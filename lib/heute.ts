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

import { vorgangUrl } from "@/lib/anliegenListe";
import { mieteUeberfaellig, zahlungsBriefUrl } from "@/lib/mahnung";

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
  /**
   * Zweite, ausdrückliche Handlung neben der Zeile (05.10.2026): bei überfälliger Miete
   * „Erinnerung schreiben“ → vorausgefüllter Brief (lib/mahnung.ts). Nie in einem Bündel.
   */
  neben?: { label: string; href: string };
};

export type OffeneMiete = {
  mieterId: string;
  name: string;
  objekt: string;
  monat: string;
  /** Soll des Monats (warm). Ohne Betrag gibt es keinen Erinnerungs-Knopf. */
  betrag?: number;
};
export type OffenesAnliegen = { id: string; titel: string | null; mieter: string; erstellt: string };
export type OffeneMeldung = { id: string; art: string | null; mieter: string; datum: string };
export type FristZeile = { datum: string; label: string; sub: string; warn: boolean; href?: string };

/**
 * Wohin eine abgeleitete Frist führt (Verknüpfungs-Audit 06.10.2026, Paket D). Vorher verlinkte
 * jede Frist pauschal auf /termine — und dort hatten abgeleitete Fristen gar keinen Link: „NK-
 * Abrechnung zustellen“ endete zwei Klicks später ohne Weg zur Abrechnung. EINE Regel für
 * Dashboard und /termine.
 */
export function fristZiel(quelle: string, id: string | null | undefined, label: string): string {
  if (quelle === "mieter" && id) {
    const nk = /NK-Abrechnung (\d{4})/.exec(label)?.[1];
    return nk ? `/tenants/${id}/nk?jahr=${nk}` : `/tenants/${id}`;
  }
  if (quelle === "objekt" && id) return `/properties/${id}`;
  if (quelle === "kredit") return "/kredite";
  if (quelle === "steuer") return "/steuer";
  if (quelle === "vertreter") return "/einstellungen?tab=vertreter";
  return "/termine";
}
export type ObjektOhneKaufdatum = { id: string; name: string };
/** Vollmacht eines Vertreters, die bald abläuft oder abgelaufen ist (lib/vertreter.ts). */
export type VollmachtZeile = { id: string; name: string; gueltigBis: string; abgelaufen: boolean };

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
    /** Vollmachten mit Status „läuft bald ab“ oder „abgelaufen“ (Einstellungen → Vertreter). */
    vollmachten?: VollmachtZeile[];
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
      // Erst NACH der Fälligkeit (3. Werktag, § 556b BGB) — vorher wäre jede Erinnerung verfrüht.
      // Die Zeile selbst führt weiter ins Mietkonto (vielleicht ist das Geld ja da).
      neben:
        m.betrag && m.betrag > 0 && mieteUeberfaellig(m.monat, heuteISO)
          ? {
              label: "Erinnerung schreiben",
              href: zahlungsBriefUrl({ mieterId: m.mieterId, jahrMonat: m.monat, betrag: m.betrag, heuteISO, art: "zahlungserinnerung" }),
            }
          : undefined,
    });
  }

  for (const a of q.anliegen) {
    aufgaben.push({
      art: "anliegen",
      label: a.titel?.trim() || "Neues Anliegen",
      sub: [a.mieter, "Mieter-Anliegen"].filter(Boolean).join(" · "),
      href: vorgangUrl(a.id),
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
      href: f.href ?? "/termine",
      aktion: f.href && f.href !== "/termine" ? "Öffnen" : "Termin öffnen",
      dringend: ueberfaellig || f.warn,
      datum: f.datum,
    });
  }

  // Vollmacht des Vertreters (02.10.2026): Wer im Ausland lebt, merkt den Ablauf sonst erst,
  // wenn die Bank die Unterschrift des Vertreters zurückweist. Abgelaufen = dringend.
  for (const v of q.vollmachten ?? []) {
    const bis = v.gueltigBis.slice(0, 10).split("-").reverse().join(".");
    aufgaben.push({
      art: "frist",
      label: v.abgelaufen ? `Vollmacht abgelaufen: ${v.name}` : `Vollmacht läuft ab: ${v.name}`,
      sub: v.abgelaufen ? `seit ${bis} — Bank und Notar akzeptieren sie nicht mehr` : `gültig bis ${bis}`,
      href: "/einstellungen?tab=vertreter",
      aktion: "Vollmacht ansehen",
      dringend: v.abgelaufen,
      datum: v.gueltigBis.slice(0, 10),
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

export type GebuendelteAufgabe = Aufgabe & { anzahl: number };

// GLEICHE AUFGABEN BÜNDELN (03.10.2026, Betreiber: „viel Neues wirkt unübersichtlich“).
// Sechs Zeilen „NK-Abrechnung 2025 zustellen“ mit derselben Frist unterscheiden sich nur im
// Mieter — sie werden EINE Zeile („6 Einträge · Anna Weber, Fatma Yılmaz, …“), die auf die
// Terminliste führt, wo jeder einzeln steht. Zusammengefasst wird nur bei gleicher Art,
// gleichem Titel UND gleichem Datum; die Reihenfolge bleibt die der ersten Zeile.
export function buendleGleicheAufgaben(liste: Aufgabe[]): GebuendelteAufgabe[] {
  const gruppen = new Map<string, Aufgabe[]>();
  for (const a of liste) {
    const k = `${a.art}|${a.label}|${a.datum}`;
    const g = gruppen.get(k);
    if (g) g.push(a);
    else gruppen.set(k, [a]);
  }
  return [...gruppen.values()].map((g) => {
    if (g.length === 1) return { ...g[0], anzahl: 1 };
    const namen = g.map((a) => a.sub.split(" · ")[0]).filter(Boolean);
    const vorne = namen.slice(0, 2).join(", ");
    return {
      ...g[0],
      anzahl: g.length,
      sub: `${g.length} Einträge · ${vorne}${namen.length > 2 ? ", …" : ""}`,
      href: g[0].art === "frist" ? "/termine" : g[0].href,
      dringend: g.some((a) => a.dringend),
      // Ein Bündel hat keinen einzelnen Mieter — die Erinnerung gibt es im Mietkonto je Zeile.
      neben: undefined,
    };
  });
}
