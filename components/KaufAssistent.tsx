"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Search, Landmark, FolderClosed, FileCheck2, ExternalLink, TriangleAlert,
  ArrowRight, Calculator, Scale, Check, type LucideIcon,
} from "lucide-react";
import Cockpit from "@/components/kalkulator/Cockpit";
import type { Kalkulation } from "@/lib/types";

// Kauf-Assistent: geführtes Ablaufschema vom gefundenen Objekt bis zur
// Finanzierungsanfrage. Der Objekt-Rechner (Cockpit, inkl. Speichern +
// Vergleich mehrerer Kandidaten) ist als Schritt eingebettet — Roter Faden
// und Cockpit gibt es nicht mehr als eigene Reiter. Rein informativ/rechnend,
// keine Darlehensvermittlung (§ 34i GewO).

const FORTSCHRITT_KEY = "myimmo_kauf_fortschritt";

const DARLEHEN: { name: string; text: string; warn?: boolean }[] = [
  { name: "Annuitätendarlehen", text: "Konstante Rate aus Zins + Tilgung. Der Standard für fast alle Fälle — planbar, flexibel (Sondertilgung, Tilgungswechsel)." },
  { name: "Endfälliges Darlehen", text: "Nur Zinsen laufend, Tilgung am Ende über einen Tilgungsersatz. Für Vermieter interessant: Zinsen bleiben konstant hoch und voll als Werbungskosten abziehbar." },
  { name: "Volltilger", text: "Tilgt bis Ende der Zinsbindung auf 0 — oft Zinsrabatt, dafür wenig flexibel." },
  { name: "Forward-Darlehen", text: "Anschlusszins schon heute für später sichern. Aufschlag je Vorlaufmonat; Abnahmepflicht auch bei fallenden Zinsen (Zinswette)." },
  { name: "Bausparkombi / „Sofortfinanzierung“ zur Ablösung", text: "Tilgungsfreies Vorausdarlehen + Bausparvertrag, der später ablöst. Klingt nach Zinssicherung, ist aber oft intransparent und teuer — Verbraucherzentrale rät meist ab (Abschlussgebühr, unsicherer Zuteilungstermin, effektiv höhere Kosten).", warn: true },
];

const FOERDERUNG: { name: string; wer: string; ok: boolean }[] = [
  { name: "KfW 297/298 – Klimafreundlicher Neubau", wer: "298 auch für Vermieter", ok: true },
  { name: "KfW 261 – Sanierung zum Effizienzhaus", wer: "auch Vermieter", ok: true },
  { name: "KfW 458 – Heizungsförderung (Vermieter max. ~35 %)", wer: "auch Vermieter", ok: true },
  { name: "BAFA BEG EM – Gebäudehülle & Anlagentechnik", wer: "auch Vermieter", ok: true },
  { name: "Landesförderbanken (z. B. NRW.BANK Mietwohnraum)", wer: "Vermieter, mit Bindung", ok: true },
  { name: "KfW 124 / 300 / 308, Wohn-Riester", wer: "nur Selbstnutzer", ok: false },
];

