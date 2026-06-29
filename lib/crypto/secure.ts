// App-Layer-Verschlüsselung für sensible Felder (aktuell: IBAN + Kontoinhaber).
//
// Warum App-Layer und nicht pgcrypto in der DB?
//   Supabase verschlüsselt die Platte bereits at-rest. Spalten-Verschlüsselung
//   bringt nur dann echten Schutz (gegen geleakte DB-Dumps, SQL-Injection,
//   neugierige/kompromittierte DB-Admins, geleakte Backups), wenn der Schlüssel
//   AUSSERHALB der Datenbank liegt. Liegt der Schlüssel in der DB (pgcrypto-Key
//   in einer Tabelle, Supabase Vault im selben Projekt), klaut ein Angreifer mit
//   den Zeilen gleich den Schlüssel mit. Deshalb: Schlüssel ausschließlich als
//   Vercel-Env-Variable, die DB sieht nur Chiffretext.
//
// Verfahren: AES-256-GCM (authentifiziert → erkennt Manipulation am Chiffretext).
// Schlüsselableitung: aus einem Master-Key per HKDF zwei getrennte Keys —
//   einen zum Verschlüsseln, einen für den Blind-Index (HMAC). So leakt ein Key
//   nicht den anderen.
//
// Env-Variable: DATA_ENCRYPTION_KEY = 32 zufällige Bytes als base64.
//   Erzeugen mit:  openssl rand -base64 32
//   ⚠️ Verlust des Schlüssels = unwiederbringlicher Verlust der Bankdaten.
//      Sicher sichern (Passwortmanager), nicht ins Repo, nicht in Logs.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
  createHmac,
} from "crypto";

const ENC_PREFIX = "enc:v1:";

let cachedKeys: { enc: Buffer; idx: Buffer } | null = null;

function masterKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "DATA_ENCRYPTION_KEY ist nicht gesetzt. Bankdaten können nicht ver-/entschlüsselt werden.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY muss 32 Byte (base64-kodiert) sein. Erzeugen mit: openssl rand -base64 32",
    );
  }
  return buf;
}

// Schlüssel werden erst beim ersten Gebrauch geladen (lazy), damit der Build
// ohne gesetzten Key gelingt und das reine Lesen von Klartext-Altzeilen den Key
// gar nicht erst anfasst.
function keys(): { enc: Buffer; idx: Buffer } {
  if (cachedKeys) return cachedKeys;
  const master = masterKey();
  const salt = Buffer.alloc(0);
  const enc = Buffer.from(hkdfSync("sha256", master, salt, "myimmo-enc-v1", 32));
  const idx = Buffer.from(
    hkdfSync("sha256", master, salt, "myimmo-blind-index-v1", 32),
  );
  cachedKeys = { enc, idx };
  return cachedKeys;
}

/** true, wenn der Wert bereits ein von uns erzeugter Chiffretext ist. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/** Verschlüsselt einen String → "enc:v1:<base64(iv|tag|ciphertext)>". */
export function encrypt(plain: string): string {
  const { enc } = keys();
  const iv = randomBytes(12); // GCM-Standard: 96-bit Nonce
  const cipher = createCipheriv("aes-256-gcm", enc, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * Entschlüsselt einen Token. Ist der Wert KEIN Chiffretext (z. B. eine noch
 * nicht migrierte Klartext-Altzeile), wird er unverändert zurückgegeben — so
 * bleibt das Lesen während/ohne Migration robust und braucht keinen Key.
 */
export function decrypt(token: string | null | undefined): string {
  if (token == null) return "";
  if (!isEncrypted(token)) return token;
  const { enc } = keys();
  const raw = Buffer.from(token.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", enc, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Wie decrypt, behält aber null/leer als null bei (für optionale Spalten). */
export function decryptNullable(token: string | null | undefined): string | null {
  if (token == null || token === "") return null;
  return decrypt(token);
}

/**
 * Deterministischer "Blind Index" (HMAC-SHA256) eines Werts. Ermöglicht
 * Gleichheits-Suche und Unique-Constraints auf verschlüsselten Spalten, ohne
 * den Klartext zu speichern. Eingabe muss vorab normalisiert sein.
 */
export function blindIndex(plain: string): string {
  const { idx } = keys();
  return createHmac("sha256", idx).update(plain, "utf8").digest("hex");
}
