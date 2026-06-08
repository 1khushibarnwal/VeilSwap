import Navbar       from "@/components/layout/Navbar";
import IntentWizard from "@/components/intent/IntentWizard";

export default function AppPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: "calc(100vh - 60px)", padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: "40px" }}>
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
              Create Intent
            </p>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(24px,3vw,34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "var(--cream)", marginBottom: "8px" }}>
              Place a veiled trade
            </h1>
            <p style={{ fontSize: "14px", color: "var(--slate)", maxWidth: "480px", lineHeight: 1.6 }}>
              Your parameters are committed as a hash and stay private until execution conditions are met.
            </p>
          </div>

          {/* Two-column layout: wizard + explainer */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(240px, 320px)", gap: "28px", alignItems: "start" }}>

            {/* Wizard */}
            <IntentWizard />

            {/* Right sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* How commit-reveal protects you */}
              <div className="card" style={{ padding: "20px" }}>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "14px", fontWeight: 600, color: "var(--cream)", marginBottom: "12px" }}>
                  Why commit-reveal?
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { title: "Hidden parameters", body: "Your token amounts, target price, and direction stay off-chain until you reveal." },
                    { title: "No frontrunning",   body: "MEV bots see only a hash. There's nothing to frontrun before the price condition is met." },
                    { title: "TWAP gating",       body: "Execution uses a 30-minute Uniswap V3 TWAP — manipulating it requires 30 minutes of capital." },
                    { title: "Slippage locked",   body: "minAmountOut is inside the hash. It cannot be changed after submission." },
                  ].map(item => (
                    <div key={item.title}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--cream)", fontFamily: "Syne, sans-serif", marginBottom: "3px" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--slate)", lineHeight: 1.55 }}>
                        {item.body}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract info */}
              <div className="card" style={{ padding: "20px" }}>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "14px", fontWeight: 600, color: "var(--cream)", marginBottom: "12px" }}>
                  Deployed contract
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace", letterSpacing: "0.06em", marginBottom: "3px" }}>
                      INTENT REGISTRY
                    </div>
                    <a
                      href={`https://sepolia.arbiscan.io/address/0xa8A54c94587627cf4030e1Bf6C812B8dB791059A`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--amber)", textDecoration: "none", wordBreak: "break-all" }}
                    >
                      0xa8A54c…1059A ↗
                    </a>
                  </div>
                  <div className="divider" />
                  <div style={{ fontSize: "11px", color: "var(--slate-dim)", fontFamily: "DM Mono, monospace" }}>
                    Arbitrum Sepolia · Chain 421614
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
