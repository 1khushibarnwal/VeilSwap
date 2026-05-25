// src/indexer/indexer.ts
//
// Polls the chain in block-range chunks, processes every IntentRegistry event,
// and writes/updates the `Intent` table.  On restart it resumes from the last
// indexed block stored in `IndexerState`.

import { parseAbiItem, type Log } from "viem";
import { prisma } from "../db/client";
import {
  publicClient,
  CONTRACT_ADDRESS,
  INTENT_REGISTRY_ABI,
} from "../utils/client";
import { logger } from "../utils/logger";

const CHUNK = BigInt(process.env.INDEXER_BLOCK_CHUNK ?? "2000");
const POLL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? "5000");

// Fall back to INDEXER_START_BLOCK (the newer env var) or INTENT_REGISTRY_DEPLOY_BLOCK
// for backwards compatibility, defaulting to 0.
const DEPLOY_BLOCK = BigInt(
  process.env.INDEXER_START_BLOCK ??
    process.env.INTENT_REGISTRY_DEPLOY_BLOCK ??
    "0",
);

const RPC_TIMEOUT_MS = 10_000; // 10 seconds — surfaces hangs as errors

// ── Event ABI items for getLogs ───────────────────────────────────────────────
const EV_SUBMITTED = parseAbiItem(
  "event IntentSubmitted(uint256 indexed intentId, address indexed user)",
);
const EV_REVEALED = parseAbiItem(
  "event IntentRevealed(uint256 indexed intentId)",
);
const EV_DEPOSITED = parseAbiItem(
  "event FundsDeposited(uint256 indexed id, uint256 amount)",
);
const EV_EXECUTED = parseAbiItem(
  "event IntentExecuted(uint256 indexed intentId, uint256 twapPrice)",
);
const EV_CANCELLED = parseAbiItem(
  "event IntentCancelled(uint256 indexed intentId)",
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wraps a promise with a hard timeout so hangs surface as errors. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[indexer] "${label}" timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

async function getLastIndexedBlock(): Promise<bigint> {
  const state = await prisma.indexerState.findUnique({ where: { id: 1 } });
  return state?.lastIndexedBlock ?? DEPLOY_BLOCK;
}

async function saveLastIndexedBlock(block: bigint): Promise<void> {
  await prisma.indexerState.upsert({
    where: { id: 1 },
    update: { lastIndexedBlock: block },
    create: { id: 1, lastIndexedBlock: block },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubmitted(
  log: Log<bigint, number, false, typeof EV_SUBMITTED>,
) {
  const intentId = log.args.intentId!;
  const user = log.args.user!;

  const onChain = await withTimeout(
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: INTENT_REGISTRY_ABI,
      functionName: "getIntent",
      args: [intentId],
    }),
    RPC_TIMEOUT_MS,
    "getIntent(submitted)",
  );

  await prisma.intent.upsert({
    where: { intentId },
    update: {},
    create: {
      intentId,
      user: user.toLowerCase(),
      commitmentHash: onChain.commitmentHash,
      expiry: onChain.expiry,
      blockNumber: log.blockNumber!,
      txHash: log.transactionHash!,
    },
  });

  logger.info("IntentSubmitted indexed", {
    intentId: intentId.toString(),
    user,
  });
}

async function handleRevealed(
  log: Log<bigint, number, false, typeof EV_REVEALED>,
) {
  const intentId = log.args.intentId!;

  const onChain = await withTimeout(
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: INTENT_REGISTRY_ABI,
      functionName: "getIntent",
      args: [intentId],
    }),
    RPC_TIMEOUT_MS,
    "getIntent(revealed)",
  );

  await prisma.intent.update({
    where: { intentId },
    data: {
      tokenIn: onChain.tokenIn.toLowerCase(),
      tokenOut: onChain.tokenOut.toLowerCase(),
      amountIn: onChain.amountIn.toString(),
      targetPrice: onChain.targetPrice.toString(),
      minAmountOut: onChain.minAmountOut.toString(),
      greaterThan: onChain.greaterThan,
      revealed: true,
    },
  });

  logger.info("IntentRevealed indexed", { intentId: intentId.toString() });
}

async function handleDeposited(
  log: Log<bigint, number, false, typeof EV_DEPOSITED>,
) {
  const intentId = log.args.id!;

  await prisma.intent.update({
    where: { intentId },
    data: { deposited: true },
  });

  logger.info("FundsDeposited indexed", { intentId: intentId.toString() });
}

