"use server";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pruefeFrischeAnmeldung } from "@/lib/auth/frisch";
import { istDemoKonto } from "@/lib/demo";

// Zwei-Faktor-Anmeldung: Was Supabase NICHT mitbringt, liegt hier —
// Wiederherstellungscodes. Ohne sie sperrt ein verlorenes Handy das Konto
// dauerhaft aus. Das TOTP selbst (Einrichten, Abfragen, Entfernen) läuft
// direkt zwischen Browser und Supabase (`supabase.auth.mfa.*`).
//
// SICHERHEITSMODELL
// · In der Tabelle liegt nur der SHA-256-Hash; ein Leseleck erlaubt kein Einlösen.
// · Einlösen verlangt eine gültige Sitzung des Kontos (aal1 reicht — genau das
//   ist die Lage, wenn das Handy fehlt). Dann wird der TOTP-Faktor über die
//   Service-Role entfernt; der Nutzer ist wieder „nur Passwort" und wird
//   gebeten, 2FA neu einzurichten. Jeder Code gilt einmal.
// · Erzeugen und Löschen verlangen eine frische Anmeldung (Passwort/TOTP in
//   den letzten Minuten) — sonst könnte eine offene Sitzung neue Codes ziehen.
// · Das Demo-Konto ist ausgeschlossen: Ein geteiltes Konto mit 2FA würde alle
//   Besucher aussperren.

const ANZAHL = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne I/O/0/1

const hash = (code: string) => createHash("sha256").update(normalisiere(code)).digest("hex");

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

export type CodesErgebnis = { ok: true; codes: string[] } | { ok: false; error: string; reauth?: boolean };

/** Neue Wiederherstellungscodes erzeugen — alte werden ungültig. Klartext nur EINMAL zurück. */
export async function erzeugeWiederherstellungscodes(): Promise<CodesErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (istDemoKonto(user.email)) return { ok: false, error: "Im Demo-Konto nicht verfügbar." };

  const frisch = await pruefeFrischeAnmeldung(supabase);
  if (!frisch.ok) return { ok: false, error: "Bitte bestätige zuerst deine Anmeldung.", reauth: true };

  const codes = Array.from({ length: ANZAHL }, neuerCode);

  // Alte Codes zuerst weg — sonst gälten zwei Sätze parallel.
  const { error: loeschFehler } = await supabase.from("mfa_wiederherstellung").delete().eq("user_id", user.id);
  if (loeschFehler) return { ok: false, error: "Alte Codes konnten nicht entfernt werden." };

  const { error } = await supabase
    .from("mfa_wiederherstellung")
    .insert(codes.map((c) => ({ user_id: user.id, code_hash: hash(c) })));
  if (error) return { ok: false, error: "Codes konnten nicht gespeichert werden." };

  return { ok: true, codes };
}

/** Wie viele ungenutzte Codes hat das Konto? (Für die Anzeige in den Einstellungen.) */
export async function zaehleWiederherstellungscodes(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("mfa_wiederherstellung")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("verbraucht_am", null);
  return error ? 0 : (count ?? 0);
}

/** Alle Codes des Kontos löschen (beim Abschalten von 2FA). */
export async function loescheWiederherstellungscodes(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase.from("mfa_wiederherstellung").delete().eq("user_id", user.id);
  return error ? { ok: false, error: "Codes konnten nicht gelöscht werden." } : { ok: true };
}

export type EinloeseErgebnis = { ok: true } | { ok: false; error: string };

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
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const eingabe = normalisiere(String(code ?? ""));
  if (eingabe.length !== 8) return { ok: false, error: "Der Code hat acht Zeichen." };

  // Den Code als verbraucht markieren — ATOMAR über den Filter, nicht erst
  // lesen und dann schreiben. Trifft das Update keine Zeile, war der Code
  // falsch oder schon benutzt; beides bekommt dieselbe Meldung.
  const { data: getroffen, error } = await supabase
    .from("mfa_wiederherstellung")
    .update({ verbraucht_am: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("code_hash", hash(eingabe))
    .is("verbraucht_am", null)
    .select("id")
    .maybeSingle();
  if (error || !getroffen) return { ok: false, error: "Dieser Code ist ungültig oder wurde bereits benutzt." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Wiederherstellung ist auf diesem Server nicht eingerichtet." };

  const { data: faktoren, error: listFehler } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listFehler) return { ok: false, error: "Faktoren konnten nicht gelesen werden." };
  for (const f of faktoren?.factors ?? []) {
    const { error: delFehler } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    if (delFehler) return { ok: false, error: "Der zweite Faktor konnte nicht entfernt werden." };
  }
  return { ok: true };
}

/** Für die Oberfläche: Muss vor einer sensiblen Aktion erneut angemeldet werden? */
export async function sitzungIstFrisch(): Promise<{ frisch: boolean; grund?: "reauth" | "mfa" }> {
  const supabase = await createClient();
  const erg = await pruefeFrischeAnmeldung(supabase);
  return erg.ok ? { frisch: true } : { frisch: false, grund: erg.grund };
}
