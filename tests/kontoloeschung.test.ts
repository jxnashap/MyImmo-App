import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Kontolöschung vollständig (05.10.2026). Bis dahin kannte `delete_own_account()` sieben neuere
// Tabellen nicht — ohne Fremdschlüssel-Kaskade blieben dort nach einer Kontolöschung Fotos aus
// Wohnungen, Vollmacht-Scans und Mieter-Adressen liegen (Art. 17 DSGVO). Gefunden erst bei der
// Prüfung vor dem Livegang, nicht beim Anlegen der Tabellen.
//
// Dieser Wächter verlangt für JEDE Tabelle, die eine Migration anlegt, eine von drei Antworten:
//   (a) die aktuelle `delete_own_account()` löscht sie,
//   (b) sie hängt per `on delete cascade` an auth.users oder an einer Tabelle, die gelöscht wird
//       (live nachgesehen am 05.10.2026, pg_constraint), oder
//   (c) sie steht mit Begründung in AUSNAHMEN.
// Eine neue Tabelle ohne Antwort macht den Test rot — dann die Funktion erweitern (Migration im
// SQL-Editor, das Lösch-Schlüsselwort löst sonst den Bestätigungsdialog aus) oder begründen.

const ORDNER = "supabase/migrations";
const dateien = readdirSync(ORDNER).filter((f) => f.endsWith(".sql")).sort();

const tabellen = new Set<string>();
for (const f of dateien) {
  const sql = readFileSync(`${ORDNER}/${f}`, "utf8");
  for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*(?:\(|as)/gi)) tabellen.add(m[1].toLowerCase());
}

// Die JÜNGSTE Fassung der Funktion zählt.
const funktion = (() => {
  const mit = dateien.filter((f) => /function public\.delete_own_account\(/.test(readFileSync(`${ORDNER}/${f}`, "utf8")));
  const sql = readFileSync(`${ORDNER}/${mit[mit.length - 1]}`, "utf8");
  return sql.slice(sql.indexOf("function public.delete_own_account("));
})();
const geloescht = new Set([...funktion.matchAll(/delete from public\.([a-z_0-9]+)/g)].map((m) => m[1]));

/** Kaskade auf auth.users oder auf eine gelöschte Eltern-Tabelle (live geprüft 05.10.2026). */
const KASKADE = new Set([
  "abos", "anliegen", "anliegen_dateien", "auftraege", "auftrag_rueckmeldungen", "beleihung_dokumente",
  "beleihung_freigaben", "beleihung_rueckmeldungen", "bewerber_links", "bewerbung_dateien", "bewerbungen",
  "einladungscodes", "firmen", "frist_ausgeblendet", "kalkulationen", "konto_freischaltung",
  "makler_dokumente", "mfa_wiederherstellung", "mieter_zugaenge", "nk_co2", "nutzer_rollen",
  "selbstauskunft", "service_zugaenge", "unterschriften", "vermieter_anfragen",
  "wiederkehrende_buchungen", "zaehlerstand_meldungen",
  // Kaskade per Migration 20261006050000 (im SQL-Editor; lokal gegen PostgreSQL 16 geprüft).
  "sanierungsprojekte",
]);

const AUSNAHMEN: Record<string, string> = {
  bank_auth_anfragen: "seit 29.08.2026 gedroppt (Open Banking entfernt)",
  bank_umsaetze: "seit 29.08.2026 gedroppt",
  bankverbindungen: "seit 29.08.2026 gedroppt",
  billing_einstellungen: "Systemschalter, kein Konto-Bezug",
  regional_kennzahlen: "Marktdaten, kein Konto-Bezug",
  zugriff_limit: "nur HMAC-Kennzeichen, Zeilen älter als 24 h werden aufgeräumt",
  newsletter_anmeldungen: "an eine E-Mail-Adresse gebunden, nicht an ein Konto; Abmelden löscht über den eigenen Weg",
  registrierung_freigaben: "an eine E-Mail-Adresse gebunden, verfällt nach 14 Tagen",
  demo_seed: "Schema der Demo-Vorlage, kein Nutzerkonto",
  nk_co: "Teil von nk_co2 (Regex-Rest) — nk_co2 hat eine Kaskade",
};

describe("Kontolöschung erfasst jede Tabelle", () => {
  it("der Wächter hat hingesehen (Plausibilität)", () => {
    expect(tabellen.size).toBeGreaterThan(45);
    expect(geloescht.has("properties")).toBe(true);
  });

  it("jede Tabelle ist gelöscht, kaskadiert oder begründet ausgenommen", () => {
    const offen = [...tabellen].filter((t) => !geloescht.has(t) && !KASKADE.has(t) && !(t in AUSNAHMEN));
    expect(offen, `Tabellen ohne Antwort bei der Kontolöschung: ${offen.join(", ")}`).toEqual([]);
  });

  it("die sieben Tabellen vom Oktober sind jetzt in der Funktion", () => {
    for (const t of ["auftrag_notizen", "vertreter", "zustellungen", "anliegen_ereignisse", "angebote", "angebotsanfragen", "gebaeude_infos", "service_objekte"]) {
      expect(geloescht.has(t), t).toBe(true);
    }
  });

  it("Kinder vor Eltern: der Verlauf wird gelöscht, BEVOR die Anliegen per Kaskade verschwinden", () => {
    expect(funktion.indexOf("public.anliegen_ereignisse")).toBeLessThan(funktion.indexOf("delete from auth.users"));
    expect(funktion.indexOf("delete from public.angebote")).toBeLessThan(funktion.indexOf("delete from public.angebotsanfragen"));
  });

  it("Zuordnungen eines Partners gehen mit, wenn ER sein Konto löscht", () => {
    expect(funktion).toMatch(/delete from public\.service_objekte\s+where vermieter_id = uid or service_user_id = uid/);
  });
});