async function handleExecuted(
  log: Log<bigint, number, false, typeof EV_EXECUTED>,
) {
  const intentId = log.args.intentId!;
  const twapPrice = log.args.twapPrice!;

  await prisma.intent.update({
    where: { intentId },
    data: {
      executed: true,
      executedTxHash: log.transactionHash!,
      executedBlock: log.blockNumber!,
      twapPriceAtExec: twapPrice.toString(),
    },
  });

  logger.info("IntentExecuted indexed", {
    intentId: intentId.toString(),
    twapPrice: twapPrice.toString(),
  });
}

async function handleCancelled(
  log: Log<bigint, number, false, typeof EV_CANCELLED>,
) {
  const intentId = log.args.intentId!;

  await prisma.intent.update({
    where: { intentId },
    data: {
      cancelled: true,
      cancelledTxHash: log.transactionHash!,
      cancelledBlock: log.blockNumber!,
    },
  });

  logger.info("IntentCancelled indexed", { intentId: intentId.toString() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core indexing loop
// ─────────────────────────────────────────────────────────────────────────────

async function indexChunk(from: bigint, to: bigint): Promise<void> {
  logger.debug("Indexing block chunk", {
    from: from.toString(),
    to: to.toString(),
  });

  const [submitted, revealed, deposited, executed, cancelled] =
    await withTimeout(
      Promise.all([
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EV_SUBMITTED,
          fromBlock: from,
          toBlock: to,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EV_REVEALED,
          fromBlock: from,
          toBlock: to,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EV_DEPOSITED,
          fromBlock: from,
          toBlock: to,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EV_EXECUTED,
          fromBlock: from,
          toBlock: to,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EV_CANCELLED,
          fromBlock: from,
          toBlock: to,
        }),
      ]),
      RPC_TIMEOUT_MS,
      `getLogs(${from}-${to})`,
    );

  type AnyLog =
    | (typeof submitted)[number]
    | (typeof revealed)[number]
    | (typeof deposited)[number]
    | (typeof executed)[number]
    | (typeof cancelled)[number];

  const allLogs: Array<{ log: AnyLog; type: string }> = [
    ...submitted.map((l) => ({ log: l, type: "submitted" })),
    ...revealed.map((l) => ({ log: l, type: "revealed" })),
    ...deposited.map((l) => ({ log: l, type: "deposited" })),
    ...executed.map((l) => ({ log: l, type: "executed" })),
    ...cancelled.map((l) => ({ log: l, type: "cancelled" })),
  ].sort((a, b) => {
    const blockDiff = Number(a.log.blockNumber! - b.log.blockNumber!);
    if (blockDiff !== 0) return blockDiff;
    return Number(a.log.logIndex! - b.log.logIndex!);
  });

  for (const { log, type } of allLogs) {
    try {
      switch (type) {
        case "submitted":
          await handleSubmitted(log as (typeof submitted)[number]);
          break;
        case "revealed":
          await handleRevealed(log as (typeof revealed)[number]);
          break;
        case "deposited":
          await handleDeposited(log as (typeof deposited)[number]);
          break;
        case "executed":
          await handleExecuted(log as (typeof executed)[number]);
          break;
        case "cancelled":
          await handleCancelled(log as (typeof cancelled)[number]);
          break;
      }
    } catch (err) {
      logger.error("Failed to handle event", {
        type,
        txHash: log.transactionHash,
        err,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: start the indexer polling loop
// ─────────────────────────────────────────────────────────────────────────────

export async function startIndexer(): Promise<void> {
  logger.info("Starting indexer...");

  const poll = async () => {
    try {
      logger.debug("Indexer poll: fetching latest block...");

      logger.info("Indexer poll: fetching latest block...");
      const latestBlock = await Promise.race([
        publicClient.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("getBlockNumber timed out")),
            10_000,
          ),
        ),
      ]);
      logger.info("Indexer poll: latest block fetched", {
        latestBlock: latestBlock.toString(),
      });

      logger.debug("Indexer poll: latest block fetched", {
        latestBlock: latestBlock.toString(),
      });

      const lastProcessed = await getLastIndexedBlock();

      if (lastProcessed >= latestBlock) {
        logger.debug("Indexer is up to date", {
          block: latestBlock.toString(),
        });
        return;
      }

      let from = lastProcessed + 1n;

      while (from <= latestBlock) {
        const to =
          from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
        await indexChunk(from, to);
        await saveLastIndexedBlock(to);
        from = to + 1n;
      }
    } catch (err) {
      logger.error("Indexer poll error", { err });
    }
  };

  await poll();
  setInterval(poll, POLL_MS);
}
