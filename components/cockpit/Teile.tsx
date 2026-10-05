import { CheckCircle2, Circle, TriangleAlert, XCircle, HelpCircle } from "lucide-react";
import type { Ampel, PruefPunkt } from "@/lib/cockpit/typen";

// Bausteine des Betreiber-Cockpits. Server-Komponenten, kein Zustand.
//
// Gestaltung bewusst aus den vorhandenen Tokens (--green/--gold/--red/--muted,
// .kpi-card, .stat-box): Das Cockpit ist Teil derselben App, keine zweite
// Designwelt. Jede Ampel trägt Symbol UND Text — Farbe allein trägt nie eine
// Aussage (Rot-Grün-Sehschwäche, Schwarz-Weiß-Druck, forced colors).

const AMPEL: Record<Ampel, { farbe: string; Symbol: typeof CheckCircle2; wort: string }> = {
  ok: { farbe: "var(--green)", Symbol: CheckCircle2, wort: "erledigt" },
  // Grau, nicht rot: „noch nicht dran“ ist kein Fehler.
  offen: { farbe: "var(--muted)", Symbol: Circle, wort: "offen" },
  warnung: { farbe: "var(--gold)", Symbol: TriangleAlert, wort: "ansehen" },
  kritisch: { farbe: "var(--red)", Symbol: XCircle, wort: "kaputt" },
  unbekannt: { farbe: "var(--muted)", Symbol: HelpCircle, wort: "unbekannt" },
};

export function AmpelSymbol({ ampel, groesse = 16 }: { ampel: Ampel; groesse?: number }) {
  const a = AMPEL[ampel];
  return (
    <span
      style={{ display: "inline-flex", color: a.farbe, flexShrink: 0 }}
      title={a.wort}
      aria-hidden="true"
    >
      <a.Symbol size={groesse} />
    </span>
  );
}

/** Eine Kennzahl. Form nach der Regel: ein einzelner Wert ist eine Kachel,
 *  kein Diagramm mit einem Balken. */
export function Kachel({
  label,
  wert,
  unten,
  betont,
}: {
  label: string;
  wert: string;
  unten?: string;
  betont?: boolean;
}) {
  return (
    <div className={betont ? "kpi-card highlight" : "kpi-card"}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{wert}</div>
      {unten ? <div className="kpi-sub">{unten}</div> : null}
    </div>
  );
}

/**
 * Trichter: geordnete Stufen mit Balken, EINE Farbe (sequenziell).
 *
 * Keine Kategorialfarben — die Stufen sind nicht verschiedene Dinge, sondern
 * dasselbe Ding, das schrumpft. Jede Zeile nennt die Zahl im Text, der Balken
 * ist Beigabe; „nicht gemessen“ bleibt Text ohne Balken statt eines Nullbalkens.
 */
export function Trichter({
  stufen,
  basis,
}: {
  stufen: { label: string; wert: number | null; hinweis?: string }[];
  basis: number;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {stufen.map((s) => {
        const anteil = s.wert === null || basis <= 0 ? 0 : Math.min(1, s.wert / basis);
        const prozent = s.wert === null || basis <= 0 ? null : Math.round((s.wert / basis) * 100);
        return (
          <div key={s.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: "var(--text-sm)" }}>{s.label}</span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {s.wert === null ? "nicht gemessen" : s.wert}
                {prozent !== null ? (
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {prozent} %</span>
                ) : null}
              </span>
            </div>
            {s.wert === null ? null : (
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "var(--bg3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${anteil * 100}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: "var(--gold-fill, var(--gold))",
                  }}
                />
              </div>
            )}
            {s.hinweis ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 3 }}>
                {s.hinweis}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Ein Verhältnis gegen eine Grenze — Balken mit einer Spur, kein Kuchen. */
export function Messbalken({
  anteil,
  text,
  ampel,
}: {
  anteil: number;
  text: string;
  ampel: Ampel;
}) {
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 5, background: "var(--bg3)", overflow: "hidden" }}
        role="img"
        aria-label={text}
      >
        <div
          style={{
            width: `${Math.round(anteil * 100)}%`,
            height: "100%",
            borderRadius: 5,
            background: AMPEL[ampel].farbe,
          }}
        />
      </div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--muted)",
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <AmpelSymbol ampel={ampel} groesse={13} />
        {text}
      </div>
    </div>
  );
}

/** Eine Zeile der Prüfliste. */
export function PunktZeile({ punkt }: { punkt: PruefPunkt }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        padding: "11px 0",
        borderTop: "1px solid var(--line)",
        alignItems: "flex-start",
      }}
    >
      <span style={{ marginTop: 2 }}>
        <AmpelSymbol ampel={punkt.ampel} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
          {punkt.titel}
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--muted)" }}>
            {AMPEL[punkt.ampel].wort}
            {punkt.herkunft === "doku" ? ` · aus der Doku, Stand ${punkt.stand}` : ""}
          </span>
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
          {punkt.detail}
        </div>
        {punkt.quelle ? (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 3, opacity: 0.85 }}>
            {punkt.quelle}
          </div>
        ) : null}
      </div>
    </li>
  );
}
