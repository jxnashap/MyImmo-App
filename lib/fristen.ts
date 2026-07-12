// Fristen-Logik aus der ursprünglichen App — typisiert für das Supabase-Schema.

export type FristKategorie =
  | "Miete" | "Betriebskosten" | "Finanzierung" | "Steuer" | "Wartung" | "WEG" | "Versicherung" | "Sonstiges";

export type Frist = {
  label: string;
  datum: string | null;
  typ: "info" | "warn" | "ok";
  kategorie?: FristKategorie;
  // Rechtsgrundlage/Quelle als kleiner Untertext ("Angaben ohne Gewähr")
  rechtsgrundlage?: string;
};

type MieterFristInput = {
  mietbeginn: string | null;
  mietende: string | null;
  kuendigung: number | null;
  letzte_erhoehung: string | null;
  mietart?: string | null;       // "Staffel" | "Index" | …
  staffel_datum?: string | null; // erste/nächste Staffelstufe
  staffel_intervall?: string | null;
  staffel_betrag?: number | null;
  staffel_prozent?: number | null;
  staffel_stufen?: number | null;
};

const iso = (d: Date) => d.toISOString().split("T")[0];

// Monate addieren OHNE Tag-Rollover: 31.03. − 1 Monat → 28./29.02. (nicht 03.03.).
function addMonate(d: Date, monate: number): Date {
  const r = new Date(d);
  const tag = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + monate);
  const letzterTag = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(tag, letzterTag));
  return r;
}

