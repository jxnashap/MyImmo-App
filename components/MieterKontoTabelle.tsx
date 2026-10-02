// Mietkonto im Mieterportal (02.10.2026): Soll je Monat und was der Vermieter davon als
// eingegangen bestätigt hat. Bewusst ohne „Rückstand“ — Grundlage sind die Buchungen des
// Vermieters, nicht der Kontoauszug des Mieters (lib/mieterKonto.ts).
import Link from "next/link";
import { Wallet } from "lucide-react";
import { euro } from "@/lib/format";
import { monatLabel } from "@/lib/mietkonto";
import { KONTO_STATUS_TEXT, type KontoMonat } from "@/lib/mieterKonto";

const KLASSE: Record<KontoMonat["status"], string> = {
  bestaetigt: "badge-green",
  teilweise: "badge-amber",
  offen: "badge-neutral",
  noch_nicht_faellig: "badge-neutral",
};

export default function MieterKontoTabelle({ titel, monate, anliegenHref }: { titel: string; monate: KontoMonat[]; anliegenHref: string }) {
  const offen = monate.filter((m) => m.status === "offen" || m.status === "teilweise").length;
  return (
    <div className="section">
      <div className="section-header">
        <h3><Wallet size={15} style={{ verticalAlign: "-2px" }} /> Mietkonto{titel ? ` · ${titel}` : ""}</h3>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>letzte 12 Monate</span>
      </div>
      <div className="section-body">
        {monate.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)", margin: 0 }}>
            Für diesen Zeitraum ist keine Miete hinterlegt — dein Vermieter hat den Mietbeginn oder die Miete noch nicht eingetragen.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }} data-kein-wischen>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "6px 6px 6px 0", fontWeight: 500 }}>Monat</th>
                    <th style={{ padding: 6, fontWeight: 500, textAlign: "right" }}>Soll</th>
                    <th style={{ padding: 6, fontWeight: 500, textAlign: "right" }}>bestätigt</th>
                    <th style={{ padding: "6px 0 6px 6px", fontWeight: 500 }}>Stand</th>
                  </tr>
                </thead>
                <tbody>
                  {monate.map((m) => (
                    <tr key={m.jahrMonat} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "7px 6px 7px 0", whiteSpace: "nowrap" }}>{monatLabel(m.jahrMonat)}</td>
                      <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap" }}>{euro(m.soll)}</td>
                      <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap" }}>{m.ist > 0 ? euro(m.ist) : "–"}</td>
                      <td style={{ padding: "6px 0 6px 6px" }}><span className={`badge ${KLASSE[m.status]}`}>{KONTO_STATUS_TEXT[m.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.55 }}>
              „Bestätigt“ heißt: Dein Vermieter hat die Zahlung verbucht. „Noch nicht bestätigt“ heißt
              nicht, dass etwas fehlt — vielleicht ist sie nur noch nicht verbucht.
              {offen > 0 && <> Hast du gezahlt und es steht hier anders? <Link href={anliegenHref}>Schreib deinem Vermieter</Link>.</>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
