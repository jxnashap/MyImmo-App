// Anlage V (Einkünfte aus Vermietung und Verpachtung) — reine Berechnung.
// Aggregiert die vorhandenen Buchungen (Einnahmen, Kosten, Kredite) je Objekt
// und Jahr und ordnet sie den Positionen der Anlage V zu. AfA wird aus dem
// Kaufpreis geschätzt (Gebäudeanteil × Satz) und ist im UI editierbar.
// Hinweis: Hilfestellung zur Steuererklärung, keine Steuerberatung.

import { restschuldVon } from "@/lib/kredit";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";
import { afaZeitanteil, linearImJahr, monatVon } from "@/lib/steuer/afaZeitraum";
import { afaSatzNachFertigstellung, degressivImJahr, degressivPruefung } from "@/lib/steuer/afa";
import { berechneAnschaffungsnah, ANSCHAFFUNGSNAH_KATEGORIEN } from "@/lib/steuer/anschaffungsnah";
import { istSelbstBewohnt } from "@/lib/steuer/selbstBewohnt";
import { kreditMonateImJahr } from "@/lib/kreditZeit";
import { anlageVZeilen, type AnlageVFeld } from "@/lib/steuer/anlageVZeilen";
import { ruecklageImJahr, HAUSGELD_KATEGORIE, RUECKLAGE_FEHLT_HINWEIS } from "@/lib/wegRuecklage";

export type AfaParams = {
  gebaeudeAnteil: number; // % des Kaufpreises, der auf das Gebäude entfällt
  satz: number | null; // AfA-Satz in % p.a. (null = automatisch je Baujahr)
};

export const AFA_DEFAULT: AfaParams = { gebaeudeAnteil: 80, satz: null };

/**
 * AfA-Satz nach Baujahr, § 7 Abs. 4 S. 1 Nr. 2 EStG — EINE Regel mit dem AfA-Assistenten
 * (Gesamtprüfung 07.10.2026, Doppelberechnung 9). Das Baujahr steht für das Fertigstellungsjahr.
 */
export const afaSatzAusBaujahr = afaSatzNachFertigstellung;

// Zeilennummern des Vordrucks stehen NICHT hier, sondern je Steuerjahr in lib/steuer/anlageVZeilen.ts (B1).
export type AnlageVEinnahmen = {
  miete: number; // Kaltmiete
  umlagen: number; // vereinnahmte Nebenkosten (laufend + aus NK-Abrechnungen)
  /** davon aus NK-Abrechnungen (Nachzahlung/Erstattung) — im Vordruck eine eigene Zeile. Teil von `umlagen`. */
  umlagenAbrechnung: number;
  sonstige: number; // sonstige Einnahmen
  summe: number;
};

export type AnlageVWerbungskosten = {
  afa: number; // Gebäude-AfA
  schuldzinsen: number;
  erhaltung: number; // Erhaltungsaufwand, voll abzuziehen
  verwaltung: number; // Verwaltungskosten (im Vordruck „nicht umgelegte Kosten“)
  grundsteuer: number; // Grundsteuer/öff. Lasten
  versicherung: number; // Versicherungen
  /** Umlagefähige Betriebskosten (Müll, Wasser, Heizung …) — im Vordruck „umgelegte Kosten“, soweit umgelegt (B1). */
  betriebskosten: number;
  hausgeldSonstige: number; // Hausgeld/WEG, CO₂-Vermieteranteil, Sonstiges, unbekannte Kategorien
  summe: number;
};

export type AnlageVObjekt = {
  propId: string | null;
  name: string;
  adresse: string | null;
  einnahmen: AnlageVEinnahmen;
  werbungskosten: AnlageVWerbungskosten;
  ueberschuss: number; // Einnahmen − Werbungskosten
  afaBasis: number; // Bemessungsgrundlage der AfA (Gebäudewert)
  afaSatz: number; // verwendeter AfA-Satz in % (für Anzeige)
  afaMethode: "auto" | "degressiv" | "manuell" | "keine";
  /**
   * true = die Schuldzinsen sind aus der AKTUELLEN Restschuld hochgerechnet und
   * gehören damit nicht in die Steuererklärung. Sie stehen nur als Größenordnung
   * in der Übersicht; für ELSTER zählt allein die Zinsbescheinigung der Bank.
   */
  schuldzinsenGeschaetzt: boolean;
  /**
   * true = im Jahr sind Instandsetzungskosten gebucht, und im 3-Jahres-Fenster nach dem Kauf ist die
   * 15-%-Grenze überschritten (§ 6 Abs. 1 Nr. 1a EStG): Sie sind dann Herstellungskosten (AfA), nicht
   * sofort abziehbare Erhaltung. Die App bucht nicht um — der Nutzer muss netto und „jährlich übliche“
   * Arbeiten beurteilen —, die Zeile und die Summen gelten aber als nicht übertragbar.
   */
  erhaltungAnschaffungsnah?: boolean;
  /**
   * true = degressive AfA gewählt, obwohl Baujahr oder Kaufjahr § 7 Abs. 5a EStG widersprechen (C20).
   * Die App rechnet weiter degressiv (sie bucht nicht um), AfA und Summen gelten aber als nicht übertragbar.
   */
  afaUnzulaessig?: boolean;
  /**
   * WEG-Erhaltungsrücklage des Jahres (lib/wegRuecklage.ts): Zuführung laut Abrechnung, davon aus dem
   * gebuchten Hausgeld herausgerechnet, Entnahme für Erhaltung (steckt in `erhaltung`). Fehlt bei Objekten ohne Eintrag.
   */
  ruecklage?: { zufuehrung: number; abgezogen: number; entnahme: number };
  /** Sachliche Hinweise zur Berechnung dieses Objekts (fehlende Angaben o. Ä.). */
  hinweise: string[];
};

