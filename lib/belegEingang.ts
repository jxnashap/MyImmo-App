// Belegeingang (Ablauf B, Prüfstand 11.10.2026): Upload → KI-Vorschlag → Zuordnung → Abgleich mit
// gebuchten Kosten → getrennte Vorschläge für Kostenart und Umlagefähigkeit → Freigabe → GENAU EINE
// Buchung mit Belegbezug. Reine Funktionen ohne Datenbank — dieselben Regeln für die Oberfläche
// (Prüfliste) und den Server (bucheBeleg prüft vor dem Schreiben noch einmal mit frischen Daten).
//
// Zwei Einordnungen, nie dasselbe Feld:
//   · KOSTENART (`kategorie`) — die Buchungskategorie, die die vorhandenen Auswertungen lesen
//     (Cashflow, Jahresbericht, DATEV; die Steuerauswertung übernimmt sie über ihre eigene Zuordnung).
//   · UMLAGEFÄHIGKEIT (`umlagefaehig`) — mietrechtlich, § 2 BetrKV: darf der Betrag in die
//     Nebenkostenabrechnung? Die Kategorie liefert nur einen Vorschlag; bestätigt wird je Buchung.
// Ein KI-Vorschlag ist nie eine Buchung und nie eine steuerliche oder rechtliche Beurteilung.

import { KOSTEN_KATEGORIEN } from "@/lib/kategorien";
import { istUmlagefaehig } from "@/lib/format";
import { nameNorm } from "@/lib/importCsv";

export const BELEG_MAX_BYTES = 15 * 1024 * 1024;
/** Höchstens so viele KI-Läufe je Beleg (die Datenbank setzt dieselbe Grenze durch). */
export const BELEG_MAX_VERSUCHE = 3;
/** Ein Lauf, der so lange „in Arbeit“ steht, gilt als abgebrochen (Datenbank: 5 Minuten). */
export const BELEG_SPERRE_MS = 5 * 60 * 1000;

export type Umlage = "ja" | "nein" | "unklar";
export type Kostenart = (typeof KOSTEN_KATEGORIEN)[number];

export type BelegVorschlag = {
  datum: string | null;
  betrag: number | null;
  aussteller: string | null;
  rechnungsnummer: string | null;
  leistung: string | null;
  /** Kostenart aus der festen Liste — oder null, wenn die KI etwas anderes vorschlug (`kategorieRoh`). */
  kategorie: Kostenart | null;
  kategorieRoh: string | null;
  /** Umlagefähigkeit nach § 2 BetrKV — getrennt von der Kostenart vorgeschlagen. */
  umlage: Umlage | null;
  umlageGrund: string | null;
  /** Anschrift/Objekt, wie sie auf dem Beleg steht. */
  objektHinweis: string | null;
};

export const BELEG_PROMPT = `Du liest eine Rechnung oder einen Gebührenbescheid für eine vermietete Immobilie. Du BUCHST nichts und
beurteilst nichts steuerlich oder rechtlich — du liest nur ab und machst Vorschläge, die ein Mensch prüft.

Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{
  "datum": "2026-03-14",
  "betrag": 1234.56,
  "aussteller": "Name des Rechnungsstellers",
  "rechnungsnummer": "RE-2026-0042",
  "leistung": "kurze Beschreibung der Leistung, höchstens 80 Zeichen",
  "kostenart": "eine aus der Liste unten",
  "umlagefaehig": "ja" | "nein" | "unklar",
  "umlage_grund": "ein Satz, warum",
  "objekt": "Anschrift oder Objektbezeichnung auf dem Beleg"
}

Regeln:
- "datum": Rechnungs- bzw. Bescheiddatum als JJJJ-MM-TT. Nicht erkennbar → null.
- "betrag": der zu zahlende GESAMTBETRAG brutto. Deutsches Format umrechnen ("1.234,56" = 1234.56).
  Keine Zwischensummen, keine Vorjahreswerte. Nicht erkennbar → null. Nie raten.
- "kostenart" ist die Buchungskategorie, genau eine aus: ${KOSTEN_KATEGORIEN.join(", ")}.
  Passt keine, schreibe deinen Vorschlag trotzdem hinein — er wird dann geprüft.
- "umlagefaehig" ist eine ANDERE Frage als die Kostenart: Darf der Betrag nach § 2 Betriebskostenverordnung
  auf Mieter umgelegt werden? Reparaturen, Instandhaltung, Verwaltung und Rücklagen: "nein". Gemischte
  Rechnungen (z. B. Hausmeister mit Reparaturanteil, Hausgeld) oder Zweifel: "unklar".
- Fehlt ein Wert, setze null. Lies Zahlen Ziffer für Ziffer ab.`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  return s ? s.slice(0, max) : null;
};

