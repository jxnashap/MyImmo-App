// Zugangscode für Makler-Links (05.10.2026) — nur Server: Erzeugen und Hashen.
// Der Code selbst wird nie gespeichert. Die Datenbank kennt nur den HMAC über Token + Code
// (Schlüssel aus DATA_ENCRYPTION_KEY, `blindIndex`), und die öffentlichen Funktionen liefern nur
// mit diesem Hash Inhalte — ohne Schlüssel lässt er sich nicht bilden, auch nicht von jemandem,
// der Link und Datenbank-Schnittstelle kennt.
import { randomInt } from "node:crypto";
import { blindIndex } from "@/lib/crypto/secure";
import { MAKLER_CODE_ZEICHEN, normalisiereMaklerCode } from "@/lib/makler";

/** Name des Cookies, das den Hash nach richtiger Eingabe trägt (Pfad: nur dieser Link). */
export const MAKLER_COOKIE = "mi_makler";

/** 8 Zeichen aus 31 → rund 8,5 · 10¹¹ Möglichkeiten; die Datenbank sperrt nach 10 Fehlversuchen. */
export function erzeugeMaklerCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += MAKLER_CODE_ZEICHEN[randomInt(MAKLER_CODE_ZEICHEN.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** An den Link gebunden: Derselbe Code für einen anderen Link ergibt einen anderen Hash. */
export function maklerCodeHash(token: string, code: string): string {
  return blindIndex(`makler-link:${token.toLowerCase()}:${normalisiereMaklerCode(code)}`);
}
