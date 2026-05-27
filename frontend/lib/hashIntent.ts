import {
  encodePacked,
  keccak256,
} from "viem";

export function hashIntent({
  user,
  tokenIn,
  tokenOut,
  amountIn,
  targetPrice,
  minAmountOut,
  greaterThan,
  expiry,
  secret,
}: {
  user: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  targetPrice: bigint;
  minAmountOut: bigint;
  greaterThan: boolean;
  expiry: bigint;
  secret: `0x${string}`;
}) {
  return keccak256(
    encodePacked(
      [
        "address",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "bool",
        "uint256",
        "bytes32",
      ],
      [
        user,
        tokenIn,
        tokenOut,
        amountIn,
        targetPrice,
        minAmountOut,
        greaterThan,
        expiry,
        secret,
      ]
    )
  );
}