// Start-Checkliste für neue Vermieter (21.10.2026, Entscheidung des Betreibers).
//
// Vorher öffnete sich die Einführungs-Tour automatisch ÜBER der Checkliste — zwei Führungen
// gleichzeitig, teils mit verschiedenen Angaben (Tour: „Ein- & Ausgaben buchen“, Mieten von Hand;
// richtig ist das Mietkonto, das die Miete aus dem Vertrag kennt). Jetzt führt nur noch die
// Checkliste; die Tour startet allein aus den Einstellungen.
//
// Pflicht sind Objekt und Mieter — erst damit rechnet die App. Kredit, Mietkonto und Absender sind
// freiwillig: Nicht jedes Objekt ist finanziert (Betreiber: „Darlehen muss nicht immer auf der
// Immobilie sein“), und wer noch keine Miete bekommen hat, hat nichts nachzuerfassen. Ein
// freiwilliger Schritt hält die Checkliste nie offen.
//
// Rein, ohne Datenbank — prüfbar (tests/startCheckliste.test.ts).

export type StartSchritt = {
  key: "objekt" | "mieter" | "kredit" | "mietkonto" | "absender";
  titel: string;
  text: string;
  href: string;
  cta: string;
  erledigt: boolean;
  freiwillig: boolean;
};

export type StartStand = {
  objekte: number;
  mieter: number;
  kredite: number;
  /** Mietbuchungen mit Mieter — entstehen beim Bestätigen im Mietkonto. */
  mietBuchungen: number;
  profil: { name?: string | null; strasse?: string | null; ort?: string | null } | null;
};

const gefuellt = (s: string | null | undefined) => !!s && s.trim().length > 0;

export function startSchritte(s: StartStand): StartSchritt[] {
  return [
    {
      key: "objekt",
      titel: "Erstes Objekt anlegen",
      text: "Name, Adresse, Kaufpreis, Miete — mehr braucht es für den Start nicht.",
      href: "/properties/new",
      cta: "Objekt anlegen",
      erledigt: s.objekte > 0,
      freiwillig: false,
    },
    {
      key: "mieter",
      titel: "Mieter erfassen",
      text: "Mit Kaltmiete und Mietbeginn — daraus entstehen Mietkonto und Abrechnungen.",
      href: "/tenants/new",
      cta: "Mieter anlegen",
      erledigt: s.mieter > 0,
      freiwillig: false,
    },
    {
      // Paket D (06.10.2026): Ohne Kredit fehlen Rate (Cashflow), Zinsbindung (Fristen) und Zinsanteil (Anlage V).
      key: "kredit",
      titel: "Kredit eintragen — falls finanziert",
      text: "Rate, Zins und Zinsbindung: daraus folgen der Cashflow nach Rate und die Erinnerung an das Ende der Zinsbindung. Ohne Finanzierung einfach überspringen.",
      href: "/kredite/new",
      cta: "Kredit eintragen",
      erledigt: s.kredite > 0,
      freiwillig: true,
    },
    {
      key: "mietkonto",
      titel: "Bisherige Mieten im Mietkonto bestätigen",
      text: "Das Mietkonto kennt aus dem Mietvertrag, welche Miete fällig war — du bestätigst nur, was eingegangen ist. Mieten nicht von Hand buchen.",
      href: "/mietkonto",
      cta: "Zum Mietkonto",
      erledigt: s.mietBuchungen > 0,
      freiwillig: true,
    },
    {
      key: "absender",
      titel: "Absender eintragen",
      text: "Name und Anschrift für den Briefkopf von Abrechnung, Erinnerung und Kündigung; die Bankverbindung steht unter „Bank“.",
      href: "/einstellungen?tab=profil",
      cta: "Zum Profil",
      erledigt: gefuellt(s.profil?.name) && gefuellt(s.profil?.strasse) && gefuellt(s.profil?.ort),
      freiwillig: true,
    },
  ];
}

/** Die Checkliste bleibt sichtbar, bis alle Pflichtschritte erledigt sind. */
export function startOffen(schritte: StartSchritt[]): boolean {
  return schritte.some((x) => !x.freiwillig && !x.erledigt);
}
