// Finanzierungswunsch → Darlehen-Formular (Verknüpfungs-Audit 06.10.2026, Paket E).
//
// Der Finanzierungswunsch aus dem Kauf-Assistenten (components/kauf/DarlehenWizard.tsx) lag nur im
// Browser (localStorage) und wurde nie ein Kredit — nach dem Kauf tippte man Betrag, Zins und
// Tilgung neu. Hier wird er in eine Adresse für /kredite/new übersetzt und dort wieder gelesen.
//
// Bewusst NICHT vorbelegt: die Monatsrate. Sie ist im Wunsch eine Beispielrechnung mit
// angenommenem Zins; im Darlehen ist sie Pflicht und muss aus dem Vertrag stammen (Paket A4: nur
// 2 von 11 echten Raten passten zur Formel). Sie erscheint nur als Hinweis neben dem Feld.
// Ebenso das Ende der Zinsbindung — als Datum hängt es an der Auszahlung, die der Wunsch nicht kennt.

export type DarlehenVorbelegung = {
  betrag: number | null;
  zinssatz: number | null;
  tilgungssatz: number | null;
  /** Nur Hinweis: Rate laut Beispielrechnung. */
  rateWunsch: number | null;
  /** Nur Hinweis: gewünschte Zinsbindung in Jahren. */
  bindungJahre: number | null;
};

/** Zahl im Bereich, sonst null — Werte aus Adresse oder Browser-Speicher sind Eingaben Fremder. */
function imBereich(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const GRENZEN = {
  betrag: [1, 50_000_000],
  zins: [0, 20],
  tilgung: [0, 20],
  rate: [1, 1_000_000],
  bindung: [1, 40],
} as const;

/** Gemerkter Wunsch → Link aufs Darlehen-Formular. Null, wenn nichts Brauchbares da ist. */
export function darlehenAusWunschUrl(wunsch: unknown, back = "/abschluss"): string | null {
  if (!wunsch || typeof wunsch !== "object") return null;
  const w = wunsch as Record<string, unknown>;
  const betrag = imBereich(w.darlehen, ...GRENZEN.betrag);
  if (betrag == null) return null;
  const p = new URLSearchParams({ betrag: String(Math.round(betrag)) });
  const zins = imBereich(w.sollzins, ...GRENZEN.zins);
  const tilgung = imBereich(w.anfangstilgung, ...GRENZEN.tilgung);
  const rate = imBereich(w.monatsrate, ...GRENZEN.rate);
  const bindung = imBereich(w.zinsbindung, ...GRENZEN.bindung);
  if (zins != null) p.set("zins", String(zins));
  if (tilgung != null) p.set("tilgung", String(tilgung));
  if (rate != null) p.set("rate", String(Math.round(rate)));
  if (bindung != null) p.set("bindung", String(Math.round(bindung)));
  p.set("back", back);
  return `/kredite/new?${p.toString()}`;
}

/** Suchparameter von /kredite/new → Vorbelegung. Unplausibles fällt weg. */
export function darlehenVorbelegung(q: Record<string, string | undefined>): DarlehenVorbelegung {
  return {
    betrag: imBereich(q.betrag, ...GRENZEN.betrag),
    zinssatz: imBereich(q.zins, ...GRENZEN.zins),
    tilgungssatz: imBereich(q.tilgung, ...GRENZEN.tilgung),
    rateWunsch: imBereich(q.rate, ...GRENZEN.rate),
    bindungJahre: imBereich(q.bindung, ...GRENZEN.bindung),
  };
}
