import "server-only";

// Dauerhafte Schritte nach außen (Ablauf F, Prüfstand 11.10.2026) — Tabelle `aussen_auftraege`.
//
// Ein Schritt, der etwas außerhalb von MyImmo auslöst (heute: die Hinweis-Mail über Brevo), läuft so:
//   1. VORMERKEN unter einem stabilen Schlüssel (eindeutig je Konto). Ein zweiter Aufruf derselben
//      Handlung — Doppelklick, Zeitüberlauf, Neustart — findet die vorhandene Zeile.
//   2. BEANSPRUCHEN (`aussen_auftrag_beanspruchen`, bedingtes Update in der Datenbank): genau ein
//      Bearbeiter; ein abgebrochener Lauf ist nach fünf Minuten wieder frei; höchstens `max_versuche`.
//   3. AUSFÜHREN.
//   4. „erledigt“ erst NACH dem erfolgreichen Speichern des Ergebnisses; sonst Fehlergrund, letzter
//      Versuch und nächster Versuch (10 min, dann 60 min). Nach dem letzten Versuch: „aufgegeben“.
//
// VERBLEIBENDES ZUSTELLRISIKO (bewusst benannt, kein „genau einmal“): Bricht der Lauf NACH dem Versand
// und VOR dem Speichern von „erledigt“ ab (Funktion beendet, Datenbank kurz weg), gilt der Schritt nach
// fünf Minuten als abgebrochen und wird wiederholt — der Empfänger kann die Mail dann ZWEIMAL bekommen.
// Umgekehrt nie: Ohne gespeichertes „erledigt“ gilt nichts als versandt. Brevo bietet keinen
// Idempotenzschlüssel, mit dem sich das beim Anbieter ausschließen ließe.

import type { SupabaseClient } from "@supabase/supabase-js";

export const AUSSEN_MAX_VERSUCHE = 3;
/** Wartezeit nach dem n-ten Fehlschlag (Minuten). */
export const AUSSEN_WARTEN_MIN = [10, 60] as const;
/** Älter als das: nicht mehr wiederholen (eine Hinweis-Mail nach einem Tag hilft niemandem). */
export const AUSSEN_HOECHSTALTER_STUNDEN = 24;
/** Abgeschlossene Einträge (erledigt/aufgegeben) werden danach gelöscht — Datenschutzerklärung Ziffer 4. */
export const AUSSEN_AUFBEWAHRUNG_TAGE = 90;

export type AussenArt = "hinweis_mail";
export type Lauf = { ok: true; ergebnis: string } | { ok: false; grund: string; endgueltig?: boolean };
export type AussenStand = "erledigt" | "schon_erledigt" | "laeuft" | "wartet" | "aufgegeben" | "nicht_gespeichert";
export type AussenErgebnis = { stand: AussenStand; ergebnis?: string | null; grund?: string | null; id?: string };

export type AussenZeile = {
  id: string; user_id: string; schluessel: string; art: AussenArt; nutzlast: Record<string, unknown>;
  status: "offen" | "in_arbeit" | "erledigt" | "fehler" | "aufgegeben";
  versuche: number; max_versuche: number; letzter_versuch: string | null; naechster_versuch: string;
  fehler: string | null; ergebnis: string | null; created_at: string;
};

/** Nächster Versuch nach dem n-ten Fehlschlag. Rein. */
export function naechsterVersuch(versuche: number, jetztMs: number): string {
  const min = AUSSEN_WARTEN_MIN[Math.min(Math.max(versuche, 1), AUSSEN_WARTEN_MIN.length) - 1];
  return new Date(jetztMs + min * 60_000).toISOString();
}

/** Zustand nach einem Fehlschlag. Rein. */
export function standNachFehler(versuche: number, maxVersuche: number, endgueltig = false): "fehler" | "aufgegeben" {
  return endgueltig || versuche >= maxVersuche ? "aufgegeben" : "fehler";
}

const ZEILE = "id,user_id,schluessel,art,nutzlast,status,versuche,max_versuche,letzter_versuch,naechster_versuch,fehler,ergebnis,created_at";
const jetzt = () => Date.now();

/** Einen beanspruchten Schritt ausführen und abschließen. */
async function bearbeite(admin: SupabaseClient, zeile: AussenZeile, lauf: () => Promise<Lauf>): Promise<AussenErgebnis> {
  let r: Lauf;
  try {
    r = await lauf();
  } catch (e) {
    r = { ok: false, grund: e instanceof Error ? e.message.slice(0, 200) : "Ausnahme" };
  }
  if (r.ok) {
    // „erledigt“ erst, wenn es gespeichert ist — ein Versuch Wiederholung, dann ehrlich melden.
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.from("aussen_auftraege")
        .update({ status: "erledigt", erledigt_am: new Date(jetzt()).toISOString(), ergebnis: r.ergebnis.slice(0, 100), fehler: null })
        .eq("id", zeile.id).eq("status", "in_arbeit");
      if (!error) return { stand: "erledigt", ergebnis: r.ergebnis, id: zeile.id };
    }
    console.error("[aussenAuftrag] Ergebnis nicht gespeichert:", zeile.id);
    return { stand: "nicht_gespeichert", ergebnis: r.ergebnis, id: zeile.id };
  }
  const status = standNachFehler(zeile.versuche, zeile.max_versuche, r.endgueltig);
  const { error } = await admin.from("aussen_auftraege")
    .update({ status, fehler: r.grund.slice(0, 300), naechster_versuch: naechsterVersuch(zeile.versuche, jetzt()) })
    .eq("id", zeile.id).eq("status", "in_arbeit");
  // Scheitert auch das, bleibt der Schritt „in Arbeit“ und ist nach fünf Minuten wieder frei.
  if (error) console.error("[aussenAuftrag] Fehlergrund nicht gespeichert:", zeile.id);
  return { stand: status === "aufgegeben" ? "aufgegeben" : "wartet", grund: r.grund, id: zeile.id };
}

