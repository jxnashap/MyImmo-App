// Fristen ↔ Dokumente (Ablauf D, Prüfstand 11.10.2026).
//
// Eine Frist, zu der ein Schreiben gehört (Wohnungsgeberbestätigung, Mieterhöhungsverlangen,
// NK-Abrechnung), führt direkt in den Brief-Generator bzw. zur Abrechnung des Mieters — der Mieter
// ist vorgewählt, das Schreiben ist ein ENTWURF, fehlende Pflichtangaben zeigt der Generator
// (lib/briefPruefung.ts). Neben der Frist steht, wie weit der Vorgang ist:
//   offen → Entwurf im Archiv (PDF erstellt) → im Portal bereitgestellt → vom Mieter abgerufen
//   → erledigt (vom Vermieter mit Datum und Zustellweg bestätigt).
// FÄLLIG und ERLEDIGT sind zwei verschiedene Dinge: Ein erstelltes PDF erledigt nichts, und auch ein
// Abruf im Portal belegt keinen Zugang (lib/zugang.ts). Erledigt ist eine Frist erst, wenn der
// Vermieter es bestätigt — dann mit dem Zustellweg, den er gewählt hat. Reine Funktionen.

import { TITEL } from "@/lib/dokumentVorlagen";
import { fristSchluessel } from "@/lib/termine";

export type FristDokument =
  | { art: "wohnungsgeber" }
  | { art: "mieterhoehung" }
  | { art: "nk"; jahr: number };

export const ZUSTELLWEGE = {
  persoenlich: "persönlich übergeben (mit Empfangsbestätigung)",
  bote: "per Boten (mit Zeugen)",
  einwurf_einschreiben: "Einwurf-Einschreiben",
  einschreiben_rueckschein: "Einschreiben mit Rückschein",
  post: "einfacher Brief",
  mail: "E-Mail",
  portal: "Mieterportal",
  meldebehoerde: "elektronisch an die Meldebehörde (§ 19 Abs. 4 BMG)",
  sonstiges: "anderer Weg",
} as const;
export type Zustellweg = keyof typeof ZUSTELLWEGE;
// Object.hasOwn statt `in`: „constructor“ oder „toString“ stehen über den Prototyp ebenfalls „in“ jedem Objekt.
export const istZustellweg = (w: unknown): w is Zustellweg => typeof w === "string" && Object.hasOwn(ZUSTELLWEGE, w);

/** Wohin die Frist führt: Generator mit vorgewähltem Mieter und Art, bzw. die NK-Abrechnung. */
export function fristDokumentZiel(mieterId: string, d: FristDokument): string {
  if (d.art === "nk") return `/tenants/${mieterId}/nk?jahr=${d.jahr}`;
  return `/tenants/${mieterId}/dokument?art=${d.art}`;
}

/** Archiv-Titel, unter dem das Schreiben abgelegt wird (lib/pdf/erzeugen.ts: „<Titel> – Name“). */
export function archivTitelPraefix(d: FristDokument): string {
  return d.art === "nk" ? `Nebenkostenabrechnung ${d.jahr}` : TITEL[d.art];
}

export type ArchivDok = { id: string; mieter_id: string | null; titel: string | null; created_at: string };
export type PortalZustellung = { notiz_id: string | null; zugestellt_am: string; gelesen_am: string | null; zurueckgezogen_am: string | null };
export type FristErledigt = { erledigt_am: string; zustellweg: string; notiz_id: string | null };

export type FristVorgang =
  | { stand: "offen" }
  | { stand: "entwurf"; notizId: string; am: string }
  | { stand: "bereitgestellt"; notizId: string; am: string }
  | { stand: "abgerufen"; notizId: string; am: string }
  | { stand: "erledigt"; am: string; zustellweg: string; notizId: string | null };

/**
 * Ab wann ein Schreiben für diese Frist zählt. NK: jedes Schreiben mit dem Jahr im Titel (die Abrechnung
 * entsteht im Folgejahr, oft lange vor dem Fristdatum 31.12.). Sonst ein Vierteljahr vor dem Fristdatum —
 * ein Mieterhöhungsverlangen von vor drei Jahren erledigt nicht die nächste Frist.
 */
export function fristSeit(d: FristDokument, fristDatum: string): string {
  if (d.art === "nk") return "0000-01-01";
  const [j, m, t] = fristDatum.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1 - 3, t)).toISOString().slice(0, 10);
}

/**
 * Wie weit ist der Vorgang zu dieser Frist? Gezählt werden nur Schreiben an DIESEN Mieter mit passendem
 * Titel ab `fristSeit()`. Die Bestätigung des Vermieters schlägt alles andere.
 */
