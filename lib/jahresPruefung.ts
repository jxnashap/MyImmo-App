// Jahresprüfung je Objekt (Ablauf E, Prüfstand 11.10.2026). Ohne Anlage V — die bleibt bei der
// Steuerseite.
//
// Eine Prüfliste für EIN Objekt und EIN Jahr: fehlende Belege, unklare Zahlungszuordnungen, mögliche
// Dubletten, offene Rückstände, widersprüchliche Vertragszeiträume, ungeklärte Umlagefähigkeit und
// fehlende Zählerstände — jeder Punkt mit einem Sprungziel. Ein Punkt wird NICHT abgehakt: Er
// verschwindet, sobald die Daten ihn nicht mehr ergeben (Beleg angehängt, Mieter zugeordnet,
// Beschreibung unterscheidet zwei Buchungen …). So schließt nur eine Korrektur, die man in den Daten
// nachsehen kann.
//
// Dazu der ABGLEICH: Jahresbericht, Buchungssaldo der Cashflow-Seite, DATEV-Export und
// Nebenkostenabrechnung werden mit DENSELBEN Funktionen gerechnet, die diese Seiten benutzen
// (`jahresZeile`, `buchungssaldo`, `baueDatevBuchungen`, `nkAusBuchungen`), und gegen die gebuchten
// Beträge gestellt. Weicht eine Ableitung ab, steht die Differenz mit Erklärung da.
// Rein, ohne Datenbank.