// Abgeleitete Fristen eines Mieters (Mietbeginn, -ende, Kündigungsfrist, nächste Erhöhung).
export function mieterFristen(m: MieterFristInput): Frist[] {
  const fristen: Frist[] = [];
  const heute = new Date();

  if (m.mietbeginn) fristen.push({ label: "Mietbeginn", datum: m.mietbeginn, typ: "info", kategorie: "Miete" });

  // Wohnungsgeberbestätigung: binnen 2 Wochen nach Einzug ausstellen
  // (§ 19 BMG, Bußgeld bis 1.000 €). Nur solange die Frist noch läuft.
  if (m.mietbeginn) {
    const wgFrist = new Date(new Date(m.mietbeginn).getTime() + 14 * 86400000);
    const wgTage = Math.ceil((wgFrist.getTime() - heute.getTime()) / 86400000);
    if (wgTage >= 0) {
      fristen.push({
        label: "Wohnungsgeberbestätigung ausstellen",
        datum: iso(wgFrist),
        typ: wgTage <= 7 ? "warn" : "info",
        kategorie: "Miete",
        rechtsgrundlage: "§ 19 BMG (2 Wochen nach Einzug)",
      });
    }
  }

  if (m.mietende) {
    const ende = new Date(m.mietende);
    const tage = Math.ceil((ende.getTime() - heute.getTime()) / 86400000);
    fristen.push({ label: "Mietende", datum: m.mietende, typ: tage < 90 ? "warn" : "info", kategorie: "Miete" });
    if (m.kuendigung) {
      const kFrist = addMonate(ende, -m.kuendigung);
      const kTage = Math.ceil((kFrist.getTime() - heute.getTime()) / 86400000);
      if (kTage > 0) fristen.push({ label: `Kündigungsfrist (${m.kuendigung} Mo. vorher)`, datum: iso(kFrist), typ: kTage < 60 ? "warn" : "info", kategorie: "Miete", rechtsgrundlage: "§ 573c BGB" });
    }
  }

  // Nächste mögliche Mieterhöhung: 12 Monate nach letzter (Kappungsgrenze §558)
  if (m.letzte_erhoehung) {
    const next = addMonate(new Date(m.letzte_erhoehung), 12);
    const nTage = Math.ceil((next.getTime() - heute.getTime()) / 86400000);
    fristen.push({ label: "Nächste Mieterhöhung möglich", datum: iso(next), typ: nTage <= 0 ? "ok" : "info", kategorie: "Miete", rechtsgrundlage: "§ 558 BGB (Kappungsgrenze)" });
  } else if (m.mietbeginn) {
    const next = addMonate(new Date(m.mietbeginn), 12);
    if (next < heute) fristen.push({ label: "Mieterhöhung möglich (keine bisher)", datum: null, typ: "ok", kategorie: "Miete", rechtsgrundlage: "§ 558 BGB" });
  }

  // NK-Abrechnung des Vorjahres: Zustellung bis 12 Monate nach Ende des
  // Abrechnungszeitraums (Kalenderjahr) → 31.12. des aktuellen Jahres.
  // Nur für laufende Mietverhältnisse.
  const aktiv = !m.mietende || new Date(m.mietende) >= heute;
  if (aktiv && m.mietbeginn) {
    const jahr = heute.getFullYear();
    const vorjahr = jahr - 1;
    // Nur wenn der Mieter im Vorjahr schon Mieter war.
    if (new Date(m.mietbeginn) < new Date(`${jahr}-01-01`)) {
      const frist = `${jahr}-12-31`;
      const tage = Math.ceil((new Date(frist).getTime() - heute.getTime()) / 86400000);
      fristen.push({
        label: `NK-Abrechnung ${vorjahr} zustellen`,
        datum: frist,
        typ: tage < 90 ? "warn" : "info",
        kategorie: "Betriebskosten",
        rechtsgrundlage: "§ 556 Abs. 3 BGB (12-Monats-Frist)",
      });
    }
  }

  // Staffelmiete: nächste Anpassungsstufe. Liegt ein Staffelplan vor
  // (Intervall + Betrag/Prozent), wird die NÄCHSTE Stufe ab heute genutzt —
  // sonst wie bisher das gepflegte Datum.
  if ((m.mietart ?? "").toLowerCase() === "staffel" && m.staffel_datum) {
    let stichtag = m.staffel_datum;
    const intervall = Number(m.staffel_intervall) || 12;
    const hatPlan = (m.staffel_betrag ?? 0) > 0 || (m.staffel_prozent ?? 0) > 0;
    if (hatPlan) {
      const stufen = m.staffel_stufen && m.staffel_stufen > 0 ? m.staffel_stufen : 5;
      let d = new Date(m.staffel_datum);
      for (let i = 0; i < stufen; i++) {
        if (d >= heute) break;
        d = addMonate(d, intervall);
      }
      if (d >= heute) stichtag = iso(d);
    }
    const tage = Math.ceil((new Date(stichtag).getTime() - heute.getTime()) / 86400000);
    fristen.push({
      label: "Staffelmiete-Anpassung",
      datum: stichtag,
      typ: tage <= 30 && tage >= 0 ? "warn" : "info",
      kategorie: "Miete",
      rechtsgrundlage: "§ 557a BGB",
    });
  }

  // Indexmiete: frühestens 12 Monate nach letzter Anpassung prüfen.
  if ((m.mietart ?? "").toLowerCase() === "index") {
    const basis = m.letzte_erhoehung || m.mietbeginn;
    if (basis) {
      const next = addMonate(new Date(basis), 12);
      fristen.push({
        label: "Indexmiete prüfen",
        datum: iso(next),
        typ: next <= heute ? "ok" : "info",
        kategorie: "Miete",
        rechtsgrundlage: "§ 557b BGB (12-Monats-Sperrfrist)",
      });
    }
  }

  return fristen;
}

// Abgeleitete Fristen eines Kredits.
type KreditFristInput = {
  zinsbindung: string | null;
  auszahlung_datum?: string | null;
};

