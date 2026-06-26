import Link from "next/link";
import Bankgespraech from "@/components/kalkulator/Bankgespraech";
import PrintButton from "@/components/PrintButton";

export default function BankgespraechPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Bankgespräch</div>
          <div className="topbar-sub">Druckfertige Übersicht für deine Bank</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/roter-faden" className="btn btn-ghost">🧵 Roter Faden</Link>
          <Link href="/cockpit" className="btn btn-ghost">🧮 Cockpit</Link>
          <span className="btn btn-ghost" style={{ borderColor: "var(--gold-dim)", color: "var(--gold)" }}>🏦 Bankgespräch</span>
          <PrintButton />
        </div>
      </div>
      <Bankgespraech />
    </div>
  );
}
