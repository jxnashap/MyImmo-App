"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

// Gemeinsamer Ablauf-Stepper für Kauf-/Verkauf-Assistent. Akkordeon: jeder
// Schritt klappt auf seine Kopfzeile (Nummer + Titel + Kurzhinweis + Status)
// ein — offen ist standardmäßig nur der erste noch nicht erledigte. So bleibt
// die Seite scanbar, statt alle Schritte gleichzeitig als Wand zu zeigen.
// Fortschritt UND welcher Schritt offen ist bleiben in localStorage.

export type StepperSchritt = {
  icon: LucideIcon;
  titel: string;
  inhalt: ReactNode;
  // Eine Zeile, die im eingeklappten Zustand sagt, worum es im Schritt geht.
  hinweis?: string;
  // Automatisch als erledigt erkannt (z. B. sobald ein Marktwert vorliegt) —
  // dann ist keine manuelle Bestätigung nötig.
  autoErledigt?: boolean;
};

function SchrittKarte({
  n, letzte, icon: Icon, titel, hinweis, erledigt, auto, offen,
  onToggleOffen, onToggleErledigt, children,
}: {
  n: number; letzte?: boolean; icon: LucideIcon; titel: string; hinweis?: string;
  erledigt: boolean; auto?: boolean; offen: boolean;
  onToggleOffen: () => void; onToggleErledigt: () => void; children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: erledigt ? "var(--green)" : "var(--gold)",
            color: erledigt ? "#fff" : "var(--btn-gold-text)",
            display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16,
            transition: "background .4s ease, color .4s ease",
          }}
        >
          {erledigt ? <Check size={18} /> : n}
        </div>
        {!letzte && (
          <div style={{ position: "relative", flex: 1, width: 2, background: "var(--line2)", marginTop: 4, borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                position: "absolute", top: 0, left: 0, width: "100%",
                height: erledigt ? "100%" : "0%",
                background: "var(--gold)", transition: "height .6s ease",
              }}
            />
          </div>
        )}
      </div>
      <div className="section" style={{ flex: 1, marginBottom: letzte ? 0 : 18, minWidth: 0 }}>
        {/* Kopfzeile ist der Auf-/Zuklapp-Schalter. Der Erledigt-Knopf liegt
            als eigener Button darüber (stoppt die Propagation), damit ein Klick
            darauf nicht den Schritt zuklappt. */}
        <div
          className="section-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
          onClick={onToggleOffen}
          role="button"
          aria-expanded={offen}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}><Icon size={16} style={{ verticalAlign: "-3px" }} /> {titel}</h3>
            {!offen && hinweis && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{hinweis}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {auto ? (
              <span style={{ fontSize: 11.5, color: "var(--green)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={12} /> automatisch erkannt
              </span>
            ) : erledigt ? (
              <span style={{ fontSize: 11.5, color: "var(--green)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={12} /> erledigt
              </span>
            ) : (
              <span className="badge badge-neutral" style={{ whiteSpace: "nowrap" }}>offen</span>
            )}
            <ChevronDown
              size={18}
              style={{ color: "var(--muted)", flexShrink: 0, transition: "transform .2s ease", transform: offen ? "rotate(180deg)" : "none" }}
            />
          </div>
        </div>
        {offen && (
          <div className="section-body">
            {children}
            {!auto && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleErledigt(); }}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: erledigt ? "var(--green)" : "var(--muted)", whiteSpace: "nowrap" }}
                >
                  {erledigt ? <><Check size={13} style={{ verticalAlign: "-2px" }} /> erledigt — als offen markieren</> : "Schritt als erledigt markieren"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AblaufStepper({
  schritte, storageKey,
}: {
  schritte: StepperSchritt[]; storageKey: string;
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [offen, setOffen] = useState<Record<number, boolean>>({});
  const [geladen, setGeladen] = useState(false);

  const istErledigt = (i: number) => !!done[i + 1] || !!schritte[i].autoErledigt;

  useEffect(() => {
    let gespeichert: Record<number, boolean> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) gespeichert = JSON.parse(raw);
    } catch { /* ignore */ }
    setDone(gespeichert);
    // Standardmäßig den ersten noch nicht erledigten Schritt öffnen (Auto-
    // Erledigt mitzählen), sonst den letzten — damit man nie vor lauter
    // zugeklappten Karten steht.
    const ersterOffen = schritte.findIndex((s, i) => !gespeichert[i + 1] && !s.autoErledigt);
    setOffen({ [(ersterOffen === -1 ? schritte.length - 1 : ersterOffen) + 1]: true });
    setGeladen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!geladen) return;
    try { localStorage.setItem(storageKey, JSON.stringify(done)); } catch { /* ignore */ }
  }, [done, geladen, storageKey]);

  const toggleErledigt = (n: number) => setDone((d) => ({ ...d, [n]: !d[n] }));
  const toggleOffen = (n: number) => setOffen((o) => ({ ...o, [n]: !o[n] }));
  const anzahl = schritte.filter((_, i) => istErledigt(i)).length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 12.5, color: "var(--muted)" }}>
        <div style={{ flex: 1, height: 6, background: "var(--line2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${(anzahl / schritte.length) * 100}%`, height: "100%", background: "var(--gold)", transition: "width .6s ease" }} />
        </div>
        <span style={{ flexShrink: 0 }}>{anzahl}/{schritte.length} erledigt</span>
      </div>

      {schritte.map((s, i) => (
        <SchrittKarte
          key={i}
          n={i + 1}
          letzte={i === schritte.length - 1}
          icon={s.icon}
          titel={s.titel}
          hinweis={s.hinweis}
          erledigt={istErledigt(i)}
          auto={!!s.autoErledigt}
          offen={!!offen[i + 1]}
          onToggleOffen={() => toggleOffen(i + 1)}
          onToggleErledigt={() => toggleErledigt(i + 1)}
        >
          {s.inhalt}
        </SchrittKarte>
      ))}
    </>
  );
}
