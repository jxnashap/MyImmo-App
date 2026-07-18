import { decryptNullable, encrypt } from "@/lib/crypto/secure";

// App-Layer-Verschlüsselung für die Darlehensnummer (kredite.darlnr) — wie
// bei den IBANs: Schlüssel liegt außerhalb der DB, decrypt lässt noch nicht
// migrierte Klartext-Altzeilen unverändert durch.

export function decryptKreditRow<T extends { darlnr?: string | null }>(row: T): T {
  return { ...row, darlnr: decryptNullable(row.darlnr) };
}

// Verschlüsselt die Darlehensnummer fürs Speichern (null/leer bleibt null).
export function encryptDarlnr(wert: string | null): string | null {
  if (!wert) return null;
  return encrypt(wert);
}
