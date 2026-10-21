// Start-Checkliste und Tour (21.10.2026, Entscheidung des Betreibers): Die Tour öffnet sich nicht
// mehr von selbst; die Checkliste führt, Objekt und Mieter sind Pflicht, der Rest freiwillig.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { startSchritte, startOffen, type StartStand } from "@/lib/startCheckliste";

const lies = (p: string) => readFileSync(p, "utf8");
const ohneKommentare = (s: string) => s.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z)).join("\n");

const leer: StartStand = { objekte: 0, mieter: 0, kredite: 0, mietBuchungen: 0, profil: null };
const erledigt = (s: StartStand) => Object.fromEntries(startSchritte(s).map((x) => [x.key, x.erledigt]));

describe("startSchritte", () => {
  it("leeres Konto: alles offen, Checkliste offen", () => {
    const l = startSchritte(leer);
    expect(l.map((x) => x.key)).toEqual(["objekt", "mieter", "kredit", "mietkonto", "absender"]);
    expect(l.every((x) => !x.erledigt)).toBe(true);
    expect(startOffen(l)).toBe(true);
  });
  it("Objekt ohne Mieter: Checkliste bleibt offen", () => {
    expect(startOffen(startSchritte({ ...leer, objekte: 1 }))).toBe(true);
  });
  it("Objekt + Mieter genügen — ohne Kredit, Miete, Absender ist sie zu", () => {
    const l = startSchritte({ ...leer, objekte: 1, mieter: 1 });
    expect(startOffen(l)).toBe(false);
    expect(l.filter((x) => x.freiwillig).map((x) => x.key)).toEqual(["kredit", "mietkonto", "absender"]);
  });
  it("Mieter ohne Objekt hält sie offen (Pflicht ist beides)", () => {
    expect(startOffen(startSchritte({ ...leer, mieter: 2 }))).toBe(true);
  });
  it("jeder Schritt hakt sich an seiner eigenen Zahl ab", () => {
    expect(erledigt({ ...leer, kredite: 1 })).toMatchObject({ kredit: true, objekt: false, mietkonto: false });
    expect(erledigt({ ...leer, mietBuchungen: 3 })).toMatchObject({ mietkonto: true, kredit: false });
    expect(erledigt({ ...leer, objekte: 1 })).toMatchObject({ objekt: true, mieter: false });
  });
  it("Absender erst mit Name, Straße und Ort — Leerzeichen zählen nicht", () => {
    expect(erledigt({ ...leer, profil: { name: "Max", strasse: "Weg 1", ort: "Kiel" } }).absender).toBe(true);
    expect(erledigt({ ...leer, profil: { name: "Max", strasse: "Weg 1", ort: null } }).absender).toBe(false);
    expect(erledigt({ ...leer, profil: { name: "  ", strasse: "Weg 1", ort: "Kiel" } }).absender).toBe(false);
  });
  it("führt ins Mietkonto statt zum Buchen von Hand, und zum Profil-Reiter", () => {
    const l = startSchritte(leer);
    expect(l.find((x) => x.key === "mietkonto")!.href).toBe("/mietkonto");
    expect(l.find((x) => x.key === "absender")!.href).toBe("/einstellungen?tab=profil");
    expect(l.some((x) => x.href === "/cashflow")).toBe(false);
  });
});

describe("Tour startet nicht von selbst", () => {
  it("OnboardingTour hat keine Auto-Start-Eigenschaft mehr", () => {
    const t = ohneKommentare(lies("components/OnboardingTour.tsx"));
    expect(t).not.toMatch(/neuerNutzer/);
    expect(t).toMatch(/export default function OnboardingTour\(\)/);
  });
  it("das Layout übergibt nichts, was sie öffnen würde", () => {
    const l = ohneKommentare(lies("app/(app)/layout.tsx"));
    expect(l).toMatch(/<OnboardingTour \/>/);
  });
  it("die Tour bucht Mieten nicht von Hand — sie führt ins Mietkonto", () => {
    const t = lies("components/OnboardingTour.tsx");
    expect(t).not.toMatch(/per Hand oder per CSV-Import/);
    expect(t).toMatch(/titel: "4 · Mieten im Mietkonto bestätigen"/);
  });
  it("Dashboard zeigt die Checkliste beim leeren Konto UND als Karte, solange sie offen ist", () => {
    const d = ohneKommentare(lies("app/(app)/page.tsx"));
    expect(d).toMatch(/if \(properties\.length === 0\) \{[\s\S]{0,400}<StartCheckliste schritte=\{startListe\} \/>/);
    expect(d).toMatch(/\{startOffen\(startListe\) && <StartCheckliste schritte=\{startListe\} kompakt \/>\}/);
  });
});
