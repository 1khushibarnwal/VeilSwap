"use client";

import { useWriteContract } from "wagmi";

import IntentRegistryABI from "@/lib/abi/IntentRegistry.json";

import { CONTRACTS } from "@/lib/contracts";

export function useRevealIntent() {
  const {
    writeContractAsync,
    isPending,
  } = useWriteContract();

  async function revealIntent(
    intentId: bigint,
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint,
    targetPrice: bigint,
    minAmountOut: bigint,
    greaterThan: boolean,
    secret: `0x${string}`
  ) {
    return await writeContractAsync({
      address:
        CONTRACTS.INTENT_REGISTRY as `0x${string}`,

      abi: IntentRegistryABI,

      functionName:
        "revealIntent",

      args: [
        intentId,
        tokenIn,
        tokenOut,
        amountIn,
        targetPrice,
        minAmountOut,
        greaterThan,
        secret,
      ],

      maxFeePerGas: BigInt(50000000),
      maxPriorityFeePerGas: BigInt(2000000),
    });
  }

  return {
    revealIntent,
    isPending,
  };
}