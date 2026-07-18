"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, Landmark, FolderClosed, FileCheck2, ExternalLink, TriangleAlert,
  ArrowRight, Calculator, Scale, Crown, ClipboardList, TrendingUp,
} from "lucide-react";
import Cockpit from "@/components/kalkulator/Cockpit";
import BewertungAssistent from "@/components/BewertungAssistent";
import AblaufStepper, { type StepperSchritt } from "@/components/AblaufStepper";
import SelbstauskunftForm from "@/components/kauf/SelbstauskunftForm";
import MachbarkeitKarte from "@/components/kauf/MachbarkeitKarte";
import DarlehenWizard from "@/components/kauf/DarlehenWizard";
import KreditantragButton from "@/components/kauf/KreditantragButton";
import { KAUF_AUSWAHL_KEY, type KaufAuswahl } from "@/lib/kauf/auswahl";
import { KAUF_BEWERTUNG_KEY, type KaufBewertung } from "@/lib/kauf/bewertung";
import { eigenkapitalGesamt, haushaltsNetto, type SelbstauskunftDaten } from "@/lib/kauf/selbstauskunft";
import { pruefeMachbarkeit } from "@/lib/kauf/machbarkeit";
import { fmtE } from "@/lib/kalk";
import type { Kalkulation } from "@/lib/types";

// Kauf-Assistent: geführtes Ablaufschema vom gefundenen Objekt bis zur
// Finanzierungsanfrage. Der Objekt-Rechner (Cockpit, inkl. Speichern +
// Vergleich mehrerer Kandidaten) ist als Schritt eingebettet — Roter Faden
// und Cockpit gibt es nicht mehr als eigene Reiter. Rein informativ/rechnend,
// keine Darlehensvermittlung (§ 34i GewO).

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

