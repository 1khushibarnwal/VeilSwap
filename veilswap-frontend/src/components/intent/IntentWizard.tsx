"use client";
import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import toast from "react-hot-toast";
import { Sparkles, PenLine, ChevronRight, ChevronLeft, Eye, EyeOff, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import {
  buildCommitmentHash, deriveSecret,
  parseAmount, formatAmount, shortenAddress,
} from "@/lib/intent";
import {
  REGISTRY_ADDRESS, REGISTRY_ABI, ERC20_ABI,
  WETH_ADDRESS, USDC_ADDRESS, TOKENS,
} from "@/lib/constants";

// ── Step types ────────────────────────────────────────────────────────────────
type Step = "input" | "confirm" | "submit" | "reveal" | "deposit" | "done";

interface FormState {
  tokenIn:      string;
  tokenOut:     string;
  amountIn:     string;
  targetPrice:  string;
  minAmountOut: string;
  greaterThan:  boolean;
  expiryHours:  string;
  passphrase:   string;
}

const DEFAULT_FORM: FormState = {
  tokenIn:      WETH_ADDRESS,
  tokenOut:     USDC_ADDRESS,
  amountIn:     "",
  targetPrice:  "",
  minAmountOut: "",
  greaterThan:  true,
  expiryHours:  "48",
  passphrase:   "",
};

const STEPS: { id: Step; label: string }[] = [
  { id: "input",   label: "Parameters" },
  { id: "confirm", label: "Review"     },
  { id: "submit",  label: "Commit"     },
  { id: "reveal",  label: "Reveal"     },
  { id: "deposit", label: "Deposit"    },
  { id: "done",    label: "Done"       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function tokenSymbol(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.symbol ?? addr.slice(0, 6);
}
function tokenDecimals(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntentWizard() {
  const { address, isConnected } = useAccount();

  const [step,       setStep]       = useState<Step>("input");
  const [form,       setForm]       = useState<FormState>(DEFAULT_FORM);
  const [aiPrompt,   setAiPrompt]   = useState("");
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiError,    setAiError]    = useState("");
  const [mode,       setMode]       = useState<"ai" | "manual">("ai");
  const [showPass,   setShowPass]   = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [intentId,   setIntentId]   = useState<bigint | null>(null);
  const [secret,     setSecret]     = useState<`0x${string}` | null>(null);
  const [commitHash, setCommitHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync } = useWriteContract();

  // ── Next intent ID from chain ──────────────────────────────────────────────
  const { data: nextId } = useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: "nextIntentId",
  });

  // ── AI parse ──────────────────────────────────────────────────────────────
  const handleAiParse = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res  = await fetch("/api/parse-intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (data.error) { setAiError(data.error); return; }

      setForm(f => ({
        ...f,
        tokenIn:      data.tokenIn      ?? f.tokenIn,
        tokenOut:     data.tokenOut     ?? f.tokenOut,
        amountIn:     data.amountIn     ?? f.amountIn,
        targetPrice:  data.targetPrice  ?? f.targetPrice,
        minAmountOut: data.minAmountOut ?? f.minAmountOut,
        greaterThan:  data.greaterThan  ?? f.greaterThan,
        expiryHours:  String(data.expiryHours ?? f.expiryHours),
      }));
      toast.success("Intent parsed — review the fields below");
      setMode("manual"); // switch to form to let user review/adjust
    } catch {
      setAiError("Failed to reach the parser. Check your connection.");
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt]);

  // ── Build derived values ───────────────────────────────────────────────────
  function buildDerived() {
    if (!address) return null;
    const expiry    = BigInt(Math.floor(Date.now() / 1000)) + BigInt(Number(form.expiryHours) * 3600);
    const inDec     = tokenDecimals(form.tokenIn);
    const outDec    = tokenDecimals(form.tokenOut);
    const amountIn  = parseAmount(form.amountIn,     inDec);
    const target    = parseAmount(form.targetPrice,  outDec);
    const minOut    = parseAmount(form.minAmountOut, outDec);
    const sec       = deriveSecret(form.passphrase + address + Date.now());
    const hash      = buildCommitmentHash({
      user: address, tokenIn: form.tokenIn as `0x${string}`,
      tokenOut: form.tokenOut as `0x${string}`,
      amountIn: amountIn, targetPrice: target, minAmountOut: minOut,
      greaterThan: form.greaterThan, expiry, secret: sec,
    });
    return { expiry, amountIn, target, minOut, sec, hash };
  }

  // ── Submit (commit phase) ─────────────────────────────────────────────────
  async function handleSubmit() {
    if (!address) return;
    const d = buildDerived();
    if (!d) return;
    try {
      const id = nextId ?? 0n;
      const tx = await writeContractAsync({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "submitIntent",
        args:         [d.hash, d.expiry],
      });
      toast.success("Commitment submitted!");
      setSecret(d.sec);
      setCommitHash(d.hash);
      setIntentId(id);
      setStep("reveal");
    } catch (e: any) {
      toast.error(e?.shortMessage ?? "Transaction failed");
    }
  }

  // ── Reveal ────────────────────────────────────────────────────────────────
  async function handleReveal() {
    if (!address || intentId === null || !secret) return;
    const d = buildDerived();
    if (!d) return;
    try {
      await writeContractAsync({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "revealIntent",
        args: [
          intentId,
          form.tokenIn  as `0x${string}`,
          form.tokenOut as `0x${string}`,
          d.amountIn, d.target, d.minOut,
          form.greaterThan, secret,
        ],
      });
      toast.success("Intent revealed!");
      setStep("deposit");
    } catch (e: any) {
      toast.error(e?.shortMessage ?? "Reveal failed");
    }
  }

  // ── Deposit ───────────────────────────────────────────────────────────────
  async function handleDeposit() {
    if (!address || intentId === null) return;
    const d = buildDerived();
    if (!d) return;
    try {
      // Approve first
      await writeContractAsync({
        address:      form.tokenIn as `0x${string}`,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [REGISTRY_ADDRESS, d.amountIn],
      });
      toast.success("Token approved");
      // Then deposit
      await writeContractAsync({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "depositIntentFunds",
        args:         [intentId],
      });
      toast.success("Funds deposited — intent is live!");
      setStep("done");
    } catch (e: any) {
      toast.error(e?.shortMessage ?? "Deposit failed");
    }
  }

  // ── Clipboard copy ────────────────────────────────────────────────────────
  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Step index ────────────────────────────────────────────────────────────
  const stepIdx = STEPS.findIndex(s => s.id === step);

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: "20px", fontWeight: 600, color: "var(--cream)", marginBottom: "12px" }}>
          Connect your wallet
        </div>
        <p style={{ color: "var(--slate)", fontSize: "14px" }}>
          You need a connected wallet to create intents.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "36px" }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width:        "28px", height: "28px",
                borderRadius: "50%",
                display:      "flex", alignItems: "center", justifyContent: "center",
                fontFamily:   "DM Mono, monospace", fontSize: "11px", fontWeight: 500,
                background:   i < stepIdx ? "var(--jade)" : i === stepIdx ? "var(--amber)" : "var(--ink-2)",
                color:        i <= stepIdx ? "var(--ink)" : "var(--slate)",
                border:       i === stepIdx ? "2px solid var(--amber-l)" : "1px solid var(--border)",
                flexShrink:   0,
                transition:   "background 0.3s",
              }}>
                {i < stepIdx ? <Check size={12} /> : i + 1}
              </div>
              <span style={{ fontSize: "10px", color: i === stepIdx ? "var(--amber)" : "var(--slate-dim)", fontFamily: "DM Mono, monospace", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: "1px", background: i < stepIdx ? "var(--jade)" : "var(--border)", margin: "0 4px 18px" }} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP: input ───────────────────────────────────────────────────── */}
      {step === "input" && (
        <div className="card" style={{ padding: "28px" }}>

          {/* Mode toggle */}
          <div style={{ display: "flex", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", marginBottom: "24px" }}>
            {(["ai", "manual"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex:       1, padding: "9px",
                  background: mode === m ? "var(--ink-3)" : "transparent",
                  border:     "none", cursor: "pointer",
                  color:      mode === m ? "var(--cream)" : "var(--slate)",
                  fontFamily: "Syne, sans-serif", fontSize: "13px", fontWeight: 500,
                  display:    "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  transition: "background 0.15s",
                }}
              >
                {m === "ai" ? <><Sparkles size={13} /> AI Parser</> : <><PenLine size={13} /> Manual</>}
              </button>
            ))}
          </div>

          {/* AI mode */}
          {mode === "ai" && (
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "var(--slate)", fontFamily: "DM Mono, monospace", marginBottom: "8px", letterSpacing: "0.04em" }}>
                DESCRIBE YOUR TRADE
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder='e.g. "sell 1 mWETH if the price hits $4200 within 48 hours"'
                rows={3}
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "var(--ink-2)", border: "1px solid var(--border-2)",
                  borderRadius: "8px", color: "var(--cream)", resize: "vertical",
                  fontFamily: "DM Sans, sans-serif", fontSize: "14px", outline: "none",
                  lineHeight: 1.6,
                }}
                onFocus={e  => { e.currentTarget.style.borderColor = "var(--amber)"; }}
                onBlur={e   => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleAiParse(); }}
              />
              {aiError && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", color: "var(--rose)", fontSize: "12px" }}>
                  <AlertCircle size={12} /> {aiError}
                </div>
              )}
              <button
                onClick={handleAiParse}
                disabled={aiLoading || !aiPrompt.trim()}
                className="btn-primary"
                style={{ marginTop: "12px", width: "100%", padding: "11px" }}
              >
                {aiLoading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Parsing…</> : <><Sparkles size={14} /> Parse intent</>}
              </button>
            </div>
          )}

          {/* Manual / review form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {mode === "manual" && (
              <p style={{ fontSize: "12px", color: "var(--slate)", fontFamily: "DM Mono, monospace", letterSpacing: "0.04em" }}>
                MANUAL PARAMETERS
              </p>
            )}
            {mode === "ai" && (
              <p style={{ fontSize: "12px", color: "var(--slate)", fontFamily: "DM Mono, monospace", letterSpacing: "0.04em" }}>
                ADJUST IF NEEDED
              </p>
            )}

            {/* Token pair */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>TOKEN IN</label>
                <select className="input" value={form.tokenIn} onChange={e => setForm(f => ({ ...f, tokenIn: e.target.value }))}>
                  {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>TOKEN OUT</label>
                <select className="input" value={form.tokenOut} onChange={e => setForm(f => ({ ...f, tokenOut: e.target.value }))}>
                  {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>
                AMOUNT IN ({tokenSymbol(form.tokenIn)})
              </label>
              <input className="input" type="number" placeholder="1.0" value={form.amountIn} onChange={e => setForm(f => ({ ...f, amountIn: e.target.value }))} />
            </div>

            {/* Price condition */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>CONDITION</label>
                <select className="input" style={{ width: "auto" }} value={form.greaterThan ? "gte" : "lte"} onChange={e => setForm(f => ({ ...f, greaterThan: e.target.value === "gte" }))}>
                  <option value="gte">Price ≥</option>
                  <option value="lte">Price ≤</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  TARGET PRICE ({tokenSymbol(form.tokenOut)} per {tokenSymbol(form.tokenIn)})
                </label>
                <input className="input" type="number" placeholder="4200" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))} />
              </div>
            </div>

            {/* Min out */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>
                MIN AMOUNT OUT ({tokenSymbol(form.tokenOut)}) — slippage floor
              </label>
              <input className="input" type="number" placeholder="3990" value={form.minAmountOut} onChange={e => setForm(f => ({ ...f, minAmountOut: e.target.value }))} />
            </div>

            {/* Expiry */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>EXPIRY (HOURS)</label>
              <input className="input" type="number" placeholder="48" value={form.expiryHours} onChange={e => setForm(f => ({ ...f, expiryHours: e.target.value }))} />
            </div>

            {/* Secret passphrase */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", marginBottom: "6px", letterSpacing: "0.05em" }}>SECRET PHRASE — save this, needed for reveal</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder="anything memorable — kept private"
                  value={form.passphrase}
                  onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
                  style={{ paddingRight: "42px" }}
                />
                <button
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--slate)", padding: "2px" }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ marginTop: "4px", width: "100%", padding: "12px" }}
              disabled={!form.amountIn || !form.targetPrice || !form.minAmountOut || !form.passphrase}
              onClick={() => setStep("confirm")}
            >
              Review intent <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: confirm ─────────────────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="card" style={{ padding: "28px" }}>
          <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 700, color: "var(--cream)", marginBottom: "4px" }}>
            Review your intent
          </h3>
          <p style={{ fontSize: "13px", color: "var(--slate)", marginBottom: "24px" }}>
            Once submitted, the hash is on-chain. Details stay hidden until you reveal.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { l: "Sell",       v: `${form.amountIn} ${tokenSymbol(form.tokenIn)}`  },
              { l: "For",        v: tokenSymbol(form.tokenOut)                        },
              { l: "Condition",  v: `Price ${form.greaterThan ? "≥" : "≤"} ${form.targetPrice} ${tokenSymbol(form.tokenOut)}` },
              { l: "Min output", v: `${form.minAmountOut} ${tokenSymbol(form.tokenOut)}`},
              { l: "Expires in", v: `${form.expiryHours} hours`                       },
              { l: "Your wallet",v: shortenAddress(address ?? "")                     },
            ].map((row, i, arr) => (
              <div key={row.l} style={{
                display:       "flex", justifyContent: "space-between", alignItems: "center",
                padding:       "13px 0",
                borderBottom:  i < arr.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <span style={{ fontSize: "13px", color: "var(--slate)" }}>{row.l}</span>
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: "13px", color: "var(--cream)", fontWeight: 500 }}>{row.v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "24px", padding: "12px 14px", background: "rgba(200,146,58,0.07)", border: "1px solid rgba(200,146,58,0.18)", borderRadius: "8px", fontSize: "12px", color: "var(--amber-l)", lineHeight: 1.6 }}>
            ⚠ Your secret phrase will be hashed and committed on-chain. Keep the original — you need it to reveal.
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep("input")}>
              <ChevronLeft size={14} /> Edit
            </button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => setStep("submit")}>
              Commit intent <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: submit ──────────────────────────────────────────────────── */}
      {step === "submit" && (
        <div className="card" style={{ padding: "28px", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(200,146,58,0.1)", border: "1px solid rgba(200,146,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--amber)" }}>
            <Lock size={22} />
          </div>
          <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 700, color: "var(--cream)", marginBottom: "10px" }}>
            Submit commitment
          </h3>
          <p style={{ fontSize: "13px", color: "var(--slate)", lineHeight: 1.6, marginBottom: "8px" }}>
            This transaction stores only a cryptographic hash of your intent. No trading details are visible on-chain yet.
          </p>
          <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--slate-dim)", marginBottom: "28px" }}>
            keccak256(user ∥ tokenIn ∥ tokenOut ∥ amountIn ∥ … ∥ secret)
          </p>
          <button className="btn-primary" style={{ width: "100%", padding: "13px" }} onClick={handleSubmit}>
            Submit on-chain <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── STEP: reveal ──────────────────────────────────────────────────── */}
      {step === "reveal" && (
        <div className="card" style={{ padding: "28px" }}>
          <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 700, color: "var(--cream)", marginBottom: "8px" }}>
            Reveal your intent
          </h3>
          <p style={{ fontSize: "13px", color: "var(--slate)", lineHeight: 1.6, marginBottom: "20px" }}>
            Intent <span style={{ fontFamily: "DM Mono, monospace", color: "var(--amber)" }}>#{intentId?.toString()}</span> is committed. Now reveal the parameters so the protocol can verify them.
          </p>

          {/* Secret display */}
          <div style={{ padding: "14px", background: "var(--ink-2)", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--slate)", letterSpacing: "0.05em" }}>YOUR SECRET (bytes32)</span>
              <button onClick={copySecret} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--slate)", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                {copied ? <><Check size={11} color="var(--jade)" /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--cream)", wordBreak: "break-all", lineHeight: 1.6 }}>
              {secret}
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "rgba(196,82,82,0.06)", border: "1px solid rgba(196,82,82,0.2)", borderRadius: "8px", fontSize: "12px", color: "#e08080", marginBottom: "20px" }}>
            Save your secret before proceeding. It cannot be recovered if lost.
          </div>

          <button className="btn-primary" style={{ width: "100%", padding: "13px" }} onClick={handleReveal}>
            Reveal intent <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── STEP: deposit ─────────────────────────────────────────────────── */}
      {step === "deposit" && (
        <div className="card" style={{ padding: "28px", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(58,158,122,0.1)", border: "1px solid rgba(58,158,122,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--jade)" }}>
            <Zap size={22} />
          </div>
          <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 700, color: "var(--cream)", marginBottom: "10px" }}>
            Deposit funds
          </h3>
          <p style={{ fontSize: "13px", color: "var(--slate)", lineHeight: 1.6, marginBottom: "8px" }}>
            Lock <span style={{ fontFamily: "DM Mono, monospace", color: "var(--cream)" }}>{form.amountIn} {tokenSymbol(form.tokenIn)}</span> into the registry. The keeper will execute when the price condition is met.
          </p>
          <p style={{ fontSize: "12px", color: "var(--slate-dim)", marginBottom: "28px" }}>
            Two transactions: approve → deposit.
          </p>
          <button className="btn-primary" style={{ width: "100%", padding: "13px" }} onClick={handleDeposit}>
            Approve & Deposit <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── STEP: done ────────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="card" style={{ padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: "44px", marginBottom: "16px" }}>✓</div>
          <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--jade)", marginBottom: "10px" }}>
            Intent is live
          </h3>
          <p style={{ fontSize: "14px", color: "var(--slate)", lineHeight: 1.65, marginBottom: "8px" }}>
            Intent <span style={{ fontFamily: "DM Mono, monospace", color: "var(--cream)" }}>#{intentId?.toString()}</span> is active.
            The keeper monitors the Uniswap V3 TWAP every 15 seconds and executes when your price condition is met.
          </p>
          <p style={{ fontSize: "13px", color: "var(--slate-dim)", marginBottom: "32px" }}>
            You can cancel and recover funds any time after expiry from the Dashboard.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <a href="/dashboard" className="btn-primary">View Dashboard</a>
            <button className="btn-ghost" onClick={() => { setStep("input"); setForm(DEFAULT_FORM); setIntentId(null); setSecret(null); }}>
              New Intent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
