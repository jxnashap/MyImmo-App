"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, Landmark, FolderClosed, FileCheck2, TriangleAlert,
  Calculator, Scale, Crown, ClipboardList, TrendingUp, Info, Check,
} from "lucide-react";
import ObjektRechner from "@/components/kauf/ObjektRechner";
import BewertungAssistent from "@/components/BewertungAssistent";
import AblaufStepper, { type StepperSchritt } from "@/components/AblaufStepper";
import SelbstauskunftForm from "@/components/kauf/SelbstauskunftForm";
import MachbarkeitKarte from "@/components/kauf/MachbarkeitKarte";
import DarlehenWizard from "@/components/kauf/DarlehenWizard";
import FoerderCheck from "@/components/kauf/FoerderCheck";
import FinanzierungsVorschlaege from "@/components/kauf/FinanzierungsVorschlaege";
import KreditantragButton from "@/components/kauf/KreditantragButton";
import { KAUF_AUSWAHL_KEY, type KaufAuswahl } from "@/lib/kauf/auswahl";
import { KAUF_BEWERTUNG_KEY, type KaufBewertung } from "@/lib/kauf/bewertung";
import { KAUF_DARLEHEN_KEY, type DarlehenAuswahl } from "@/lib/kauf/darlehen";
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
  const [darlehenWunsch, setDarlehenWunsch] = useState<DarlehenAuswahl | null>(null);

  // Darlehenswunsch (Schritt „Finanzierung") lesen — liefert die Rate für die
  // Machbarkeits-Ampel. Auf Fokuswechsel + nach „übernehmen" neu laden.
  useEffect(() => {
    const lade = () => {
      try {
        const raw = localStorage.getItem(KAUF_DARLEHEN_KEY);
        setDarlehenWunsch(raw ? (JSON.parse(raw) as DarlehenAuswahl) : null);
      } catch { setDarlehenWunsch(null); }
    };
    lade();
    window.addEventListener("focus", lade);
    return () => window.removeEventListener("focus", lade);
  }, []);

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

  // Eigenkapital aus der Selbstauskunft; Darlehensbedarf & Rate ergeben sich
  // erst aus der Finanzierung (nicht mehr im Objekt-Rechner).
  const ekVorhanden = selbstauskunft ? eigenkapitalGesamt(selbstauskunft) : 0;
  const darlehensbedarf = auswahl ? Math.max(0, auswahl.gesamtInvest - ekVorhanden) : 0;
  const rate = darlehenWunsch?.monatsrate ?? 0;
  const darlehen = darlehenWunsch?.darlehen && darlehenWunsch.darlehen > 0 ? darlehenWunsch.darlehen : darlehensbedarf;

  const gewaehltesObjekt = auswahl && auswahl.kp > 0 ? (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--gold-pale, rgba(212,175,90,0.1))", border: "1px solid var(--gold)", marginBottom: 14 }}>
      <Crown size={16} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Gewähltes Objekt: {auswahl.name}{auswahl.adresse ? ` — ${auswahl.adresse}` : ""}</div>
        <div style={{ color: "var(--muted)" }}>
          Kaufpreis {fmtE(auswahl.kp)} · Gesamtinvestition {fmtE(auswahl.gesamtInvest)}
          {ekVorhanden > 0 && <> · <strong>Darlehensbedarf {fmtE(darlehensbedarf)}</strong></>}
          {auswahl.kaltmiete > 0 && <> · Kaltmiete {fmtE(auswahl.kaltmiete)}/Mo</>}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)", marginBottom: 14, fontSize: 12, color: "var(--muted)" }}>
      <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>Noch kein Objekt gewählt. Rechne in Schritt 2 deine Kandidaten durch, vergleiche sie und übernimm das beste — die Zahlen erscheinen dann hier.</span>
    </div>
  );

  // Machbarkeits-Ampel: gewähltes Objekt (A) + Selbstauskunft (B) + Rate aus
  // dem Darlehenswunsch (D). Rate 0 → die ratenabhängigen Checks entfallen.
  const machbarkeit = auswahl && auswahl.kp > 0
    ? pruefeMachbarkeit({
        darlehen,
        rate,
        kaufpreis: auswahl.kp,
        gesamtInvest: auswahl.gesamtInvest,
        kaltmieteNeu: auswahl.kaltmiete,
        haushaltsNetto: selbstauskunft ? haushaltsNetto(selbstauskunft) : 0,
        mieteinnahmenBestehend: selbstauskunft?.mieteinnahmen ?? 0,
        ausgabenFix: selbstauskunft
          ? selbstauskunft.ratenKredite + selbstauskunft.versicherungen + selbstauskunft.unterhalt + selbstauskunft.sonstigeAusgaben
          : 0,
        anzahlPersonen: selbstauskunft?.anzahlPersonen ?? 1,
        eigenkapital: ekVorhanden,
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
      autoErledigt: !!auswahl && auswahl.kp > 0,
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Trag die Grundwerte ein und wähle <strong>Vermieten</strong> oder <strong>Eigennutzung</strong> —
            du siehst sofort Rendite, Preis/m² und Kaufpreisfaktor. <strong>Speichere</strong> mehrere
            Kandidaten und vergleiche 3–5 über <Scale size={13} style={{ verticalAlign: "-2px", margin: "0 3px" }} />„Vergleich":
            das beste bekommt eine Krone. Die Finanzierung rechnest du danach aus.
          </p>
          {!rechnerOffen ? (
            <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setRechnerOffen(true)}>
              <Calculator size={14} style={{ verticalAlign: "-2px" }} /> Objekt-Rechner öffnen
            </button>
          ) : (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <ObjektRechner gespeichert={gespeichert} />
            </div>
          )}
        </>
      ),
    },
    {
      icon: ClipboardList,
      titel: "Deine Finanzen (Selbstauskunft)",
      autoErledigt: !!selbstauskunft,
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
      autoErledigt: !!darlehenWunsch && darlehenWunsch.darlehen > 0,
      inhalt: (
        <>
          {gewaehltesObjekt}
          {machbarkeit && <MachbarkeitKarte ergebnis={machbarkeit} />}

          <div className="form-section-label" style={{ marginTop: 4 }}>Dein Finanzierungswunsch</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
            Beantworte, was dir wichtig ist — daraus rechnen wir dir eine Beispiel-Konfiguration mit
            ihren Auswirkungen aus, die du in den Kreditantrag übernehmen kannst. Die Entscheidung triffst du.
          </p>
          <DarlehenWizard darlehenVorschlag={darlehensbedarf} onUebernommen={setDarlehenWunsch} />

          <div className="form-section-label" style={{ marginTop: 20 }}>Zwei Finanzierungs-Szenarien im Vergleich</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
            Grafische Aufteilung deiner Gesamtinvestition in Eigenkapital, (optional) Förderkredit und Bankdarlehen —
            einmal „solide" (mehr Eigenkapital), einmal „liquiditätsschonend" (mehr Puffer). Beide sind Rechenbeispiele, keine Empfehlung.
          </p>
          {auswahl && auswahl.gesamtInvest > 0 ? (
            <FinanzierungsVorschlaege
              gesamtInvest={auswahl.gesamtInvest} kaufpreis={auswahl.kp} ekVorhanden={ekVorhanden}
              nutzung={auswahl.nutzung} kinder={selbstauskunft?.kinder ?? 0} zveJahr={selbstauskunft?.zveHaushaltJahr ?? 0}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
              <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Sobald du in Schritt 2 ein Objekt übernommen hast, erscheinen hier zwei grafische Finanzierungs-Szenarien.</span>
            </div>
          )}

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

          <div className="form-section-label" style={{ marginTop: 16 }}>Fördercheck</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
            Wähle Nutzung, Vorhaben und Bundesland — du siehst nur die Programme, die zu dir passen.
          </p>
          <FoerderCheck />
        </>
      ),
    },
    {
      icon: FolderClosed,
      titel: "Zwei Ordner: Makler & Bank",
      inhalt: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Am Ende brauchst du zwei Ordner. Der <strong>Makler-Ordner</strong> zeigt dich als seriösen,
            finanzierungssicheren Käufer (6 Kern-Dokumente, Datensparsamkeit). Der <strong>Bank-Ordner</strong>
            bündelt alle Unterlagen für die Finanzierung — passend zu deinem Objekt (Kauf, Vermietung, ETW);
            MyImmo erzeugt Kennblatt, Mietaufstellung &amp; Co. aus deinen Daten.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/makler" className="btn btn-gold" style={{ fontSize: 13 }}>
              <FolderClosed size={14} style={{ verticalAlign: "-2px" }} /> Makler-Ordner öffnen
            </Link>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--faint)", margin: "8px 0 0", display: "flex", gap: 7 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Den <strong>Bank-Ordner</strong> (Beleihungsordner mit Kennblatt, Mietaufstellung, Freigabe-Link)
              findest du objektbezogen auf der Seite des jeweiligen Objekts → Reiter „Beleihungsordner", sobald das
              Objekt in deinem Bestand ist.</span>
          </p>
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

  return (
    <>
      {/* Kurz-Guide: einklappbar, standardmäßig zu. Reine Orientierung — kein Rat. */}
      <details style={{ marginBottom: 16, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg3)" }}>
        <summary style={{ cursor: "pointer", userSelect: "none", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          So gehst du vor <span style={{ fontWeight: 400, color: "var(--faint)" }}>— der Ablauf in Kürze</span>
        </summary>
        <div style={{ padding: "0 16px 14px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            <li><strong>Bewerten:</strong> Marktwert schätzen und mit dem Kaufpreis vergleichen.</li>
            <li><strong>Durchrechnen:</strong> 3–5 Objekte eingeben, speichern und vergleichen — das beste bekommt eine Krone; übernimm es für die Finanzierung.</li>
            <li><strong>Selbstauskunft:</strong> Einnahmen, Ausgaben, Eigenkapital und Kredite einmal erfassen (verschlüsselt).</li>
            <li><strong>Finanzierung &amp; Förderung:</strong> Beispiel-Konfiguration rechnen, in Frage kommende Förderprogramme ansehen.</li>
            <li><strong>Mappe für die Bank:</strong> Unterlagen sammeln, Kreditantrag erzeugen und <strong>selbst</strong> an deine Bank(en) geben.</li>
            <li><strong>Angebote vergleichen:</strong> nach effektivem Jahreszins und Flexibilität entscheiden.</li>
          </ol>
          <p style={{ fontSize: 11, color: "var(--faint)", margin: "10px 0 0" }}>
            MyImmo rechnet, sortiert und bereitet Unterlagen vor — es vermittelt keine Darlehen und
            gibt keine Finanzierungsempfehlung. Die Entscheidung triffst du selbst.
          </p>
        </div>
      </details>

      {/* Meilenstein-Badges: bestätigen erreichte, real berechnete Schritte
          (kein Score, keine Objekt-Wertung). Reihenfolge = Ablauf. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {[
          { id: "bew", label: "Objekt bewertet", an: !!bewertung && bewertung.marktwert > 0, cls: "badge-gold" },
          { id: "obj", label: "Objekt gewählt", an: !!auswahl && auswahl.kp > 0, cls: "badge-gold" },
          { id: "fin", label: "Finanzen erfasst", an: !!selbstauskunft, cls: "badge-green" },
          { id: "darl", label: "Finanzierung gerechnet", an: !!darlehenWunsch && darlehenWunsch.darlehen > 0, cls: "badge-green" },
        ].map((b) => (
          <span key={`${b.id}-${b.an}`}
            className={`badge ${b.an ? `${b.cls} badge-pop` : "badge-muted"}`}
            style={{ opacity: b.an ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {b.an && <Check size={11} />} {b.label}
          </span>
        ))}
      </div>

      <AblaufStepper schritte={schritte} storageKey="myimmo_kauf_fortschritt" />
    </>
  );
}
