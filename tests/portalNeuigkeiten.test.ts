import { describe, it, expect } from "vitest";
import { bauePortalNeuigkeiten, type NeuigkeitenQuelle } from "@/lib/portalNeuigkeiten";

// Dashboard: Neuigkeiten aus dem Mieterportal (02.10.2026, Idee des Betreibers).
// Was PASSIERT ist — nicht, was zu tun ist (das stehen in „Termine & Aufgaben“).

const HEUTE = "2026-10-02";
const leer = (): NeuigkeitenQuelle => ({
  ereignisse: [], anliegen: new Map(), zustellungen: [], angebote: [], rueckmeldungen: [], freigaben: [], bewerbungen: [],
});

describe("Neuigkeiten aus dem Mieterportal", () => {
  it("nichts passiert: leere Liste (der Normalfall)", () => {
    expect(bauePortalNeuigkeiten(leer(), HEUTE)).toEqual({ liste: [], gesamt: 0 });
  });

  it("nur Einträge des MIETERS zählen — eigene Nachrichten und Status-Wechsel nicht", () => {
    const q = leer();
    q.anliegen.set("a1", { titel: "Heizung", mieter: "Sophie Berger" });
    q.ereignisse = [
      { anliegen_id: "a1", autor_rolle: "mieter", art: "nachricht", text: "Danke", created_at: "2026-10-01T09:00:00Z" },
      { anliegen_id: "a1", autor_rolle: "vermieter", art: "nachricht", text: "Komme Montag", created_at: "2026-10-01T10:00:00Z" },
      { anliegen_id: "a1", autor_rolle: "mieter", art: "status", text: null, created_at: "2026-10-01T11:00:00Z" },
      { anliegen_id: "a1", autor_rolle: "mieter", art: "termin", text: "Termin bestätigt: 2026-10-05 10:00", created_at: "2026-10-01T12:00:00Z" },
    ];
    const r = bauePortalNeuigkeiten(q, HEUTE).liste;
    expect(r.map((n) => [n.art, n.text, n.sub])).toEqual([
      ["termin", "Termin bestätigt: 2026-10-05 10:00", "Sophie Berger · Heizung"],
      ["nachricht", "Nachricht von Sophie Berger", "Heizung"],
    ]);
  });

  it("älter als 14 Tage fällt heraus — wartende Freigaben bleiben, solange sie warten", () => {
    const q = leer();
    q.angebote = [{ firma: "Böhm", betrag: 480, created_at: "2026-09-18T00:00:00Z" }, { firma: "Alt", betrag: 1, created_at: "2026-09-17T23:00:00Z" }];
    q.freigaben = [{ titel: "Dachrinne", created_at: "2026-08-01T00:00:00Z" }];
    const r = bauePortalNeuigkeiten(q, HEUTE).liste;
    expect(r.map((n) => n.text)).toEqual(["Angebot von Böhm", "Hausmeister bittet um Freigabe"]);
    expect(r[0].sub.replace(/\s/g, " ")).toBe("480,00 €"); // toLocaleString setzt ein geschütztes Leerzeichen
  });

  it("neueste zuerst, gekappt auf die Grenze — `gesamt` nennt die echte Zahl", () => {
    const q = leer();
    q.bewerbungen = Array.from({ length: 8 }, (_, i) => ({ name: `B${i}`, created_at: `2026-09-2${i}T00:00:00Z` }));
    q.zustellungen = [{ titel: "NK 2025", art: "dokument", mieter: "Sophie", bestaetigt_am: "2026-10-02T08:00:00Z" }];
    q.rueckmeldungen = [{ art: "zusage", firma: "Böhm", auftrag: "Dachrinne", created_at: "2026-10-01T08:00:00Z" }];
    const r = bauePortalNeuigkeiten(q, HEUTE, 3);
    expect(r.gesamt).toBe(10);
    expect(r.liste.map((n) => n.text)).toEqual(["Sophie hat bestätigt", "Böhm hat den Auftrag angenommen", "Neue Bewerbung von B7"]);
    expect(r.liste.map((n) => n.href)).toEqual(["/archiv", "/anliegen?tab=service", "/anliegen?tab=bewerbungen"]);
  });

  it("eine bestätigte Mitteilung führt zum Haus-Reiter, ohne Bestätigung keine Zeile", () => {
    const q = leer();
    q.zustellungen = [
      { titel: "Wasser aus", art: "mitteilung", mieter: "Sophie", bestaetigt_am: "2026-10-01T00:00:00Z" },
      { titel: "Offen", art: "dokument", mieter: "Max", bestaetigt_am: null },
    ];
    expect(bauePortalNeuigkeiten(q, HEUTE).liste.map((n) => [n.sub, n.href])).toEqual([["Wasser aus", "/anliegen?tab=haus"]]);
  });
});
