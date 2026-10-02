// Objekt-Check auf der Objektseite (02.10.2026): „8 von 10 Angaben“ mit Direktlinks zu dem,
// was fehlt. Rechnung in lib/objektCheck.ts. Bei vollständigem Objekt nur eine schmale Zeile.
import Link from "next/link";
import { CheckCircle2, ListChecks } from "lucide-react";
import type { ObjektCheck } from "@/lib/objektCheck";

export default function ObjektCheckKarte({ check }: { check: ObjektCheck }) {
  if (check.fehlend.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--green)", margin: "0 0 14px" }}>
        <CheckCircle2 size={13} style={{ verticalAlign: "-2px" }} /> Objekt-Check: alle {check.gesamt} Angaben gepflegt.
      </p>
    );
  }
  const prozent = Math.round((check.erfuellt / check.gesamt) * 100);
  return (
    <div className="section mb-20">
      <div className="section-header">
        <div>
          <h3><ListChecks size={15} style={{ verticalAlign: "-2px" }} /> Objekt-Check</h3>
          <div className="section-sub">{check.erfuellt} von {check.gesamt} Angaben gepflegt</div>
        </div>
      </div>
      <div className="section-body">
        <div style={{ height: 6, borderRadius: 4, background: "var(--line)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${prozent}%`, height: "100%", background: "var(--gold-fill)" }} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {check.fehlend.map((f) => (
            <div key={f.schluessel} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 200 }}>
                <strong>{f.label}</strong> <span style={{ color: "var(--muted)" }}>— {f.grund}</span>
              </span>
              <Link href={f.href} className="btn btn-ghost btn-sm">Ergänzen</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
