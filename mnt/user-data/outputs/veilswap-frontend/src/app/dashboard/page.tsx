"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import Navbar     from "@/components/layout/Navbar";
import IntentCard, { type IntentData } from "@/components/intent/IntentCard";
import { deriveStatus } from "@/lib/intent";
import { REGISTRY_ADDRESS, REGISTRY_ABI } from "@/lib/constants";
import { RefreshCw, User, Globe } from "lucide-react";

type Tab = "personal" | "global";

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card-2" style={{ padding: "16px 20px" }}>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: "22px", fontWeight: 700, color: accent ? "var(--amber)" : "var(--cream)", marginBottom: "4px" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--slate)", fontFamily: "DM Mono, monospace", letterSpacing: "0.03em" }}>
        {label}
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="shimmer" style={{ height: "62px", borderRadius: "12px" }} />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", border: "1px dashed var(--border)", borderRadius: "12px" }}>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: "12px", color: "var(--slate-dim)", letterSpacing: "0.06em" }}>
        {message}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [tab,           setTab]           = useState<Tab>("personal");
  const [allIntents,    setAllIntents]    = useState<IntentData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<string>("all");

  // ── Fetch total intent count ───────────────────────────────────────────────
  const { data: nextId } = useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: "nextIntentId",
  });

  // ── Load all intents from chain ────────────────────────────────────────────
  const loadIntents = useCallback(async () => {
    if (!publicClient || !nextId) return;
    setLoading(true);
    try {
      const total = Number(nextId);
      const ids   = Array.from({ length: total }, (_, i) => BigInt(i));

      const results = await Promise.allSettled(
        ids.map(id =>
          publicClient.readContract({
            address:      REGISTRY_ADDRESS,
            abi:          REGISTRY_ABI,
            functionName: "getIntent",
            args:         [id],
          }).then((data: any) => ({ intentId: id, ...data } as IntentData))
        )
      );

      const intents = results
        .filter((r): r is PromiseFulfilledResult<IntentData> => r.status === "fulfilled")
        .map(r => r.value);

      setAllIntents(intents);
    } catch (e) {
      console.error("Failed to load intents", e);
    } finally {
      setLoading(false);
    }
  }, [publicClient, nextId]);

  useEffect(() => { loadIntents(); }, [loadIntents]);

  async function refresh() {
    setRefreshing(true);
    await loadIntents();
    setRefreshing(false);
  }

  // ── Derived sets ──────────────────────────────────────────────────────────
  const myIntents = allIntents.filter(
    i => address && i.user.toLowerCase() === address.toLowerCase()
  );

  // Global dashboard shows ONLY executed intents (post-execution = public record)
  const globalIntents = allIntents.filter(i => i.executed);

  const displayIntents = tab === "personal" ? myIntents : globalIntents;

  const filtered = statusFilter === "all"
    ? displayIntents
    : displayIntents.filter(i => deriveStatus(i) === statusFilter);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const myStats = {
    total:     myIntents.length,
    active:    myIntents.filter(i => ["ready","revealed","submitted"].includes(deriveStatus(i))).length,
    executed:  myIntents.filter(i => i.executed).length,
    cancelled: myIntents.filter(i => i.cancelled).length,
  };

  const globalStats = {
    total:    allIntents.length,
    executed: globalIntents.length,
    unique:   new Set(allIntents.map(i => i.user.toLowerCase())).size,
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "calc(100vh - 60px)", padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
                Dashboard
              </p>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(22px,3vw,32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "var(--cream)" }}>
                Intent tracker
              </h1>
            </div>
            <button
              onClick={refresh}
              className="btn-ghost"
              style={{ padding: "8px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>

          {/* Tab toggle */}
          <div style={{ display: "flex", borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden", marginBottom: "28px", width: "fit-content" }}>
            {([
              { id: "personal", label: "My Intents",    icon: <User size={13} />  },
              { id: "global",   label: "Global Record", icon: <Globe size={13} /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setStatusFilter("all"); }}
                style={{
                  padding:    "9px 18px",
                  background: tab === t.id ? "var(--ink-3)" : "transparent",
                  border:     "none",
                  cursor:     "pointer",
                  color:      tab === t.id ? "var(--cream)" : "var(--slate)",
                  fontFamily: "Syne, sans-serif",
                  fontSize:   "13px",
                  fontWeight: tab === t.id ? 600 : 400,
                  display:    "flex",
                  alignItems: "center",
                  gap:        "6px",
                  transition: "background 0.15s",
                }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Stats row */}
          {tab === "personal" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "28px" }}>
              <Stat label="Total intents"  value={myStats.total}     />
              <Stat label="Active"         value={myStats.active}    accent />
              <Stat label="Executed"       value={myStats.executed}  />
              <Stat label="Cancelled"      value={myStats.cancelled} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "28px" }}>
              <Stat label="All-time intents"  value={globalStats.total}    />
              <Stat label="Executed (public)" value={globalStats.executed} accent />
              <Stat label="Unique traders"    value={globalStats.unique}   />
            </div>
          )}

          {/* Global note */}
          {tab === "global" && (
            <div style={{ padding: "12px 16px", background: "rgba(200,146,58,0.06)", border: "1px solid rgba(200,146,58,0.15)", borderRadius: "8px", marginBottom: "20px", fontSize: "12px", color: "var(--amber)", fontFamily: "DM Mono, monospace", lineHeight: 1.55 }}>
              Only executed intents appear here. Pending and cancelled intents are private to their owners — this preserves the protocol's MEV protection model.
            </div>
          )}

          {/* Status filter */}
          {displayIntents.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {["all", "submitted", "revealed", "ready", "executed", "cancelled", "expired"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding:    "4px 12px",
                    borderRadius: "20px",
                    border:     statusFilter === s ? "1px solid rgba(200,146,58,0.4)" : "1px solid var(--border)",
                    background: statusFilter === s ? "rgba(200,146,58,0.1)" : "transparent",
                    color:      statusFilter === s ? "var(--amber)" : "var(--slate)",
                    fontFamily: "DM Mono, monospace",
                    fontSize:   "11px",
                    cursor:     "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Intent list */}
          {loading ? (
            <Skeleton />
          ) : !isConnected && tab === "personal" ? (
            <Empty message="Connect your wallet to see your intents" />
          ) : filtered.length === 0 ? (
            <Empty message={tab === "personal" ? "No intents yet — create your first one" : "No executed intents yet"} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map(intent => (
                <IntentCard
                  key={intent.intentId.toString()}
                  intent={intent}
                  isOwner={!!address && intent.user.toLowerCase() === address.toLowerCase()}
                  onRefresh={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
