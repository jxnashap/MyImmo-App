import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { neuSeit, seitFuerVergleich } from "@/lib/serviceNeu";
import type { AuftragNotiz } from "@/lib/auftragNotizen";

// „Neu seit deinem letzten Besuch“ im Service-Portal (05.10.2026).
const SEIT = "2026-10-05T10:00:00Z";
const vorher = "2026-10-04T09:00:00Z";
const nachher = "2026-10-05T12:00:00Z";
const notiz = (autor_rolle: "vermieter" | "service", created_at: string, extra: Partial<AuftragNotiz> = {}): AuftragNotiz =>
  ({ id: created_at + autor_rolle, auftrag_id: "a", autor_rolle, art: "notiz", text: "x", datei_name: null, datei_type: null, created_at, ...extra });

describe("Was ist neu?", () => {
  it("neuer Auftrag vom Vermieter — nicht der eigene Antrag", () => {
    expect(neuSeit({ status: "offen", erstellt_von: "vermieter", created_at: nachher }, SEIT)).toBe("Neuer Auftrag");
    expect(neuSeit({ status: "freigabe", erstellt_von: "service", created_at: nachher }, SEIT)).toBeNull();
    expect(neuSeit({ status: "offen", erstellt_von: "vermieter", created_at: vorher }, SEIT)).toBeNull();
  });
  it("Freigabe des eigenen Antrags bzw. des Fachbetrieb-Vorschlags", () => {
    expect(neuSeit({ status: "offen", erstellt_von: "service", created_at: vorher, updated_at: nachher }, SEIT)).toBe("Freigegeben");
    expect(neuSeit({ status: "offen", erstellt_von: "vermieter", created_at: vorher, updated_at: nachher, notizen: [notiz("service", vorher, { art: "fachbetrieb" })] }, SEIT)).toBe("Freigegeben");
    // Ein Vermieter-Auftrag, den nur ein Termin geändert hat, ist keine „Freigabe“.
    expect(neuSeit({ status: "offen", erstellt_von: "vermieter", created_at: vorher, updated_at: nachher }, SEIT)).toBeNull();
    expect(neuSeit({ status: "nicht_freigegeben", erstellt_von: "service", created_at: vorher, updated_at: nachher }, SEIT)).toBe("Nicht freigegeben");
  });
  it("Rückfrage geht vor; eigene Notizen sind nie neu", () => {
    const a = { status: "freigabe", erstellt_von: "service", created_at: vorher };
    expect(neuSeit({ ...a, notizen: [notiz("vermieter", nachher, { rueckfrage: true })] }, SEIT)).toBe("Rückfrage");
    expect(neuSeit({ ...a, notizen: [notiz("vermieter", nachher)] }, SEIT)).toBe("Nachricht");
    expect(neuSeit({ ...a, notizen: [notiz("service", nachher)] }, SEIT)).toBeNull();
    // beantwortete Rückfrage ist nicht mehr „Rückfrage“, aber die Vermieter-Notiz bleibt neu
    expect(neuSeit({ ...a, notizen: [notiz("vermieter", nachher, { rueckfrage: true }), notiz("service", nachher)] }, SEIT)).toBe("Nachricht");
  });
  it("Erstbesuch: die letzten 7 Tage zählen", () => {
    expect(seitFuerVergleich(null, "2026-10-05")).toBe("2026-09-28T00:00:00.000Z");
    expect(seitFuerVergleich(SEIT, "2026-10-05")).toBe(SEIT);
  });
});

describe("Verdrahtung", () => {
  it("der Besuch wird nur im echten Portal gemeldet — nicht in Vorschau, Demo oder Vermieter-Ansicht", () => {
    expect(readFileSync("components/ServicePortalAnsicht.tsx", "utf8")).toMatch(/\{!vorschau && !ansichtImVermieterKonto && <GesehenMelden \/>\}/);
  });
  it("die Datenbank merkt sich nichts für das geteilte Demo-Konto", () => {
    expect(readFileSync("supabase/migrations/20261005150000_service_gesehen.sql", "utf8")).toMatch(/if public\.ist_demo_nutzer\(\) then return; end if;/);
  });
});
