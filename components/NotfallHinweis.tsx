// Notfall-Hinweis im Mieterportal (02.10.2026). MyImmo ist kein Notdienst: Bei Gefahr
// steht ZUERST 112 und die Sofortmaßnahme da, erst danach die Meldung an den Vermieter.
// Ohne Zustand und ohne JavaScript (details/summary) — er muss auch dann aufgehen, wenn
// die Seite noch lädt. Texte: lib/schadensmeldung.ts (NOTFALL_TEXT).
import { Siren } from "lucide-react";
import { NOTFALL_TEXT, type NotfallArt } from "@/lib/schadensmeldung";

function Schritte({ art }: { art: NotfallArt }) {
  const n = NOTFALL_TEXT[art];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{n.titel}</div>
      <ol style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
        {n.schritte.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </div>
  );
}

/** Einklappbarer Kasten „Notfall?“ — oben im Portal und im Anliegen-Reiter. */
export function NotfallKasten() {
  return (
    <details className="section" style={{ border: "1px solid var(--red)", padding: "10px 14px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--red)" }}>
        <Siren size={14} style={{ verticalAlign: "-2px" }} /> Notfall? Feuer, Gasgeruch, Wasserrohrbruch — zuerst hier
      </summary>
      <p style={{ fontSize: 12.5, margin: "8px 0 0" }}>
        <strong>Bei Feuer, Rauch, Verletzten oder akuter Gefahr: sofort <a href="tel:112">112</a>.</strong>{" "}
        Das Portal ist kein Notdienst — dein Vermieter sieht eine Meldung nicht sofort.
      </p>
      {(["gas", "wasser", "strom"] as const).map((a) => <Schritte key={a} art={a} />)}
    </details>
  );
}

/** Hinweis mitten in der Schadensmeldung, sobald eine Antwort auf Gefahr deutet. */
export function NotfallSofort({ art }: { art: NotfallArt }) {
  return (
    <div role="alert" style={{ padding: "10px 14px", border: "1px solid var(--red)", borderRadius: 12, background: "var(--bg2)" }}>
      <div style={{ fontWeight: 700, color: "var(--red)", fontSize: 13 }}>
        <Siren size={14} style={{ verticalAlign: "-2px" }} /> Erst handeln, dann melden
      </div>
      <Schritte art={art} />
      {art !== "allgemein" && (
        <p style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          Bei Feuer, Rauch oder Verletzten: <a href="tel:112"><strong>112</strong></a>.
        </p>
      )}
    </div>
  );
}
