import { createHash, randomBytes } from "node:crypto";

// Token-Erzeugung und -Hashing. Getrennt von `lib/newsletter.ts`, weil dort
// der Einwilligungstext liegt, der auch im Browser gebraucht wird — `node:crypto`
// würde die Client-Komponente unbaubar machen.

/** Neues Token (URL-tauglich, 32 Byte Zufall). */
export const neuesToken = (): string => randomBytes(32).toString("base64url");

/**
 * In der Datenbank liegt nur der Hash. Ein Leseleck der Tabelle erlaubt damit
 * nicht, fremde Anmeldungen zu bestätigen oder abzumelden.
 */
export const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
