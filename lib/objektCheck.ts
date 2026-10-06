// Objekt-Check „8 von 10 Angaben“ (02.10.2026, Ausbau-Paket Punkt 2; Plan vom 01.10., Phase 2).
//
// Die Datenlücken-Erkennung gab es schon (lib/heute.ts, Art „stammdaten“) — aber nur als
// Sammelzeile ganz unten in den Aufgaben. Hier wird daraus ein ZIEL je Objekt: was fehlt, warum
// es zählt, und wo man es nachträgt. Nur Angaben, die etwas berechnen, nicht „nice to have“.
// Was für ein Objekt nicht gilt (Mieter bei Leerstand, Kredit ohne Darlehen, Gebäudeanteil beim
// Grundstück), zählt nicht mit — sonst kann ein gepflegtes Objekt nie vollständig sein.
// Reine Funktion.

export type CheckPunkt = { schluessel: string; label: string; grund: string; href: string; erfuellt: boolean };
export type ObjektCheck = { erfuellt: number; gesamt: number; punkte: CheckPunkt[]; fehlend: CheckPunkt[] };

export type CheckObjekt = {
  id: string;
  typ?: string | null;
  adresse?: string | null;
  kaufpreis?: number | null;
  kaufdatum?: string | null;
  flaeche?: number | null;
  baujahr?: number | null;
  afa_gebaeudeanteil?: number | null;
  vergleichsmiete_m2?: number | null;
  obj_status?: string | null;
};
export type CheckMieter = { id: string; prop_id: string | null; mietbeginn: string | null; mietende: string | null };
export type CheckKredit = { id: string; prop_id: string | null; auszahlung_datum: string | null };

const laeuft = (m: CheckMieter, heute: string) => !m.mietende || m.mietende >= heute;

export function objektCheck(p: CheckObjekt, mieter: CheckMieter[], kredite: CheckKredit[], heute: string): ObjektCheck {
  const bearbeiten = `/properties/${p.id}/edit`;
  const grundstueck = (p.typ ?? "") === "Grundstück";
  const eigeneMieter = mieter.filter((m) => m.prop_id === p.id && laeuft(m, heute));
  const eigeneKredite = kredite.filter((k) => k.prop_id === p.id);
  const vermietet = (p.obj_status ?? "") === "Vermietet" || eigeneMieter.length > 0;

  const punkte: CheckPunkt[] = [
    { schluessel: "adresse", label: "Adresse", grund: "für Briefe, Abrechnungen und die Wertschätzung", href: bearbeiten, erfuellt: !!p.adresse?.trim() },
    { schluessel: "kaufpreis", label: "Kaufpreis", grund: "Grundlage für AfA, Rendite und Wert", href: bearbeiten, erfuellt: (p.kaufpreis ?? 0) > 0 },
    { schluessel: "kaufdatum", label: "Kaufdatum", grund: "AfA im Kaufjahr, 15 %-Grenze und Spekulationsfrist", href: bearbeiten, erfuellt: !!p.kaufdatum },
    { schluessel: "flaeche", label: "Wohnfläche", grund: "Umlageschlüssel und Mietspiegel-Vergleich", href: bearbeiten, erfuellt: (p.flaeche ?? 0) > 0 },
    { schluessel: "baujahr", label: "Baujahr", grund: "AfA-Satz und Wertschätzung", href: bearbeiten, erfuellt: (p.baujahr ?? 0) > 0 },
  ];
  if (!grundstueck) {
    // Zum AfA-Assistenten, der den Anteil aus Kaufpreis, Grundstück und Bodenrichtwert rechnet
    // und ihn am Objekt speichert — im Formular müsste man die Zahl raten (Paket D).
    punkte.push({ schluessel: "gebaeudeanteil", label: "Gebäudeanteil (AfA)", grund: "sonst rechnet die AfA mit pauschal 80 %", href: `/afa-assistent?objekt=${p.id}`, erfuellt: (p.afa_gebaeudeanteil ?? 0) > 0 });
  }
  if (vermietet) {
    punkte.push({ schluessel: "mieter", label: "Mieter angelegt", grund: "Soll-Miete, Mietkonto und NK-Abrechnung", href: `/tenants/new?prop=${p.id}&back=/properties/${p.id}`, erfuellt: eigeneMieter.length > 0 });
    if (eigeneMieter.length > 0) {
      const ohne = eigeneMieter.filter((m) => !m.mietbeginn);
      punkte.push({
        schluessel: "mietbeginn", label: "Mietbeginn bei allen Mietern", grund: "ohne Mietbeginn erscheint die Miete nicht im Mietkonto",
        href: ohne.length === 1 ? `/tenants/${ohne[0].id}/edit` : "/tenants", erfuellt: ohne.length === 0,
      });
    }
    punkte.push({ schluessel: "vergleichsmiete", label: "Vergleichsmiete (€/m²)", grund: "Prüfung auf verbilligte Vermietung (§ 21 Abs. 2 EStG)", href: bearbeiten, erfuellt: (p.vergleichsmiete_m2 ?? 0) > 0 });
  }
  if (eigeneKredite.length > 0) {
    const ohne = eigeneKredite.filter((k) => !k.auszahlung_datum);
    punkte.push({
      schluessel: "auszahlung", label: "Auszahlungsdatum der Darlehen", grund: "Frist für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB)",
      href: ohne.length === 1 ? `/kredite/${ohne[0].id}/edit` : "/kredite", erfuellt: ohne.length === 0,
    });
  }

  const fehlend = punkte.filter((x) => !x.erfuellt);
  return { erfuellt: punkte.length - fehlend.length, gesamt: punkte.length, punkte, fehlend };
}
