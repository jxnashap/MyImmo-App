import { describe, it, expect } from "vitest";
import {
  darfFeature, effektiverPlan, einheitenLimit, planEnthaelt,
  EINHEITEN_LIMIT, type Abo,
} from "@/lib/plan";

const abo = (over: Partial<Abo> = {}): Abo => ({
  plan: "privat", status: "aktiv", zyklus: "jahr",
  provider_customer_id: "ctm_1", provider_subscription_id: "sub_1",
  gueltig_bis: null, storniert_zum: null, ...over,
});

describe("Tarif-Matrix", () => {
  it("Kostenlos enthält keine Bezahl-Features", () => {
    expect(planEnthaelt("kostenlos", "nk_pdf")).toBe(false);
    expect(planEnthaelt("kostenlos", "steuer")).toBe(false);
  });
  it("Privat: NK/Steuer/Dokumente/Mieterportal, aber kein KI-Import", () => {
    expect(planEnthaelt("privat", "nk_pdf")).toBe(true);
    expect(planEnthaelt("privat", "mieterportal")).toBe(true);
    expect(planEnthaelt("privat", "ki_import")).toBe(false);
    expect(planEnthaelt("privat", "beleihung")).toBe(false);
  });
  it("Plus: alles aus Privat + KI/Service/Beleihung, keine Hausverwaltung", () => {
    expect(planEnthaelt("plus", "nk_pdf")).toBe(true);
    expect(planEnthaelt("plus", "ki_import")).toBe(true);
    expect(planEnthaelt("plus", "beleihung")).toBe(true);
    expect(planEnthaelt("plus", "hausverwaltung")).toBe(false);
  });
  it("Business enthält Hausverwaltung", () => {
    expect(planEnthaelt("business", "hausverwaltung")).toBe(true);
  });
});

describe("Wirksamer Plan", () => {
  it("ohne Abo → kostenlos", () => expect(effektiverPlan(null)).toBe("kostenlos"));
  it("aktiv/testphase/ueberfaellig behalten den Tarif (Kulanz beim Mahnlauf)", () => {
    expect(effektiverPlan(abo({ status: "aktiv" }))).toBe("privat");
    expect(effektiverPlan(abo({ status: "testphase", plan: "plus" }))).toBe("plus");
    expect(effektiverPlan(abo({ status: "ueberfaellig" }))).toBe("privat");
  });
  it("gekündigt/pausiert → kostenlos", () => {
    expect(effektiverPlan(abo({ status: "gekuendigt" }))).toBe("kostenlos");
    expect(effektiverPlan(abo({ status: "pausiert" }))).toBe("kostenlos");
  });
});

describe("darfFeature", () => {
  it("Early Access (enforced=false): ALLES erlaubt, auch ohne Abo", () => {
    expect(darfFeature(null, "nk_pdf", false)).toBe(true);
    expect(darfFeature(null, "hausverwaltung", false)).toBe(true);
  });
  it("durchgesetzt: Feature folgt dem Tarif", () => {
    expect(darfFeature(null, "nk_pdf", true)).toBe(false);
    expect(darfFeature(abo(), "nk_pdf", true)).toBe(true);
    expect(darfFeature(abo(), "ki_import", true)).toBe(false);
    expect(darfFeature(abo({ plan: "plus" }), "ki_import", true)).toBe(true);
  });
});

describe("Einheiten-Limit", () => {
  it("Limits je Tarif", () => {
    expect(EINHEITEN_LIMIT.kostenlos).toBe(1);
    expect(EINHEITEN_LIMIT.privat).toBe(5);
    expect(EINHEITEN_LIMIT.plus).toBe(24);
    expect(EINHEITEN_LIMIT.business).toBe(Number.POSITIVE_INFINITY);
  });
  it("Early Access: unbegrenzt; durchgesetzt: Tarif-Limit", () => {
    expect(einheitenLimit(null, false)).toBe(Number.POSITIVE_INFINITY);
    expect(einheitenLimit(null, true)).toBe(1);
    expect(einheitenLimit(abo(), true)).toBe(5);
    expect(einheitenLimit(abo({ status: "gekuendigt" }), true)).toBe(1);
  });
});
