"use client";
import Link             from "next/link";
import { usePathname }  from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Github }        from "lucide-react";

const NAV = [
  { href: "/",          label: "Home"      },
  { href: "/app",       label: "Trade"     },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header
      style={{
        position:     "sticky",
        top:          0,
        zIndex:       50,
        borderBottom: "1px solid var(--border)",
        background:   "rgba(12,14,18,0.85)",
        backdropFilter: "blur(12px)",
      }}
    >
      <nav
        style={{
          maxWidth:      "1280px",
          margin:        "0 auto",
          padding:       "0 24px",
          height:        "60px",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          gap:           "24px",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div style={{
            width:        "32px",
            height:       "32px",
            borderRadius: "8px",
            background:   "var(--amber)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            flexShrink:   0,
          }}>
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "14px", color: "var(--ink)", letterSpacing: "-0.5px" }}>
              VS
            </span>
          </div>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "var(--cream)", letterSpacing: "-0.3px" }}>
            VeilSwap
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {NAV.map((n) => {
            const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  padding:        "6px 14px",
                  borderRadius:   "7px",
                  fontSize:       "13px",
                  fontWeight:     active ? 600 : 400,
                  fontFamily:     "Syne, sans-serif",
                  color:          active ? "var(--cream)" : "var(--slate)",
                  background:     active ? "var(--ink-2)" : "transparent",
                  textDecoration: "none",
                  transition:     "color 0.15s, background 0.15s",
                  letterSpacing:  "0.01em",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a
            href="https://github.com/1khushibarnwal/VeilSwap"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              width:        "34px",
              height:       "34px",
              borderRadius: "8px",
              border:       "1px solid var(--border-2)",
              color:        "var(--slate)",
              transition:   "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--cream)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--slate)"; }}
          >
            <Github size={15} />
          </a>
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </nav>
    </header>
  );
}