/** KI-Antwort robust lesen. Unplausibles wird null — nie eine Zahl, die nicht im Text stand. */
export function leseBelegVorschlag(antwort: string): BelegVorschlag | null {
  const m = antwort.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let roh: Record<string, unknown>;
  try {
    const p = JSON.parse(m[0]);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    roh = p as Record<string, unknown>;
  } catch {
    return null;
  }
  const datumRoh = text(roh.datum, 10);
  const datum = datumRoh && ISO.test(datumRoh) && datumGueltig(datumRoh) ? datumRoh : null;
  const b = typeof roh.betrag === "number" ? roh.betrag : typeof roh.betrag === "string" ? Number(roh.betrag) : NaN;
  const betrag = Number.isFinite(b) && b > 0 && b < 10_000_000 ? Math.round(b * 100) / 100 : null;
  const kategorieRoh = text(roh.kostenart, 60);
  const kategorie = (KOSTEN_KATEGORIEN as readonly string[]).find((k) => k.toLowerCase() === (kategorieRoh ?? "").toLowerCase()) as Kostenart | undefined;
  const u = text(roh.umlagefaehig, 10)?.toLowerCase();
  return {
    datum,
    betrag,
    aussteller: text(roh.aussteller, 120),
    rechnungsnummer: text(roh.rechnungsnummer, 60),
    leistung: text(roh.leistung, 120),
    kategorie: kategorie ?? null,
    kategorieRoh: kategorie ? null : kategorieRoh,
    umlage: u === "ja" || u === "nein" || u === "unklar" ? u : null,
    umlageGrund: text(roh.umlage_grund, 200),
    objektHinweis: text(roh.objekt, 160),
  };
}

