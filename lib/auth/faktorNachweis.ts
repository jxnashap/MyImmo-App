// Signierter Kurzzeit-Nachweis „dieses Konto hat KEINEN bestätigten zweiten
// Faktor" — für die Zwei-Faktor-Schranke im Proxy (Audit 01.10.2026, A2/A3).
//
// WARUM: Der Proxy kennt vom Token nur `aal` (signiert, vertrauenswürdig),
// aber nicht, ob das Konto einen Faktor HAT. Das weiß nur der Auth-Server
// (`getUser` → `user.factors`). Jede Anfrage dort nachzufragen brächte die
// ~40 `GET /user` je Seitenaufruf zurück, die am 30.09.2026 gerade abgeschafft
// wurden. Deshalb: einmal nachfragen, das NEGATIVE Ergebnis zehn Minuten in
// einem signierten, an den Nutzer gebundenen Cookie merken. Ein POSITIVES
// Ergebnis (Konto hat Faktor) wird nie gemerkt — es führt sofort zur Sperre.
//
// Der Nachweis ist KEINE Anmeldung: Ohne gültiges Token nützt er nichts; mit
// Token und ohne Nachweis fragt der Proxy nach. Dasselbe Muster wie
// `lib/auth/resetNachweis.ts` (HMAC über DATA_ENCRYPTION_KEY, Ablauf
// mitsigniert, zeitkonstanter Vergleich, fail-closed).
//
// In Kauf genommen: Richtet der Inhaber einen Faktor ein, kann eine FREMDE
// aal1-Sitzung mit frischem Nachweis bis zu zehn Minuten weiterlaufen. Danach
// greift die Schranke. Wer fremden Zugriff vermutet, setzt ohnehin das Passwort
// zurück — das meldet alle Sitzungen ab (`signOut({ scope: "global" })`).
import { timingSafeEqual } from "node:crypto";
import { blindIndex } from "@/lib/crypto/secure";

export const FAKTOR_COOKIE = "mi_faktor";
/** Zehn Minuten — Kompromiss aus Auth-Server-Last und Reaktionszeit auf eine Einrichtung. */
export const FAKTOR_SEKUNDEN = 10 * 60;

const signatur = (userId: string, exp: number): string => blindIndex(`kein-faktor:${userId}:${exp}`);

/** Nachweis ausstellen — nur nach einem `getUser`, das KEINEN bestätigten Faktor zeigte. */
export function stelleFaktorNachweisAus(userId: string, jetztSekunden: number = Math.floor(Date.now() / 1000)): string {
  const exp = jetztSekunden + FAKTOR_SEKUNDEN;
  return `${exp}.${signatur(userId, exp)}`;
}

/** Fail-closed: alles, was nicht eindeutig gültig ist, zählt als „nachfragen". */
export function faktorNachweisGueltig(
  wert: string | null | undefined,
  userId: string | null | undefined,
  jetztSekunden: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!wert || !userId) return false;
  const punkt = wert.indexOf(".");
  if (punkt <= 0) return false;
  const expText = wert.slice(0, punkt);
  if (!/^\d+$/.test(expText)) return false;
  const exp = Number(expText);
  if (!Number.isSafeInteger(exp) || exp <= jetztSekunden) return false;
  let erwartet: string;
  try {
    erwartet = signatur(userId, exp);
  } catch {
    return false; // ohne DATA_ENCRYPTION_KEY gibt es keinen Nachweis — dann wird nachgefragt
  }
  const a = Buffer.from(wert.slice(punkt + 1), "utf8");
  const b = Buffer.from(erwartet, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Bestätigter TOTP-Faktor vorhanden? — nur aus einer SERVER-Antwort (`getUser`) speisen. */
export function hatBestaetigtenFaktor(faktoren: ReadonlyArray<{ status?: string | null }> | null | undefined): boolean {
  return !!faktoren?.some((f) => f.status === "verified");
}

/**
 * Pfade, auf denen die Zwei-Faktor-Schranke NICHT greift: Dort holt der Nutzer
 * den zweiten Schritt nach bzw. setzt sein Passwort zurück — und die
 * statischen Dateien brauchen keine Anmeldung. Alles andere, auch jede
 * API-Route und jeder POST (Server-Actions), bleibt gesperrt.
 */
export function mfaAusgenommen(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname === "/auth/signout" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/icon.svg" ||
    pathname === "/og.png" ||
    pathname === "/myimmo_logo_2048.png" ||
    pathname === "/theme.js" ||
    pathname.startsWith("/landing/") ||
    pathname.startsWith("/fonts/")
  );
}
