// „Heute wichtig" — die eine Frage, die ein Vermieter beim Öffnen der App hat:
// Was muss ich JETZT tun?
//
// WARUM DIESE DATEI (08.09.2026, Feedback Befund 7)
// Das Dashboard zeigte die Antwort ganz unten, hinter Kennzahlen, zwei Charts,
// Karte, Krediten und Buchungen. Der Sofort-PR (#318) hat den Fristen-Block
// nach oben geholt — das war Verschieben. Hier kommt das Zusammenführen: Alle
// Quellen, die eine HANDLUNG verlangen, in einer Liste, jede Zeile mit genau
// einem Ziel.
//
// Reine Funktion ohne Datenbank und ohne React: Was hier gerechnet wird, lässt
// sich prüfen. Die Seite reicht nur die Zeilen herein.

export type AufgabenArt = "miete" | "anliegen" | "zaehler" | "frist" | "termin" | "stammdaten";

export type Aufgabe = {
  art: AufgabenArt;
  /** Kurz und in der Sprache des Nutzers — was ist zu tun. */
  label: string;
  /** Wer/wo — Mieter, Objekt, Kategorie. */
  sub: string;
  /** Ziel des Klicks. Genau EINE Handlung je Zeile. */
  href: string;
  /** Beschriftung des Knopfes. */
  aktion: string;
  /** Überfällig oder sonst dringend → rot statt gold. */
  dringend: boolean;
  /** Sortierschlüssel: ISO-Datum. Ohne Datum (z. B. offene Miete) das Fenster-Ende. */
  datum: string;
};

export type OffeneMiete = { mieterId: string; name: string; objekt: string; monat: string };
export type OffenesAnliegen = { id: string; titel: string | null; mieter: string; erstellt: string };
export type OffeneMeldung = { id: string; art: string | null; mieter: string; datum: string };
export type FristZeile = { datum: string; label: string; sub: string; warn: boolean };
export type ObjektOhneKaufdatum = { id: string; name: string };

const monatLabel = (ym: string) => {
  const [j, m] = ym.split("-");
  const namen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const i = Number(m) - 1;
  return namen[i] ? `${namen[i]} ${j}` : ym;
};

/**
 * Baut die Liste. Reihenfolge ist Absicht:
 *   1. Überfälliges zuerst (egal aus welcher Quelle).
 *   2. Danach nach Datum.
 * Bei Gleichstand entscheidet die Art — Geld vor Kommunikation vor Terminen.
 */
