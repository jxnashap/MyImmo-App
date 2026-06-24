import Link from "next/link";
import Cockpit from "@/components/kalkulator/Cockpit";

export default function CockpitPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">🧮 Cockpit</div>
          <div className="topbar-sub">Vollständige Profi-Kalkulation</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/roter-faden" className="btn btn-ghost">🧵 Roter Faden</Link>
          <span className="btn btn-ghost" style={{ borderColor: "var(--gold-dim)", color: "var(--gold)" }}>🧮 Cockpit</span>
          <Link href="/bankgespraech" className="btn btn-ghost">🏦 Bankgespräch</Link>
        </div>
      </div>
      <Cockpit />
    </div>
  );
}
