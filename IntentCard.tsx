"use client";
import { useState } from "react";
import { useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, X, Zap, Clock } from "lucide-react";
import {
  deriveStatus, STATUS_LABEL, STATUS_BADGE,
  formatAmount, shortenAddress, formatExpiry, timeUntil,
} from "@/lib/intent";
import { REGISTRY_ADDRESS, REGISTRY_ABI, TOKENS } from "@/lib/constants";

export interface IntentData {
  intentId:     bigint;
  user:         string;
  tokenIn:      string;
  tokenOut:     string;
  amountIn:     bigint;
  targetPrice:  bigint;
  minAmountOut: bigint;
  greaterThan:  boolean;
  expiry:       bigint;
  commitmentHash: string;
  revealed:     boolean;
  executed:     boolean;
  deposited:    boolean;
  cancelled:    boolean;
  twapPrice?:   bigint;
}

function tokenSymbol(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.symbol ?? addr.slice(0, 6);
}
function tokenDec(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18;
}

export default function IntentCard({
  intent,
  isOwner = false,
  onRefresh,
}: {
  intent:    IntentData;
  isOwner?:  boolean;
  onRefresh?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(intent);
  const { writeContractAsync } = useWriteContract();

  async function handleExecute() {
    try {
      await writeContractAsync({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "executeIntent",
        args:         [intent.intentId],
      });
      toast.success(`Intent #${intent.intentId} executed!`);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.shortMessage ?? "Execution failed");
    }
  }

  async function handleCancel() {
    try {
      await writeContractAsync({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "cancelIntent",
        args:         [intent.intentId],
      });
      toast.success(`Intent #${intent.intentId} cancelled`);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.shortMessage ?? "Cancel failed");
    }
  }

  const inSym  = tokenSymbol(intent.tokenIn);
  const outSym = tokenSymbol(intent.tokenOut);
  const inDec  = tokenDec(intent.tokenIn);
  const outDec = tokenDec(intent.tokenOut);

  return (
    <div
      className="card"
      style={{
        padding:    "0",
        overflow:   "hidden",
        transition: "border-color 0.15s",
        borderColor: status === "ready" ? "rgba(200,146,58,0.3)" : undefined,
      }}
    >
      {/* ── Top row ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "16px 18px",
          cursor:         "pointer",
          gap:            "12px",
        }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Left: ID + status */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{
            fontFamily:   "DM Mono, monospace",
            fontSize:     "12px",
            color:        "var(--slate-dim)",
            flexShrink:   0,
          }}>
            #{intent.intentId.toString()}
          </span>
          <span className={`badge ${STATUS_BADGE[status]}`}>
            {status === "ready" && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", animation: "pulse 2s infinite", flexShrink: 0 }} />}
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Middle: trade summary */}
        {intent.revealed ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", overflow: "hidden" }}>
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: "13px", color: "var(--cream)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {formatAmount(intent.amountIn, inDec, 4)} {inSym}
            </span>
            <span style={{ color: "var(--slate-dim)", fontSize: "12px" }}>
              {intent.greaterThan ? "if price ≥" : "if price ≤"}
            </span>
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: "13px", color: "var(--amber)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {formatAmount(intent.targetPrice, outDec, 2)} {outSym}
            </span>
          </div>
        ) : (
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: "12px", color: "var(--slate-dim)" }}>
              [hidden until revealed]
            </span>
          </div>
        )}

        {/* Right: expiry + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          {status !== "executed" && status !== "cancelled" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--slate-dim)", fontSize: "11px", fontFamily: "DM Mono, monospace" }}>
              <Clock size={11} />
              {timeUntil(intent.expiry)}
            </div>
          )}
          {expanded ? <ChevronUp size={14} color="var(--slate)" /> : <ChevronDown size={14} color="var(--slate)" />}
        </div>
      </div>

      {/* ── Expanded detail ──────────────────────────────────────────────── */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "0" }}>

          {intent.revealed ? (
            <>
              {[
                { l: "Token In",     v: `${inSym} — ${shortenAddress(intent.tokenIn)}`    },
                { l: "Token Out",    v: `${outSym} — ${shortenAddress(intent.tokenOut)}`   },
                { l: "Amount In",    v: `${formatAmount(intent.amountIn, inDec, 6)} ${inSym}` },
                { l: "Target Price", v: `${intent.greaterThan ? "≥" : "≤"} ${formatAmount(intent.targetPrice, outDec, 4)} ${outSym}` },
                { l: "Min Out",      v: `${formatAmount(intent.minAmountOut, outDec, 4)} ${outSym}` },
                { l: "Expiry",       v: formatExpiry(intent.expiry)                         },
                { l: "Owner",        v: shortenAddress(intent.user)                          },
              ].map((row, i, arr) => (
                <div key={row.l} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "9px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--slate)" }}>{row.l}</span>
                  <span style={{ fontFamily: "DM Mono, monospace", fontSize: "12px", color: "var(--cream)" }}>{row.v}</span>
                </div>
              ))}

              {intent.twapPrice != null && intent.twapPrice > 0n && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                  <span style={{ fontSize: "12px", color: "var(--slate)" }}>TWAP at execution</span>
                  <span style={{ fontFamily: "DM Mono, monospace", fontSize: "12px", color: "var(--jade)" }}>
                    {formatAmount(intent.twapPrice, outDec, 4)} {outSym}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "12px 0", textAlign: "center" }}>
              <span style={{ fontFamily: "DM Mono, monospace", fontSize: "12px", color: "var(--slate-dim)" }}>
                Details hidden — commitment hash only
              </span>
              <div style={{ fontFamily: "DM Mono, monospace", fontSize: "10px", color: "var(--ink-3)", marginTop: "6px", wordBreak: "break-all" }}>
                {intent.commitmentHash}
              </div>
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────────── */}
          {(status === "ready" || status === "expired") && (
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              {status === "ready" && (
                <button className="btn-primary" style={{ flex: 1, padding: "9px", fontSize: "13px" }} onClick={handleExecute}>
                  <Zap size={13} /> Execute
                </button>
              )}
              {isOwner && (status === "ready" || status === "expired") && (
                <button className="btn-danger" style={{ flex: 1, padding: "9px", fontSize: "13px" }} onClick={handleCancel}>
                  <X size={13} /> Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
