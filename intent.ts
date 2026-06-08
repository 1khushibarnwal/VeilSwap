import { keccak256, encodePacked, type Address } from "viem";

// ── Types ────────────────────────────────────────────────────────────────────

export interface IntentParams {
  user:         Address;
  tokenIn:      Address;
  tokenOut:     Address;
  amountIn:     bigint;
  targetPrice:  bigint;
  minAmountOut: bigint;
  greaterThan:  boolean;
  expiry:       bigint;
  secret:       `0x${string}`;
}

export type IntentStatus =
  | "submitted"
  | "revealed"
  | "ready"
  | "executed"
  | "cancelled"
  | "expired";

// ── Hash building ─────────────────────────────────────────────────────────────
// Mirrors exactly: keccak256(abi.encodePacked(user, tokenIn, tokenOut,
//   amountIn, targetPrice, minAmountOut, greaterThan, expiry, secret))

export function buildCommitmentHash(p: IntentParams): `0x${string}` {
  return keccak256(
    encodePacked(
      ["address","address","address","uint256","uint256","uint256","bool","uint256","bytes32"],
      [p.user, p.tokenIn, p.tokenOut, p.amountIn, p.targetPrice, p.minAmountOut, p.greaterThan, p.expiry, p.secret]
    )
  );
}

export function deriveSecret(passphrase: string): `0x${string}` {
  return keccak256(encodePacked(["string"], [passphrase]));
}

// ── Status derivation ─────────────────────────────────────────────────────────

export function deriveStatus(intent: {
  revealed: boolean; deposited: boolean;
  executed: boolean; cancelled: boolean; expiry: bigint;
}): IntentStatus {
  if (intent.executed)  return "executed";
  if (intent.cancelled) return "cancelled";
  if (intent.expiry < BigInt(Math.floor(Date.now() / 1000))) return "expired";
  if (intent.revealed && intent.deposited) return "ready";
  if (intent.revealed) return "revealed";
  return "submitted";
}

export const STATUS_LABEL: Record<IntentStatus, string> = {
  submitted: "Submitted",
  revealed:  "Revealed",
  ready:     "Awaiting price",
  executed:  "Executed",
  cancelled: "Cancelled",
  expired:   "Expired",
};

export const STATUS_BADGE: Record<IntentStatus, string> = {
  submitted: "badge-submitted",
  revealed:  "badge-revealed",
  ready:     "badge-ready",
  executed:  "badge-executed",
  cancelled: "badge-cancelled",
  expired:   "badge-expired",
};

// ── Formatting ────────────────────────────────────────────────────────────────

export function parseAmount(value: string, decimals: number): bigint {
  if (!value || value === ".") return 0n;
  const [whole = "0", frac = ""] = value.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export function formatAmount(raw: bigint, decimals: number, precision = 4): string {
  const divisor = 10n ** BigInt(decimals);
  const whole   = raw / divisor;
  const frac    = (raw % divisor).toString().padStart(decimals, "0").slice(0, precision);
  return `${whole}.${frac}`;
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

export function formatExpiry(expiry: bigint): string {
  const date = new Date(Number(expiry) * 1000);
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function timeUntil(expiry: bigint): string {
  const diff = Number(expiry) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}
