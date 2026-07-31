import { describe, it, expect } from "vitest";
import { EINWILLIGUNGSTEXT, TOKEN_STUNDEN, bestaetigungsMail, istEmail, normalisiereEmail } from "@/lib/newsletter";
import { neuesToken, tokenHash } from "@/lib/newsletterToken";

describe("Adressprüfung", () => {
  it("nimmt übliche Adressen an", () => {
    for (const e of ["a@b.de", "vorname.nachname@immo-verwaltung.example", "x+tag@sub.domain.co.uk"]) {
      expect(istEmail(e), e).toBe(true);
    }
  });

  it("weist offensichtlichen Unsinn ab", () => {
    for (const e of ["", "abc", "a@b", "a@@b.de", "a b@c.de", "@b.de", "a@.de", "a@b..de", "a@b.de "]) {
      // Das letzte Beispiel hat ein Leerzeichen am Ende — getrimmt ist es gültig,
      // deshalb steht es hier bewusst als Sonderfall.
      if (e === "a@b.de ") { expect(istEmail(e)).toBe(true); continue; }
      expect(istEmail(e), JSON.stringify(e)).toBe(false);
    }
  });

  it("begrenzt die Länge", () => {
    expect(istEmail("a".repeat(70) + "@b.de")).toBe(false);
    expect(istEmail("a@" + "b".repeat(260) + ".de")).toBe(false);
  });

  it("vergleicht ohne Rücksicht auf Groß- und Kleinschreibung", () => {
    expect(normalisiereEmail("  Max.Mustermann@Example.DE ")).toBe("max.mustermann@example.de");
  });
});

describe("Token", () => {
  it("erzeugt bei jedem Aufruf einen anderen Wert", () => {
    const menge = new Set(Array.from({ length: 50 }, () => neuesToken()));
    expect(menge.size).toBe(50);
  });

  it("ist URL-tauglich", () => {
    for (let i = 0; i < 20; i++) expect(neuesToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hasht stabil und einwegig", () => {
    const t = neuesToken();
    expect(tokenHash(t)).toBe(tokenHash(t));
    expect(tokenHash(t)).toHaveLength(64);
    // Der Klartext darf im Hash nicht auftauchen — sonst wäre das Speichern
    // des Hashs sinnlos.
    expect(tokenHash(t)).not.toContain(t.slice(0, 8));
    expect(tokenHash(t)).not.toBe(tokenHash(neuesToken()));
  });
});

describe("Bestätigungsmail", () => {
  const url = "https://www.myimmoapp.de/api/newsletter/bestaetigen?token=abc";

  it("enthält den Link in beiden Fassungen", () => {
    const m = bestaetigungsMail(url);
    expect(m.text).toContain(url);
    expect(m.html).toContain(url);
    // Textfassung ist Pflicht: Ohne sie landen Mails eher im Spam, und
    // Textclients sähen gar nichts.
    expect(m.text.length).toBeGreaterThan(120);
  });

  it("nennt die Gültigkeitsdauer", () => {
    const m = bestaetigungsMail(url);
    expect(m.text).toContain(String(TOKEN_STUNDEN));
    expect(m.html).toContain(String(TOKEN_STUNDEN));
  });

  it("sagt, was bei einer fremden Anmeldung zu tun ist", () => {
    // Pflichtbestandteil einer sauberen Double-Opt-in-Mail: Wer nicht bestellt
    // hat, muss nichts tun — und muss das auch lesen können.
    expect(bestaetigungsMail(url).text.toLowerCase()).toContain("nicht angemeldet");
  });
});

describe("Einwilligung", () => {
  it("nennt Zweck und Widerruf", () => {
    expect(EINWILLIGUNGSTEXT).toMatch(/E-Mail/);
    expect(EINWILLIGUNGSTEXT.toLowerCase()).toContain("widerruf");
  });
});
