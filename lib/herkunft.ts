// Herkunftsmessung ohne Analyse-Werkzeug (03.10.2026, `docs/MARKETINGPLAN.md` §6).
//
// Ein Link trägt eine Marke — `?von=instagram`, `?von=welle1` oder das
// verbreitete `?utm_source=…` —, und die Warteliste bzw. die Registrierung
// speichert sie mit. Mehr nicht.
//
// BEWUSST OHNE SPEICHER IM BROWSER: Die Marke wird nur aus der Adresse der
// Seite gelesen, auf der das Formular abgeschickt wird. Kein Cookie, kein
// localStorage — jede Speicherung auf dem Endgerät fiele unter § 25 TDDDG und
// bräuchte eine Einwilligung, und die Datenschutzerklärung verspricht „keine
// Analyse-Tools". Preis dafür: Wer über `/?von=instagram` kommt, erst zum
// Ratgeber klickt und sich DORT einträgt, zählt als „direkt". Kampagnen-Links
// deshalb immer auf die Seite setzen, auf der das Formular steht.
//
// Die Marke kommt aus der Adresszeile, also vom Besucher. Sie entscheidet über
// nichts und wird auf eine harmlose Kennung beschnitten — sie ist eine
// Zählhilfe, kein Nachweis.

/** Abfrageparameter, in dieser Reihenfolge gelesen. */
export const HERKUNFT_PARAMETER = ["von", "utm_source"] as const;

const MUSTER = /^[a-z0-9._-]{1,40}$/;

/** Macht aus einer beliebigen Eingabe eine Kennung wie `instagram` oder `null`. */
export function normalisiereHerkunft(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  const k = wert.trim().toLowerCase();
  return MUSTER.test(k) ? k : null;
}

/** Liest die Marke aus einem Suchteil (`?von=…`) oder fertigen Parametern. */
export function herkunftAus(suche: string | URLSearchParams | null | undefined): string | null {
  if (!suche) return null;
  const p = typeof suche === "string" ? new URLSearchParams(suche) : suche;
  for (const name of HERKUNFT_PARAMETER) {
    const k = normalisiereHerkunft(p.get(name));
    if (k) return k;
  }
  return null;
}

/** Im Browser: die Marke der aktuellen Seite. Auf dem Server immer `null`. */
export function herkunftDieserSeite(): string | null {
  return typeof window === "undefined" ? null : herkunftAus(window.location.search);
}
