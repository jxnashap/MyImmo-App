"use client";
import { Save, FileText } from "lucide-react";

import BriefBlatt from "@/components/BriefBlatt";
import BriefVersand from "@/components/BriefVersand";
import SubmitButton from "@/components/SubmitButton";

import { useState, useTransition } from "react";
import { normMietart } from "@/lib/mietart";
import type { Tenant, Property, VermieterProfil, Iban } from "@/lib/types";
import {
  ARTEN,
  TITEL,
  DEFAULT_VORLAGEN,
  PLATZHALTER,
  ART_ZEIGT_BETRAG,
  ART_ZEIGT_KONTO,
  ART_BETRAG_RUECKFALL,
  BETRAG_LABEL,
  DATUM_LABEL,
  briefDatum,
  fehlendePlatzhalter,
  satzanfangGross,
  fuelleVorlage,
  ART_BESCHEINIGUNG,
  briefZusatzWerte,
  monatText,
  type DocArt,
} from "@/lib/dokumentVorlagen";
import { saveDokumentVorlage, resetDokumentVorlage } from "@/lib/actions/dokumentVorlagen";
import { speichereBrief } from "@/lib/actions/dokumente";
import { tastaturAktion } from "@/lib/a11y";
import type { MietkontoZeitraum } from "@/lib/mietkonto";
import {
  BEGRUENDUNGSMITTEL,
  BEGRUENDUNG_PFLICHT,
  REPARATUR_HINWEIS,
  SCHRIFTFORM,
  alleMieter,
  anrede,
  deDatum,
  digitalGesperrt,
  empfaengerNamenZeilen,
  fruehestWirksam,
  fruehesterKuendigungstermin,
  istIsoDatum,
  mieterhoehungBasis,
  namenAufzaehlung,
  pruefeBrief,
} from "@/lib/briefPruefung";
import { useToast } from "@/components/Toast";
import { adressZeilen, mieterAnschrift } from "@/lib/format";