export function fristVorgang(
  d: FristDokument,
  mieterId: string,
  fristDatum: string,
  archiv: ArchivDok[],
  portal: PortalZustellung[],
  erledigt?: FristErledigt | null,
): FristVorgang {
  if (erledigt) return { stand: "erledigt", am: erledigt.erledigt_am, zustellweg: erledigt.zustellweg, notizId: erledigt.notiz_id };
  const praefix = archivTitelPraefix(d);
  const seit = fristSeit(d, fristDatum);
  const doks = archiv
    .filter((n) => n.mieter_id === mieterId && (n.titel ?? "").startsWith(praefix) && n.created_at.slice(0, 10) >= seit)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (doks.length === 0) return { stand: "offen" };
  // Das weiteste Stadium über alle passenden Schreiben (eine neue Fassung kann noch Entwurf sein).
  let best: FristVorgang = { stand: "entwurf", notizId: doks[0].id, am: doks[0].created_at.slice(0, 10) };
  for (const n of doks) {
    const z = portal.find((p) => p.notiz_id === n.id && !p.zurueckgezogen_am);
    if (!z) continue;
    if (z.gelesen_am) return { stand: "abgerufen", notizId: n.id, am: z.gelesen_am.slice(0, 10) };
    if (best.stand === "entwurf") best = { stand: "bereitgestellt", notizId: n.id, am: z.zugestellt_am.slice(0, 10) };
  }
  return best;
}

/**
 * Wie weit zurück Schreiben und Portal-Zustellungen für den Stand geladen werden: NK-Abrechnungen
 * entstehen im Folgejahr (bis zu ~12 Monate vor dem 31.12.), alles andere ab drei Monaten vor der Frist.
 */
export const FRIST_ARCHIV_TAGE = 400;
export function fristArchivAb(heuteISO: string): string {
  const [j, m, t] = heuteISO.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t - FRIST_ARCHIV_TAGE)).toISOString().slice(0, 10);
}

// ---- Vermerke (`frist_ausgeblendet`): ausgeblendet ODER erledigt ----------------------------------

export const FRIST_VERMERK_SPALTEN = "schluessel,grund,erledigt_am,zustellweg,notiz_id";
export type FristVermerk = { schluessel: string; grund: string | null; erledigt_am: string | null; zustellweg: string | null; notiz_id: string | null };

export function vermerkeAus(rows: FristVermerk[] | null | undefined): Map<string, FristVermerk> {
  return new Map((rows ?? []).map((r) => [r.schluessel, r]));
}

/**
 * Vermerk zu einer Frist: zuerst der Schlüssel MIT Bezug, dann der alte ohne (Altbestand blendet weiter
 * aus). Ein Erledigt-Vermerk zählt nur mit Bezug — der alte Schlüssel galt für alle Mieter zugleich.
 */
export function fristVermerk(
  vermerke: Map<string, FristVermerk>,
  quelle: string,
  bezug: string | null,
  datum: string,
  label: string,
): FristVermerk | null {
  const neu = vermerke.get(fristSchluessel(quelle, datum, label, bezug));
  if (neu) return neu;
  const alt = bezug ? vermerke.get(fristSchluessel(quelle, datum, label)) : undefined;
  return alt ? { ...alt, grund: "ausgeblendet", erledigt_am: null, zustellweg: null, notiz_id: null } : null;
}

/**
 * Stabile UID einer abgeleiteten Frist für den Kalender-Export (RFC 5545: gleiche Frist, gleiche UID über
 * alle Exporte). Zwei FNV-1a-64-Hashes über den Fristschlüssel (Quelle, Bezug, Datum, Bezeichnung) —
 * keine Geheimhaltung nötig, nur Unterscheidbarkeit; ohne Krypto-Modul, damit die Datei rein bleibt.
 */
const FNV_PRIM = BigInt("0x100000001b3");
export function fristUid(quelle: string, bezug: string | null, datum: string, label: string): string {
  const schluessel = fristSchluessel(quelle, datum, label, bezug);
  const fnv = (text: string, start: bigint) => {
    let h = start;
    for (const b of new TextEncoder().encode(text)) h = BigInt.asUintN(64, (h ^ BigInt(b)) * FNV_PRIM);
    return h.toString(16).padStart(16, "0");
  };
  return `frist-${fnv(schluessel, BigInt("0xcbf29ce484222325"))}${fnv(schluessel, BigInt("0x84222325cbf29ce4"))}@myimmo`;
}

export function erledigtAus(v: FristVermerk | null): FristErledigt | null {
  return v && v.grund === "erledigt" && v.erledigt_am && v.zustellweg
    ? { erledigt_am: v.erledigt_am, zustellweg: v.zustellweg, notiz_id: v.notiz_id }
    : null;
}

const de = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Text neben der Frist — nie „zugestellt“, solange der Vermieter es nicht bestätigt hat. */
export function vorgangText(v: FristVorgang): string {
  switch (v.stand) {
    case "offen": return "noch kein Schreiben";
    case "entwurf": return `PDF erstellt am ${de(v.am)} — Zugang nicht bestätigt`;
    case "bereitgestellt": return `im Portal bereitgestellt am ${de(v.am)} — nicht abgerufen`;
    case "abgerufen": return `im Portal abgerufen am ${de(v.am)} — Zugang bitte bestätigen`;
    case "erledigt": return `erledigt am ${de(v.am)} · ${ZUSTELLWEGE[v.zustellweg as Zustellweg] ?? v.zustellweg}`;
  }
}