/**
 * Schritt vormerken (falls neu), beanspruchen und ausführen. Läuft er schon oder ist er erledigt,
 * passiert NICHTS — der Stand sagt, warum.
 */
export async function fuehreAus(
  admin: SupabaseClient,
  s: { userId: string; ausgeloestVon?: string | null; schluessel: string; art: AussenArt; nutzlast: Record<string, unknown>; maxVersuche?: number },
  lauf: () => Promise<Lauf>,
): Promise<AussenErgebnis> {
  const { error: e1 } = await admin.from("aussen_auftraege").upsert(
    { user_id: s.userId, ausgeloest_von: s.ausgeloestVon ?? null, schluessel: s.schluessel, art: s.art, nutzlast: s.nutzlast, max_versuche: s.maxVersuche ?? AUSSEN_MAX_VERSUCHE },
    { onConflict: "user_id,schluessel", ignoreDuplicates: true },
  );
  // Ohne gespeicherten Auftrag kein Versand — sonst gäbe es einen Schritt ohne Spur und ohne Schutz
  // gegen das zweite Mal.
  if (e1) return { stand: "nicht_gespeichert", grund: "Auftrag konnte nicht vorgemerkt werden." };
  const { data: z, error: e2 } = await admin.from("aussen_auftraege").select(ZEILE)
    .eq("user_id", s.userId).eq("schluessel", s.schluessel).maybeSingle();
  if (e2 || !z) return { stand: "nicht_gespeichert", grund: "Auftrag nicht lesbar." };
  return beanspruchenUndAusfuehren(admin, z as AussenZeile, lauf);
}

async function beanspruchenUndAusfuehren(admin: SupabaseClient, z: AussenZeile, lauf: () => Promise<Lauf>): Promise<AussenErgebnis> {
  const { data: b, error } = await admin.rpc("aussen_auftrag_beanspruchen", { p_id: z.id });
  const beansprucht = (b as AussenZeile[] | null)?.[0];
  if (error || !beansprucht) {
    if (z.status === "erledigt") return { stand: "schon_erledigt", ergebnis: z.ergebnis, id: z.id };
    if (z.status === "aufgegeben" || z.versuche >= z.max_versuche) return { stand: "aufgegeben", grund: z.fehler, id: z.id };
    if (z.status === "in_arbeit") return { stand: "laeuft", id: z.id };
    return { stand: "wartet", grund: z.fehler, id: z.id };
  }
  return bearbeite(admin, beansprucht, lauf);
}

/**
 * Fällige Schritte wiederholen (Cron). Zu alte Schritte werden aufgegeben, statt Tage später eine
 * Hinweis-Mail zu schicken. `handler` baut den Lauf aus der gespeicherten Nutzlast.
 */
export async function wiederholeFaellige(
  admin: SupabaseClient,
  handler: (z: AussenZeile) => () => Promise<Lauf>,
  grenze = 50,
): Promise<{ bearbeitet: number; erledigt: number; aufgegeben: number; veraltet: number; geloescht: number }> {
  // Aufbewahrung: Was abgeschlossen ist, braucht niemand länger als 90 Tage (Nachvollziehbarkeit bei
  // Rückfragen „kam die Mail an?“); danach weg. Laufende und wartende Einträge bleiben.
  const frist = new Date(jetzt() - AUSSEN_AUFBEWAHRUNG_TAGE * 86_400_000).toISOString();
  const { data: geloescht, error: eLoesch } = await admin.from("aussen_auftraege")
    .delete().in("status", ["erledigt", "aufgegeben"]).lt("created_at", frist).select("id");
  if (eLoesch) throw new Error("Alte Schritte nicht gelöscht");
  const alt = new Date(jetzt() - AUSSEN_HOECHSTALTER_STUNDEN * 3_600_000).toISOString();
  const { data: veraltet, error: eAlt } = await admin.from("aussen_auftraege")
    .update({ status: "aufgegeben", fehler: `älter als ${AUSSEN_HOECHSTALTER_STUNDEN} Stunden — nicht mehr wiederholt` })
    .in("status", ["offen", "fehler"]).lt("created_at", alt).select("id");
  if (eAlt) throw new Error("Veraltete Schritte nicht lesbar");
  const { data, error } = await admin.from("aussen_auftraege").select(ZEILE)
    .in("status", ["offen", "fehler", "in_arbeit"]).lte("naechster_versuch", new Date(jetzt()).toISOString())
    .order("naechster_versuch").limit(grenze);
  if (error) throw new Error("Fällige Schritte nicht lesbar");
  let erledigt = 0, aufgegeben = 0, bearbeitet = 0;
  for (const z of (data ?? []) as AussenZeile[]) {
    if (z.versuche >= z.max_versuche) continue;
    const r = await beanspruchenUndAusfuehren(admin, z, handler(z));
    if (r.stand === "laeuft" || r.stand === "wartet" && !r.grund) continue;
    bearbeitet++;
    if (r.stand === "erledigt") erledigt++;
    if (r.stand === "aufgegeben") aufgegeben++;
  }
  return { bearbeitet, erledigt, aufgegeben, veraltet: (veraltet ?? []).length, geloescht: (geloescht ?? []).length };
}
