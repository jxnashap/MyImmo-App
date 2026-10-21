"use server";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pruefeFrischeAnmeldung } from "@/lib/auth/frisch";
import { istDemoKonto } from "@/lib/demo";
import { blindIndex } from "@/lib/crypto/secure";
import { darfWeiter } from "@/lib/net/bremse";

// Zwei-Faktor-Anmeldung: Was Supabase NICHT mitbringt, liegt hier —
// Wiederherstellungscodes. Ohne sie sperrt ein verlorenes Handy das Konto
// dauerhaft aus. Das TOTP selbst (Einrichten, Abfragen, Entfernen) läuft
// direkt zwischen Browser und Supabase (`supabase.auth.mfa.*`).
//
// SICHERHEITSMODELL (B01, 11.10.2026)
// · Die Tabelle `mfa_wiederherstellung` ist für anon/authenticated GESPERRT
//   (Migration 20261011102000) — nur dieser Server liest und schreibt sie, über
//   die Service-Role. Vorher konnte eine reine Passwort-Sitzung (aal1) per REST
//   eigene Hashes EINFÜGEN und danach mit dem selbst gewählten Code den zweiten
//   Faktor entfernen lassen: 2FA war damit wirkungslos.
// · Gespeichert wird ein HMAC (Schlüssel aus DATA_ENCRYPTION_KEY, eigener
//   Zweck-Präfix), kein bloßer SHA-256 — 40 Bit Code sind sonst offline
//   durchprobierbar. Alte SHA-256-Codes werden beim Einlösen weiter erkannt.
// · Erzeugen verlangt: bestätigter Faktor (vom Auth-Server, nicht aus dem
//   Cookie), aal2 in DIESER Sitzung und eine frische Anmeldung.
// · Einlösen verlangt nur die Passwort-Sitzung (aal1 — genau die Lage ohne
//   Handy), ist aber gebremst (5 Versuche / 15 min je Konto). Der Code wird
//   ATOMAR über den Filter verbraucht; scheitert danach das Entfernen des
//   Faktors, wird der Verbrauch zurückgenommen (der Code bleibt gültig).
//   Nach Erfolg sind alle übrigen Codes ungültig.
// · Das Demo-Konto ist ausgeschlossen: Ein geteiltes Konto mit 2FA würde alle
//   Besucher aussperren.

const ANZAHL = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne I/O/0/1
const ZWECK = "mfa-wiederherstellung-v2:";

/** HMAC des normalisierten Codes; `null`, wenn der Schlüssel fehlt (dann keine neuen Codes). */
function codeHash(code: string): string | null {
  try {
    return blindIndex(ZWECK + normalisiere(code));
  } catch {
    return null;
  }
}

/** Alte Form (bis 11.10.2026): SHA-256 ohne Schlüssel. Nur noch zum Einlösen alter Codes. */
const altHash = (code: string) => createHash("sha256").update(normalisiere(code)).digest("hex");

/** „abcd-efgh" → „ABCDEFGH": Leerraum/Bindestriche egal, Groß-/Kleinschreibung egal. */
function normalisiere(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

type Faktor = { status?: string | null; factor_type?: string | null };
const hatBestaetigtenFaktor = (faktoren: Faktor[] | null | undefined) =>
  !!faktoren?.some((f) => f.status === "verified");

export type CodesErgebnis = { ok: true; codes: string[] } | { ok: false; error: string; reauth?: boolean };

/** Neue Wiederherstellungscodes erzeugen — alte werden ungültig. Klartext nur EINMAL zurück. */
export async function erzeugeWiederherstellungscodes(): Promise<CodesErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du bist nicht mehr angemeldet — bitte neu anmelden." };
  if (istDemoKonto(user.email)) return { ok: false, error: "Im Demo-Konto nicht verfügbar." };

  // Ohne bestätigten Faktor gibt es nichts wiederherzustellen — und ohne diese Prüfung reichte für
  // ein Konto ohne 2FA eine frische Passwort-Anmeldung, um Codes zu ziehen, die nach dem späteren
  // Einrichten weiter gälten.
  if (!hatBestaetigtenFaktor(user.factors as Faktor[] | undefined)) {
    return { ok: false, error: "Richte zuerst die Zwei-Faktor-Anmeldung ein." };
  }
  // Mit Faktor verlangt die Prüfung aal2 UND eine frische Anmeldung.
  const frisch = await pruefeFrischeAnmeldung(supabase);
  if (!frisch.ok) return { ok: false, error: "Bitte bestätige zuerst deine Anmeldung.", reauth: true };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Wiederherstellungscodes sind auf diesem Server nicht eingerichtet." };

  const codes = Array.from({ length: ANZAHL }, neuerCode);
  const hashes = codes.map(codeHash);
  if (hashes.some((h) => !h)) return { ok: false, error: "Wiederherstellungscodes sind auf diesem Server nicht eingerichtet." };

  // Alte Codes zuerst weg — sonst gälten zwei Sätze parallel.
  const { error: loeschFehler } = await admin.from("mfa_wiederherstellung").delete().eq("user_id", user.id);
  if (loeschFehler) return { ok: false, error: "Alte Codes konnten nicht entfernt werden." };

  const { error } = await admin
    .from("mfa_wiederherstellung")
    .insert(hashes.map((h) => ({ user_id: user.id, code_hash: h })));
  if (error) return { ok: false, error: "Die alten Codes sind ungültig, die neuen konnten nicht gespeichert werden — bitte erneut erzeugen." };

  return { ok: true, codes };
}