import { jahresZeile } from "@/lib/jahresberichtZeile";
import { buchungssaldo, IN_KREDITRATE_ENTHALTEN } from "@/lib/cashflowKennzahl";
import { baueDatevBuchungen, SKR03_EINNAHMEN } from "@/lib/datev";
import { nkAusBuchungen, nkBezeichnung } from "@/lib/nkAusBuchungen";
import { erwarteteMonate, gezahltImMonat, monatLabel, TEILZAHLUNG_TOLERANZ, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";
import { mietFaelligkeit } from "@/lib/mietStatus";

export type JpArt = "beleg" | "zuordnung" | "dublette" | "rueckstand" | "vertrag" | "umlage" | "zaehler" | "abgleich";
export const JP_ART_TITEL: Record<JpArt, string> = {
  beleg: "Fehlende Belege",
  zuordnung: "Unklare Zahlungszuordnung",
  dublette: "Mögliche Dubletten",
  rueckstand: "Offene Rückstände",
  vertrag: "Widersprüchliche Vertragszeiträume",
  umlage: "Umlagefähigkeit ungeklärt",
  zaehler: "Zählerstände",
  abgleich: "Abgleich NK · Cashflow · Jahresbericht · DATEV",
};
export const JP_ARTEN = Object.keys(JP_ART_TITEL) as JpArt[];

export type JpPunkt = {
  art: JpArt;
  schwere: "hoch" | "mittel" | "hinweis";
  text: string;
  /** Sprungziel, an dem sich der Punkt beheben lässt. */
  href: string;
  /** Stabil je Sachverhalt (für React-Schlüssel und Tests). */
  schluessel: string;
  betrag?: number;
};

export type JpAbgleich = {
  bezeichnung: string;
  aLabel: string;
  a: number;
  bLabel: string;
  b: number;
  differenz: number;
  stimmt: boolean;
  erklaerung: string;
};

export type JpMieter = MietkontoMieter & {
  id: string;
  prop_id: string | null;
  vorname: string | null;
  nachname: string | null;
  einheit: string | null;
};
export type JpZeitraum = MietkontoZeitraum & { mieter_id: string };
export type JpEinnahme = {
  id: string; prop_id: string | null; mieter_id: string | null; buchungsdatum: string | null;
  betrag: number | null; kategorie: string | null; soll_monat?: string | null; nk_anteil?: number | null; beschreibung?: string | null;
};
export type JpKosten = {
  id: string; prop_id: string | null; buchungsdatum: string | null; betrag: number | null; kategorie: string | null;
  beschreibung?: string | null; umlagefaehig?: string | null;
  rechnung_path?: string | null; rechnung_name?: string | null; beleg_eingang_id?: string | null;
};
export type JpMeldung = { id: string; mieter_id: string; prop_id: string | null; ablesedatum: string; uebernommen_am: string | null; art: string | null };
export type JpVerbrauch = { prop_id: string | null; buchungsdatum: string | null };
export type JpEingang = { id: string; status: string; prop_id: string | null };
export type JpKredit = Parameters<typeof jahresZeile>[3]["kredite"][number];
/** Hauskosten, wie die NK-Abrechnung des Jahres sie führt (Objekt: Mehrfamilienhaus, sonst beim Mieter). */
export type JpNk = { quelle: "objekt" | "mieter" | "keine"; positionen: { bezeichnung: string; betrag: number }[] };

export type JahresPruefung = { punkte: JpPunkt[]; abgleich: JpAbgleich[]; anzahl: Record<JpArt, number> };

const r2 = (n: number) => Math.round(n * 100) / 100;
const imJahr = (d: string | null | undefined, jahr: number) => !!d && d.slice(0, 4) === String(jahr);
const name = (m: JpMieter) => [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter";
const de = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const euro = (n: number) => `${r2(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/** Zählerstand gilt als zum Nutzerwechsel gehörig, wenn er höchstens so viele Tage daneben liegt. */
export const ZAEHLER_FENSTER_TAGE = 14;
/** Differenz, ab der der Abgleich „weicht ab“ meldet (Rundung über viele Buchungen). */
export const ABGLEICH_TOLERANZ = 0.01;

export function jahresPruefung(e: {
  jahr: number;
  heute: string;
  objekt: { id: string; bezeichnung: string | null; einheiten_anzahl?: number | null; kaufdatum?: string | null };
  /** ALLE Mieter des Kontos (eine Mietzahlung beim falschen Objekt fällt nur so auf). */
  mieter: JpMieter[];
  zeitraeume: JpZeitraum[];
  /** Einnahmen des Kontos im Jahr (alle Objekte, auch ohne Objekt). */
  einnahmen: JpEinnahme[];
  /** Kosten des Objekts im Jahr. */
  kosten: JpKosten[];
  kredite: JpKredit[];
  meldungen: JpMeldung[];
  verbrauch: JpVerbrauch[];
  belegEingang: JpEingang[];
  nk: JpNk;
}): JahresPruefung {
  const { jahr, heute, objekt } = e;
  const pid = objekt.id;
  const punkte: JpPunkt[] = [];
  const add = (p: JpPunkt) => punkte.push(p);
  const mieterHier = e.mieter.filter((m) => m.prop_id === pid);
  const mieterIds = new Set(mieterHier.map((m) => m.id));
  const mieterVon = new Map(e.mieter.map((m) => [m.id, m]));
  const jahrStart = `${jahr}-01-01`;
  const jahrEnde = `${jahr}-12-31`;
  const lief = (m: JpMieter) => (!m.mietbeginn || m.mietbeginn <= jahrEnde) && (!m.mietende || m.mietende >= jahrStart);

  const einnahmenObjekt = e.einnahmen.filter((x) => x.prop_id === pid && imJahr(x.buchungsdatum, jahr));
  const kostenObjekt = e.kosten.filter((x) => x.prop_id === pid && imJahr(x.buchungsdatum, jahr));

  // ---- Fehlende Belege -------------------------------------------------------------------------
  // Schuldzinsen gebündelt (Durchsicht 27.10.2026): Die Bank schickt EINE Zinsbescheinigung im Jahr,
  // keinen Monatsbeleg — zwölf Einzelpunkte überdeckten die echten Lücken (z. B. eine Reparatur).
  // Der Schlüssel trägt das Datum: Die Liste steht nach Datum statt nach Zufallskennung.
  const zinsenOhne: typeof kostenObjekt = [];
  for (const k of kostenObjekt) {
    if ((Number(k.betrag) || 0) <= 0) continue;
    if (k.rechnung_path || k.rechnung_name || k.beleg_eingang_id) continue;
    if (k.kategorie === "Schuldzinsen") { zinsenOhne.push(k); continue; }
    add({
      art: "beleg", schwere: "mittel", schluessel: `beleg:${k.buchungsdatum ?? ""}:${k.id}`, betrag: Number(k.betrag),
      text: `${k.kategorie ?? "Kosten"} vom ${de(k.buchungsdatum!)} (${euro(Number(k.betrag))}) ohne Beleg${k.beschreibung ? ` — ${k.beschreibung}` : ""}`,
      href: `/kosten/${k.id}/edit`,
    });
  }
  if (zinsenOhne.length === 1) {
    const k = zinsenOhne[0];
    add({
      art: "beleg", schwere: "mittel", schluessel: `beleg:${k.buchungsdatum ?? ""}:${k.id}`, betrag: Number(k.betrag),
      text: `Schuldzinsen vom ${de(k.buchungsdatum!)} (${euro(Number(k.betrag))}) ohne Beleg${k.beschreibung ? ` — ${k.beschreibung}` : ""}`,
      href: `/kosten/${k.id}/edit`,
    });
  } else if (zinsenOhne.length > 1) {
    const summe = r2(zinsenOhne.reduce((a, k) => a + Number(k.betrag), 0));
    add({
      art: "beleg", schwere: "hinweis", schluessel: "beleg:zinsen", betrag: summe,
      text: `${zinsenOhne.length} Zinsbuchungen (${euro(summe)}) ohne Beleg — die Zinsbescheinigung der Bank für ${jahr} genügt als ein Beleg`,
      href: `/cashflow?jahr=${jahr}&prop=${pid}`,
    });
  }
  const eingangOffen = e.belegEingang.filter((b) => b.prop_id === pid && b.status !== "gebucht");
  if (eingangOffen.length > 0) {
    add({
      art: "beleg", schwere: "hinweis", schluessel: "beleg:eingang",
      text: `${eingangOffen.length === 1 ? "1 Beleg liegt" : `${eingangOffen.length} Belege liegen`} im Belegeingang und ${eingangOffen.length === 1 ? "ist" : "sind"} noch nicht gebucht`,
      href: "/cashflow/belege",
    });
  }

  // ---- Unklare Zahlungszuordnung ---------------------------------------------------------------
  const miete = (x: JpEinnahme) => (x.kategorie ?? "").toLowerCase() === "miete";
  for (const x of einnahmenObjekt) {
    if (miete(x) && !x.mieter_id) {
      add({
        art: "zuordnung", schwere: "hoch", schluessel: `ohne-mieter:${x.id}`, betrag: Number(x.betrag),
        text: `Mieteingang vom ${de(x.buchungsdatum!)} (${euro(Number(x.betrag) || 0)}) ohne Mieter — zählt in keinem Mietkonto`,
        href: `/einnahmen/${x.id}/edit`,
      });
    }
  }
  for (const x of e.einnahmen) {
    if (!imJahr(x.buchungsdatum, jahr) || !x.mieter_id || !mieterIds.has(x.mieter_id) || x.prop_id === pid) continue;
    add({
      art: "zuordnung", schwere: "hoch", schluessel: `falsches-objekt:${x.id}`, betrag: Number(x.betrag),
      text: `Zahlung von ${name(mieterVon.get(x.mieter_id)!)} vom ${de(x.buchungsdatum!)} ist ${x.prop_id ? "einem anderen Objekt" : "keinem Objekt"} zugeordnet`,
      href: `/einnahmen/${x.id}/edit`,
    });
  }

  // ---- Rückstände und Überzahlungen (dieselben Regeln wie das Mietkonto) -----------------------
  const heuteYm = heute.slice(0, 7);
  const bisYm = `${jahr}-12` < heuteYm ? `${jahr}-12` : heuteYm;
  for (const m of mieterHier) {
    if (!lief(m) || !m.mietbeginn || `${jahr}-01` > bisYm) continue;
    const zr = e.zeitraeume.filter((z) => z.mieter_id === m.id);
    const eigene = e.einnahmen.filter((x) => x.mieter_id === m.id);
    const offen: { ym: string; rest: number }[] = [];
    for (const mon of erwarteteMonate(m, zr, `${jahr}-01`, bisYm, new Date(`${heute}T12:00:00Z`))) {
      if (mon.gesamt <= 0) continue;
      const gezahlt = gezahltImMonat(eigene, mon.jahrMonat);
      if (gezahlt == null) continue;
      const rest = r2(mon.gesamt - gezahlt);
      if (rest >= TEILZAHLUNG_TOLERANZ && mietFaelligkeit(mon.jahrMonat, heute).stand === "ueberfaellig") offen.push({ ym: mon.jahrMonat, rest });
      if (-rest >= TEILZAHLUNG_TOLERANZ) {
        add({
          art: "zuordnung", schwere: "mittel", schluessel: `ueberzahlt:${m.id}:${mon.jahrMonat}`, betrag: -rest,
          text: `${name(m)}: ${monatLabel(mon.jahrMonat)} ${euro(-rest)} mehr gezahlt als Soll — Nachzahlung, anderer Monat oder Fehlbuchung?`,
          href: `/mietkonto?monat=${mon.jahrMonat}`,
        });
      }
    }
    if (offen.length > 0) {
      const summe = r2(offen.reduce((s, o) => s + o.rest, 0));
      add({
        art: "rueckstand", schwere: "hoch", schluessel: `rueckstand:${m.id}`, betrag: summe,
        text: `${name(m)}: ${euro(summe)} offen (${offen.map((o) => monatLabel(o.ym)).join(", ")})`,
        href: `/mietkonto?monat=${offen[0].ym}`,
      });
    }
  }

  // ---- Mögliche Dubletten ---------------------------------------------------------------------
  // Gleicher Tag, gleicher Betrag, gleiche Art, gleiche Beschreibung. Unterscheidet die Beschreibung
  // zwei echte Buchungen (z. B. Rechnungsnummer), verschwindet der Punkt — nachvollziehbar.
  const gruppen = <T,>(xs: T[], schl: (x: T) => string | null) => {
    const g = new Map<string, T[]>();
    for (const x of xs) { const k = schl(x); if (k) g.set(k, [...(g.get(k) ?? []), x]); }
    return [...g.values()].filter((l) => l.length > 1);
  };
  for (const l of gruppen(kostenObjekt, (k) => (Number(k.betrag) ? `${k.buchungsdatum}|${r2(Number(k.betrag))}|${k.kategorie ?? ""}|${norm(k.beschreibung ?? "")}` : null))) {
    add({
      art: "dublette", schwere: "mittel", schluessel: `dublette-k:${l.map((k) => k.id).sort().join(",")}`, betrag: r2(Number(l[0].betrag) * (l.length - 1)),
      text: `${l.length}× ${l[0].kategorie ?? "Kosten"} ${euro(Number(l[0].betrag))} am ${de(l[0].buchungsdatum!)} — doppelt gebucht?`,
      href: `/kosten/${l[1].id}/edit`,
    });
  }
  for (const l of gruppen(einnahmenObjekt, (x) => (Number(x.betrag) ? `${x.mieter_id ?? "-"}|${x.buchungsdatum}|${r2(Number(x.betrag))}|${x.kategorie ?? ""}|${norm(x.beschreibung ?? "")}` : null))) {
    add({
      art: "dublette", schwere: "mittel", schluessel: `dublette-e:${l.map((x) => x.id).sort().join(",")}`, betrag: r2(Number(l[0].betrag) * (l.length - 1)),
      text: `${l.length}× ${l[0].kategorie ?? "Einnahme"} ${euro(Number(l[0].betrag))} am ${de(l[0].buchungsdatum!)}${l[0].mieter_id && mieterVon.has(l[0].mieter_id) ? ` von ${name(mieterVon.get(l[0].mieter_id)!)}` : ""} — doppelt gebucht?`,
      href: `/einnahmen/${l[1].id}/edit`,
    });
  }

  // ---- Widersprüchliche Vertragszeiträume -----------------------------------------------------
  for (const m of mieterHier) {
    if (!lief(m)) continue;
    const href = `/tenants/${m.id}/edit`;
    if (!m.mietbeginn) {
      add({ art: "vertrag", schwere: "hoch", schluessel: `ohne-beginn:${m.id}`, text: `${name(m)}: kein Mietbeginn — Soll und Rückstände lassen sich nicht rechnen`, href });
      continue;
    }
    if (m.mietende && m.mietende < m.mietbeginn) {
      add({ art: "vertrag", schwere: "hoch", schluessel: `ende-vor-beginn:${m.id}`, text: `${name(m)}: Mietende ${de(m.mietende)} liegt vor dem Mietbeginn ${de(m.mietbeginn)}`, href });
    }
    const zr = e.zeitraeume.filter((z) => z.mieter_id === m.id).sort((a, b) => a.von.localeCompare(b.von));
    for (let i = 1; i < zr.length; i++) {
      const vorher = zr[i - 1];
      if (vorher.bis === null || vorher.bis >= zr[i].von) {
        add({ art: "vertrag", schwere: "hoch", schluessel: `zeitraum-ueberlappt:${m.id}:${zr[i].von}`, text: `${name(m)}: Miet-Zeiträume ab ${monatLabel(vorher.von.slice(0, 7))} und ab ${monatLabel(zr[i].von.slice(0, 7))} überschneiden sich — welche Miete gilt?`, href: `/tenants/${m.id}` });
      }
    }
    for (const z of zr) {
      const ausserhalb = z.von.slice(0, 7) < m.mietbeginn.slice(0, 7) || (!!m.mietende && z.von.slice(0, 7) > m.mietende.slice(0, 7));
      if (ausserhalb) add({ art: "vertrag", schwere: "mittel", schluessel: `zeitraum-ausserhalb:${m.id}:${z.von}`, text: `${name(m)}: Miet-Zeitraum ab ${monatLabel(z.von.slice(0, 7))} liegt außerhalb des Mietverhältnisses`, href: `/tenants/${m.id}` });
    }
  }
  // Zwei Mietverhältnisse gleichzeitig in derselben Einheit (bzw. im Objekt mit nur einer Einheit).
  const einheitVon = (m: JpMieter) => norm(m.einheit ?? "") || ((objekt.einheiten_anzahl ?? 1) <= 1 ? "(ganzes Objekt)" : null);
  const laufende = mieterHier.filter((m) => lief(m) && m.mietbeginn);
  for (let i = 0; i < laufende.length; i++) {
    for (let j = i + 1; j < laufende.length; j++) {
      const a = laufende[i], b = laufende[j];
      const ea = einheitVon(a);
      if (!ea || ea !== einheitVon(b)) continue;
      const ueberlappt = a.mietbeginn! < (b.mietende ?? "9999-12-31") && b.mietbeginn! < (a.mietende ?? "9999-12-31");
      if (!ueberlappt) continue;
      add({
        art: "vertrag", schwere: "hoch", schluessel: `doppelt-vermietet:${[a.id, b.id].sort().join(",")}`,
        text: `${name(a)} und ${name(b)} wohnen laut Vertrag gleichzeitig in ${ea === "(ganzes Objekt)" ? "diesem Objekt" : `Einheit „${a.einheit}“`} — Mietende vergessen oder Mitmieter?`,
        href: `/tenants/${b.id}/edit`,
      });
    }
  }

  // ---- Umlagefähigkeit ungeklärt (dieselbe Regel wie die NK: nkAusBuchungen) -------------------
  const nkGebucht = nkAusBuchungen(e.kosten, pid, jahr);
  for (const k of kostenObjekt) {
    if (k.umlagefaehig !== "unklar") continue;
    add({ art: "umlage", schwere: "mittel", schluessel: `umlage:${k.id}`, betrag: Number(k.betrag), text: `${k.kategorie ?? "Kosten"} vom ${de(k.buchungsdatum!)} (${euro(Number(k.betrag) || 0)}): umlagefähig ja oder nein?`, href: `/kosten/${k.id}/edit` });
  }
  for (const u of nkGebucht.unklar) {
    if (kostenObjekt.some((k) => k.umlagefaehig === "unklar" && k.kategorie === u.kategorie)) continue; // schon je Buchung genannt
    const erste = kostenObjekt.find((k) => k.kategorie === u.kategorie);
    add({ art: "umlage", schwere: "mittel", schluessel: `umlage-kat:${u.kategorie}`, betrag: u.betrag, text: `${u.kategorie} ${euro(u.betrag)}: enthält umlagefähige und nicht umlagefähige Anteile — je Buchung festlegen`, href: erste ? `/kosten/${erste.id}/edit` : `/cashflow?jahr=${jahr}&prop=${pid}` });
  }

  // ---- Zählerstände ---------------------------------------------------------------------------
  for (const z of e.meldungen) {
    if (z.uebernommen_am || !mieterIds.has(z.mieter_id) || !imJahr(z.ablesedatum, jahr)) continue;
    add({ art: "zaehler", schwere: "mittel", schluessel: `meldung:${z.id}`, text: `${z.art ?? "Zählerstand"} vom ${de(z.ablesedatum)} (${name(mieterVon.get(z.mieter_id)!)}) gemeldet, noch nicht übernommen`, href: "/verbrauch" });
  }
  // Nutzerwechsel im Jahr ohne Ablesung in der Nähe (HeizkostenV § 9b: Zwischenablesung).
  const ablesungen = [
    ...e.meldungen.filter((z) => z.prop_id === pid || mieterIds.has(z.mieter_id)).map((z) => z.ablesedatum),
    ...e.verbrauch.filter((v) => v.prop_id === pid && v.buchungsdatum).map((v) => v.buchungsdatum!),
  ];
  const wechsel: { datum: string; m: JpMieter; was: string }[] = [];
  for (const m of mieterHier) {
    if (m.mietbeginn && imJahr(m.mietbeginn, jahr) && m.mietbeginn <= heute) wechsel.push({ datum: m.mietbeginn, m, was: "Einzug" });
    if (m.mietende && imJahr(m.mietende, jahr) && m.mietende <= heute) wechsel.push({ datum: m.mietende, m, was: "Auszug" });
  }
  for (const w of wechsel) {
    if (ablesungen.some((d) => Math.abs(tageZwischen(w.datum, d)) <= ZAEHLER_FENSTER_TAGE)) continue;
    add({
      art: "zaehler", schwere: "mittel", schluessel: `zwischenablesung:${w.m.id}:${w.was}`,
      text: `${w.was} ${name(w.m)} am ${de(w.datum)}: kein Zählerstand ±${ZAEHLER_FENSTER_TAGE} Tage (Zwischenablesung, § 9b HeizkostenV) — falls die Wohnung eigene Zähler hat`,
      href: `/verbrauch/new?prop=${pid}`,
    });
  }

  // ---- Abgleich ------------------------------------------------------------------------------
  const abgleich: JpAbgleich[] = [];
  const zeile = (bezeichnung: string, aLabel: string, a: number, bLabel: string, b: number, erklaerung: string) => {
    const differenz = r2(b - a);
    abgleich.push({ bezeichnung, aLabel, a: r2(a), bLabel, b: r2(b), differenz, stimmt: Math.abs(differenz) <= ABGLEICH_TOLERANZ, erklaerung });
  };
  const summe = <T extends { betrag: number | null }>(xs: T[]) => xs.reduce((s, x) => s + (Number(x.betrag) || 0), 0);
  const kaution = einnahmenObjekt.filter((x) => x.kategorie === "Kaution");
  const ohneKaution = einnahmenObjekt.filter((x) => x.kategorie !== "Kaution");
  const zinsKat = new Set<string>(IN_KREDITRATE_ENTHALTEN);
  const laufend = kostenObjekt.filter((k) => !zinsKat.has(k.kategorie ?? ""));
  const monate = jahr === Number(heute.slice(0, 4)) ? Number(heute.slice(5, 7)) : 12;
  const jb = jahresZeile(pid, jahr, monate, { einnahmen: einnahmenObjekt, kosten: kostenObjekt, kredite: e.kredite, kaufdatum: objekt.kaufdatum ?? null });

  zeile("Jahresbericht · Einnahmen", "gebucht (ohne Kaution)", summe(ohneKaution), "Jahresbericht", jb.e, "Kaution ist durchlaufend und zählt nicht als Einnahme.");
  zeile("Jahresbericht · laufende Kosten", "gebucht (ohne Schuldzinsen)", summe(laufend), "Jahresbericht", jb.k, "Schuldzinsen stecken in der Kreditrate und werden dort abgezogen.");

  const saldo = buchungssaldo(einnahmenObjekt, kostenObjekt);
  zeile("Cashflow-Seite · Buchungssaldo", "Jahresbericht-Einnahmen + Kaution − laufende Kosten − Schuldzinsen", jb.e + summe(kaution) - jb.k - (summe(kostenObjekt) - summe(laufend)), "Cashflow-Seite", saldo.saldo,
    "Der Buchungssaldo zählt alle Buchungen; der Jahresbericht lässt Kaution weg und rechnet Schuldzinsen über die Rate.");

  // Der Export wird mit DERSELBEN Funktion gebaut wie die Route /api/export/datev — einmal für die
  // Einnahmen, einmal für die Kosten, damit keine Kontenzuordnung erraten werden muss.
  const name0 = () => objekt.bezeichnung ?? "";
  const datevE = baueDatevBuchungen(jahr, einnahmenObjekt, [], name0);
  const datevK = baueDatevBuchungen(jahr, [], kostenObjekt, name0);
  const datev = [...datevE, ...datevK];
  const kautionKonto = SKR03_EINNAHMEN.Kaution;
  const vz = (sh: "S" | "H") => (sh === "H" ? 1 : -1);
  const dErloes = datevE.filter((b) => b.konto !== kautionKonto).reduce((s, b) => s + vz(b.sollHaben) * b.betrag, 0);
  const dKaution = datevE.filter((b) => b.konto === kautionKonto).reduce((s, b) => s + vz(b.sollHaben) * b.betrag, 0);
  const dAufwand = datevK.reduce((s, b) => s - vz(b.sollHaben) * b.betrag, 0);
  zeile("DATEV · Erlöse", "gebucht (ohne Kaution)", summe(ohneKaution), "DATEV-Export", dErloes, "Rückbuchungen stehen im Export mit umgekehrtem Soll/Haben.");
  zeile("DATEV · Kaution", "gebucht", summe(kaution), "DATEV-Export (Konto 1600)", dKaution, "Durchlaufender Posten, eigenes Konto.");
  zeile("DATEV · Aufwand", "gebucht (alle Kosten)", summe(kostenObjekt), "DATEV-Export", dAufwand, "Gutschriften stehen im Export mit umgekehrtem Soll/Haben.");
  const exportierbar = [...einnahmenObjekt, ...kostenObjekt].filter((x) => (Number(x.betrag) || 0) !== 0).length;
  zeile("DATEV · Anzahl Buchungen", "gebucht (Betrag ≠ 0)", exportierbar, "Zeilen im Export", datev.length, "Buchungen mit Betrag 0 gehen nicht in den Export.");

  // NK-Vorauszahlungen: gebuchter NK-Anteil der Mieten gegen das Soll laut Vertrag (bis heute).
  let nkSoll = 0;
  for (const m of mieterHier) {
    if (!lief(m) || !m.mietbeginn) continue;
    const zr = e.zeitraeume.filter((z) => z.mieter_id === m.id);
    for (const mon of erwarteteMonate(m, zr, `${jahr}-01`, bisYm, new Date(`${heute}T12:00:00Z`))) nkSoll += mon.nk;
  }
  const nkIst = einnahmenObjekt.filter(miete).reduce((s, x) => s + (Number(x.nk_anteil) || 0), 0);
  zeile("NK · Vorauszahlungen", "laut Verträgen (bis heute)", nkSoll, "als NK-Anteil gebucht", nkIst, "Fehlt der NK-Anteil in Mietbuchungen, stimmen Abrechnung und Anlage V nicht; Rückstände senken den gebuchten Wert.");

  // Umlagefähige Kosten: gebucht (nkAusBuchungen) gegen die Positionen der NK-Abrechnung.
  const gebuchtNk = new Map(nkGebucht.vorschlaege.map((v) => [norm(v.bezeichnung), v]));
  const inNk = new Map<string, { bezeichnung: string; betrag: number }>();
  for (const p of e.nk.positionen) {
    const key = norm(nkBezeichnung(p.bezeichnung));
    const vorhanden = inNk.get(key);
    // Objekt (MFH): Positionen addieren; beim Mieter steht je Mieter die Hausposition → höchster Wert.
    inNk.set(key, { bezeichnung: p.bezeichnung, betrag: e.nk.quelle === "objekt" ? r2((vorhanden?.betrag ?? 0) + p.betrag) : Math.max(vorhanden?.betrag ?? 0, p.betrag) });
  }
  zeile("NK · umlagefähige Kosten", "gebucht", nkGebucht.vorschlaege.reduce((s, v) => s + v.betrag, 0), "in der NK-Abrechnung", [...inNk.values()].reduce((s, v) => s + v.betrag, 0),
    e.nk.quelle === "keine" ? `Für ${jahr} sind noch keine NK-Kosten erfasst.` : "Abweichungen je Kostenart stehen in der Prüfliste.");
  const nkHref = e.nk.quelle === "objekt" ? `/properties/${pid}/nebenkosten?jahr=${jahr}` : mieterHier[0] ? `/tenants/${mieterHier[0].id}/nk?jahr=${jahr}` : `/properties/${pid}`;
  if (e.nk.quelle !== "keine") {
    for (const [key, g] of gebuchtNk) {
      const n = inNk.get(key);
      if (!n) add({ art: "abgleich", schwere: "mittel", schluessel: `nk-fehlt:${key}`, betrag: g.betrag, text: `${g.bezeichnung}: ${euro(g.betrag)} gebucht, aber nicht in der NK-Abrechnung ${jahr}`, href: nkHref });
      else if (Math.abs(r2(n.betrag - g.betrag)) >= TEILZAHLUNG_TOLERANZ) add({ art: "abgleich", schwere: "mittel", schluessel: `nk-betrag:${key}`, betrag: r2(n.betrag - g.betrag), text: `${g.bezeichnung}: gebucht ${euro(g.betrag)}, in der NK-Abrechnung ${euro(n.betrag)}`, href: nkHref });
    }
    for (const [key, n] of inNk) {
      if (!gebuchtNk.has(key)) add({ art: "abgleich", schwere: "hinweis", schluessel: `nk-ungebucht:${key}`, betrag: n.betrag, text: `${n.bezeichnung}: ${euro(n.betrag)} in der NK-Abrechnung, aber nicht gebucht — Beleg und Buchung vorhanden?`, href: `/cashflow/neu?typ=ausgabe&prop=${pid}&back=/properties/${pid}/jahrespruefung` });
    }
  }
  for (const a of abgleich) {
    if (a.stimmt || a.bezeichnung.startsWith("NK ·")) continue;
    add({ art: "abgleich", schwere: "hoch", schluessel: `abgleich:${a.bezeichnung}`, betrag: a.differenz, text: `${a.bezeichnung}: ${a.bLabel} ${a.differenz > 0 ? "+" : ""}${a.differenz.toLocaleString("de-DE")} gegenüber ${a.aLabel}`, href: a.bezeichnung.startsWith("DATEV") ? "/steuer" : a.bezeichnung.startsWith("Cashflow") ? `/cashflow?jahr=${jahr}&prop=${pid}` : `/jahresbericht?year=${jahr}` });
  }
  if (Math.abs(r2(nkIst - nkSoll)) >= TEILZAHLUNG_TOLERANZ && nkSoll > 0) {
    add({ art: "abgleich", schwere: "mittel", schluessel: "nk-vorauszahlung", betrag: r2(nkIst - nkSoll), text: `NK-Vorauszahlungen: laut Verträgen ${euro(nkSoll)}, als NK-Anteil gebucht ${euro(nkIst)}`, href: `/mietkonto?monat=${bisYm}` });
  }

  const rang = { hoch: 0, mittel: 1, hinweis: 2 } as const;
  punkte.sort((a, b) => JP_ARTEN.indexOf(a.art) - JP_ARTEN.indexOf(b.art) || rang[a.schwere] - rang[b.schwere] || a.schluessel.localeCompare(b.schluessel));
  const anzahl = Object.fromEntries(JP_ARTEN.map((a) => [a, punkte.filter((p) => p.art === a).length])) as Record<JpArt, number>;
  return { punkte, abgleich, anzahl };
}
