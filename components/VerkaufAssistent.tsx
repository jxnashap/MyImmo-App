"use client";

import Link from "next/link";
import { Search, Coins, FolderClosed, Handshake, ArrowRight, TriangleAlert } from "lucide-react";
import VerkaufRechner, { type VerkaufObjekt } from "@/components/VerkaufRechner";
import AblaufStepper, { type StepperSchritt } from "@/components/AblaufStepper";

// Verkauf-Assistent: Ablaufschema von der Wertermittlung bis zur Übergabe,
// mit derselben animierten Fortschrittslinie wie der Kauf-Assistent.
// Nutzt den Marktwert-Schätzer und den § 23-Spekulations-Rechner.

const UNTERLAGEN: { gruppe: string; items: string[] }[] = [
  { gruppe: "Immer", items: ["Aktueller Grundbuchauszug", "Energieausweis (gültig)", "Bauzeichnungen / Grundrisse", "Wohn-/Nutzflächenberechnung", "Flurkarte / Lageplan", "Aussagekräftiges Exposé + Fotos"] },
  { gruppe: "Eigentumswohnung (WEG)", items: ["Teilungserklärung + Aufteilungsplan", "WEG-Protokolle (letzte 3 Jahre)", "Hausgeld-/Jahresabrechnung", "Nachweis Instandhaltungsrücklage"] },
  { gruppe: "Vermietetes Objekt", items: ["Mietverträge", "Mietaufstellung / Mietnachweis", "Nebenkostenabrechnungen"] },
];

export default function VerkaufAssistent({ objekte = [] }: { objekte?: VerkaufObjekt[] }) {
  const schritte: StepperSchritt[] = [
    {
      icon: Search,
      titel: "Verkaufswert ermitteln",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Was ist realistisch erzielbar? Schätze den Marktwert nach ImmoWertV und vergleiche mit
            aktuellen Angebotspreisen deiner Lage.
          </p>
          <Link href="/bewertung" className="btn btn-gold" style={{ fontSize: 13 }}>
            Marktwert-Schätzer öffnen <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
          </Link>
        </>
      ),
    },
    {
      icon: Coins,
      titel: "Steuer & Netto-Erlös berechnen",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Spekulationssteuer nach § 23 EStG (steuerfrei nach 10 Jahren) und was am Ende übrig bleibt —
            nach Tilgung der Restschuld, Verkaufskosten und Steuer.
          </p>
          <VerkaufRechner objekte={objekte} />
        </>
      ),
    },
    {
      icon: FolderClosed,
      titel: "Verkaufsunterlagen vorbereiten",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Käufer und deren Banken verlangen dieselben Unterlagen wie bei einer Finanzierung — vieles
            liegt schon in deinem Archiv.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {UNTERLAGEN.map((g) => (
              <div key={g.gruppe}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{g.gruppe}</div>
                <div style={{ display: "grid", gap: 3 }}>
                  {g.items.map((it) => (
                    <div key={it} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--gold)", flexShrink: 0 }} /> {it}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/archiv" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 12 }}>Zum Archiv</Link>
        </>
      ),
    },
    {
      icon: Handshake,
      titel: "Verkaufen & übergeben",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Privat oder über einen Makler inserieren, Besichtigungen, Kaufpreisverhandlung. Der Kaufvertrag
            wird notariell beurkundet; die Übergabe hältst du mit einem Protokoll fest.
          </p>
          <Link href="/tenants" className="btn btn-ghost" style={{ fontSize: 12 }}>Übergabeprotokoll (bei Mieter)</Link>
          <div style={{ fontSize: 11.5, color: "var(--faint)", display: "flex", gap: 7, marginTop: 12 }}>
            <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Bei einem vermieteten Objekt geht das Mietverhältnis auf den Käufer über („Kauf bricht nicht Miete", § 566 BGB). Steuerlich: Ausnahmen des § 23 EStG und die Drei-Objekt-Grenze mit dem Steuerberater klären.</span>
          </div>
        </>
      ),
    },
  ];

  return <AblaufStepper schritte={schritte} storageKey="myimmo_verkauf_fortschritt" />;
}
