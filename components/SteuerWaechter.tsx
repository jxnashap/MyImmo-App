// Steuer-Wächter auf /steuer (02.10.2026): 15 %-Grenze und Spekulationsfrist für ALLE Objekte
// auf einen Blick. Rechnet nichts Neues — dieselben Funktionen wie die Objektseite
// (lib/steuer/waechter.ts). Server-Komponente, kein Zustand.
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { datum, euro } from "@/lib/format";
import type { WaechterZeile } from "@/lib/steuer/waechter";

const ANSCHAFFUNG_BADGE: Record<string, { label: string; cls: string }> = {
  ok: { label: "im Rahmen", cls: "badge-green" },
  warnung: { label: "nahe an 15 %", cls: "badge-amber" },
  ueberschritten: { label: "15 % überschritten", cls: "badge-red" },
  abgelaufen: { label: "Frist vorbei", cls: "badge-neutral" },
  inaktiv: { label: "Angaben fehlen", cls: "badge-neutral" },
};

export default function SteuerWaechter({ zeilen }: { zeilen: WaechterZeile[] }) {
  if (zeilen.length === 0) return null;
  const achtung = zeilen.filter((z) => z.achtung).length;
  return (
    <div className="section mb-20">
      <div className="section-header">
        <div>
          <h3><ShieldAlert size={15} style={{ verticalAlign: "-2px" }} /> Steuer-Wächter</h3>
          <div className="section-sub">
            {achtung === 0 ? "Bei keinem Objekt droht gerade eine Grenze" : `${achtung} ${achtung === 1 ? "Objekt verlangt" : "Objekte verlangen"} Aufmerksamkeit`}
          </div>
        </div>
      </div>
      <div className="section-body">
        <div className="table-scroll"><table style={{ fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr><th>Objekt</th><th>15 %-Grenze (3 Jahre nach Kauf)</th><th>Spekulationsfrist (10 Jahre)</th></tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const a = z.anschaffungsnah;
              const b = a ? ANSCHAFFUNG_BADGE[a.status] : null;
              const s = z.spekulation;
              return (
                <tr key={z.id} style={z.achtung ? { background: "var(--gold-pale)" } : undefined}>
                  <td><Link href={`/properties/${z.id}`}>{z.name}</Link></td>
                  <td>
                    {!a ? <span style={{ color: "var(--faint)" }}>kein Gebäude</span> : (
                      <>
                        <span className={`badge ${b!.cls}`}>{b!.label}</span>
                        {(a.status === "ok" || a.status === "warnung" || a.status === "ueberschritten") && (
                          <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                            {euro(a.kostenImFenster)} von {euro(a.grenze)} · bis&nbsp;{datum(a.fensterBis!)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    {!s.aktiv ? <span style={{ color: "var(--faint)" }}>Kaufdatum fehlt</span>
                      : s.steuerfrei ? <span className="badge badge-green">steuerfrei seit {datum(s.steuerfreiAb!)}</span>
                      : <span style={{ color: z.achtung ? "var(--text)" : "var(--muted)" }}>steuerfrei ab&nbsp;{datum(s.steuerfreiAb!)} · noch&nbsp;{s.tageVerbleibend.toLocaleString("de-DE")}&nbsp;Tage</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p style={{ fontSize: 11, color: "var(--faint)", margin: "8px 0 0" }}>
          Gezählt werden Reparatur, Instandhaltung und Modernisierung (brutto). Näherung, keine Steuerberatung — Details auf der Objektseite.
        </p>
      </div>
    </div>
  );
}
