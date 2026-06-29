import { decrypt, decryptNullable } from "@/lib/crypto/secure";

// Entschlüsselt die sensiblen Felder einer aus der DB gelesenen ibans-Zeile.
// Robust gegenüber noch nicht migrierten Klartext-Altzeilen (decrypt lässt
// Nicht-Chiffretext unverändert durch). Den internen Blind-Index (iban_bidx)
// entfernen wir dabei, damit er nicht versehentlich nach außen gelangt.
export function decryptIbanRow<
  T extends { iban?: string | null; inhaber?: string | null; iban_bidx?: string | null },
>(row: T): T {
  const { iban_bidx, ...rest } = row;
  return {
    ...rest,
    iban: decrypt(row.iban ?? ""),
    inhaber: decryptNullable(row.inhaber),
  } as unknown as T;
}