/** Wie viele ungenutzte Codes hat das Konto? (Für die Anzeige in den Einstellungen.) */
export async function zaehleWiederherstellungscodes(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;
  const { count, error } = await admin
    .from("mfa_wiederherstellung")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("verbraucht_am", null);
  return error ? 0 : (count ?? 0);
}

/**
 * Alle Codes des Kontos löschen (beim Abschalten von 2FA). Ohne bestätigten Faktor sind die Codes
 * wirkungslos und dürfen weg; solange noch ein Faktor da ist, nur mit aal2 + frischer Anmeldung —
 * sonst könnte eine Passwort-Sitzung dem Inhaber den Rückweg nehmen.
 */
export async function loescheWiederherstellungscodes(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du bist nicht mehr angemeldet — bitte neu anmelden." };
  if (hatBestaetigtenFaktor(user.factors as Faktor[] | undefined)) {
    const frisch = await pruefeFrischeAnmeldung(supabase);
    if (!frisch.ok) return { ok: false, error: "Bitte bestätige zuerst deine Anmeldung." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Codes konnten nicht gelöscht werden." };
  const { error } = await admin.from("mfa_wiederherstellung").delete().eq("user_id", user.id);
  return error ? { ok: false, error: "Codes konnten nicht gelöscht werden." } : { ok: true };
}

export type EinloeseErgebnis = { ok: true } | { ok: false; error: string };

const FALSCH = "Dieser Code ist ungültig oder wurde bereits benutzt.";

/**
 * Wiederherstellungscode einlösen: entfernt den TOTP-Faktor des Kontos.
 *
 * Voraussetzung ist eine Sitzung mit Passwort (aal1). Der Aufrufer ist also
 * bereits als Kontoinhaber angemeldet und scheitert nur am zweiten Faktor —
 * genau dafür sind die Codes da.
 */
export async function loeseWiederherstellungscodeEin(code: string): Promise<EinloeseErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du bist nicht mehr angemeldet — bitte neu anmelden." };

  const eingabe = normalisiere(String(code ?? ""));
  if (eingabe.length !== 8) return { ok: false, error: "Der Code hat acht Zeichen." };

  // Bremse VOR jedem Datenbankzugriff auf die Codes: 40 Bit sind online nur so lange sicher, wie
  // niemand tausendfach raten darf. Kennung = Konto (wird in darfWeiter gehasht).
  if (!(await darfWeiter("mfa_wiederherstellung", 5, 15 * 60, user.id))) {
    return { ok: false, error: "Zu viele Versuche. Bitte warte 15 Minuten." };
  }

  // Erst prüfen, ob es überhaupt etwas wiederherzustellen gibt und ob der Server es kann — sonst
  // würde ein Code verbraucht, ohne dass etwas passiert.
  if (!hatBestaetigtenFaktor(user.factors as Faktor[] | undefined)) {
    return { ok: false, error: "Für dieses Konto ist keine Zwei-Faktor-Anmeldung aktiv." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Wiederherstellung ist auf diesem Server nicht eingerichtet." };

  const kandidaten = [codeHash(eingabe), altHash(eingabe)].filter((h): h is string => !!h);
  // Verbrauchen — ATOMAR über den Filter, nicht erst lesen und dann schreiben. Trifft das Update
  // keine Zeile, war der Code falsch oder schon benutzt; beides bekommt dieselbe Meldung.
  const { data: getroffen, error } = await admin
    .from("mfa_wiederherstellung")
    .update({ verbraucht_am: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("code_hash", kandidaten)
    .is("verbraucht_am", null)
    .select("id");
  const ids = ((getroffen ?? []) as { id: string }[]).map((z) => z.id);
  if (error || ids.length === 0) return { ok: false, error: FALSCH };

  // Faktor entfernen. Scheitert das, wird der Verbrauch zurückgenommen — der Inhaber käme sonst
  // mit einem verbrauchten Code und weiter aktivem Faktor nicht mehr hinein.
  const zuruecknehmen = async (meldung: string): Promise<EinloeseErgebnis> => {
    const { error: rueckFehler } = await admin
      .from("mfa_wiederherstellung")
      .update({ verbraucht_am: null })
      .eq("user_id", user.id)
      .in("id", ids);
    return {
      ok: false,
      error: rueckFehler
        ? `${meldung} Der Code ist dabei verbraucht worden — bitte einen anderen Code verwenden.`
        : `${meldung} Der Code bleibt gültig — bitte später erneut versuchen.`,
    };
  };
  const { data: faktoren, error: listFehler } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listFehler) return zuruecknehmen("Faktoren konnten nicht gelesen werden.");
  for (const f of faktoren?.factors ?? []) {
    const { error: delFehler } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    if (delFehler) return zuruecknehmen("Der zweite Faktor konnte nicht entfernt werden.");
  }

  // Die übrigen Codes gehörten zum entfernten Faktor — sie dürfen nicht weiter gelten. Scheitert das
  // Aufräumen, sind sie ohne Faktor wirkungslos, und das nächste Einrichten ersetzt sie.
  const { error: restFehler } = await admin.from("mfa_wiederherstellung").delete().eq("user_id", user.id);
  if (restFehler) console.warn("[mfa] übrige Wiederherstellungscodes nicht entfernt (ohne Faktor wirkungslos)");
  return { ok: true };
}

/** Für die Oberfläche: Muss vor einer sensiblen Aktion erneut angemeldet werden? */
export async function sitzungIstFrisch(): Promise<{ frisch: boolean; grund?: "reauth" | "mfa" }> {
  const supabase = await createClient();
  const erg = await pruefeFrischeAnmeldung(supabase);
  return erg.ok ? { frisch: true } : { frisch: false, grund: erg.grund };
}