function datumGueltig(iso: string): boolean {
  const [j, mo, t] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(j, mo - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === mo - 1 && d.getUTCDate() === t && j >= 2000 && j <= 2100;
}

const tage = (a: string, b: string) =>
  Math.abs(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86_400_000;

/**
 * Objekt aus der Anschrift auf dem Beleg: nur, wenn GENAU EIN Objekt passt (Straße + Hausnummer bzw.
 * Bezeichnung kommt im Hinweis vor). Mehrdeutig oder nichts → null, der Vermieter wählt.
 */
export function objektVorschlag(hinweis: string | null, objekte: { id: string; bezeichnung: string | null; adresse: string | null }[]): string | null {
  const h = nameNorm(hinweis).replace(/str\./g, "straße").replace(/strasse/g, "straße");
  if (h.length < 4) return null;
  const passend = objekte.filter((o) => {
    const strasse = nameNorm((o.adresse ?? "").split(",")[0]).replace(/str\./g, "straße").replace(/strasse/g, "straße");
    const bez = nameNorm(o.bezeichnung);
    return (strasse.length >= 5 && h.includes(strasse)) || (bez.length >= 5 && h.includes(bez));
  });
  return passend.length === 1 ? passend[0].id : null;
}

// ---------------------------------------------------------------------------- Prüfliste --

export type KostenZeile = {
  id: string;
  prop_id: string | null;
  buchungsdatum: string | null;
  betrag: number | string | null;
  kategorie: string | null;
  beschreibung: string | null;
  rechnung_path: string | null;
  beleg_eingang_id: string | null;
};

export type EingangZeile = { id: string; datei_hash: string; status: string; datei_name?: string | null; created_at?: string | null };

export type PruefArt =
  | "betrag_fehlt"
  | "datum_fehlt"
  | "kategorie_unbekannt"
  | "objekt_fehlt"
  | "dublette_datei"
  | "dublette_buchung"
  | "zahlung_unklar"
  | "umlage_pruefen";

export type Pruefpunkt = {
  art: PruefArt;
  text: string;
  /** Sperrt die Buchung, bis der Punkt behoben (bzw. — bei Dubletten — ausdrücklich bestätigt) ist. */
  sperrt: boolean;
};

export type BelegEingabe = {
  eintragId: string;
  datei_hash: string;
  prop_id: string | null;
  /** Ausdrücklich „ohne Objekt“ gewählt (Verwaltungskosten, Kontogebühren …). */
  ohneObjekt?: boolean;
  kategorie: string | null;
  umlagefaehig: string | null;
  betrag: number | null;
  datum: string | null;
  rechnungsnummer?: string | null;
};

const euro = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const datumDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const gleicherBetrag = (a: number | string | null, b: number) => Math.abs((Number(a) || 0) - b) < 0.005;

/**
 * Prüfliste eines Belegs — die Gründe, warum er NICHT ohne Blick gebucht werden soll — und die
 * schon gebuchten Kosten, an die sich der Beleg hängen lässt (gleicher Betrag, ±45 Tage, noch ohne
 * Beleg; z. B. eine wiederkehrende Grundsteuer-Buchung). Gibt es mehrere, ist die Zahlung unklar.
 */
export function pruefeBeleg(
  e: BelegEingabe,
  kontext: { kosten: KostenZeile[]; eingaenge: EingangZeile[] },
): { punkte: Pruefpunkt[]; anhaengbar: KostenZeile[] } {
  const punkte: Pruefpunkt[] = [];
  if (!(e.betrag != null && e.betrag > 0)) punkte.push({ art: "betrag_fehlt", text: "Betrag fehlt.", sperrt: true });
  if (!(e.datum && ISO.test(e.datum) && datumGueltig(e.datum))) punkte.push({ art: "datum_fehlt", text: "Rechnungsdatum fehlt.", sperrt: true });
  if (!(KOSTEN_KATEGORIEN as readonly string[]).includes(e.kategorie ?? "")) {
    punkte.push({ art: "kategorie_unbekannt", text: e.kategorie ? `Kostenart „${e.kategorie}“ gibt es nicht — bitte eine aus der Liste wählen.` : "Kostenart fehlt.", sperrt: true });
  }
  if (!e.prop_id && !e.ohneObjekt) punkte.push({ art: "objekt_fehlt", text: "Kein Objekt zugeordnet — Objekt wählen oder ausdrücklich „ohne Objekt“.", sperrt: true });

  const andereDatei = kontext.eingaenge.filter((x) => x.id !== e.eintragId && x.datei_hash === e.datei_hash);
  if (andereDatei.length > 0) {
    punkte.push({
      art: "dublette_datei",
      text: `Dieselbe Datei liegt schon im Belegeingang${andereDatei.some((x) => x.status === "gebucht") ? " und ist gebucht" : ""}.`,
      sperrt: true,
    });
  }

  let anhaengbar: KostenZeile[] = [];
  if (e.betrag != null && e.betrag > 0 && e.datum) {
    const imZeitraum = (k: KostenZeile, t: number) => !!k.buchungsdatum && tage(k.buchungsdatum, e.datum!) <= t;
    const gleichesObjekt = (k: KostenZeile) => !e.prop_id || !k.prop_id || k.prop_id === e.prop_id;
    const fremd = kontext.kosten.filter((k) => k.beleg_eingang_id !== e.eintragId);
    const nr = (e.rechnungsnummer ?? "").trim().toLowerCase();
    const doppelt = fremd.filter(
      (k) =>
        (k.rechnung_path && gleicherBetrag(k.betrag, e.betrag!) && imZeitraum(k, 3) && gleichesObjekt(k)) ||
        (nr.length >= 4 && (k.beschreibung ?? "").toLowerCase().includes(nr)),
    );
    if (doppelt.length > 0) {
      const d = doppelt[0];
      punkte.push({
        art: "dublette_buchung",
        text: `Mögliche Dublette: Buchung vom ${datumDe(d.buchungsdatum ?? "")} über ${euro(Number(d.betrag) || 0)}${d.kategorie ? ` (${d.kategorie})` : ""} hat schon einen Beleg.`,
        sperrt: true,
      });
    }
    anhaengbar = fremd
      .filter((k) => !k.rechnung_path && !k.beleg_eingang_id && gleicherBetrag(k.betrag, e.betrag!) && imZeitraum(k, 45) && gleichesObjekt(k))
      .sort((a, b) => tage(a.buchungsdatum!, e.datum!) - tage(b.buchungsdatum!, e.datum!));
    if (anhaengbar.length > 1) {
      punkte.push({ art: "zahlung_unklar", text: `${anhaengbar.length} gebuchte Kosten ohne Beleg passen zu Betrag und Datum — bitte die richtige wählen oder neu buchen.`, sperrt: false });
    }
  }

  const u = e.umlagefaehig;
  const standard = e.kategorie ? istUmlagefaehig(e.kategorie) : "unklar";
  if (u === "unklar" || !u) {
    punkte.push({ art: "umlage_pruefen", text: "Umlagefähigkeit nach § 2 BetrKV ungeklärt — die Buchung geht erst nach deiner Entscheidung in die NK-Abrechnung.", sperrt: false });
  } else if (standard !== "unklar" && u !== standard) {
    punkte.push({
      art: "umlage_pruefen",
      text: `„${e.kategorie}“ ist üblicherweise ${standard === "ja" ? "umlagefähig" : "nicht umlagefähig"}, gewählt ist „${u === "ja" ? "umlagefähig" : "nicht umlagefähig"}“ — bitte prüfen.`,
      sperrt: false,
    });
  }
  return { punkte, anhaengbar };
}

/** Darf gebucht werden? Sperrende Punkte müssen weg — Dubletten nur mit ausdrücklicher Bestätigung. */
export function buchbar(punkte: Pruefpunkt[], dubletteBestaetigt: boolean): boolean {
  return punkte.every((p) => !p.sperrt || (dubletteBestaetigt && (p.art === "dublette_datei" || p.art === "dublette_buchung")));
}

/** Stichzeit für `anzeigeStatus`/`kiMoeglich` — vom SERVER einmal je Anfrage geholt und übergeben. */
export const jetztMs = () => Date.now();

/** Zustand zur Anzeige: Ein Lauf, der länger als 5 Minuten „in Arbeit“ steht, ist abgebrochen. */
export function anzeigeStatus(e: { status: string; letzter_versuch: string | null }, jetzt: number): string {
  if (e.status === "in_arbeit" && e.letzter_versuch && jetzt - Date.parse(e.letzter_versuch) > BELEG_SPERRE_MS) return "abgebrochen";
  return e.status;
}

/** Darf ein (weiterer) KI-Lauf angefordert werden? */
export function kiMoeglich(e: { status: string; versuche: number; letzter_versuch: string | null }, jetzt: number): boolean {
  if (e.versuche >= BELEG_MAX_VERSUCHE) return false;
  const s = anzeigeStatus(e, jetzt);
  return s === "neu" || s === "fehler" || s === "abgebrochen";
}

/** Dateiendung für den Speicherpfad aus dem erkannten Typ (nie aus dem Dateinamen). */
export function endungFuer(mime: string): string {
  return mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}