export function baueHeuteAufgaben(
  q: {
    offeneMieten: OffeneMiete[];
    anliegen: OffenesAnliegen[];
    meldungen: OffeneMeldung[];
    fristen: FristZeile[];
    /** Objekte ohne Kaufdatum — AfA und Spekulationsfrist rechnen sonst falsch. */
    ohneKaufdatum?: ObjektOhneKaufdatum[];
    /** Laufende Mieter ohne Mietbeginn — im Mietkonto unsichtbar (keine Soll-Miete). */
    mieterOhneBeginn?: ObjektOhneKaufdatum[];
    /** Mieter ohne Objekt — zählen in keiner Objekt-Miete. */
    mieterOhneObjekt?: ObjektOhneKaufdatum[];
    /** Kredite ohne Auszahlungsdatum — keine Frist fürs Sonderkündigungsrecht (§ 489 BGB). */
    krediteOhneAuszahlung?: ObjektOhneKaufdatum[];
  },
  heuteISO: string,
  grenze = 5,
): Aufgabe[] {
  const aufgaben: Aufgabe[] = [];

  // Offene Miete des laufenden Monats: die häufigste tägliche Handlung.
  for (const m of q.offeneMieten) {
    aufgaben.push({
      art: "miete",
      label: `Mieteingang ${monatLabel(m.monat)} offen`,
      sub: [m.name, m.objekt].filter(Boolean).join(" · "),
      href: `/mietkonto?monat=${m.monat}`,
      aktion: "Miete bestätigen",
      // Ab dem 5. des Monats ist eine offene Miete keine Formsache mehr.
      dringend: Number(heuteISO.slice(8, 10)) >= 5,
      datum: `${m.monat}-01`,
    });
  }

  for (const a of q.anliegen) {
    aufgaben.push({
      art: "anliegen",
      label: a.titel?.trim() || "Neues Anliegen",
      sub: [a.mieter, "Mieter-Anliegen"].filter(Boolean).join(" · "),
      href: "/anliegen",
      aktion: "Anliegen öffnen",
      // Älter als 7 Tage unbeantwortet: Der Mieter wartet zu lange.
      dringend: a.erstellt.slice(0, 10) < tageVor(heuteISO, 7),
      datum: a.erstellt.slice(0, 10),
    });
  }

  for (const z of q.meldungen) {
    aufgaben.push({
      art: "zaehler",
      label: `Zählerstand prüfen${z.art ? ` (${z.art})` : ""}`,
      sub: [z.mieter, "vom Mieter gemeldet"].filter(Boolean).join(" · "),
      href: "/verbrauch",
      aktion: "Stand übernehmen",
      dringend: z.datum.slice(0, 10) < tageVor(heuteISO, 14),
      datum: z.datum.slice(0, 10),
    });
  }

  for (const f of q.fristen) {
    const ueberfaellig = f.datum < heuteISO;
    aufgaben.push({
      art: "frist",
      label: f.label,
      sub: f.sub,
      href: "/termine",
      aktion: "Termin öffnen",
      dringend: ueberfaellig || f.warn,
      datum: f.datum,
    });
  }

  // Stammdaten-Lücken (30.09.2026, Prüfung der echten Konten): Jede Lücke
  // verfälscht eine Zahl, ohne dass die App es sagte. EINE Sammelzeile je
  // Lücke statt einer je Datensatz — sonst verdrängen zwanzig Stammdaten-
  // Zeilen die Miete. Nie dringend und ans Ende sortiert: Es eilt nicht, es
  // fällt nur auf.
  //   Kaufdatum      20 von 23 Objekten → AfA im Kaufjahr voll, § 23 EStG unbekannt
  //   Mietbeginn      3 Mieter          → im Mietkonto unsichtbar, nie „offen"
  //   Objekt          3 Mieter          → in keiner Objekt-Miete
  //   Auszahlung      6 von 8 Krediten  → keine Frist § 489 BGB (10 Jahre)
  const luecke = (
    liste: ObjektOhneKaufdatum[] | undefined,
    einzeln: (e: ObjektOhneKaufdatum) => { label: string; href: string },
    mehrere: (n: number) => { label: string; href: string },
    sub: string,
  ) => {
    if (!liste || liste.length === 0) return;
    const z = liste.length === 1 ? einzeln(liste[0]) : mehrere(liste.length);
    aufgaben.push({ art: "stammdaten", ...z, sub, aktion: "Ergänzen", dringend: false, datum: "9999-12-31" });
  };
  luecke(
    q.ohneKaufdatum,
    (e) => ({ label: `Kaufdatum fehlt: ${e.name}`, href: `/properties/${e.id}` }),
    (n) => ({ label: `Kaufdatum fehlt bei ${n} Objekten`, href: "/properties" }),
    "für die AfA im Kaufjahr und die Spekulationsfrist",
  );
  luecke(
    q.mieterOhneBeginn,
    (e) => ({ label: `Mietbeginn fehlt: ${e.name}`, href: `/tenants/${e.id}/edit` }),
    (n) => ({ label: `Mietbeginn fehlt bei ${n} Mietern`, href: "/tenants" }),
    "ohne Mietbeginn erscheint die Miete nicht im Mietkonto",
  );
  luecke(
    q.mieterOhneObjekt,
    (e) => ({ label: `Mieter ohne Objekt: ${e.name}`, href: `/tenants/${e.id}/edit` }),
    (n) => ({ label: `${n} Mieter ohne Objekt`, href: "/tenants" }),
    "die Miete zählt in keinem Objekt",
  );
  luecke(
    q.krediteOhneAuszahlung,
    (e) => ({ label: `Auszahlungsdatum fehlt: ${e.name}`, href: `/kredite/${e.id}/edit` }),
    (n) => ({ label: `Auszahlungsdatum fehlt bei ${n} Krediten`, href: "/kredite" }),
    "für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB)",
  );

  const rang: Record<AufgabenArt, number> = { miete: 0, anliegen: 1, zaehler: 2, frist: 3, termin: 4, stammdaten: 5 };
  aufgaben.sort((a, b) => {
    if (a.dringend !== b.dringend) return a.dringend ? -1 : 1;
    if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
    return rang[a.art] - rang[b.art];
  });
  return aufgaben.slice(0, grenze);
}

/** ISO-Datum minus n Tage — rein rechnerisch, ohne Zeitzone (vgl. naechsteFaelligkeit). */
export function tageVor(iso: string, tage: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - tage));
  return d.toISOString().slice(0, 10);
}