// Nummerierte Schritt-Karte mit animierter Fortschrittslinie. Ist der Schritt
// erledigt, füllt sich die goldene Linie zum nächsten Schritt.
function Schritt({
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

export default function KaufAssistent({ gespeichert = [] }: { gespeichert?: Kalkulation[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [geladen, setGeladen] = useState(false);
  const [rechnerOffen, setRechnerOffen] = useState(false);

  // Fortschritt aus localStorage laden / speichern.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORTSCHRITT_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch { /* ignore */ }
    setGeladen(true);
  }, []);
  useEffect(() => {
    if (!geladen) return;
    try { localStorage.setItem(FORTSCHRITT_KEY, JSON.stringify(done)); } catch { /* ignore */ }
  }, [done, geladen]);

  const toggle = (n: number) => setDone((d) => ({ ...d, [n]: !d[n] }));
  const ist = (n: number) => !!done[n];
  const anzahl = Object.values(done).filter(Boolean).length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 12.5, color: "var(--muted)" }}>
        <div style={{ flex: 1, height: 6, background: "var(--line2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${(anzahl / 5) * 100}%`, height: "100%", background: "var(--gold)", transition: "width .6s ease" }} />
        </div>
        <span style={{ flexShrink: 0 }}>{anzahl}/5 erledigt</span>
      </div>

      <Schritt n={1} icon={Search} titel="Objekt bewerten" erledigt={ist(1)} onToggle={() => toggle(1)}>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Schätze den Marktwert nach ImmoWertV (Ertrags- oder Sachwert), schlage den Bodenrichtwert
          im amtlichen BORIS-Portal deines Bundeslands nach und vergleiche mit dem Kaufpreis.
        </p>
        <Link href="/bewertung" className="btn btn-gold" style={{ fontSize: 13 }}>
          Marktwert-Schätzer öffnen <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </Link>
      </Schritt>

      <Schritt n={2} icon={Calculator} titel="Objekt durchrechnen & vergleichen" erledigt={ist(2)} onToggle={() => toggle(2)}>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Rechne jedes in Frage kommende Objekt durch — Kaufnebenkosten, Cashflow, Rendite und die
          30-Jahres-Entwicklung. <strong>Speichere</strong> mehrere Kandidaten und stelle sie über
          <Scale size={13} style={{ verticalAlign: "-2px", margin: "0 3px" }} />„Vergleich" nebeneinander,
          um das beste Objekt auszuwählen — erst danach geht es zur Finanzierung.
        </p>
        {!rechnerOffen ? (
          <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setRechnerOffen(true)}>
            <Calculator size={14} style={{ verticalAlign: "-2px" }} /> Objekt-Rechner öffnen
          </button>
        ) : (
          <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <Cockpit gespeichert={gespeichert} />
          </div>
        )}
      </Schritt>

      <Schritt n={3} icon={Landmark} titel="Finanzierung & Förderung" erledigt={ist(3)} onToggle={() => toggle(3)}>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Überblick über die Darlehensarten — welche zu dir passt, entscheidest du mit deiner Bank.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {DARLEHEN.map((d) => (
            <div key={d.name} style={{ padding: "8px 12px", borderRadius: 8, background: d.warn ? "rgba(240,160,48,0.08)" : "var(--bg3)", border: `1px solid ${d.warn ? "var(--amber)" : "var(--line)"}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {d.warn && <TriangleAlert size={13} color="var(--amber)" />} {d.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{d.text}</div>
            </div>
          ))}
        </div>

        <div className="form-section-label" style={{ marginTop: 16 }}>Förderprogramme (Auswahl, Stand 2026 — vor Antrag Konditionen prüfen)</div>
        <div style={{ display: "grid", gap: 4 }}>
          {FOERDERUNG.map((f) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: f.ok ? "var(--green)" : "var(--faint)", flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{f.name}</span>
              <span className={`badge ${f.ok ? "badge-green" : "badge-neutral"}`}>{f.wer}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <a href="https://www.kfw.de/inlandsfoerderung/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}><ExternalLink size={12} style={{ verticalAlign: "-2px" }} /> KfW</a>
          <a href="https://www.bafa.de" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}><ExternalLink size={12} style={{ verticalAlign: "-2px" }} /> BAFA</a>
        </div>
      </Schritt>

      <Schritt n={4} icon={FolderClosed} titel="Finanzierungsmappe für die Bank" erledigt={ist(4)} onToggle={() => toggle(4)}>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Alle Unterlagen, die Banken verlangen — passend zu deinem Objekt (Kauf, Vermietung, ETW).
          MyImmo erzeugt Kennblatt, Mietaufstellung &amp; Co. aus deinen Daten. Du bekommst einen sicheren
          Link, den du <strong>selbst an deine Bank(en)</strong> schickst.
        </p>
        <Link href="/beleihung" className="btn btn-gold" style={{ fontSize: 13 }}>
          Beleihungsordner / Finanzierungsmappe <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </Link>
      </Schritt>

      <Schritt n={5} letzte icon={FileCheck2} titel="Angebote vergleichen & entscheiden" erledigt={ist(5)} onToggle={() => toggle(5)}>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Die Bank prüft und schickt ihr Angebot zurück. Vergleiche die Angebote nach dem
          <strong> effektiven Jahreszins</strong> (nicht nur dem Sollzins) und der Flexibilität
          (Sondertilgung, Tilgungswechsel). Nach der Zusage: Notartermin, Grundschuld, Auszahlung
          durch die Bank — und das Objekt wandert in deinen MyImmo-Bestand.
        </p>
        <div style={{ fontSize: 11.5, color: "var(--faint)", display: "flex", gap: 7 }}>
          <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>MyImmo vermittelt keine Darlehen und gibt keine Finanzierungsempfehlung — die Auswahl von Bank
            und Darlehen triffst du selbst. Unterschrift und Auszahlung laufen über die Bank bzw. den Notar.</span>
        </div>
      </Schritt>
    </>
  );
}
