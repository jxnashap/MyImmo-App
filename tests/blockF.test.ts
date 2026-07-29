// Restbefunde der zweiten Prüfrunde.
import { describe, it, expect, vi } from "vitest";
import { fristSchluessel } from "@/lib/termine";
import { wechslePasswort } from "@/lib/passwortWechsel";

describe("Schlüssel abgeleiteter Fristen", () => {
  it("unterscheidet Quelle, Datum und Bezeichnung", () => {
    expect(fristSchluessel("mieter", "2026-08-01", "Mieterhöhung möglich"))
      .toBe("mieter|2026-08-01|Mieterhöhung möglich");
    expect(fristSchluessel("kredit", "2026-08-01", "Mieterhöhung möglich"))
      .not.toBe(fristSchluessel("mieter", "2026-08-01", "Mieterhöhung möglich"));
  });

  it("enthält das Datum — eine wiederkehrende Frist kommt im Folgejahr zurück", () => {
    // Sonst bliebe die NK-Abrechnungsfrist für immer stumm, nur weil sie
    // einmal ausgeblendet wurde.
    const heuer = fristSchluessel("steuer", "2026-12-31", "NK-Abrechnung fällig");
    const naechstes = fristSchluessel("steuer", "2027-12-31", "NK-Abrechnung fällig");
    expect(heuer).not.toBe(naechstes);
  });
});

describe("Passwortwechsel mit Bestätigung", () => {
  // Minimaler Supabase-Doppelgänger: merkt sich, was aufgerufen wurde.
  function fakeClient(opts: { anmeldungKlappt?: boolean } = {}) {
    const aufrufe = { signIn: 0, update: 0 };
    return {
      aufrufe,
      client: {
        auth: {
          signInWithPassword: vi.fn(async () => {
            aufrufe.signIn += 1;
            return opts.anmeldungKlappt === false
              ? { error: { message: "Invalid login credentials" } }
              : { error: null };
          }),
          updateUser: vi.fn(async () => {
            aufrufe.update += 1;
            return { error: null };
          }),
        },
      } as never,
    };
  }

  const basis = { email: "a@b.de", aktuell: "AltesPasswort1", neu: "NeuesPasswort1", wiederholung: "NeuesPasswort1" };

  it("ändert das Passwort erst nach erfolgreicher Bestätigung", async () => {
    const { client, aufrufe } = fakeClient();
    const erg = await wechslePasswort(client, basis);
    expect(erg.ok).toBe(true);
    expect(aufrufe.signIn).toBe(1);
    expect(aufrufe.update).toBe(1);
  });

  it("ändert NICHTS, wenn das aktuelle Passwort falsch ist", async () => {
    const { client, aufrufe } = fakeClient({ anmeldungKlappt: false });
    const erg = await wechslePasswort(client, basis);
    expect(erg.ok).toBe(false);
    // Der eigentliche Punkt: kein updateUser, also keine Übernahme des Kontos
    // über eine fremde offene Sitzung.
    expect(aufrufe.update).toBe(0);
  });

  it("verlangt das aktuelle Passwort, wenn es fehlt", async () => {
    const { client, aufrufe } = fakeClient();
    const erg = await wechslePasswort(client, { ...basis, aktuell: "" });
    expect(erg.ok).toBe(false);
    expect(aufrufe.update).toBe(0);
  });

  it("Google-Konten setzen ein Passwort ohne Bestätigung", async () => {
    const { client, aufrufe } = fakeClient();
    const erg = await wechslePasswort(client, { ...basis, aktuell: "", istGoogle: true });
    expect(erg.ok).toBe(true);
    expect(aufrufe.signIn).toBe(0);
    expect(aufrufe.update).toBe(1);
  });

  it("setzt dieselbe Längenregel wie die Registrierung durch", async () => {
    const { client, aufrufe } = fakeClient();
    // 6 Zeichen — genau der Wert, den die Vermieter-Einstellungen früher zuließen.
    const erg = await wechslePasswort(client, { ...basis, neu: "abc123", wiederholung: "abc123" });
    expect(erg.ok).toBe(false);
    expect(aufrufe.update).toBe(0);
  });

  it("weist abweichende Wiederholung und unverändertes Passwort ab", async () => {
    const { client } = fakeClient();
    expect((await wechslePasswort(client, { ...basis, wiederholung: "Anderes12345" })).ok).toBe(false);
    expect((await wechslePasswort(client, { ...basis, neu: basis.aktuell, wiederholung: basis.aktuell })).ok).toBe(false);
  });
});
