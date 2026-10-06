// Kaufprüfung → Objekt (Verknüpfungs-Audit 06.10.2026, Paket E).
//
// Vorher endete der Kaufweg bei „Objekt anlegen“ mit einem LEEREN Formular: Adresse, Kaufpreis,
// Fläche, Baujahr und Miete standen schon in der Kaufprüfung und wurden ein zweites Mal getippt.
// Die Spalte `kalkulationen.uebernommen_prop_id` gab es seit der Migration 20261006050000, sie
// wurde aber nie geschrieben. Diese Datei übersetzt die gespeicherten Eingaben des Rechners
// (`eingabenSnapshot()` in components/kauf/ObjektRechner.tsx) in Vorgaben für das Objektformular.
// Rein, ohne Datenbank. Nichts wird still gespeichert — der Nutzer sieht das Formular und prüft.

import { zahlDe } from "@/lib/zahl";

export type ObjektVorbelegung = {
  bezeichnung: string;
  typ: "Eigentumswohnung" | "Einfamilienhaus" | "Mehrfamilienhaus";
  adresse: string | null;
  kaufpreis: number | null;
  flaeche: number | null;
  grundstuecksflaeche: number | null;
  baujahr: number | null;
  einheiten_anzahl: number | null;
  miete: number | null;
  obj_status: "Vermietet" | "Selbst bewohnt";
};

/** Nur positive Zahlen übernehmen — eine 0 aus einem leeren Feld ist keine Angabe. */
function positiv(s: string | undefined): number | null {
  const n = zahlDe(s ?? "");
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

export function objektAusKaufpruefung(name: string | null | undefined, data: Record<string, string> | null | undefined): ObjektVorbelegung {
  const d = data ?? {};
  const haus = d.objektTyp === "haus";
  const whg = haus ? Math.round(positiv(d.anzahlWhg) ?? 1) : 1;
  const typ = !haus ? "Eigentumswohnung" : whg > 1 ? "Mehrfamilienhaus" : "Einfamilienhaus";
  const vermietet = d.nutzung !== "eigennutzung";
  const baujahr = positiv(d.baujahr);
  const adresse = (d.adresse ?? "").trim() || null;
  return {
    bezeichnung: (name ?? "").trim() || adresse || "Neues Objekt",
    typ,
    adresse,
    kaufpreis: positiv(d.kaufpreis),
    flaeche: positiv(d.flaeche),
    grundstuecksflaeche: haus ? positiv(d.grundFlaeche) : null,
    // Ein Baujahr außerhalb des Plausiblen (Tippfehler „198“) nicht übernehmen.
    baujahr: baujahr != null && baujahr >= 1500 && baujahr <= 2100 ? Math.round(baujahr) : null,
    einheiten_anzahl: typ === "Mehrfamilienhaus" ? whg : null,
    // Bei Eigennutzung ist eine noch gespeicherte Miete keine Einnahme. „hausgeld“ fragt der Rechner
    // nur bei Eigennutzung ab, als „Laufende Kosten / Hausgeld“ — Hausgeld und Bewirtschaftung in
    // einem Feld. Ins Objekt-Feld Hausgeld gehört es deshalb nicht; es bleibt leer.
    miete: vermietet ? positiv(d.kaltmiete) : null,
    obj_status: vermietet ? "Vermietet" : "Selbst bewohnt",
  };
}
