// Nebenkosten am Objekt: Stand je Mieter und „Nächste Abrechnung“ (21.10.2026, Durchsicht Paket 4).
//
// Die Liste „Abrechnungen <Jahr>“ zeigte nur den Saldo — ob eine Abrechnung schon erstellt, im Portal
// bereitgestellt oder abgerufen war, stand nirgends, und „Zurück“ führte aus jeder Abrechnung zum
// Mieter statt zur Liste. Der Stand kommt aus DERSELBEN Regel wie die Frist in /termine
// (`fristVorgang` in lib/fristDokument.ts) — Fällig ≠ erledigt (Ablauf D). Rein.
import {
  erledigtAus, fristVermerk, fristVorgang,
  type ArchivDok, type FristVermerk, type FristVorgang, type PortalZustellung,
} from "@/lib/fristDokument";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `reihe` aus der Adresse: höchstens 200 Mieter-IDs, nur gültige, ohne Doppel. */
export function naechsteReihe(roh: string | undefined | null): string[] {
  const ids = String(roh ?? "").split(",").map((x) => x.trim()).filter((x) => UUID.test(x));
  return [...new Set(ids)].slice(0, 200);
}

/** Bezeichnung und Datum der NK-Frist eines Jahres — wie in `mieterFristen` (lib/fristen.ts). */
export function nkFrist(jahr: number): { label: string; datum: string } {
  return { label: `NK-Abrechnung ${jahr} zustellen`, datum: `${jahr + 1}-12-31` };
}

/** Wie weit ist die Abrechnung dieses Mieters? Erledigt nur über den Vermerk in /termine. */
export function nkStand(
  mieterId: string,
  jahr: number,
  archiv: ArchivDok[],
  portal: PortalZustellung[],
  vermerke: Map<string, FristVermerk>,
): FristVorgang {
  const f = nkFrist(jahr);
  return fristVorgang({ art: "nk", jahr }, mieterId, f.datum, archiv, portal, erledigtAus(fristVermerk(vermerke, "mieter", mieterId, f.datum, f.label)));
}
