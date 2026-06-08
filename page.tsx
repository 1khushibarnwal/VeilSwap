import Link    from "next/link";
import Navbar   from "@/components/layout/Navbar";
import { Shield, Eye, Zap, Lock, GitBranch, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon:  <Lock size={20} />,
    step:  "01",
    title: "Commit",
    desc:  "Submit a cryptographic hash of your trade intent. No details visible on-chain — only a keccak256 commitment.",
  },
  {
    icon:  <Eye size={20} />,
    step:  "02",
    title: "Reveal",
    desc:  "When ready, reveal the plaintext parameters. The contract verifies they match your commitment exactly.",
  },
  {
    icon:  <Shield size={20} />,
    step:  "03",
    title: "Execute",
    desc:  "A keeper monitors the Uniswap V3 TWAP oracle. When your price condition is met, execution fires automatically.",
  },
];

const TECH = [
  { label: "Solidity 0.8.20", sub: "Smart contracts" },
  { label: "Uniswap V3 TWAP", sub: "Price oracle"    },
  { label: "Commit-Reveal",   sub: "MEV protection"  },
  { label: "Arbitrum Sepolia",sub: "EVM L2"          },
  { label: "Foundry",         sub: "202 tests"       },
  { label: "Node.js + Prisma",sub: "Keeper backend"  },
];

export default function Home() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: "100vh" }}>

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section
          style={{
            position:   "relative",
            overflow:   "hidden",
            padding:    "120px 24px 100px",
            textAlign:  "center",
          }}
        >
          {/* Subtle grid texture */}
          <div style={{
            position:   "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(200,194,188,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(200,194,188,0.03) 1px, transparent 1px)",
            backgroundSize:  "48px 48px",
            pointerEvents:   "none",
          }} />

          {/* Amber glow blob */}
          <div style={{
            position:   "absolute",
            top:        "-80px",
            left:       "50%",
            transform:  "translateX(-50%)",
            width:      "600px",
            height:     "400px",
            background: "radial-gradient(ellipse, rgba(200,146,58,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ maxWidth: "720px", margin: "0 auto", position: "relative" }}>
            {/* Tag */}
            <div style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "6px",
              padding:      "5px 14px",
              borderRadius: "20px",
              border:       "1px solid rgba(200,146,58,0.3)",
              background:   "rgba(200,146,58,0.08)",
              marginBottom: "28px",
              fontFamily:   "DM Mono, monospace",
              fontSize:     "11px",
              color:        "var(--amber)",
              letterSpacing:"0.06em",
              textTransform:"uppercase",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--amber)", animation: "pulse 2s infinite" }} />
              Live on Arbitrum Sepolia
            </div>

            <h1
              style={{
                fontFamily:   "Syne, sans-serif",
                fontSize:     "clamp(40px, 6vw, 72px)",
                fontWeight:   800,
                color:        "var(--cream)",
                letterSpacing:"-2px",
                lineHeight:   1.08,
                marginBottom: "24px",
              }}
            >
              Trade with a{" "}
              <span style={{ color: "var(--amber)" }}>Veil</span>
            </h1>

            <p
              style={{
                fontSize:     "17px",
                color:        "var(--slate)",
                lineHeight:   1.7,
                marginBottom: "44px",
                fontWeight:   300,
              }}
            >
              Place private limit orders on Arbitrum. Your parameters stay hidden
              until execution — commit-reveal scheme with Uniswap V3 TWAP gating
              makes frontrunning economically irrational.
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/app" className="btn-primary" style={{ padding: "13px 28px", fontSize: "14px" }}>
                Create Intent <ArrowRight size={15} />
              </Link>
              <Link href="/dashboard" className="btn-ghost" style={{ padding: "13px 28px", fontSize: "14px" }}>
                View Dashboard
              </Link>
            </div>

            {/* Stats bar */}
            <div style={{
              display:        "flex",
              justifyContent: "center",
              gap:            "40px",
              marginTop:      "64px",
              padding:        "24px",
              borderRadius:   "12px",
              border:         "1px solid var(--border)",
              background:     "var(--ink-1)",
              flexWrap:       "wrap",
            }}>
              {[
                { n: "202",    l: "Tests written"      },
                { n: "30 min", l: "TWAP manipulation window" },
                { n: "100%",   l: "Permissionless keepers" },
                { n: "0",      l: "Trusted intermediaries" },
              ].map(s => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "var(--cream)" }}>
                    {s.n}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--slate)", marginTop: "2px" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section style={{ padding: "80px 24px", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
                Protocol
              </p>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, letterSpacing: "-1px", color: "var(--cream)" }}>
                How VeilSwap works
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {STEPS.map((s) => (
                <div key={s.step} className="card" style={{ padding: "28px", position: "relative" }}>
                  <div style={{
                    position:   "absolute",
                    top:        "24px",
                    right:      "24px",
                    fontFamily: "DM Mono, monospace",
                    fontSize:   "11px",
                    color:      "var(--ink-3)",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                  }}>
                    {s.step}
                  </div>
                  <div style={{
                    width:      "40px", height: "40px",
                    borderRadius: "10px",
                    background: "rgba(200,146,58,0.1)",
                    border:     "1px solid rgba(200,146,58,0.2)",
                    display:    "flex", alignItems: "center", justifyContent: "center",
                    color:      "var(--amber)",
                    marginBottom: "20px",
                  }}>
                    {s.icon}
                  </div>
                  <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "17px", fontWeight: 600, color: "var(--cream)", marginBottom: "10px" }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--slate)", lineHeight: 1.65 }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TECH STACK ───────────────────────────────────────────────────── */}
        <section style={{ padding: "60px 24px", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--slate-dim)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", marginBottom: "28px" }}>
              Built with
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
              {TECH.map(t => (
                <div key={t.label} className="card-2" style={{ padding: "10px 18px", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontFamily: "Syne, sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--cream)" }}>{t.label}</span>
                  <span style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--slate)", marginTop: "2px" }}>{t.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section style={{ padding: "80px 24px 120px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 700, letterSpacing: "-1px", color: "var(--cream)", marginBottom: "16px" }}>
              Ready to trade privately?
            </h2>
            <p style={{ fontSize: "15px", color: "var(--slate)", lineHeight: 1.6, marginBottom: "32px" }}>
              Connect your wallet and place your first veiled intent in under a minute.
            </p>
            <Link href="/app" className="btn-primary" style={{ padding: "14px 32px", fontSize: "15px" }}>
              Open App <ArrowRight size={16} />
            </Link>
          </div>
        </section>

      </main>
    </>
  );
}
