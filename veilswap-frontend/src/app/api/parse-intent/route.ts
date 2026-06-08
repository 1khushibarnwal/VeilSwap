import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `You are a DeFi intent parser for VeilSwap — a commit-reveal, TWAP-gated limit order protocol.

Token addresses (Arbitrum Sepolia):
  mWETH = 0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650  (18 decimals)
  mUSDC = 0xB8101132fa8a75d996476327EF56F5e5d7be40A0  (6 decimals)

Rules:
1. "sell WETH if price > X" → tokenIn=mWETH, tokenOut=mUSDC, greaterThan=true
2. "buy WETH if price < X"  → tokenIn=mUSDC, tokenOut=mWETH, greaterThan=false
3. targetPrice expressed as: how many tokenOut units per 1 tokenIn (human readable)
4. amountIn = human-readable amount of tokenIn
5. minAmountOut = 95% of expected output (5% slippage) unless user specifies
6. expiryHours from user input ("48 hours", "2 days" = 48h, "1 week" = 168h)

Respond with ONLY this JSON — no markdown, no explanation:
{
  "tokenIn":        "0x...",
  "tokenOut":       "0x...",
  "tokenInSymbol":  "mWETH",
  "tokenOutSymbol": "mUSDC",
  "amountIn":       "1.5",
  "targetPrice":    "4200",
  "minAmountOut":   "3990",
  "greaterThan":    true,
  "expiryHours":    48,
  "summary":        "Sell 1.5 mWETH when price ≥ $4,200 within 48h"
}

If unparseable: { "error": "reason" }`;

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const prompt = (body.prompt ?? "").trim();

  if (prompt.length < 5)
    return NextResponse.json({ error: "Prompt too short" }, { status: 400 });

  if (!process.env.GROQ_API_KEY)
    return NextResponse.json({ error: "GROQ_API_KEY not set on server" }, { status: 500 });

  try {
    const chat = await groq.chat.completions.create({
      model:       "llama3-8b-8192",
      temperature: 0.1,
      max_tokens:  400,
      messages: [
        { role: "system", content: SYSTEM  },
        { role: "user",   content: prompt  },
      ],
    });

    const raw     = chat.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed  = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[parse-intent]", err?.message);
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