export function kreditFristen(k: KreditFristInput): Frist[] {
  const fristen: Frist[] = [];
  if (k.zinsbindung) {
    fristen.push({ label: "Zinsbindung endet", datum: k.zinsbindung, typ: "warn", kategorie: "Finanzierung" });
    // Auch wenn der Vorlauf-Zeitpunkt schon verstrichen ist, anzeigen —
    // dann ist die Vorbereitung überfällig (Liste markiert das rot).
    const vorlauf = addMonate(new Date(k.zinsbindung), -12);
    if (new Date(k.zinsbindung) >= new Date()) {
      fristen.push({
        label: "Anschlussfinanzierung vorbereiten",
        datum: iso(vorlauf),
        typ: "warn",
        kategorie: "Finanzierung",
        rechtsgrundlage: "Empfehlung: 12 Mon. Vorlauf (Finanztip/Interhyp)",
      });
    }
  }
  // Sonderkündigungsrecht: 10 Jahre nach Vollauszahlung, Frist 6 Monate.
  if (k.auszahlung_datum) {
    const skr = addMonate(new Date(k.auszahlung_datum), 120);
    fristen.push({
      label: "Sonderkündigungsrecht (10 J. nach Auszahlung)",
      datum: iso(skr),
      typ: skr <= new Date() ? "ok" : "info",
      kategorie: "Finanzierung",
      rechtsgrundlage: "§ 489 Abs. 1 Nr. 2 BGB (6 Mon. Kündigungsfrist)",
    });
  }
  return fristen;
}

// Globale/objektunabhängige Steuer-Fristen des laufenden Jahres (+ nächstes,
// damit die Liste am Jahresende nicht leerläuft).
export function globaleFristen(): Frist[] {
  const heute = new Date();
  const jahr = heute.getFullYear();
  const fristen: Frist[] = [];

  // Grundsteuer-Vierteljahresraten: 15.02. / 15.05. / 15.08. / 15.11.
  for (const j of [jahr, jahr + 1]) {
    for (const [mm, tt] of [["02", "15"], ["05", "15"], ["08", "15"], ["11", "15"]] as const) {
      const d = `${j}-${mm}-${tt}`;
      if (new Date(d) < heute) continue;
      fristen.push({
        label: "Grundsteuer fällig (Vierteljahresrate)",
        datum: d,
        typ: "info",
        kategorie: "Steuer",
        rechtsgrundlage: "§ 28 GrStG",
      });
    }
    // Einkommensteuererklärung des Vorjahres: 31.07. des Folgejahres
    const est = `${j}-07-31`;
    if (new Date(est) >= heute) {
      fristen.push({
        label: `Einkommensteuererklärung ${j - 1}`,
        datum: est,
        typ: "info",
        kategorie: "Steuer",
        rechtsgrundlage: "§ 149 Abs. 2 AO (ohne Steuerberater)",
      });
    }
  }
  return fristen;
}

// Objektbezogene Fristen (Energieausweis).
type ObjektFristInput = { energieausweis_datum?: string | null; typ?: string | null };

export function objektFristen(p: ObjektFristInput): Frist[] {
  const fristen: Frist[] = [];
  if (p.energieausweis_datum) {
    const ablauf = addMonate(new Date(p.energieausweis_datum), 120);
    fristen.push({
      label: "Energieausweis erneuern",
      datum: iso(ablauf),
      typ: ablauf <= new Date() ? "warn" : "info",
      kategorie: "Sonstiges",
      rechtsgrundlage: "§ 79 Abs. 3 GEG (10 Jahre gültig)",
    });
  }
  return fristen;
}

export type RefinanzWarnung = {
  level: "abgelaufen" | "kritisch" | "warnung";
  months: number;
  label: string;
  color: string;
  bg: string;
};

// Warnung, wenn die Zinsbindung eines Darlehens bald (<=24 Mon.) ausläuft.
export function getRefinanzWarning(zinsbindung: string | null): RefinanzWarnung | null {
  if (!zinsbindung) return null;
  const zb = new Date(zinsbindung);
  const now = new Date();
  const diffMonths = Math.round((zb.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (diffMonths < 0) return { level: "abgelaufen", months: diffMonths, label: "Abgelaufen!", color: "var(--red)", bg: "var(--red-dim)" };
  if (diffMonths <= 12) return { level: "kritisch", months: diffMonths, label: `In ${diffMonths} Monat${diffMonths === 1 ? "" : "en"}`, color: "var(--red)", bg: "var(--red-dim)" };
  if (diffMonths <= 24) return { level: "warnung", months: diffMonths, label: `In ${diffMonths} Monaten`, color: "var(--amber)", bg: "rgba(240,160,48,0.1)" };
  return null;
}
