// 15%-Wächter: anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG).
//
// Instandsetzungs-/Modernisierungskosten INNERHALB VON 3 JAHREN nach der
// Anschaffung werden zu Herstellungskosten (nur über AfA absetzbar statt sofort),
// wenn sie NETTO 15 % der Gebäude-Anschaffungskosten übersteigen. Reine
// Rechenfunktion ohne DB-Zugriff. Keine Steuerberatung.
//
// Vereinfachungen (bewusst konservativ = warnt eher zu früh):
// - Es wird der gespeicherte Bruttobetrag der Kosten verwendet (keine
//   Netto-/USt-Trennung in der App). Bei Privatvermietung mit steuerfreier
//   Wohnraumvermietung ist die Brutto-Betrachtung praxisnah; die 15 %-Grenze
//   meint netto, daher warnt der Wächter tendenziell früher.
// - Nur Kosten der Kategorien Reparatur/Instandhaltung/Modernisierung zählen;
//   jährlich übliche Erhaltungsarbeiten sind gesetzlich ausgenommen, werden hier
//   aber nicht herausgerechnet (Nutzer entscheidet).

const GEBAEUDEANTEIL_STANDARD = 80; // % — wie im Objektformular ("Standard 80")

/** Kostenkategorien, die als Instandsetzung/Modernisierung in die 15 %-Prüfung fallen. */
export const ANSCHAFFUNGSNAH_KATEGORIEN = ["Reparatur", "Instandhaltung", "Modernisierung"];

export type AnschaffungsnahInput = {
  kaufpreis: number | null;
  gebaeudeanteilProzent: number | null; // afa_gebaeudeanteil; null → 80 %
  kaufdatum: string | null;             // YYYY-MM-DD (Anschaffung)
};

export type AnschaffungsnahKosten = {
  buchungsdatum: string | null; // YYYY-MM-DD
  kategorie: string | null;
  betrag: number | null;
};

export type AnschaffungsnahStatus = "inaktiv" | "ok" | "warnung" | "ueberschritten" | "abgelaufen";

export type AnschaffungsnahErgebnis = {
  status: AnschaffungsnahStatus;
  gebaeudeAK: number;       // Gebäude-Anschaffungskosten (Basis der 15 %)
  grenze: number;           // 15 % der Gebäude-AK
  kostenImFenster: number;  // Summe relevanter Kosten im 3-Jahres-Fenster
  ausgeschoepftProzent: number; // kostenImFenster / grenze * 100
  fensterVon: string | null;    // YYYY-MM-DD
  fensterBis: string | null;    // YYYY-MM-DD (letzter Tag im Fenster)
  monateVerbleibend: number;    // bis Fensterende (0 wenn abgelaufen)
  hinweis: string;
};

const rund2 = (n: number) => Math.round(n * 100) / 100;

/** 3 Jahre nach Anschaffung, minus 1 Tag = letzter Tag im schädlichen Fenster. */
function fensterEnde(kaufISO: string): string {
  const d = new Date(`${kaufISO}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 3);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function monateZwischen(vonISO: string, bisISO: string): number {
  const a = new Date(`${vonISO}T00:00:00Z`);
  const b = new Date(`${bisISO}T00:00:00Z`);
  const m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return Math.max(0, m);
}

export function berechneAnschaffungsnah(
  objekt: AnschaffungsnahInput,
  kosten: AnschaffungsnahKosten[],
  heute: Date = new Date(),
): AnschaffungsnahErgebnis {
  const heuteISO = heute.toISOString().slice(0, 10);
  const anteil = objekt.gebaeudeanteilProzent && objekt.gebaeudeanteilProzent > 0
    ? objekt.gebaeudeanteilProzent
    : GEBAEUDEANTEIL_STANDARD;
  const gebaeudeAK = objekt.kaufpreis && objekt.kaufpreis > 0 ? rund2(objekt.kaufpreis * anteil / 100) : 0;
  const grenze = rund2(gebaeudeAK * 0.15);

  const leer: AnschaffungsnahErgebnis = {
    status: "inaktiv", gebaeudeAK, grenze, kostenImFenster: 0,
    ausgeschoepftProzent: 0, fensterVon: null, fensterBis: null, monateVerbleibend: 0, hinweis: "",
  };

  if (!objekt.kaufdatum || !/^\d{4}-\d{2}-\d{2}$/.test(objekt.kaufdatum)) {
    return { ...leer, hinweis: "Kaufdatum ergänzen, um den 15 %-Wächter zu aktivieren." };
  }
  if (gebaeudeAK <= 0) {
    return { ...leer, fensterVon: objekt.kaufdatum, hinweis: "Kaufpreis ergänzen, um den 15 %-Wächter zu aktivieren." };
  }

  const von = objekt.kaufdatum;
  const bis = fensterEnde(von);

  const kostenImFenster = rund2(
    kosten
      .filter((k) => k.buchungsdatum && ANSCHAFFUNGSNAH_KATEGORIEN.includes(k.kategorie ?? ""))
      .filter((k) => k.buchungsdatum! >= von && k.buchungsdatum! <= bis)
      .reduce((s, k) => s + (Number(k.betrag) || 0), 0),
  );

  const ausgeschoepftProzent = grenze > 0 ? rund2((kostenImFenster / grenze) * 100) : 0;
  const abgelaufen = heuteISO > bis;
  const monateVerbleibend = abgelaufen ? 0 : monateZwischen(heuteISO, bis);

  let status: AnschaffungsnahStatus;
  let hinweis: string;
  if (kostenImFenster > grenze) {
    status = "ueberschritten";
    hinweis = "15 %-Grenze überschritten: Diese Kosten gelten als anschaffungsnahe Herstellungskosten und sind nur über die AfA absetzbar — nicht sofort. Steuerberatung empfohlen.";
  } else if (abgelaufen) {
    status = "abgelaufen";
    hinweis = "3-Jahres-Frist abgelaufen — neue Instandsetzungskosten sind nicht mehr anschaffungsnah und wieder sofort absetzbar.";
  } else if (ausgeschoepftProzent >= 80) {
    status = "warnung";
    hinweis = "Nahe an der 15 %-Grenze. Weitere Instandsetzungen könnten in anschaffungsnahe Herstellungskosten kippen — ggf. hinter den Stichtag verschieben.";
  } else {
    status = "ok";
    hinweis = "Im sicheren Bereich. Der Wächter zählt Reparatur-/Instandhaltungskosten der ersten 3 Jahre gegen die 15 %-Grenze.";
  }

  return {
    status, gebaeudeAK, grenze, kostenImFenster, ausgeschoepftProzent,
    fensterVon: von, fensterBis: bis, monateVerbleibend, hinweis,
  };
}
