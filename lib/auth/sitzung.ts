// Sitzungs-Helfer für Zwei-Faktor-Anmeldung und „frische Anmeldung" —
// reine Funktionen ohne Supabase-Client, damit sie ohne Attrappe testbar sind.
//
// HINTERGRUND (08.09.2026, Feedback Befund 5 und 6)
// · Zwei-Faktor über Supabase-MFA (TOTP). Supabase führt je Sitzung ein
//   „Authenticator Assurance Level": aal1 = nur Passwort, aal2 = zweiter Faktor
//   in DIESER Sitzung bestätigt. `nextLevel` sagt, was das Konto verlangt.
// · „Frische Anmeldung": Vor Vollexport, Kontolöschung und Bank-Freigabe soll
//   die letzte Passwort-/TOTP-Bestätigung höchstens einige Minuten her sein.
//   Supabase schreibt dafür `amr` (Authentication Methods Reference) in den
//   JWT: eine Liste aus { method, timestamp }. Wer eine offene Sitzung auf
//   einem fremden Rechner vorfindet, kommt damit nicht mehr an den Export.

export type AalStand = { currentLevel: string | null; nextLevel: string | null };

/** Konto verlangt einen zweiten Faktor, die Sitzung hat ihn noch nicht. */
export function mussMfaNachholen(aal: AalStand | null | undefined): boolean {
  return !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** Base64url-Payload eines JWT als Objekt — ohne Signaturprüfung (die macht Supabase). */
export function jwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const teile = token.split(".");
  if (teile.length < 2) return null;
  try {
    const json = Buffer.from(teile[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Zeitpunkt (Sekunden) der jüngsten Anmeldemethode laut `amr` — oder null. */
export function juengsteAnmeldung(token: string | null | undefined): number | null {
  const p = jwtPayload(token);
  const amr = p?.amr;
  if (!Array.isArray(amr)) return null;
  let max: number | null = null;
  for (const e of amr) {
    const ts = (e as { timestamp?: unknown })?.timestamp;
    if (typeof ts === "number" && Number.isFinite(ts)) max = max == null ? ts : Math.max(max, ts);
  }
  return max;
}

/**
 * Ist die Anmeldung frisch genug?
 *
 * Fail-closed: Ohne `amr` (alter Token, fremdes Format) gilt die Sitzung als
 * NICHT frisch — dann fragt die App einmal das Passwort ab, was harmlos ist.
 * Umgekehrt (unbekannt = frisch) wäre genau die Lücke, die geschlossen werden soll.
 */
export function sitzungFrisch(
  token: string | null | undefined,
  maxSekunden: number,
  jetztSekunden: number = Math.floor(Date.now() / 1000),
): boolean {
  const zuletzt = juengsteAnmeldung(token);
  if (zuletzt == null) return false;
  return jetztSekunden - zuletzt <= maxSekunden;
}

/** Standard: zehn Minuten. Lang genug für einen Export, kurz genug gegen den offenen Rechner. */
export const FRISCH_SEKUNDEN = 10 * 60;
