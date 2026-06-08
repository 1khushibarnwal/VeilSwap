import { arbitrumSepolia } from "wagmi/chains";

export const CHAIN = arbitrumSepolia;

export const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ??
  "0xa8A54c94587627cf4030e1Bf6C812B8dB791059A";

export const WETH_ADDRESS =
  (process.env.NEXT_PUBLIC_WETH_ADDRESS as `0x${string}`) ??
  "0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650";

export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ??
  "0xB8101132fa8a75d996476327EF56F5e5d7be40A0";

export const POOL_ADDRESS =
  (process.env.NEXT_PUBLIC_POOL_ADDRESS as `0x${string}`) ??
  "0x280A26995FD0C7885F24c7CBa7237DF45a37aE72";

export const TOKENS = [
  { symbol: "mWETH", address: WETH_ADDRESS, decimals: 18, name: "Mock WETH" },
  { symbol: "mUSDC", address: USDC_ADDRESS, decimals: 6,  name: "Mock USDC" },
] as const;

export const REGISTRY_ABI = [
  { type: "function", name: "submitIntent",
    inputs: [{ name: "_commitmentHash", type: "bytes32" }, { name: "_expiry", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "revealIntent",
    inputs: [
      { name: "intentId",     type: "uint256" },
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "targetPrice",  type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "greaterThan",  type: "bool"    },
      { name: "secret",       type: "bytes32" },
    ],
    outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "depositIntentFunds",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "executeIntent",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "cancelIntent",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getIntent",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "user",           type: "address" },
      { name: "tokenIn",        type: "address" },
      { name: "tokenOut",       type: "address" },
      { name: "amountIn",       type: "uint256" },
      { name: "targetPrice",    type: "uint256" },
      { name: "minAmountOut",   type: "uint256" },
      { name: "greaterThan",    type: "bool"    },
      { name: "expiry",         type: "uint256" },
      { name: "commitmentHash", type: "bytes32" },
      { name: "revealed",       type: "bool"    },
      { name: "executed",       type: "bool"    },
      { name: "deposited",      type: "bool"    },
      { name: "cancelled",      type: "bool"    },
    ]}],
    stateMutability: "view" },
  { type: "function", name: "nextIntentId",
    inputs: [], outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" },
  { type: "function", name: "tokenPairPool",
    inputs: [{ name: "", type: "address" }, { name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view" },
  { type: "event", name: "IntentSubmitted",
    inputs: [{ name: "intentId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }] },
  { type: "event", name: "IntentRevealed",
    inputs: [{ name: "intentId", type: "uint256", indexed: true }] },
  { type: "event", name: "FundsDeposited",
    inputs: [{ name: "id", type: "uint256", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "IntentExecuted",
    inputs: [{ name: "intentId", type: "uint256", indexed: true }, { name: "twapPrice", type: "uint256", indexed: false }] },
  { type: "event", name: "IntentCancelled",
    inputs: [{ name: "intentId", type: "uint256", indexed: true }] },
  { type: "error", name: "IntentRegistry__ExpiryPassed",                  inputs: [] },
  { type: "error", name: "IntentRegistry__NotIntentOwner",                inputs: [] },
  { type: "error", name: "IntentRegistry__AlreadyRevealed",               inputs: [] },
  { type: "error", name: "IntentRegistry__RevealHashMismatch",            inputs: [] },
  { type: "error", name: "IntentRegistry__IntentNotRevealed",             inputs: [] },
  { type: "error", name: "IntentRegistry__AlreadyExecuted",               inputs: [] },
  { type: "error", name: "IntentRegistry__IntentExpired",                 inputs: [] },
  { type: "error", name: "IntentRegistry__PriceConditionNotMet",          inputs: [] },
  { type: "error", name: "IntentRegistry__TransferInDepositIntentFailed", inputs: [] },
  { type: "error", name: "IntentRegistry__AlreadyDeposited",              inputs: [] },
  { type: "error", name: "IntentRegistry__AlreadyCancelled",              inputs: [] },
  { type: "error", name: "IntentRegistry__IntentAlreadyExecuted",         inputs: [] },
  { type: "error", name: "IntentRegistry__NotYetExpired",                 inputs: [] },
  { type: "error", name: "IntentRegistry__CancelTransferFailed",          inputs: [] },
  { type: "error", name: "IntentRegistry__PoolNotRegistered",             inputs: [] },
  { type: "error", name: "IntentRegistry__NotContractOwner",              inputs: [] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "allowance",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;
