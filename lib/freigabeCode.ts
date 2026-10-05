// Zugangscode für Freigabe-Links an Makler und Bank (05.10.2026) — nur Server.
// Der Code selbst wird nie gespeichert. Die Datenbank kennt nur den HMAC über Art + Token + Code
// (Schlüssel aus DATA_ENCRYPTION_KEY, `blindIndex`); ihre öffentlichen Funktionen liefern Inhalte
// nur mit diesem Hash. Ohne Schlüssel lässt er sich nicht bilden — auch nicht von jemandem, der
// Link und Datenbank-Schnittstelle kennt.
import { randomInt } from "node:crypto";
import { blindIndex } from "@/lib/crypto/secure";
import { MAKLER_CODE_ZEICHEN, normalisiereMaklerCode } from "@/lib/makler";

export type FreigabeArt = "makler" | "bank";

/** Cookie, das nach richtiger Eingabe den Hash trägt — Pfad jeweils nur dieser eine Link. */
export const FREIGABE_COOKIE: Record<FreigabeArt, string> = { makler: "mi_makler", bank: "mi_bank" };
export const FREIGABE_PFAD: Record<FreigabeArt, (token: string) => string> = {
  makler: (t) => `/makler-link/${t}`,
  bank: (t) => `/beleihung/${t}`,
};

/** 8 Zeichen aus 31 → rund 8,5 · 10¹¹ Möglichkeiten; die Datenbank sperrt nach 10 Fehlversuchen. */
export function erzeugeFreigabeCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += MAKLER_CODE_ZEICHEN[randomInt(MAKLER_CODE_ZEICHEN.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** An Art und Link gebunden: Derselbe Code ergibt für einen anderen Link einen anderen Hash. */
export function freigabeCodeHash(art: FreigabeArt, token: string, code: string): string {
  return blindIndex(`${art}-link:${token.toLowerCase()}:${normalisiereMaklerCode(code)}`);
}
