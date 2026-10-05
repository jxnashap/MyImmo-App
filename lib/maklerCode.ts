// Makler-Link: Namen aus der ersten Fassung (05.10.2026), jetzt über lib/freigabeCode.ts —
// dieselbe Rechnung wie vorher (`makler-link:<token>:<code>`), bestehende Hashes bleiben gültig.
import { FREIGABE_COOKIE, erzeugeFreigabeCode, freigabeCodeHash } from "@/lib/freigabeCode";

export const MAKLER_COOKIE = FREIGABE_COOKIE.makler;
export const erzeugeMaklerCode = erzeugeFreigabeCode;
export const maklerCodeHash = (token: string, code: string) => freigabeCodeHash("makler", token, code);
