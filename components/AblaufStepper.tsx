"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";

// Gemeinsamer Ablauf-Stepper für Kauf-/Verkauf-Assistent: nummerierte
// Schritt-Karten mit animierter goldener Fortschrittslinie, die sich pro
// erledigtem Schritt weiterfüllt. Fortschritt bleibt in localStorage erhalten.

export type StepperSchritt = {
  icon: LucideIcon;
  titel: string;
  inhalt: ReactNode;
};

function SchrittKarte({
  n, letzte, icon: Icon, titel, erledigt, onToggle, children,
}: {
  n: number; letzte?: boolean; icon: LucideIcon; titel: string;
  erledigt: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: erledigt ? "var(--green)" : "var(--gold)",
            color: erledigt ? "#fff" : "#1a1814",
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
        <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}><Icon size={16} style={{ verticalAlign: "-3px" }} /> {titel}</h3>
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-ghost"
            style={{ fontSize: 11.5, flexShrink: 0, color: erledigt ? "var(--green)" : "var(--muted)", whiteSpace: "nowrap" }}
          >
            {erledigt ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> erledigt</> : "als erledigt markieren"}
          </button>
        </div>
        <div className="section-body">{children}</div>
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
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch { /* ignore */ }
    setGeladen(true);
  }, [storageKey]);
  useEffect(() => {
    if (!geladen) return;
    try { localStorage.setItem(storageKey, JSON.stringify(done)); } catch { /* ignore */ }
  }, [done, geladen, storageKey]);

  const toggle = (n: number) => setDone((d) => ({ ...d, [n]: !d[n] }));
  const anzahl = Object.values(done).filter(Boolean).length;

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
          erledigt={!!done[i + 1]}
          onToggle={() => toggle(i + 1)}
        >
          {s.inhalt}
        </SchrittKarte>
      ))}
    </>
  );
}
