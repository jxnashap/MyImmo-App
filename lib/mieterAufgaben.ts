// Mieter-Startseite: „Was muss ich erledigen?“ (02.10.2026, Schritt 4 aus
// docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
//
// Reine Funktion über die Portal-Daten, die ohnehin geladen sind (lib/portalDaten.ts) —
// keine zusätzliche Abfrage, ohne React, deshalb prüfbar (tests/mieterAufgaben.test.ts).
// Jede Zeile hat genau ein Ziel (einen Reiter) und eine Handlung, wie beim Vermieter
// (lib/heute.ts).
import type { PortalDaten } from "@/lib/portalDaten";

export type MieterAufgabe = {
  id: string;
  titel: string;
  text: string;
  tab: "anliegen" | "dokumente" | "zaehler";
  dringend: boolean;
  /** Sortierschlüssel (ISO). */
  wann: string;
};

/** Wie lange eine Antwort des Vermieters als „neu“ oben steht. */
export const ANTWORT_TAGE = 14;
/** Ab wie vielen Tagen vor der Frist eine Anfrage des Vermieters dringend ist. */
export const FRIST_DRINGEND_TAGE = 3;

const tageZwischen = (von: string, bis: string) =>
  Math.round(
    (Date.UTC(+bis.slice(0, 4), +bis.slice(5, 7) - 1, +bis.slice(8, 10)) -
      Date.UTC(+von.slice(0, 4), +von.slice(5, 7) - 1, +von.slice(8, 10))) / 86_400_000,
  );

const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

type Eingabe = Pick<PortalDaten, "freigegebeneDocs" | "anliegen" | "verlauf" | "vermieterAnfragen">;

export function baueMieterAufgaben(d: Eingabe, heute: string): MieterAufgabe[] {
  const liste: MieterAufgabe[] = [];

  for (const doc of d.freigegebeneDocs) {
    const z = doc.zustellung;
    const titel = doc.titel || doc.datei_name || "Dokument";
    if (z.bestaetigung_noetig && !z.bestaetigt_am) {
      liste.push({
        id: `bestaetigen:${z.id}`, titel: `Bitte bestätigen: ${titel}`,
        text: "Dein Vermieter bittet um „gelesen und bestätigt“ — keine Unterschrift.",
        tab: "dokumente", dringend: true, wann: z.zugestellt_am,
      });
    } else if (!z.gelesen_am) {
      liste.push({
        id: `neu:${z.id}`, titel: `Neues Dokument: ${titel}`,
        text: `Zugestellt am ${de(z.zugestellt_am)} — noch nicht geöffnet.`,
        tab: "dokumente", dringend: false, wann: z.zugestellt_am,
      });
    }
  }

  for (const a of d.anliegen) {
    if (a.status === "erledigt") continue;
    const slots = a.termin_vorschlaege ?? [];
    if (slots.length > 0 && !a.termin_bestaetigt) {
      liste.push({
        id: `termin:${a.id}`, titel: `Termin wählen: ${a.titel}`,
        text: `Dein Vermieter schlägt ${slots.length === 1 ? "einen Termin" : `${slots.length} Termine`} vor.`,
        tab: "anliegen", dringend: true, wann: a.created_at,
      });
      continue;
    }
    const verlauf = d.verlauf[a.id] ?? [];
    const letzte = verlauf[verlauf.length - 1];
    if (
      letzte && letzte.art === "nachricht" && letzte.autor_rolle === "vermieter" &&
      tageZwischen(letzte.created_at.slice(0, 10), heute) <= ANTWORT_TAGE
    ) {
      liste.push({
        id: `antwort:${a.id}`, titel: `Antwort zu: ${a.titel}`,
        text: "Dein Vermieter hat geschrieben.", tab: "anliegen", dringend: false, wann: letzte.created_at,
      });
    }
  }

  for (const f of d.vermieterAnfragen) {
    if (f.status !== "offen") continue;
    const frist = f.faellig_bis?.slice(0, 10) ?? null;
    const rest = frist ? tageZwischen(heute, frist) : null;
    liste.push({
      id: `anfrage:${f.id}`, titel: `Anfrage deines Vermieters: ${f.titel}`,
      text: frist
        ? rest! < 0 ? `War fällig am ${de(frist)}.` : `Bitte bis ${de(frist)} erledigen.`
        : "Bitte beantworten.",
      tab: "anliegen", dringend: rest !== null && rest <= FRIST_DRINGEND_TAGE, wann: frist ?? f.created_at,
    });
  }

  // Dringendes zuerst, innerhalb davon das Neueste (bzw. die späteste Frist) oben.
  return liste.sort((a, b) =>
    a.dringend !== b.dringend ? (a.dringend ? -1 : 1) : b.wann.localeCompare(a.wann),
  );
}
