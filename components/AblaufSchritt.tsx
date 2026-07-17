import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Nummerierte Schritt-Karte mit Verbindungslinie — für die Ablaufschemata der
// Kauf-/Verkauf-Assistenten.
export default function AblaufSchritt({
  n, letzte, icon: Icon, titel, children,
}: {
  n: number; letzte?: boolean; icon: LucideIcon; titel: string; children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "#1a1814", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>{n}</div>
        {!letzte && <div style={{ flex: 1, width: 2, background: "var(--line2)", marginTop: 4 }} />}
      </div>
      <div className="section" style={{ flex: 1, marginBottom: letzte ? 0 : 18, minWidth: 0 }}>
        <div className="section-header"><h3><Icon size={16} style={{ verticalAlign: "-3px" }} /> {titel}</h3></div>
        <div className="section-body">{children}</div>
      </div>
    </div>
  );
}