export type AnlageVErgebnis = {
  jahr: number;
  objekte: AnlageVObjekt[];
  gesamt: AnlageVObjekt; // Summe über alle Objekte
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const jahrVon = (d: string | null | undefined) => (d ? Number(d.slice(0, 4)) : NaN);
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

// Kategorie → Anlage-V-Posten. Deckt alle Kategorien des Kosten-Formulars plus
// automatisch erzeugte Kategorien ab. Unbekannte/eigene Kategorien fallen
// bewusst in "Hausgeld / sonstige Kosten" — dort gehen sie steuerlich
// nicht verloren, tauchen aber nicht in einem spezifischeren Posten auf.
const KOSTEN_BUCKET: Record<string, keyof Omit<AnlageVWerbungskosten, "afa" | "summe">> = {
  Schuldzinsen: "schuldzinsen",
  Reparatur: "erhaltung",
  Instandhaltung: "erhaltung",
  Modernisierung: "erhaltung",
  Verwaltung: "verwaltung",
  Makler: "verwaltung",
  Grundsteuer: "grundsteuer",
  Versicherung: "versicherung",
  "Hausgeld / WEG": "hausgeldSonstige",
  Sonstiges: "hausgeldSonstige",
  "CO₂-Kosten (Vermieteranteil)": "hausgeldSonstige",
  // Umlagefähige Betriebskosten (lib/kategorien.ts, BETRIEBSKOSTEN_KATEGORIEN): beim Vermieter
  // Werbungskosten — im Vordruck „umgelegte Kosten“; die Umlage des Mieters steht als Einnahme bei den Umlagen.
  Müll: "betriebskosten",
  "Wasser / Abwasser": "betriebskosten",
  Allgemeinstrom: "betriebskosten",
  Heizung: "betriebskosten",
  Hausmeister: "betriebskosten",
  Gartenpflege: "betriebskosten",
  Straßenreinigung: "betriebskosten",
  Schornsteinfeger: "betriebskosten",
  Aufzug: "betriebskosten",
};

function leereWk(): AnlageVWerbungskosten {
  return { afa: 0, schuldzinsen: 0, erhaltung: 0, verwaltung: 0, grundsteuer: 0, versicherung: 0, betriebskosten: 0, hausgeldSonstige: 0, summe: 0 };
}
function leereEin(): AnlageVEinnahmen {
  return { miete: 0, umlagen: 0, umlagenAbrechnung: 0, sonstige: 0, summe: 0 };
}

/** Mietvertrag, soweit die Plausibilitätsprüfung der Umlagen ihn braucht. */
export type MieterNkVertrag = {
  prop_id: string | null;
  nk_vorauszahlung: number | string | null;
  mietbeginn: string | null;
  mietende: string | null;
};

/**
 * NK-Vorauszahlungen, die laut Verträgen im Jahr fällig waren — Monat für
 * Monat, ein Monat zählt, wenn der Vertrag an irgendeinem Tag darin lief.
 * Datumsvergleich auf ISO-Text (Monatsgrenzen exklusiv über den Folgemonat).
 */
export function nkSollImJahr(mieter: MieterNkVertrag[], propId: string, jahr: number): number {
  let summe = 0;
  for (const m of mieter) {
    if (m.prop_id !== propId) continue;
    const nk = Number(m.nk_vorauszahlung);
    if (!Number.isFinite(nk) || nk <= 0) continue;
    const beginn = (m.mietbeginn ?? "").slice(0, 10);
    const ende = (m.mietende ?? "").slice(0, 10);
    for (let monat = 1; monat <= 12; monat++) {
      const start = `${jahr}-${String(monat).padStart(2, "0")}-01`;
      const folge = monat === 12 ? `${jahr + 1}-01-01` : `${jahr}-${String(monat + 1).padStart(2, "0")}-01`;
      if (beginn && beginn >= folge) continue; // noch nicht eingezogen
      if (ende && ende < start) continue; // schon ausgezogen
      summe += nk;
    }
  }
  return r2(summe);
}

/**
 * Anschaffungsmonat für die AfA im Startjahr — nur, wenn das Kaufdatum IN diesem Jahr liegt
 * (Gesamtprüfung 07.10.2026, B2). Vorher galt der Kaufmonat auch für ein abweichendes AfA-Startjahr:
 * Kauf 15.11.2024 + Startjahr 2025 ergab 2/12 statt des vollen Jahres, ohne Hinweis.
 */
function startMonat(p: Property, startJahr: number, g: { hinweise: string[] }): number | null {
  const kj = jahrVon(p.kaufdatum);
  if (!Number.isFinite(kj)) return null;
  if (kj === startJahr) return monatVon(p.kaufdatum);
  const satz = `Das AfA-Startjahr ${startJahr} weicht vom Kaufjahr ${kj} ab — gerechnet wird ab Januar ${startJahr}. Bitte prüfen, ob das Startjahr stimmt (Anschaffung = Übergang von Besitz, Nutzen und Lasten).`;
  if (!g.hinweise.includes(satz)) g.hinweise.push(satz);
  return null;
}

export function berechneAnlageV(
  jahr: number,
  alleProperties: Property[],
  einnahmen: Einnahme[],
  kosten: Kosten[],
  kredite: Kredit[],
  afa: AfaParams,
  /** Optional: Mietverträge für die Plausibilitätsprüfung der Umlagen. */
  mieter: MieterNkVertrag[] = [],
): AnlageVErgebnis {
  // Eine Gruppe je Objekt, plus optional „ohne Objekt".
  const gruppen = new Map<string | null, AnlageVObjekt>();
  const hole = (propId: string | null): AnlageVObjekt => {
    if (!gruppen.has(propId)) {
      const p = properties.find((x) => x.id === propId);
      gruppen.set(propId, {
        propId,
        name: p?.bezeichnung ?? "Ohne Objektzuordnung",
        adresse: p?.adresse ?? null,
        einnahmen: leereEin(),
        werbungskosten: leereWk(),
        ueberschuss: 0,
        afaBasis: 0,
        afaMethode: "auto",
        afaSatz: 0,
        schuldzinsenGeschaetzt: false,
        hinweise: [],
      });
    }
    return gruppen.get(propId)!;
  };

  // Selbst bewohnte Objekte gehören nicht in die Anlage V (keine Einkünfte nach § 21 EStG) — weder
  // AfA noch Kosten noch Einnahmen (Gesamtprüfung 07.10.2026, A2).
  const selbst = new Set(alleProperties.filter((p) => istSelbstBewohnt(p.obj_status)).map((p) => p.id));
  const properties = alleProperties.filter((p) => !selbst.has(p.id));

  // Objekte mit Stammdaten immer anlegen (auch ohne Buchungen → für AfA).
  for (const p of properties) hole(p.id);

  // Einnahmen
  for (const e of einnahmen) {
    if (jahrVon(e.buchungsdatum) !== jahr) continue;
    if (e.prop_id && selbst.has(e.prop_id)) continue;
    const betrag = Number(e.betrag) || 0;
    const g = hole(e.prop_id);
    if (e.kategorie === "Miete") {
      const nk = Number(e.nk_anteil) || 0;
      g.einnahmen.miete += betrag - nk;
      g.einnahmen.umlagen += nk;
    } else if (e.kategorie === "Nebenkostenabrechnung") {
      g.einnahmen.umlagen += betrag;
      g.einnahmen.umlagenAbrechnung += betrag;
    }
    else if (e.kategorie === "Kaution") continue; // durchlaufend, nicht steuerbar
    else g.einnahmen.sonstige += betrag;
  }

  // Laufende Kosten
  const hausgeldGebucht = new Map<string | null, number>();
  for (const k of kosten) {
    if (jahrVon(k.buchungsdatum) !== jahr) continue;
    if (k.prop_id && selbst.has(k.prop_id)) continue;
    const betrag = Number(k.betrag) || 0;
    const g = hole(k.prop_id);
    const bucket = (k.kategorie && KOSTEN_BUCKET[k.kategorie]) || "hausgeldSonstige";
    g.werbungskosten[bucket] += betrag;
    if (k.kategorie === HAUSGELD_KATEGORIE) hausgeldGebucht.set(k.prop_id, (hausgeldGebucht.get(k.prop_id) ?? 0) + betrag);
  }

  // WEG-Erhaltungsrücklage (BFH IX R 19/24, lib/wegRuecklage.ts): Die Zuführung steckt im gebuchten
  // Hausgeld und ist keine Werbungskosten → heraus; die Entnahme für Erhaltung ist es → zur Erhaltung.
  // Die Buchungen bleiben, wie sie sind (das Geld ist abgeflossen) — nur die Anlage V rechnet so.
  for (const p of properties) {
    const g = hole(p.id);
    const gebucht = hausgeldGebucht.get(p.id) ?? 0;
    const r = ruecklageImJahr(p.weg_ruecklage, jahr);
    if (!r) {
      if (gebucht > 0 && !g.hinweise.includes(RUECKLAGE_FEHLT_HINWEIS)) g.hinweise.push(RUECKLAGE_FEHLT_HINWEIS);
      continue;
    }
    const abgezogen = Math.min(r.zufuehrung, gebucht);
    g.werbungskosten.hausgeldSonstige -= abgezogen;
    g.werbungskosten.erhaltung += r.entnahme;
    g.ruecklage = { zufuehrung: r.zufuehrung, abgezogen: r2(abgezogen), entnahme: r.entnahme };
    if (r.zufuehrung > gebucht + 0.005) {
      const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      g.hinweise.push(
        `Laut WEG-Abrechnung ${jahr} flossen ${fmt(r.zufuehrung)} € in die Erhaltungsrücklage, gebucht ist aber nur ${fmt(gebucht)} € Hausgeld. Herausgerechnet wird höchstens das gebuchte Hausgeld — fehlen Hausgeld-Buchungen?`,
      );
    }
  }

  // AfA + Schuldzinsen je Objekt
  for (const p of properties) {
    const g = hole(p.id);

    // Umlagen plausibel? (30.09.2026, Prüfung der echten Konten: 332 Miet-
    // buchungen in 2 Konten waren reine Kaltmiete ohne NK-Anteil, obwohl die
    // Mieter laut Vertrag NK vorauszahlen — und umlagefähige Kosten standen als
    // Werbungskosten drin. Dann fehlen die Umlagen als Einnahme, und
    // der Überschuss ist zu niedrig.) Nur ein Hinweis: Ob die NK tatsächlich
    // an den Vermieter gehen, weiß nur der Nutzer.
    const nkSoll = nkSollImJahr(mieter, p.id, jahr);
    if (nkSoll > 0 && g.einnahmen.umlagen < nkSoll * 0.5) {
      const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
      g.hinweise.push(
        `Laut Mietverträgen waren ${jahr} rund ${fmt(nkSoll)} € Nebenkosten-Vorauszahlungen fällig, als Umlagen gebucht sind ${fmt(g.einnahmen.umlagen)} €. Sind die Mieten nur kalt gebucht? Dann fehlen die Umlagen als Einnahme, während umlagefähige Kosten als Werbungskosten abgezogen werden — der Überschuss wäre zu niedrig. Beim Buchen der Miete den NK-Anteil angeben (das Mietkonto tut das automatisch).`,
      );
    }
    const kaufpreis = Number(p.kaufpreis) || 0;
    // Gebäudeanteil: Objekt-Override → globaler Regler
    const gebAnteil = p.afa_gebaeudeanteil ?? afa.gebaeudeAnteil;
    g.afaBasis = r2((kaufpreis * gebAnteil) / 100);
    const methode = (p.afa_methode as "auto" | "degressiv" | "manuell" | "keine") ?? "auto";
    g.afaMethode = methode;
    if (methode === "keine") {
      // Grundstücke sind nicht abschreibbar (§ 7 EStG) — keine AfA.
      g.werbungskosten.afa = 0;
      g.afaSatz = 0;
    } else if (methode === "manuell" && p.afa_betrag != null) {
      // Fester Jahresbetrag (deckt § 7b Sonder-AfA / Denkmal § 7i/§ 7h ab)
      g.werbungskosten.afa = r2(Number(p.afa_betrag));
      g.afaSatz = g.afaBasis > 0 ? r2((g.werbungskosten.afa / g.afaBasis) * 100) : 0;
    } else if (methode === "degressiv") {
      // § 7 Abs. 5a EStG: 5 % geometrisch-degressiv vom Restbuchwert.
      // Vereinfachung: kein Wechsel zu linear, keine Monats-Zeitanteiligkeit im 1. Jahr.
      //
      // Das Startjahr ist das Jahr der Anschaffung/Herstellung — NICHT das
      // Baujahr. Früher fiel die Rechnung ersatzweise aufs Baujahr zurück: Bei
      // einem Objekt von 1998 ergab das einen Exponenten von 28 und damit rund
      // ein Viertel des richtigen Betrags, kommentarlos. Ohne gepflegtes
      // Startjahr wird deshalb nicht mehr geraten.
      const start = p.afa_start_jahr ?? null;
      if (start == null) {
        g.werbungskosten.afa = 0;
        g.afaSatz = 0;
        g.hinweise.push(
          "Degressive AfA gewählt, aber kein AfA-Startjahr (Jahr der Anschaffung) hinterlegt — ohne dieses Jahr lässt sich der Restbuchwert nicht bestimmen. Bitte im Objekt ergänzen.",
        );
      } else {
        // Zeitanteil: keine AfA vor der Anschaffung, im 1. Jahr monatsgenau — danach 5 % vom
        // TATSÄCHLICHEN Restwert (degressivImJahr, A3).
        const monat = startMonat(p, start, g);
        const z = afaZeitanteil(jahr, start, monat, null);
        if (z.hinweis) g.hinweise.push(z.hinweis);
        const erstes = afaZeitanteil(start, start, monat, null).faktor;
        g.werbungskosten.afa = degressivImJahr(g.afaBasis, start, jahr, erstes);
        g.afaSatz = 5;
      }
      // Darf überhaupt degressiv abgeschrieben werden? (§ 7 Abs. 5a EStG, C20)
      const pruef = degressivPruefung(p);
      if (pruef.zulaessig === false) g.afaUnzulaessig = true;
      if (!g.hinweise.includes(pruef.text)) g.hinweise.push(pruef.text);
    } else {
      const satz = afa.satz ?? afaSatzAusBaujahr(p.baujahr); // global-Override nur bei "auto"
      g.afaSatz = satz;
      // Lineare AfA lief bisher ohne jede zeitliche Grenze: auch für Jahre VOR
      // der Anschaffung, ohne Monatsanteil im Kaufjahr und ohne Ende nach der
      // Nutzungsdauer (bei 2 % also über 50 Jahre hinaus).
      const startLinear = p.afa_start_jahr ?? (Number.isFinite(jahrVon(p.kaufdatum)) ? jahrVon(p.kaufdatum) : null);
      // Bis zur vollen Absetzung, nicht nach gerundeten 100/Satz Jahren (C18).
      const z = linearImJahr(g.afaBasis, satz, jahr, startLinear, startLinear == null ? null : startMonat(p, startLinear, g));
      if (z.hinweis) g.hinweise.push(z.hinweis);
      g.werbungskosten.afa = z.betrag;
      if (startLinear == null && g.afaBasis > 0) {
        g.hinweise.push(
          "Kein Anschaffungsdatum hinterlegt — die AfA wird für jedes Jahr voll gerechnet. Bitte Kaufdatum im Objekt ergänzen, damit das Anschaffungsjahr zeitanteilig läuft (§ 7 Abs. 1 S. 4 EStG).",
        );
      }
    }
    // Schuldzinsen: Gebucht schlägt geschätzt.
    //
    // Die Hochrechnung „aktuelle Restschuld × Zinssatz" beschreibt HEUTE, nicht
    // das Steuerjahr — für 2024 würde die Restschuld von 2026 verzinst. Als
    // Größenordnung in der Übersicht ist das brauchbar, als Wert zum Abtippen
    // in ELSTER nicht. Deshalb: Sind für das Jahr Kosten der Kategorie
    // „Schuldzinsen" gebucht, gelten die — sonst wird geschätzt und die Zeile
    // in der ELSTER-Hilfe als nicht übertragbar gekennzeichnet.
    const gebuchteZinsen = g.werbungskosten.schuldzinsen; // aus der Kosten-Schleife
    // Nur für die Monate, in denen das Darlehen im Jahr lief (ab Auszahlung, ersatzweise Kauf; bis
    // Laufzeitende) — Gesamtprüfung 07.10.2026, B3. Vorher stand jedes Jahr vor dem Kauf voll drin.
    const propKredite = kredite.filter((kr) => kr.prop_id === p.id);
    let ohneStart = false;
    const geschaetzteZinsen = r2(
      sum(propKredite.map((kr) => {
        const zr = kreditMonateImJahr(kr, jahr, p.kaufdatum);
        if (zr.ohneStart) ohneStart = true;
        return ((restschuldVon(kr) * (Number(kr.zinssatz) || 0)) / 100) * (zr.monate / 12);
      })),
    );
    if (ohneStart && geschaetzteZinsen > 0 && g.werbungskosten.schuldzinsen === 0) {
      g.hinweise.push("Für ein Darlehen ist weder Auszahlungs- noch Kaufdatum hinterlegt — die Zinsschätzung nimmt das ganze Jahr an.");
    }
    if (gebuchteZinsen > 0) {
      g.schuldzinsenGeschaetzt = false;
      // Eine einzige gebuchte Zinszahlung verdraengt die Hochrechnung komplett.
      // Wer nur einen von zwoelf Monaten gebucht hat, sieht dann einen viel zu
      // niedrigen Wert — ohne jeden Hinweis. Deshalb: liegt der gebuchte Betrag
      // deutlich (< 60 %) unter der Groessenordnung aus der Restschuld, wird das
      // ausdruecklich angesprochen.
      if (geschaetzteZinsen > 0 && gebuchteZinsen < geschaetzteZinsen * 0.6) {
        g.hinweise.push(
          `Für ${jahr} sind nur ${gebuchteZinsen.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € Schuldzinsen gebucht; aus der Restschuld ergäbe sich rund ${geschaetzteZinsen.toLocaleString("de-DE", { maximumFractionDigits: 0 })} € im Jahr. Sind wirklich alle Zinszahlungen des Jahres erfasst? Maßgeblich ist die Zinsbescheinigung der Bank.`,
        );
      }
    } else if (geschaetzteZinsen > 0) {
      g.werbungskosten.schuldzinsen = geschaetzteZinsen;
      g.schuldzinsenGeschaetzt = true;
      g.hinweise.push(
        "Die Schuldzinsen sind aus der heutigen Restschuld hochgerechnet und gelten nicht für das Steuerjahr. Für die Steuererklärung den Betrag aus der Zinsbescheinigung der Bank verwenden — oder die gezahlten Zinsen als Ausgabe der Kategorie Schuldzinsen buchen.",
      );
    }
  }

  // 15-%-Grenze (§ 6 Abs. 1 Nr. 1a EStG) — Gesamtprüfung 07.10.2026, A1. Vorher meldete der
  // Steuer-Wächter „überschritten“, die Anlage V führte dieselben Kosten aber als sofort abziehbare
  // Erhaltung (im Beispiel 19.600 € zu hohe Werbungskosten). Gleiche Rechnung wie der Wächter.
  for (const p of properties) {
    if ((p.typ ?? "") === "Grundstück" || !p.kaufdatum) continue;
    const g = hole(p.id);
    const eigene = kosten.filter((k) => k.prop_id === p.id);
    const an = berechneAnschaffungsnah(
      { kaufpreis: Number(p.kaufpreis) || null, gebaeudeanteilProzent: p.afa_gebaeudeanteil ?? null, kaufdatum: p.kaufdatum },
      eigene.map((k) => ({ buchungsdatum: k.buchungsdatum, kategorie: k.kategorie, betrag: Number(k.betrag) || 0 })),
    );
    if (an.status !== "ueberschritten" || !an.fensterVon || !an.fensterBis) continue;
    const imJahrImFenster = eigene.filter((k) =>
      jahrVon(k.buchungsdatum) === jahr && ANSCHAFFUNGSNAH_KATEGORIEN.includes(k.kategorie ?? "") &&
      (k.buchungsdatum ?? "") >= an.fensterVon! && (k.buchungsdatum ?? "") <= an.fensterBis!);
    if (imJahrImFenster.length === 0) continue;
    const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
    g.erhaltungAnschaffungsnah = true;
    g.hinweise.push(
      `Instandsetzungskosten in den ersten drei Jahren nach dem Kauf liegen bei ${fmt(an.kostenImFenster)} € und damit über 15 % der Gebäude-Anschaffungskosten (${fmt(an.grenze)} €). Sie zählen dann zu den Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) und sind nur über die AfA absetzbar, nicht sofort als Erhaltung. Die Grenze gilt netto; jährlich übliche Erhaltungsarbeiten zählen nicht mit — bitte mit dem Steuerberater klären, bevor du die Erhaltung überträgst.`,
    );
  }

  // Summen je Objekt + Rundung
  const objekte = [...gruppen.values()].map((g) => {
    const e = g.einnahmen;
    e.miete = r2(e.miete); e.umlagen = r2(e.umlagen); e.umlagenAbrechnung = r2(e.umlagenAbrechnung); e.sonstige = r2(e.sonstige);
    e.summe = r2(e.miete + e.umlagen + e.sonstige);
    const w = g.werbungskosten;
    w.erhaltung = r2(w.erhaltung); w.verwaltung = r2(w.verwaltung); w.grundsteuer = r2(w.grundsteuer);
    w.versicherung = r2(w.versicherung); w.betriebskosten = r2(w.betriebskosten); w.hausgeldSonstige = r2(w.hausgeldSonstige);
    w.summe = r2(w.afa + w.schuldzinsen + w.erhaltung + w.verwaltung + w.grundsteuer + w.versicherung + w.betriebskosten + w.hausgeldSonstige);
    g.ueberschuss = r2(e.summe - w.summe);
    return g;
  });

  // Leere Objekte ohne jede Bewegung ausblenden (keine Einnahmen, keine WK).
  // Ein Rücklagen-Eintrag zählt als Bewegung — sonst verschwände mit dem Objekt auch sein Hinweis.
  const sichtbar = objekte.filter((g) => g.einnahmen.summe !== 0 || g.werbungskosten.summe !== 0 || g.ruecklage);

  // Gesamtsumme
  const gesamt: AnlageVObjekt = {
    propId: null,
    name: "Gesamt (alle Objekte)",
    adresse: null,
    einnahmen: {
      miete: r2(sum(sichtbar.map((g) => g.einnahmen.miete))),
      umlagen: r2(sum(sichtbar.map((g) => g.einnahmen.umlagen))),
      umlagenAbrechnung: r2(sum(sichtbar.map((g) => g.einnahmen.umlagenAbrechnung))),
      sonstige: r2(sum(sichtbar.map((g) => g.einnahmen.sonstige))),
      summe: r2(sum(sichtbar.map((g) => g.einnahmen.summe))),
    },
    werbungskosten: {
      afa: r2(sum(sichtbar.map((g) => g.werbungskosten.afa))),
      schuldzinsen: r2(sum(sichtbar.map((g) => g.werbungskosten.schuldzinsen))),
      erhaltung: r2(sum(sichtbar.map((g) => g.werbungskosten.erhaltung))),
      verwaltung: r2(sum(sichtbar.map((g) => g.werbungskosten.verwaltung))),
      grundsteuer: r2(sum(sichtbar.map((g) => g.werbungskosten.grundsteuer))),
      versicherung: r2(sum(sichtbar.map((g) => g.werbungskosten.versicherung))),
      betriebskosten: r2(sum(sichtbar.map((g) => g.werbungskosten.betriebskosten))),
      hausgeldSonstige: r2(sum(sichtbar.map((g) => g.werbungskosten.hausgeldSonstige))),
      summe: r2(sum(sichtbar.map((g) => g.werbungskosten.summe))),
    },
    ueberschuss: r2(sum(sichtbar.map((g) => g.ueberschuss))),
    afaBasis: r2(sum(sichtbar.map((g) => g.afaBasis))),
    afaSatz: 0,
    afaMethode: "auto",
    schuldzinsenGeschaetzt: sichtbar.some((g) => g.schuldzinsenGeschaetzt),
    erhaltungAnschaffungsnah: sichtbar.some((g) => g.erhaltungAnschaffungsnah),
    afaUnzulaessig: sichtbar.some((g) => g.afaUnzulaessig),
    ...(sichtbar.some((g) => g.ruecklage)
      ? {
          ruecklage: {
            zufuehrung: r2(sum(sichtbar.map((g) => g.ruecklage?.zufuehrung ?? 0))),
            abgezogen: r2(sum(sichtbar.map((g) => g.ruecklage?.abgezogen ?? 0))),
            entnahme: r2(sum(sichtbar.map((g) => g.ruecklage?.entnahme ?? 0))),
          },
        }
      : {}),
    hinweise: [
      ...new Set(sichtbar.flatMap((g) => g.hinweise)),
      ...(selbst.size > 0
        ? [`Selbst bewohnt und deshalb nicht in der Anlage V: ${alleProperties.filter((p) => selbst.has(p.id)).map((p) => p.bezeichnung).join(", ")}.`]
        : []),
    ],
  };

  return { jahr, objekte: sichtbar, gesamt };
}

// Anlage-V-Positionen als flache Liste (für Anzeige, CSV und PDF). Ohne Zeilennummern — die hängen am
// Steuerjahr (lib/steuer/anlageVZeilen.ts, B1); `positionMitZeile()` setzt sie dazu, wo sie geprüft sind.
export const ANLAGE_V_POSITIONEN: { key: string; label: string; bereich: "einnahme" | "wk"; feld: AnlageVFeld | AnlageVFeld[] }[] = [
  { key: "miete", label: "Mieteinnahmen (Kaltmiete)", bereich: "einnahme", feld: "miete" },
  { key: "umlagen", label: "Umlagen / Nebenkosten", bereich: "einnahme", feld: ["umlagenLaufend", "umlagenAbrechnung"] },
  { key: "sonstige", label: "Sonstige Einnahmen", bereich: "einnahme", feld: "sonstigeEinnahmen" },
  { key: "afa", label: "AfA Gebäude", bereich: "wk", feld: "afa" },
  { key: "schuldzinsen", label: "Schuldzinsen", bereich: "wk", feld: "schuldzinsen" },
  { key: "erhaltung", label: "Erhaltungsaufwand", bereich: "wk", feld: "erhaltung" },
  { key: "verwaltung", label: "Verwaltungskosten", bereich: "wk", feld: "nichtUmgelegt" },
  { key: "grundsteuer", label: "Grundsteuer / öffentl. Lasten", bereich: "wk", feld: ["umgelegt", "nichtUmgelegt"] },
  { key: "versicherung", label: "Versicherungen", bereich: "wk", feld: ["umgelegt", "nichtUmgelegt"] },
  { key: "betriebskosten", label: "Umlagefähige Betriebskosten", bereich: "wk", feld: ["umgelegt", "nichtUmgelegt"] },
  { key: "hausgeldSonstige", label: "Hausgeld / sonstige Kosten", bereich: "wk", feld: ["nichtUmgelegt", "sonstigeKosten"] },
];

/** Zeilenangabe eines Postens im Vordruck des Jahres („Z. 46–48“, „Z. 73–75 / 76–78“) — null ohne geprüften Vordruck. */
export function zeilenAngabe(jahr: number, feld: AnlageVFeld | AnlageVFeld[]): string | null {
  const t = anlageVZeilen(jahr);
  if (!t) return null;
  return `Z. ${(Array.isArray(feld) ? feld : [feld]).map((f) => t.felder[f].zeile).join(" / ")}`;
}

/** Bezeichnung eines Postens mit Zeilenangabe des Jahres, falls geprüft. */
export function positionMitZeile(p: { label: string; feld: AnlageVFeld | AnlageVFeld[] }, jahr: number): string {
  const z = zeilenAngabe(jahr, p.feld);
  return z ? `${p.label} — ${z}` : p.label;
}

export function wertVon(o: AnlageVObjekt, key: string): number {
  if (key in o.einnahmen) return (o.einnahmen as unknown as Record<string, number>)[key];
  if (key in o.werbungskosten) return (o.werbungskosten as unknown as Record<string, number>)[key];
  return 0;
}

// ---- ELSTER-Ausfüllhilfe (Übertragung nach "Mein ELSTER") ----
// Ordnet die berechneten Werte den Zeilen der amtlichen Anlage V des STEUERJAHRES zu
// (lib/steuer/anlageVZeilen.ts). Ohne geprüften Vordruck steht keine Zeile da („–“).
// Wichtig: In ELSTER ist JE Objekt eine eigene Anlage V auszufüllen.
export type ElsterZeile = {
  zeile: string;
  bezeichnung: string;
  betrag: number;
  bereich: "einnahme" | "wk" | "summe";
  /**
   * false = diesen Wert NICHT nach ELSTER übertragen. Betrifft geschätzte
   * Größen, die nur der Orientierung dienen (derzeit die hochgerechneten
   * Schuldzinsen). `warnung` sagt, woher der richtige Wert kommt.
   */
  uebertragbar?: boolean;
  warnung?: string;
  /** Sachlicher Hinweis, wohin der Betrag gehört, wenn der Vordruck mehrere Zeilen kennt. */
  hinweis?: string;
};

const SUMMEN_WARNUNG =
  "Enthält die geschätzten Schuldzinsen — nicht übertragen. Erst den Betrag aus der Zinsbescheinigung eintragen, ELSTER bildet die Summe dann selbst.";
const ERHALTUNG_WARNUNG =
  "15-%-Grenze nach dem Kauf überschritten — diese Kosten sind voraussichtlich Herstellungskosten (AfA), nicht sofort abziehbar. Erst mit dem Steuerberater klären.";

/**
 * Sind Summe der Werbungskosten und Ergebnis zum Übertragen geeignet? EINE Regel für ELSTER-Hilfe
 * und PDF (Gesamtprüfung 07.10.2026, B4: das PDF wies Summe und Verlust ohne Kennzeichnung aus).
 */
export function summenWarnung(o: AnlageVObjekt): string | undefined {
  if (o.schuldzinsenGeschaetzt) return SUMMEN_WARNUNG;
  if (o.erhaltungAnschaffungsnah) return "Enthält Erhaltungsaufwand, der wegen der 15-%-Grenze voraussichtlich nicht sofort abziehbar ist — nicht übertragen, erst klären.";
  if (o.afaUnzulaessig) return "Enthält eine degressive AfA, die nach Baujahr oder Kaufjahr nicht zulässig ist (§ 7 Abs. 5a EStG) — nicht übertragen, erst klären.";
  return undefined;
}

const euroText = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const AFA_WARNUNG =
  "Degressive AfA, obwohl Baujahr oder Kaufjahr § 7 Abs. 5a EStG widersprechen — nicht übertragen, erst klären.";

export function elsterZeilen(o: AnlageVObjekt, jahr: number): ElsterZeile[] {
  const e = o.einnahmen;
  const w = o.werbungskosten;
  const z = (f: AnlageVFeld | AnlageVFeld[]) => zeilenAngabe(jahr, f)?.replace(/^Z\. /, "") ?? "–";
  const umlageHinweis = "Auf die Mieter umgelegt → „Umgelegte Kosten“, sonst „Nicht umgelegte Kosten“.";
  const zeilen: ElsterZeile[] = [
    { zeile: z("miete"), bezeichnung: "Mieteinnahmen für Wohnungen (ohne Umlagen)", betrag: e.miete, bereich: "einnahme" },
    { zeile: z("umlagenLaufend"), bezeichnung: "Umlagen, laufend vereinnahmt (Nebenkosten-Vorauszahlungen)", betrag: r2(e.umlagen - e.umlagenAbrechnung), bereich: "einnahme" },
    { zeile: z("umlagenAbrechnung"), bezeichnung: "Umlagen: Nachzahlungen / Erstattungen aus der Nebenkostenabrechnung", betrag: e.umlagenAbrechnung, bereich: "einnahme" },
    {
      zeile: z("sonstigeEinnahmen"), bezeichnung: "Sonstige Einnahmen", betrag: e.sonstige, bereich: "einnahme",
      hinweis: "Zeile je nach Art: frühere Jahre/Kautionen, Garage/Werbefläche, Zuschüsse.",
    },
    { zeile: z("summeEinnahmen"), bezeichnung: "Summe der Einnahmen", betrag: e.summe, bereich: "summe" },
    {
      zeile: z("afa"), bezeichnung: "AfA für Gebäude", betrag: w.afa, bereich: "wk",
      uebertragbar: !o.afaUnzulaessig,
      warnung: o.afaUnzulaessig ? AFA_WARNUNG : undefined,
    },
    {
      zeile: z("schuldzinsen"),
      bezeichnung: "Schuldzinsen (ohne Tilgung)",
      betrag: w.schuldzinsen,
      bereich: "wk",
      uebertragbar: !o.schuldzinsenGeschaetzt,
      warnung: o.schuldzinsenGeschaetzt
        ? "Nur Schätzung aus der heutigen Restschuld — nicht übertragen. Betrag der Zinsbescheinigung der Bank eintragen."
        : undefined,
    },
    {
      zeile: z("erhaltung"), bezeichnung: "Erhaltungsaufwendungen, voll abzuziehen", betrag: w.erhaltung, bereich: "wk",
      uebertragbar: !o.erhaltungAnschaffungsnah,
      warnung: o.erhaltungAnschaffungsnah ? ERHALTUNG_WARNUNG : undefined,
      hinweis: o.ruecklage && o.ruecklage.entnahme > 0
        ? `Enthält ${euroText(o.ruecklage.entnahme)} Entnahmen aus der Erhaltungsrücklage laut WEG-Abrechnung.`
        : undefined,
    },
    { zeile: z(["umgelegt", "nichtUmgelegt"]), bezeichnung: "Grundsteuer / öffentliche Lasten", betrag: w.grundsteuer, bereich: "wk", hinweis: umlageHinweis },
    { zeile: z(["umgelegt", "nichtUmgelegt"]), bezeichnung: "Versicherungen", betrag: w.versicherung, bereich: "wk", hinweis: umlageHinweis },
    { zeile: z(["umgelegt", "nichtUmgelegt"]), bezeichnung: "Umlagefähige Betriebskosten (Müll, Wasser, Heizung …)", betrag: w.betriebskosten, bereich: "wk", hinweis: umlageHinweis },
    { zeile: z("nichtUmgelegt"), bezeichnung: "Verwaltungskosten", betrag: w.verwaltung, bereich: "wk" },
    {
      zeile: z(["nichtUmgelegt", "sonstigeKosten"]), bezeichnung: "Hausgeld / WEG und sonstige Kosten", betrag: w.hausgeldSonstige, bereich: "wk",
      // Wortlaut des Vordrucks: „Nicht umgelegte Kosten (… – ohne Erhaltungsrücklage –)“ und Erhaltungsaufwendungen
      // „einschließlich Entnahmen aus der Erhaltungsrücklage“.
      hinweis: o.ruecklage
        ? `Hausgeld aufteilen: Umgelegtes zu „Umgelegte Kosten“, Verwaltergebühr zu „Nicht umgelegte Kosten“. Die Zuführung zur Erhaltungsrücklage (${euroText(o.ruecklage.abgezogen)}) ist schon herausgerechnet.`
        : "Hausgeld aufteilen: Umgelegtes zu „Umgelegte Kosten“, Verwaltergebühr zu „Nicht umgelegte Kosten“. Die Zuführung zur Erhaltungsrücklage nicht ansetzen — laut Vordruck zählt erst die Entnahme für eine Reparatur (bei den Erhaltungsaufwendungen). Beträge aus der WEG-Abrechnung auf der Objektseite eintragen, dann rechnet MyImmo das heraus.",
    },
    {
      zeile: z("summeWerbungskosten"),
      bezeichnung: "Summe der Werbungskosten",
      betrag: w.summe,
      bereich: "summe",
      // Die Summe enthaelt die geschaetzten Schuldzinsen. Sie als uebertragbar
      // auszuweisen, waehrend die Schuldzinsen durchgestrichen sind, ist widerspruechlich —
      // wer die Summe abtippt, uebertraegt die Schaetzung durch die Hintertuer.
      uebertragbar: !summenWarnung(o),
      warnung: summenWarnung(o),
    },
    {
      zeile: z("ueberschuss"),
      bezeichnung: o.ueberschuss >= 0 ? "Überschuss (Einkünfte)" : "Verlust",
      betrag: o.ueberschuss,
      bereich: "summe",
      uebertragbar: !summenWarnung(o),
      warnung: summenWarnung(o),
    },
  ];
  // Leere Posten ohne Bedeutung weglassen — Summen und Ergebnis bleiben immer stehen.
  return zeilen.filter((x) => x.bereich === "summe" || x.betrag !== 0 || x.uebertragbar === false);
}
