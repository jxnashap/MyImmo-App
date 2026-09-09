// Restbefunde der zweiten Prüfrunde.
import { describe, it, expect, vi } from "vitest";
import { fristSchluessel } from "@/lib/termine";
import { wechslePasswort, sendePasswortMail, RESET_ZIEL } from "@/lib/passwortWechsel";

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
    const aufrufe = { signIn: 0, update: 0, mail: 0 };
    let letztesUpdate: Record<string, unknown> | null = null;
    let letztesMailZiel: string | null = null;
    return {
      aufrufe,
      letztes: () => letztesUpdate,
      mailZiel: () => letztesMailZiel,
      client: {
        auth: {
          signInWithPassword: vi.fn(async () => {
            aufrufe.signIn += 1;
            return opts.anmeldungKlappt === false
              ? { error: { message: "Invalid login credentials" } }
              : { error: null };
          }),
          updateUser: vi.fn(async (attr: Record<string, unknown>) => {
            aufrufe.update += 1;
            letztesUpdate = attr;
            return { error: null };
          }),
          resetPasswordForEmail: vi.fn(async (_e: string, o?: { redirectTo?: string }) => {
            aufrufe.mail += 1;
            letztesMailZiel = o?.redirectTo ?? null;
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

  // Bis 09.09.2026 stand hier das Gegenteil: „Google-Konten setzen ein Passwort
  // OHNE Bestätigung". Das war ein `istGoogle`-Zweig, der die Prüfung übersprang.
  // Mit Supabases Schalter „Require current password when updating" hätte er
  // still versagt — ein Konto ohne Passwort kann keines mitschicken. Der Zweig
  // ist weg; für Google führt der Weg jetzt über die E-Mail.
  it("ohne aktuelles Passwort wird NICHT geändert — auch nicht für Google", async () => {
    const { client, aufrufe } = fakeClient();
    const erg = await wechslePasswort(client, { ...basis, aktuell: "" });
    expect(erg.ok).toBe(false);
    expect(aufrufe.update).toBe(0);
  });

  it("schickt das aktuelle Passwort als `current_password` mit", async () => {
    // Die eigentliche serverseitige Prüfung. Ohne dieses Feld bliebe der
    // Supabase-Schalter wirkungslos — bzw. wuerde jede Aenderung abweisen.
    const { client, letztes } = fakeClient();
    await wechslePasswort(client, basis);
    expect(letztes()).toMatchObject({ current_password: basis.aktuell, password: basis.neu });
  });

  it("meldet ein geleaktes Passwort verständlich, statt englisch durchzureichen", async () => {
    const { client } = fakeClient();
    (client as unknown as { auth: { updateUser: unknown } }).auth.updateUser = async () => ({
      error: { message: "Password is known to be weak and easy to guess, please choose a different one (pwned)" },
    });
    const erg = await wechslePasswort(client, basis);
    expect(erg.ok).toBe(false);
    if (!erg.ok) expect(erg.fehler).toMatch(/Datenleck/);
  });

  it("der Mail-Weg zeigt auf dieselbe Einlöse-Route wie „Passwort vergessen“", async () => {
    // Zwei Stellen, ein Ziel — sonst laufen Login und Einstellungen auseinander.
    const { client, aufrufe, mailZiel } = fakeClient();
    const erg = await sendePasswortMail(client, "a@b.de");
    expect(erg.ok).toBe(true);
    expect(aufrufe.mail).toBe(1);
    expect(RESET_ZIEL).toBe("/auth/passwort");
    // Im Test gibt es kein window — dann bleibt redirectTo undefined.
    expect(mailZiel() === null || String(mailZiel()).endsWith(RESET_ZIEL)).toBe(true);
  });

  it("ohne E-Mail-Adresse wird nichts verschickt", async () => {
    const { client, aufrufe } = fakeClient();
    expect((await sendePasswortMail(client, "")).ok).toBe(false);
    expect(aufrufe.mail).toBe(0);
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