const fmtIban = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();
const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  " €";
// Gleiche Schreibweise wie im PDF (lib/pdf/erzeugen.ts): „6. Oktober 2026“.
const deDate = briefDatum;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DocGenerator({
  tenant,
  property,
  vermieter,
  ibans = [],
  vorlagen = {},
  initial,
  hatUnterschrift = false,
  mietVerlauf,
  heute: heuteIso,
}: {
  tenant: Tenant;
  property: Property | null;
  vermieter: VermieterProfil | null;
  ibans?: Iban[];
  vorlagen?: Record<string, string>;
  /** Vorbefüllung (z. B. aus dem Rückstands-Wächter): art/betrag/datum/grund */
  initial?: { art?: string; betrag?: string; datum?: string; grund?: string; monat?: string };
  /** true, wenn in den Einstellungen eine E-Signatur hinterlegt ist. */
  hatUnterschrift?: boolean;
  /** Mieterfelder OHNE Zeitraum-Anpassung + Miet-Zeiträume — für Kappungsgrenze und Sperrfrist (P3). */
  mietVerlauf?: {
    stand: { kaltmiete: number | null; nk_vorauszahlung: number | null; stellplatz_miete: number | null };
    zeitraeume: MietkontoZeitraum[];
  };
  /** Stichtag vom Server (Berlin), damit Vorschau und PDF denselben Tag sehen. */
  heute?: string;
}) {
  const initialAbsAdr = [
    vermieter?.strasse,
    [vermieter?.plz, vermieter?.ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const startArt: DocArt = ARTEN.some((a) => a.v === initial?.art) ? (initial!.art as DocArt) : "allgemein";
  const [art, setArt] = useState<DocArt>(startArt);
  const [betrag, setBetrag] = useState(initial?.betrag ?? "");
  const [datum, setDatum] = useState(initial?.datum ?? "");
  const [grund, setGrund] = useState(initial?.grund ?? "");
  // P4 (B38/C43/B41): Zusatzfelder, die nur einzelne Arten nutzen — gezeigt, wenn die Vorlage den
  // Platzhalter enthält. „2026-10“ aus der URL wird als „Oktober 2026“ angezeigt.
  const [monat, setMonat] = useState(monatText(initial?.monat));
  const [personen, setPersonen] = useState(() =>
    alleMieter(`${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim(), tenant.weitere_mieter).join("\n"),
  );
  const [einzug, setEinzug] = useState(tenant.mietbeginn?.slice(0, 10) ?? "");
  const [eigentuemerAnderer, setEigentuemerAnderer] = useState(false);
  const [eigentuemer, setEigentuemer] = useState("");
  const [ibanId, setIbanId] = useState("");
  const [vName, setVName] = useState(vermieter?.name ?? "");
  const [vAdr, setVAdr] = useState(initialAbsAdr);
  const [vorlageText, setVorlageText] = useState(vorlagen[startArt] ?? DEFAULT_VORLAGEN[startArt]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [signieren, setSignieren] = useState(false);
  // Zugang beim Mieter: Grundlage der Fristen (§ 573c, § 558b BGB). Bewusst leer — „heute“ wäre
  // um den Monatsersten herum oft falsch, und ein zu früher Zugang ergäbe einen zu frühen Termin.
  const [zugang, setZugang] = useState("");
  const [ablegen, startAblegen] = useTransition();
  const toast = useToast();

  const zeigtBetrag = ART_ZEIGT_BETRAG.includes(art);
  const zeigtKonto = ART_ZEIGT_KONTO.includes(art);
  const selectedIban = ibans.find((x) => x.id === ibanId) ?? null;
  const betragLabel = BETRAG_LABEL[art] ?? "Betrag (€)";
  const datumLabel = DATUM_LABEL[art] ?? "Datum";
  // Datumsfeld nur, wenn die Vorlage das Datum auch benutzt.
  const zeigtDatum = vorlageText.includes("{{datum}}");

  function wechselArt(v: DocArt) {
    setArt(v);
    setVorlageText(vorlagen[v] ?? DEFAULT_VORLAGEN[v] ?? "");
    setSaveState("idle");
  }

  async function speichern() {
    setSaveState("saving");
    try {
      await saveDokumentVorlage(art, vorlageText);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function zuruecksetzen() {
    setVorlageText(DEFAULT_VORLAGEN[art] ?? "");
    setSaveState("idle");
    try {
      await resetDokumentVorlage(art);
    } catch {
      /* ignore */
    }
  }

  // --- Werte für Platzhalter (identisch zur PDF-Route) ---
  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  // B44: alle Vertragspartner — Platzhalter {{mieter}}, Adressfeld, Anrede (wie lib/pdf/erzeugen.ts).
  const namen = alleMieter(mieterName, tenant.weitere_mieter);
  const mieterText = namenAufzaehlung(namen);
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";
  const miete = tenant.kaltmiete ?? 0;
  const nkvz = tenant.nk_vorauszahlung ?? 0;
  const warm = miete + nkvz + (tenant.stellplatz_miete ?? 0);
  const betragNum = parseFloat(betrag) || 0; // type="number"
  // Wie im PDF: ohne Eingabe die geschuldete Warmmiete.
  const effBetrag = betragNum > 0 ? betragNum : ART_BETRAG_RUECKFALL.includes(art) ? warm : 0;
  const werte: Record<string, string> = {
    mieter: mieterText || "–",
    objekt,
    betrag: effBetrag > 0 ? eur(effBetrag) : "",
    miete: miete > 0 ? eur(miete) : "",
    datum: deDate(datum),
    grund: grund.trim(),
    mieterkonto: tenant.iban ? fmtIban(tenant.iban) : "",
    mietbeginn: tenant.mietbeginn ? deDate(tenant.mietbeginn) : "–",
    nkvz: nkvz > 0 ? eur(nkvz) : "0,00 €",
    warmmiete: warm > 0 ? eur(warm) : "",
    vermieter: vName || "–",
    ...briefZusatzWerte(
      { monat, personen, einzug, eigentuemerAnderer: eigentuemerAnderer ? "1" : "", eigentuemer },
      { namen, mietbeginn: tenant.mietbeginn, vermieterAdresse: vAdr },
    ),
  };
  const istBescheinigung = ART_BESCHEINIGUNG.includes(art);
  const gefuellt = fuelleVorlage(vorlageText, werte);
  const absaetze = istBescheinigung ? satzanfangGross(gefuellt) : gefuellt;
  // Leere Platzhalter ergäben halbe Sätze („bis spätestens zu begleichen“) — dann kein PDF.
  const fehlend = fehlendePlatzhalter(vorlageText, werte);
  // Gesamtprüfung P3: DIESELBE Prüfung wie der Server (lib/pdf/erzeugen.ts) — Absender, Pflicht-
  // Begründung, Zugang, Fristen, Kappungsgrenze. Fehler sperren PDF, Archiv und Versand.
  const heuteYm = (heuteIso ?? new Date().toISOString()).slice(0, 7);
  const pruefung = pruefeBrief({
    art,
    text: vorlageText,
    grund,
    vName,
    datum,
    zugang,
    kuendigung: { ueberlassung: tenant.mietbeginn },
    mieterhoehung: {
      ...mieterhoehungBasis(
        { ...(mietVerlauf?.stand ?? tenant), mietbeginn: tenant.mietbeginn, letzte_erhoehung: tenant.letzte_erhoehung },
        mietVerlauf?.zeitraeume ?? [],
        datum,
        heuteYm,
      ),
      neueMiete: betragNum,
    },
    mieterAnzahl: namen.length,
  });
  const fehlendText = [
    ...fehlend.map((k) => (k === "datum" ? datumLabel : k === "betrag" ? betragLabel.replace(" (€)", "") : PLATZHALTER.find((p) => p.key === k)?.label ?? k)),
    ...pruefung.fehlend,
  ].join(", ");
  const blockiert = fehlend.length > 0 || pruefung.fehlend.length > 0 || pruefung.fehler.length > 0;
  const pflichtGrund = BEGRUENDUNG_PFLICHT.includes(art);
  const schriftform = SCHRIFTFORM[art];
  const nurPapier = digitalGesperrt(art);
  const kuendTermin = art === "kuendigung" && istIsoDatum(zugang) ? fruehesterKuendigungstermin(zugang, tenant.mietbeginn) : null;
  const erhoehungAb = art === "mieterhoehung" && istIsoDatum(zugang) ? fruehestWirksam(zugang) : null;

  // --- Vorschau-Daten ---
  const absName = vName || "–";
  const heute = deDate(heuteIso ?? new Date().toISOString());
  const ortDatum = (vermieter?.ort ? vermieter.ort.replace(/^\d{4,5}\s*/, "") + ", " : "") + heute;
  // Anschrift-Fallback OHNE Objektnamen: Der interne Name („ETW Lindenstraße 12")
  // enthält oft selbst die Straße — mit `objekt` als Fallback stand sie im
  // Adressfeld doppelt. Postalisch zählt nur Einheit + Adresse.
  const empfZeilen = adressZeilen(mieterAnschrift(tenant, property));
  const titel = TITEL[art];
  // Dieselben Felder für PDF-Download, Archiv und Versand (BriefVersand).
  const felder = {
    art, datum, betrag, grund, ibanId, vName, vAdr, text: vorlageText,
    signieren: signieren && !nurPapier ? "1" : "", zugang,
    monat, personen, einzug, eigentuemerAnderer: eigentuemerAnderer ? "1" : "", eigentuemer,
  };


  return (
    // `data-demo-erlaubt`: Der Brief-Generator ist das EINZIGE Werkzeug, das in
    // der Demo bedienbar bleibt (Vorgabe Betreiber 30.08.2026) — als Beispiel
    // zum Selbstzusammenstellen, inklusive PDF. `components/DemoNurLesen.tsx`
    // laesst alles innerhalb dieses Bereichs in Ruhe. Gespeichert wird trotzdem
    // nichts: `speichereBrief` und `saveDokumentVorlage` laufen gegen die
    // RLS-Schreibsperre des Demo-Kontos.
    <div data-demo-erlaubt style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---------- Eingaben + Vorlagen-Editor ---------- */}
      <div className="form-box no-print" style={{ maxWidth: 460, flex: "1 1 420px" }}>
        <h3>Dokument erstellen</h3>
        <p>Brief an den Mieter — Vorschau prüfen, dann als PDF herunterladen.</p>

        {!vermieter && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              background: "rgba(240,160,48,0.1)",
              border: "1px solid rgba(240,160,48,0.3)",
              borderRadius: 7,
              fontSize: 12,
              color: "var(--amber)",
            }}
          >
            Tipp: Hinterlege deinen Absender unter <strong>Einstellungen</strong>, dann ist der
            Briefkopf automatisch gefüllt.
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Dokumentart</label>
            <select value={art} onChange={(e) => wechselArt(e.target.value as DocArt)}>
              {ARTEN.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {zeigtDatum && (
            <div className="form-group">
              <label>{datumLabel}</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                aria-invalid={fehlend.includes("datum") || undefined}
                style={fehlend.includes("datum") ? { borderColor: "var(--red)" } : undefined}
              />
            </div>
          )}
        </div>
        {/* P4 (B39): Die Vorlage deckt Erhaltung ab, keine Modernisierungsankündigung nach § 555c BGB. */}
        {art === "reparatur" && (
          <div role="note" className="brief-warnung" style={{ marginBottom: 12 }}>{REPARATUR_HINWEIS}</div>
        )}
        {/* P4 (B38, C43): Welche Miete? Ohne Monat bleibt offen, worauf sich Erinnerung, Mahnung oder Quittung bezieht. */}
        {vorlageText.includes("{{monat}}") && (
          <div className="form-row single">
            <div className="form-group">
              <label htmlFor="brief-monat">Mietmonat *</label>
              <input
                id="brief-monat"
                value={monat}
                onChange={(e) => setMonat(e.target.value)}
                placeholder="z. B. Oktober 2026"
                aria-invalid={fehlend.includes("monat") || undefined}
                style={fehlend.includes("monat") ? { borderColor: "var(--red)" } : undefined}
              />
              {art === "mietquittung" && (
                <div className="brief-hinweis">
                  Die Quittung bestätigt, was eingegangen ist (§ 368 BGB) — Betrag und Tag so eintragen, wie die Zahlung kam.
                  Am einfachsten aus dem Mietkonto: dort steht bei jedem bestätigten Eingang „Quittung“.
                </div>
              )}
            </div>
          </div>
        )}
        {/* P4 (B41): Pflichtangaben der Wohnungsgeberbestätigung nach § 19 Abs. 3 BMG. */}
        {vorlageText.includes("{{einzug}}") && (
          <div className="form-row single">
            <div className="form-group">
              <label htmlFor="brief-einzug">Einzugsdatum *</label>
              <input
                id="brief-einzug"
                type="date"
                value={einzug}
                onChange={(e) => setEinzug(e.target.value)}
                aria-invalid={fehlend.includes("einzug") || undefined}
                style={fehlend.includes("einzug") ? { borderColor: "var(--red)" } : undefined}
              />
              <div className="brief-hinweis">
                Der Tag des tatsächlichen Einzugs — nicht zwingend der Mietbeginn. Die Anmeldung ist binnen zwei Wochen nach dem Einzug fällig (§ 17 Abs. 1 BMG).
              </div>
            </div>
          </div>
        )}
        {vorlageText.includes("{{personen}}") && (
          <div className="form-row single">
            <div className="form-group">
              <label htmlFor="brief-personen">Einziehende Personen * (je Zeile ein Name)</label>
              <textarea
                id="brief-personen"
                rows={3}
                value={personen}
                onChange={(e) => setPersonen(e.target.value)}
                aria-invalid={fehlend.includes("personen") || undefined}
                style={{ resize: "vertical", ...(fehlend.includes("personen") ? { borderColor: "var(--red)" } : {}) }}
              />
              <div className="brief-hinweis">Alle, die einziehen und sich anmelden müssen — auch Kinder und Mitbewohner, die nicht im Vertrag stehen.</div>
            </div>
          </div>
        )}
        {vorlageText.includes("{{eigentuemer}}") && (
          <div className="form-row single">
            <fieldset className="form-group" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 12, marginBottom: 6 }}>Eigentümer der Wohnung *</legend>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="radio" name="brief-eigentuemer" checked={!eigentuemerAnderer} onChange={() => setEigentuemerAnderer(false)} />
                Ich (der Wohnungsgeber) bin Eigentümer
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 4 }}>
                <input type="radio" name="brief-eigentuemer" checked={eigentuemerAnderer} onChange={() => setEigentuemerAnderer(true)} />
                Jemand anderes ist Eigentümer (z. B. bei Untervermietung)
              </label>
              {eigentuemerAnderer && (
                <input
                  aria-label="Name des Eigentümers"
                  value={eigentuemer}
                  onChange={(e) => setEigentuemer(e.target.value)}
                  placeholder="Name des Eigentümers"
                  style={{ marginTop: 6, ...(fehlend.includes("eigentuemer") ? { borderColor: "var(--red)" } : {}) }}
                />
              )}
            </fieldset>
          </div>
        )}
        {/* Gesamtprüfung P3: Fristen hängen am Zugang (§ 573c Abs. 1, § 558b Abs. 1 BGB). */}
        {pflichtGrund && (
          <div className="form-row single">
            <div className="form-group">
              <label htmlFor="brief-zugang">Zugang beim Mieter (voraussichtlich) *</label>
              <input
                id="brief-zugang"
                type="date"
                value={zugang}
                onChange={(e) => setZugang(e.target.value)}
                aria-invalid={pruefung.fehlend.includes("Zugang beim Mieter") || undefined}
                style={pruefung.fehlend.includes("Zugang beim Mieter") ? { borderColor: "var(--red)" } : undefined}
              />
              <div className="brief-hinweis">
                Der Tag, an dem der Brief beim Mieter ankommt — davon hängen die Fristen ab. Im Zweifel einen späteren Tag eintragen.
              </div>
              {kuendTermin && (
                <div className="brief-vorschlag">
                  <span>
                    Frühestens zum <strong>{deDatum(kuendTermin.termin)}</strong> (Frist {kuendTermin.fristMonate} Monate, Zugang bis {deDatum(kuendTermin.zugangBis)})
                  </span>
                  {datum !== kuendTermin.termin && (
                    <button type="button" className="btn btn-ghost" onClick={() => setDatum(kuendTermin.termin)}>Übernehmen</button>
                  )}
                  {kuendTermin.sichererTermin !== kuendTermin.termin && datum !== kuendTermin.sichererTermin && (
                    <button type="button" className="btn btn-ghost" onClick={() => setDatum(kuendTermin.sichererTermin)}>
                      {deDatum(kuendTermin.sichererTermin)} übernehmen
                    </button>
                  )}
                </div>
              )}
              {erhoehungAb && (
                <div className="brief-vorschlag">
                  <span>Frühestens wirksam ab <strong>{deDatum(erhoehungAb)}</strong> (§ 558b Abs. 1 BGB)</span>
                  {datum !== erhoehungAb && (
                    <button type="button" className="btn btn-ghost" onClick={() => setDatum(erhoehungAb)}>Übernehmen</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* § 558 gilt nicht bei Staffel- oder Indexmiete (§ 557a Abs. 2, § 557b Abs. 2 BGB; Audit P7, B8). */}
        {art === "mieterhoehung" && normMietart(tenant.mietart) !== "standard" && (
          <div role="note" style={{ fontSize: 12.5, marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(240,160,48,0.08)", border: "1px solid rgba(240,160,48,0.3)" }}>
            {normMietart(tenant.mietart) === "staffel"
              ? "Dieser Mieter hat eine Staffelmiete: Eine Erhöhung auf die Vergleichsmiete (§ 558 BGB) ist ausgeschlossen (§ 557a Abs. 2 BGB) — die Miete steigt nur nach den vereinbarten Stufen."
              : "Dieser Mieter hat eine Indexmiete: Eine Erhöhung auf die Vergleichsmiete (§ 558 BGB) ist ausgeschlossen (§ 557b Abs. 2 BGB) — angepasst wird nur nach dem Verbraucherpreisindex."}
          </div>
        )}
        {zeigtBetrag && (
          <div className="form-row single">
            <div className="form-group">
              <label>{betragLabel}</label>
              <input
                type="number"
                step="0.01"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="form-row single">
          <div className="form-group">
            <label htmlFor="brief-grund">
              {art === "kuendigung" ? "Kündigungsgründe *" : art === "mieterhoehung" ? "Begründung *" : "Begründung / Zusatztext (optional)"}
            </label>
            {art === "mieterhoehung" && (
              <select
                aria-label="Begründungsmittel einfügen"
                value=""
                onChange={(e) => {
                  const b = BEGRUENDUNGSMITTEL.find((x) => x.key === e.target.value);
                  if (b) setGrund((g) => (g.trim() ? `${g.trim()}\n\n${b.text}` : b.text));
                }}
                style={{ marginBottom: 6 }}
              >
                <option value="">Begründungsmittel einfügen …</option>
                {BEGRUENDUNGSMITTEL.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            )}
            <textarea
              id="brief-grund"
              rows={pflichtGrund ? 4 : 2}
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              aria-invalid={pruefung.fehlend.includes("Begründung") || undefined}
              style={{ resize: "vertical", ...(pruefung.fehlend.includes("Begründung") ? { borderColor: "var(--red)" } : {}) }}
            />
            {art === "mieterhoehung" && (
              <div className="brief-hinweis">
                Ohne Begründung ist das Verlangen unwirksam (§ 558a Abs. 1 BGB). Lücken in [eckigen Klammern] ausfüllen. Gibt es einen
                qualifizierten Mietspiegel mit Angaben zu dieser Wohnung, gehören diese Angaben auch dann in den Brief, wenn du dich auf
                ein anderes Mittel stützt (§ 558a Abs. 3 BGB).
              </div>
            )}
            {art === "kuendigung" && (
              <div className="brief-hinweis">
                Die Gründe müssen im Schreiben stehen; andere zählen später nur, wenn sie nachträglich entstanden sind (§ 573 Abs. 3 BGB).
              </div>
            )}
          </div>
        </div>

        {/* Vorlagetext bearbeiten + speichern */}
        <div className="form-section-label">Vorlagetext (wird gespeichert)</div>
        <div className="form-group">
          <textarea
            rows={9}
            value={vorlageText}
            onChange={(e) => {
              setVorlageText(e.target.value);
              setSaveState("idle");
            }}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", margin: "6px 0 8px", lineHeight: 1.7 }}>
          Platzhalter:{" "}
          {PLATZHALTER.map((p) => (
            <code
              key={p.key}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--line2)",
                borderRadius: 5,
                padding: "1px 5px",
                marginRight: 5,
                fontSize: 11,
                whiteSpace: "nowrap",
              }}
              title={p.label}
            >{`{{${p.key}}}`}</code>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={speichern} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Vorlage speichern</>}
          </button>
          <button type="button" className="btn btn-ghost" onClick={zuruecksetzen}>
            Zurücksetzen
          </button>
          {saveState === "saved" && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Gespeichert</span>}
          {saveState === "error" && <span style={{ fontSize: 12, color: "var(--red)" }}>Fehler beim Speichern</span>}
        </div>

        {zeigtKonto && (
          <>
            <div className="form-section-label">Zahlungskonto (optional)</div>
            {ibans.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--faint)", padding: "4px 0 8px" }}>
                Noch keine IBANs — unter <strong>Einstellungen</strong> anlegen, dann erscheinen sie
                hier.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {ibans.map((x) => {
                  const sel = x.id === ibanId;
                  return (
                    <div
                      key={x.id}
                      onClick={() => setIbanId(sel ? "" : x.id)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={sel}
                      aria-label={`Zahlungskonto ${x.kontoname || x.inhaber || x.iban}${sel ? " abwählen" : " auswählen"}`}
                      onKeyDown={tastaturAktion(() => setIbanId(sel ? "" : x.id))}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 7,
                        border: `1px solid ${sel ? "var(--gold)" : "var(--line2)"}`,
                        background: sel ? "var(--gold-pale)" : "var(--bg3)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          border: `2px solid ${sel ? "var(--gold)" : "var(--line2)"}`,
                          background: sel ? "var(--gold-fill)" : "transparent",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {x.kontoname}
                          {x.inhaber ? " · " + x.inhaber : ""}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                          {fmtIban(x.iban)}
                        </div>
                      </div>
                      {sel && <span style={{ color: "var(--gold)" }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="form-section-label">Absender</div>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input value={vName} onChange={(e) => setVName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input
              value={vAdr}
              onChange={(e) => setVAdr(e.target.value)}
              placeholder="Straße, PLZ Ort"
            />
          </div>
        </div>
      </div>

      {/* ---------- Vorschau: DIN-A4-Brief-Blatt (zugleich Druckvorlage) ---------- */}
      <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        <BriefBlatt
          absenderName={absName}
          absenderZeile={[vAdr ? vAdr.split(/,\s*/).join(" · ") : null, vermieter?.email].filter(Boolean).join(" · ") || null}
          ruecksende={null /* wie im PDF: kein Rücksendevermerk im Adressfeld */}
          vermerk="Vertrauliches Dokument"
          empfaenger={[...empfaengerNamenZeilen(namen), ...empfZeilen]}
          ortDatum={ortDatum}
          betreff={titel}
          untertitel={`Mietobjekt: ${objekt}`}
        >
          {!istBescheinigung && <p>{anrede(namen)}</p>}
          {absaetze.length === 0 ? (
            <p className="brief-muted" style={{ fontStyle: "italic" }}>
              (Noch kein Text — Felder ausfüllen oder Vorlage bearbeiten.)
            </p>
          ) : (
            absaetze.map((p, i) => <p key={i}>{p}</p>)
          )}

          {zeigtKonto && selectedIban && (
            <div className="brief-konto">
              <div style={{ fontWeight: 700 }}>Bitte überweisen Sie auf folgendes Konto:</div>
              <div style={{ marginTop: 4 }}>{selectedIban.inhaber || absName}</div>
              <div className="iban">IBAN {fmtIban(selectedIban.iban)}</div>
              {selectedIban.kontoname && (
                <div className="brief-muted">{selectedIban.kontoname}</div>
              )}
            </div>
          )}

          {istBescheinigung ? (
            <p style={{ marginTop: 40, borderTop: "1px solid var(--line2)", maxWidth: 220, paddingTop: 4, fontSize: 11, color: "var(--muted)" }}>
              {vName || "–"} (Vermieter / Wohnungsgeber)
            </p>
          ) : (
          <p style={{ marginTop: 26 }}>Mit freundlichen Grüßen</p>
          )}
          {!istBescheinigung && <p style={{ marginTop: 40 }}>{absName}</p>}
        </BriefBlatt>

        {/* PDF-Download: Route liefert attachment → Download ohne neues Fenster */}
        <form
          action={`/tenants/${tenant.id}/dokument/pdf`}
          method="POST"
          className="no-print"
          style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <input type="hidden" name="art" value={art} />
          <input type="hidden" name="datum" value={datum} />
          <input type="hidden" name="betrag" value={betrag} />
          <input type="hidden" name="grund" value={grund} />
          <input type="hidden" name="ibanId" value={ibanId} />
          <input type="hidden" name="vName" value={vName} />
          <input type="hidden" name="vAdr" value={vAdr} />
          <input type="hidden" name="text" value={vorlageText} />
          <input type="hidden" name="signieren" value={felder.signieren} />
          <input type="hidden" name="zugang" value={zugang} />
          <input type="hidden" name="monat" value={monat} />
          <input type="hidden" name="personen" value={personen} />
          <input type="hidden" name="einzug" value={einzug} />
          <input type="hidden" name="eigentuemerAnderer" value={felder.eigentuemerAnderer} />
          <input type="hidden" name="eigentuemer" value={eigentuemer} />
          {nurPapier ? (
            <span style={{ fontSize: 11, color: "var(--faint)", marginRight: "auto" }}>
              Ohne eingebettete Unterschrift — bitte ausdrucken und eigenhändig unterschreiben.
            </span>
          ) : hatUnterschrift ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", marginRight: "auto", cursor: "pointer" }}>
              <input type="checkbox" checked={signieren} onChange={(e) => setSignieren(e.target.checked)} />
              Digital signieren (E-Signatur einbetten)
            </label>
          ) : (
            <span style={{ fontSize: 11, color: "var(--faint)", marginRight: "auto" }}>
              Tipp: In den Einstellungen eine E-Signatur hinterlegen, um PDFs digital zu unterschreiben.
            </span>
          )}
          {fehlendText && (
            <span role="status" style={{ flexBasis: "100%", fontSize: 12, color: "var(--red)" }}>
              Bitte noch ausfüllen: {fehlendText}.{fehlend.length > 0 ? " Sonst entsteht ein unvollständiger Satz." : ""}
            </span>
          )}
          {pruefung.fehler.map((t) => (
            <span key={t} role="alert" style={{ flexBasis: "100%", fontSize: 12, color: "var(--red)" }}>{t}</span>
          ))}
          {pruefung.warnungen.map((t) => (
            <span key={t} className="brief-warnung">{t}</span>
          ))}
          {schriftform && (
            <span className={schriftform.stufe === "pflicht" ? "brief-schriftform" : "brief-warnung"}>{schriftform.text}</span>
          )}
          <button data-demo-sperre
            type="button"
            className="btn btn-outline"
            disabled={ablegen || blockiert}
            onClick={() =>
              startAblegen(async () => {
                const res = await speichereBrief(tenant.id, felder);
                toast(res.ok ? "Beim Mieter & im Archiv gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.", res.ok ? "success" : "error");
              })
            }
          >
            {ablegen ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Im Archiv ablegen</>}
          </button>
          {blockiert ? (
            <button type="button" className="btn btn-gold" disabled><FileText size={14} style={{ verticalAlign: "-2px" }} /> Als PDF herunterladen</button>
          ) : (
            <SubmitButton><FileText size={14} style={{ verticalAlign: "-2px" }} /> Als PDF herunterladen</SubmitButton>
          )}
        </form>
        {/* Schriftform-Arten (Kündigung) nie per Mail oder Portal — dort wären sie unwirksam (A8). */}
        {!blockiert && !nurPapier && (
          <BriefVersand
            mieterId={tenant.id}
            email={tenant.email}
            mieterName={mieterText}
            betreff={titel}
            absender={vName}
            felder={felder}
          />
        )}
      </div>
    </div>
  );
}
