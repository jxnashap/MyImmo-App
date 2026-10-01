// „Beim Start benachrichtigen“ (01.10.2026): dezent, nur bei geschlossener
// Registrierung, und der angezeigte Einwilligungstext ist derselbe, der
// gespeichert wird (eine Konstante, keine Kopie).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EINWILLIGUNGSTEXT, EINWILLIGUNGSTEXT_START, zweckAus, einwilligungFuer, bestaetigungsMail } from "@/lib/newsletter";
import { START_MELDUNG } from "@/components/landing/StartBenachrichtigung";

const lies = (p: string) => readFileSync(p, "utf8");

describe("Zweck und Wortlaut", () => {
  it("nur „start“ ist die Startanmeldung — alles andere bleibt Vorlagen", () => {
    expect(zweckAus("start")).toBe("start");
    for (const q of ["vorlagen", "", null, undefined, "Start", "ratgeber"]) expect(zweckAus(q), String(q)).toBe("vorlagen");
    expect(einwilligungFuer("start")).toBe(EINWILLIGUNGSTEXT_START);
    expect(einwilligungFuer("vorlagen")).toBe(EINWILLIGUNGSTEXT);
  });
  it("der Start-Wortlaut nennt den Zweck und den Widerruf", () => {
    expect(EINWILLIGUNGSTEXT_START).toContain("wenn MyImmo für alle startet");
    expect(EINWILLIGUNGSTEXT_START).toContain("jederzeit über den Abmeldelink");
  });
  it("beide Mails enthalten den Link, die Start-Mail spricht vom Start", () => {
    const s = bestaetigungsMail("https://x/b?token=1", "start");
    expect(s.html).toContain("wenn MyImmo für alle startet");
    expect(s.html).toContain("https://x/b?token=1");
    expect(bestaetigungsMail("https://x/b?token=1").html).toContain("MyImmo-Vorlagen");
  });
});

describe("Einbindung", () => {
  const k = lies("components/landing/StartBenachrichtigung.tsx");
  it("das Formular zeigt die Konstante und sendet quelle „start“", () => {
    expect(k).toContain("{EINWILLIGUNGSTEXT_START}");
    expect(k).toContain("quelle: QUELLE_START");
  });
  it("dezent: zuerst nur eine Textzeile, das Formular erst nach Klick", () => {
    expect(k).toContain("!offen ? (");
    expect(k).toContain("Beim Start per E-Mail benachrichtigen");
  });
  it("nur bei geschlossener Registrierung, auf der Startseite und im Schluss der Unterseiten", () => {
    expect(lies("components/LandingPage.tsx")).toContain("{!REGISTRIERUNG_OFFEN && <StartBenachrichtigung nl={nl} />}");
    expect(lies("components/landing/Shell.tsx")).toContain("{!REGISTRIERUNG_OFFEN && <StartBenachrichtigung />}");
    expect(lies("app/(app)/page.tsx")).toContain("<LandingPage nl={(await seite.searchParams).nl} />");
  });
  it("jede Rückmeldung der Bestätigungsroute hat einen Text", () => {
    for (const s of ["ok", "abgelaufen", "fehler"]) expect(START_MELDUNG[s]?.text, s).toBeTruthy();
  });
  it("die Datenschutzerklärung nennt die Startbenachrichtigung", () => {
    expect(lies("app/(pub)/datenschutz/page.tsx")).toContain("Benachrichtigung zum Start");
  });
});
