import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

// Test-Key VOR dem Import des Moduls setzen (Key wird lazy gelesen, aber sicher
// ist sicher).
beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

const load = async () => await import("@/lib/crypto/secure");

describe("encrypt/decrypt — AES-256-GCM Roundtrip", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", async () => {
    const { encrypt, decrypt } = await load();
    const klar = "DE89370400440532013000";
    const token = encrypt(klar);
    expect(token).not.toBe(klar);
    expect(token.startsWith("enc:v1:")).toBe(true);
    expect(decrypt(token)).toBe(klar);
  });

  it("erzeugt bei gleichem Klartext unterschiedliche Chiffretexte (zufälliger IV)", async () => {
    const { encrypt } = await load();
    expect(encrypt("DE89370400440532013000")).not.toBe(
      encrypt("DE89370400440532013000"),
    );
  });

  it("erkennt Chiffretext (isEncrypted)", async () => {
    const { encrypt, isEncrypted } = await load();
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("DE89370400440532013000")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("lässt Klartext-Altzeilen unverändert durch (Migrations-Toleranz)", async () => {
    const { decrypt, decryptNullable } = await load();
    expect(decrypt("DE89370400440532013000")).toBe("DE89370400440532013000");
    expect(decrypt(null)).toBe("");
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable("")).toBeNull();
  });

  it("schlägt bei manipuliertem Chiffretext fehl (Auth-Tag)", async () => {
    const { encrypt, decrypt } = await load();
    const token = encrypt("geheim");
    // letztes Zeichen kippen
    const kaputt = token.slice(0, -2) + (token.endsWith("A") ? "B" : "A") + "=";
    expect(() => decrypt(kaputt)).toThrow();
  });
});

describe("blindIndex — deterministischer HMAC", () => {
  it("ist deterministisch für gleichen Input", async () => {
    const { blindIndex } = await load();
    expect(blindIndex("DE89370400440532013000")).toBe(
      blindIndex("DE89370400440532013000"),
    );
  });

  it("unterscheidet verschiedene Inputs", async () => {
    const { blindIndex } = await load();
    expect(blindIndex("DE89370400440532013000")).not.toBe(
      blindIndex("DE89370400440532013001"),
    );
  });

  it("entspricht nicht dem Chiffretext (eigener Schlüssel)", async () => {
    const { blindIndex, encrypt } = await load();
    expect(blindIndex("x")).not.toBe(encrypt("x"));
  });
});
