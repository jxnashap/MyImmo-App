import Link from "next/link";
import RoterFaden from "@/components/kalkulator/RoterFaden";

export default function RoterFadenPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">🧵 Roter Faden</div>
          <div className="topbar-sub">Schnell-Kalkulation Schritt für Schritt</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span className="btn btn-ghost" style={{ borderColor: "var(--gold-dim)", color: "var(--gold)" }}>🧵 Roter Faden</span>
          <Link href="/cockpit" className="btn btn-ghost">🧮 Cockpit</Link>
          <Link href="/bankgespraech" className="btn btn-ghost">🏦 Bankgespräch</Link>
        </div>
      </div>
      <RoterFaden />
    </div>
  );
}
