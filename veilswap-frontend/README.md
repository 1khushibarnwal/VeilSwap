# VeilSwap Frontend

Next.js 14 frontend for the VeilSwap intent-based trading protocol.

## Stack

- **Framework** — Next.js 14 (App Router)
- **Wallet** — RainbowKit + wagmi + viem
- **Styling** — Tailwind CSS + custom CSS variables
- **Fonts** — Syne (headings) + DM Mono (data) + DM Sans (body)
- **AI Parser** — Groq (llama3-8b) via server-side API route
- **Chain** — Arbitrum Sepolia (421614)

## Pages

| Route        | Description                                      |
|--------------|--------------------------------------------------|
| `/`          | Landing page — hero, how it works, tech stack    |
| `/app`       | Create intent — AI parser + manual form wizard   |
| `/dashboard` | Intent tracker — personal view + global record   |

## Setup

### 1. Install

```bash
cd frontend
npm install
```

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
GROQ_API_KEY=your_groq_api_key          # get free at console.groq.com
NEXT_PUBLIC_REGISTRY_ADDRESS=0xa8A54c94587627cf4030e1Bf6C812B8dB791059A
NEXT_PUBLIC_WETH_ADDRESS=0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650
NEXT_PUBLIC_USDC_ADDRESS=0xB8101132fa8a75d996476327EF56F5e5d7be40A0
NEXT_PUBLIC_POOL_ADDRESS=0x280A26995FD0C7885F24c7CBa7237DF45a37aE72
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id  # free at cloud.walletconnect.com
```

### 3. Run

```bash
npm run dev
# open http://localhost:3000
```

## Architecture notes

### AI intent parser
Natural language prompts are sent to `/api/parse-intent` (server-side Next.js route). The Groq API key never touches the browser. The route returns structured JSON that pre-fills the manual form — the user can review and adjust before proceeding.

### Commit-reveal flow
The wizard enforces the exact lifecycle required by the contract:

```
Submit (hash) → Reveal (params) → Deposit (tokens) → [keeper executes]
```

The commitment hash is built client-side using viem's `encodePacked` + `keccak256`, mirroring exactly what the Solidity contract computes in `revealIntent`.

### Dashboard
- **My Intents tab** — shows all intents owned by the connected wallet, any status
- **Global Record tab** — shows only `executed` intents across all users. Pending/cancelled intents stay private — this is intentional and preserves the protocol's MEV protection model.

## Contract addresses (Arbitrum Sepolia)

| Contract       | Address                                      |
|----------------|----------------------------------------------|
| IntentRegistry | `0xa8A54c94587627cf4030e1Bf6C812B8dB791059A` |
| MockWETH       | `0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650` |
| MockUSDC       | `0xB8101132fa8a75d996476327EF56F5e5d7be40A0` |
| Uniswap V3 Pool| `0x280A26995FD0C7885F24c7CBa7237DF45a37aE72` |