export default function KaufAssistent({
  gespeichert = [], selbstauskunft = null,
}: {
  gespeichert?: Kalkulation[]; selbstauskunft?: SelbstauskunftDaten | null;
}) {
  const [rechnerOffen, setRechnerOffen] = useState(false);
  const [saOffen, setSaOffen] = useState(false);
  const [bewOffen, setBewOffen] = useState(false);
  const [bewertung, setBewertung] = useState<KaufBewertung | null>(null);
  const [auswahl, setAuswahl] = useState<KaufAuswahl | null>(null);

  const ladeBewertung = () => {
    try {
      const raw = localStorage.getItem(KAUF_BEWERTUNG_KEY);
      setBewertung(raw ? (JSON.parse(raw) as KaufBewertung) : null);
    } catch { setBewertung(null); }
  };
  useEffect(() => {
    ladeBewertung();
    window.addEventListener("focus", ladeBewertung);
    return () => window.removeEventListener("focus", ladeBewertung);
  }, []);

  // Gewähltes Objekt aus dem Vergleich lesen (Schritt 2 „übernehmen"). Auf
  // Fokuswechsel neu laden, damit die Übernahme ohne Reload ankommt.
  useEffect(() => {
    const lade = () => {
      try {
        const raw = localStorage.getItem(KAUF_AUSWAHL_KEY);
        setAuswahl(raw ? (JSON.parse(raw) as KaufAuswahl) : null);
      } catch { setAuswahl(null); }
    };
    lade();
    window.addEventListener("focus", lade);
    return () => window.removeEventListener("focus", lade);
  }, [rechnerOffen]);

  const gewaehltesObjekt = auswahl && (auswahl.kp > 0 || auswahl.darlehen > 0) ? (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--gold-pale, rgba(212,175,90,0.1))", border: "1px solid var(--gold)", marginBottom: 14 }}>
      <Crown size={16} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Gewähltes Objekt: {auswahl.name}{auswahl.adresse ? ` — ${auswahl.adresse}` : ""}</div>
        <div style={{ color: "var(--muted)" }}>
          Kaufpreis {fmtE(auswahl.kp)} · Eigenkapital {fmtE(auswahl.eigenkapital)} · <strong>Darlehensbedarf {fmtE(auswahl.darlehen)}</strong> · Rate {fmtE(auswahl.rate)}/Mo
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)", marginBottom: 14, fontSize: 12, color: "var(--muted)" }}>
      <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>Noch kein Objekt gewählt. Rechne in Schritt 2 deine Kandidaten durch, vergleiche sie und übernimm das beste — die Zahlen erscheinen dann hier.</span>
    </div>
  );

  // Machbarkeits-Ampel: gewähltes Objekt (A) + Selbstauskunft (B).
  const machbarkeit = auswahl && (auswahl.kp > 0 || auswahl.darlehen > 0)
    ? pruefeMachbarkeit({
        darlehen: auswahl.darlehen,
        rate: auswahl.rate,
        kaufpreis: auswahl.kp,
        gesamtInvest: auswahl.gesamtInvest,
        kaltmieteNeu: auswahl.kaltmiete,
        haushaltsNetto: selbstauskunft ? haushaltsNetto(selbstauskunft) : 0,
        mieteinnahmenBestehend: selbstauskunft?.mieteinnahmen ?? 0,
        ausgabenFix: selbstauskunft
          ? selbstauskunft.ratenKredite + selbstauskunft.versicherungen + selbstauskunft.unterhalt + selbstauskunft.sonstigeAusgaben
          : 0,
        anzahlPersonen: selbstauskunft?.anzahlPersonen ?? 1,
        eigenkapital: selbstauskunft ? eigenkapitalGesamt(selbstauskunft) : 0,
      })
    : null;

  const schritte: StepperSchritt[] = [
    {
      icon: Search,
      titel: "Objekt bewerten",
      autoErledigt: !!bewertung && bewertung.marktwert > 0,
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Schätze den Marktwert nach ImmoWertV (Ertrags- oder Sachwert), schlage den Bodenrichtwert
            im amtlichen BORIS-Portal deines Bundeslands nach und vergleiche mit dem Kaufpreis.
          </p>
          {bewertung && bewertung.marktwert > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--gold-pale, rgba(212,175,90,0.1))", border: "1px solid var(--gold)", marginBottom: 12 }}>
              <TrendingUp size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12.5 }}>
                <div style={{ fontWeight: 600 }}>Geschätzter Marktwert: {fmtE(bewertung.marktwert)}</div>
                <div style={{ color: "var(--muted)" }}>
                  Spanne {fmtE(bewertung.min)}–{fmtE(bewertung.max)} · wird in den Rechner übernommen
                </div>
              </div>
            </div>
          )}
          {!bewOffen ? (
            <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setBewOffen(true)}>
              <Search size={14} style={{ verticalAlign: "-2px" }} /> {bewertung ? "Marktwert-Schätzer erneut öffnen" : "Marktwert-Schätzer öffnen"}
            </button>
          ) : (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <BewertungAssistent imKaufFlow onGespeichert={ladeBewertung} />
            </div>
          )}
        </>
      ),
    },
    {
      icon: Calculator,
      titel: "Objekt durchrechnen & vergleichen",
      inhalt: (
        <>
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
        </>
      ),
    },
    {
      icon: ClipboardList,
      titel: "Deine Finanzen (Selbstauskunft)",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Die Bank prüft, ob du dir die Rate leisten kannst — dafür braucht sie deine Einnahmen,
            Ausgaben, dein Eigenkapital und bestehende Kredite. Trag es einmal ein: Es fließt in die
            Machbarkeitsprüfung und später in die Selbstauskunft für die Bank. Verschlüsselt gespeichert.
          </p>
          {!saOffen ? (
            <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setSaOffen(true)}>
              <ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> Selbstauskunft ausfüllen
            </button>
          ) : (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <SelbstauskunftForm initial={selbstauskunft} />
            </div>
          )}
        </>
      ),
    },
    {
      icon: Landmark,
      titel: "Finanzierung & Förderung",
      inhalt: (
        <>
          {gewaehltesObjekt}
          {machbarkeit && <MachbarkeitKarte ergebnis={machbarkeit} />}

          <div className="form-section-label" style={{ marginTop: 4 }}>Dein Finanzierungswunsch</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
            Beantworte, was dir wichtig ist — daraus stellen wir eine passende Darlehenskonfiguration
            zusammen, die du in den Kreditantrag übernehmen kannst.
          </p>
          <DarlehenWizard darlehenVorschlag={auswahl?.darlehen ?? 0} />

          <div className="form-section-label" style={{ marginTop: 20 }}>Darlehensarten im Überblick</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
            Welche Art zu dir passt, entscheidest du mit deiner Bank.
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
        </>
      ),
    },
    {
      icon: FolderClosed,
      titel: "Finanzierungsmappe für die Bank",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Alle Unterlagen, die Banken verlangen — passend zu deinem Objekt (Kauf, Vermietung, ETW).
            MyImmo erzeugt Kennblatt, Mietaufstellung &amp; Co. aus deinen Daten. Du bekommst einen sicheren
            Link, den du <strong>selbst an deine Bank(en)</strong> schickst.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/beleihung" className="btn btn-outline" style={{ fontSize: 13 }}>
              Beleihungsordner / Finanzierungsmappe <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
            </Link>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div className="form-section-label" style={{ marginTop: 0 }}>Kreditantrag / Selbstauskunft</div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
              Fasst deine Selbstauskunft, das gewählte Objekt und deinen Finanzierungswunsch in einem
              PDF zusammen — fertig zum Ausdrucken, Unterschreiben und <strong>selbst</strong> an die Bank geben.
            </p>
            <KreditantragButton />
          </div>
        </>
      ),
    },
    {
      icon: FileCheck2,
      titel: "Angebote vergleichen & entscheiden",
      inhalt: (
        <>
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
        </>
      ),
    },
  ];

  return <AblaufStepper schritte={schritte} storageKey="myimmo_kauf_fortschritt" />;
}
