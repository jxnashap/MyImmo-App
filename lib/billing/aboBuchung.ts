// Abo-Zahlung als Kostenbuchung (05.10.2026, Vorgabe des Betreibers).
//
// Jede bezahlte MyImmo-Rechnung landet von selbst als Kosten „Verwaltung"
// in den Büchern des Vermieters — und damit in der Anlage V bei den nicht umgelegten Kosten
// (`lib/anlageV.ts`, KOSTEN_BUCKET „Verwaltung" → verwaltung). Vorher stimmte
// der Satz „wir machen das automatisch in die Anlage V" schlicht nicht: Das Abo
// tauchte dort nur auf, wenn der Nutzer die Rechnung selbst buchte.
//
// Reine Funktionen, ohne Datenbank — geschrieben wird atomar und genau einmal
// je Paddle-Transaktion über die SQL-Funktion `abo_zahlung_buchen`
// (Migration 20261005…_abo_zahlung_buchen). Paddle stellt Webhooks
// mindestens einmal zu, Wiederholungen sind der Normalfall.
//
// VERTEILUNG: nach Einheiten (`einheiten_anzahl`, fehlend = 1) auf die Objekte,
// die vermietet werden oder vermietet werden sollen. Selbst bewohnte Objekte
// bekommen nichts — dort gibt es keine Werbungskosten. Cent-genau nach dem
// Verfahren der größten Reste: Die Summe der Zeilen ist immer der gezahlte
// Betrag. Ohne passendes Objekt: eine Zeile ohne Objekt.
//
// NICHT abgedeckt: Erstattungen und Gutschriften (transaction.* mit negativem
// Betrag bzw. adjustment.*). Die bucht der Nutzer selbst zurück.
import { istSelbstBewohnt } from "@/lib/steuer/selbstBewohnt";

export const ABO_KATEGORIE = "Verwaltung";
export const ABO_BESCHREIBUNG = "MyImmo-Abo";

/** Satz im Abo-Tab — wer zahlt, soll wissen, dass in seinen Büchern etwas entsteht. */
export const ABO_BUCHUNG_HINWEIS =
  "Jede bezahlte Rechnung bucht MyImmo automatisch als Kosten „Verwaltung“ (in der Anlage V bei den nicht umgelegten Kosten), " +
  "anteilig nach Einheiten auf deine Objekte außer selbst bewohnten. Du findest sie unter „Ein- & Ausgaben“ " +
  "und kannst sie dort ändern oder löschen.";

export type AboZahlung = {
  transaktionId: string;
  subscriptionId: string | null;
  /** custom_data.user_id — beim ersten Kauf gesetzt (erstelleCheckoutUrl), bei Verlängerungen nicht verlässlich. */
  userIdHinweis: string | null;
  cent: number;
  /** Buchungsdatum als YYYY-MM-DD (Abrechnungstag in Berlin). */
  datum: string;
};

const TXN = /^txn_[a-z\d]{26}$/;

/** Tag in Berlin aus einem ISO-Zeitpunkt — eine Zahlung um 23:30 UTC am 31.12. gehört ins neue Jahr. */
export function berlinerTag(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
}

/** `transaction.completed` in Euro mit positivem Betrag → Zahlung, sonst null. */
export function parseAboZahlung(payload: unknown): AboZahlung | null {
  const p = payload as { event_type?: string; occurred_at?: string; data?: Record<string, unknown> } | null;
  if (p?.event_type !== "transaction.completed" || !p.data) return null;
  const d = p.data as {
    id?: string;
    status?: string;
    subscription_id?: string | null;
    custom_data?: { user_id?: unknown } | null;
    currency_code?: string;
    billed_at?: string | null;
    details?: { totals?: { grand_total?: string } } | null;
  };
  if (!d.id || !TXN.test(d.id) || d.status !== "completed") return null;
  if (d.currency_code !== "EUR") return null; // Bücher in Euro; Fremdwährung bucht der Nutzer selbst
  const roh = d.details?.totals?.grand_total;
  if (typeof roh !== "string" || !/^\d+$/.test(roh)) return null; // Paddle: kleinste Einheit als Zeichenkette
  const cent = Number(roh);
  if (!Number.isSafeInteger(cent) || cent <= 0) return null; // 0-€-Testphase bucht nichts
  const datum = berlinerTag(d.billed_at ?? p.occurred_at ?? "");
  if (!datum) return null;
  const uid = d.custom_data?.user_id;
  return {
    transaktionId: d.id,
    subscriptionId: typeof d.subscription_id === "string" ? d.subscription_id : null,
    userIdHinweis: typeof uid === "string" && uid ? uid : null,
    cent,
    datum,
  };
}

export type AboObjekt = { id: string; einheiten_anzahl?: number | null; obj_status?: string | null };

/** Selbst bewohnt → keine Werbungskosten. Alles andere (vermietet, leer, Ferien) zählt. */
export function zaehltFuerAbo(o: AboObjekt): boolean {
  return !istSelbstBewohnt(o.obj_status);
}

/** Verteilt `cent` nach Einheiten, Summe exakt; Reihenfolge der Objekte bestimmt den Gleichstand. */
export function verteileAufObjekte(cent: number, objekte: AboObjekt[]): { prop_id: string | null; cent: number }[] {
  const ziel = objekte.filter(zaehltFuerAbo);
  if (ziel.length === 0) return [{ prop_id: null, cent }];
  const gewicht = ziel.map((o) => {
    const n = Math.floor(Number(o.einheiten_anzahl));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });
  const summe = gewicht.reduce((a, b) => a + b, 0);
  const roh = gewicht.map((g) => (cent * g) / summe);
  const teile = roh.map(Math.floor);
  let rest = cent - teile.reduce((a, b) => a + b, 0);
  const reihenfolge = roh
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of reihenfolge) {
    if (rest <= 0) break;
    teile[i] += 1;
    rest -= 1;
  }
  return ziel.map((o, i) => ({ prop_id: o.id, cent: teile[i] })).filter((z) => z.cent > 0);
}

export type AboKostenZeile = {
  prop_id: string | null;
  buchungsdatum: string;
  kategorie: string;
  betrag: number;
  beschreibung: string;
};

/** Die Kostenzeilen, die `abo_zahlung_buchen` schreibt. */
export function aboKostenZeilen(z: AboZahlung, objekte: AboObjekt[]): AboKostenZeile[] {
  const teile = verteileAufObjekte(z.cent, objekte);
  const anteil = teile.length > 1 ? " (anteilig nach Einheiten)" : "";
  return teile.map((t) => ({
    prop_id: t.prop_id,
    buchungsdatum: z.datum,
    kategorie: ABO_KATEGORIE,
    betrag: t.cent / 100,
    beschreibung: `${ABO_BESCHREIBUNG}${anteil} · Rechnung ${z.transaktionId}`,
  }));
}
