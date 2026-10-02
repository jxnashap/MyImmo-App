// „Angebote einholen“ (02.10.2026, Handwerker-Anfragen Stufe 1) — reine Helfer.
//
// Der Vermieter schickt einer oder mehreren Firmen aus SEINEM Verzeichnis einen Link
// (/angebot/<token>); die Firma antwortet ohne Konto mit Betrag, Termin und Text. Der Vermieter
// wählt, daraus wird ein normaler Auftrag. MyImmo erstellt keinen Kostenvoranschlag und
// vermittelt keine Firmen (docs/zukunft/HANDWERKER-ANFRAGEN.md).

export type Angebot = {
  id: string; anfrage_id: string; firma: string; kontakt: string | null;
  betrag: number; termin: string | null; nachricht: string | null; created_at: string;
};
export type Angebotsanfrage = {
  id: string; anliegen_id: string; firma_id: string; status: string;
  public_token: string; token_ablauf: string; auftrag_id: string | null; created_at: string;
  angebote: Angebot[];
};

/** Höchstzahl Firmen je Versand — mehr ist kein Vergleich mehr, sondern Streuung. */
export const MAX_FIRMEN = 5;

/** Der Link, den die Firma bekommt. */
export const angebotPfad = (token: string) => `/angebot/${token}`;

/**
 * Das günstigste Angebot ALLER offenen Anfragen eines Vorgangs — je Anfrage zählt nur das
 * LETZTE Angebot (eine Firma darf korrigieren, bis zu drei Mal).
 */
export function aktuelleAngebote(anfragen: Angebotsanfrage[]): { anfrage: Angebotsanfrage; angebot: Angebot }[] {
  const out: { anfrage: Angebotsanfrage; angebot: Angebot }[] = [];
  for (const q of anfragen) {
    if (q.angebote.length === 0) continue;
    const letztes = [...q.angebote].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    out.push({ anfrage: q, angebot: letztes });
  }
  return out.sort((a, b) => a.angebot.betrag - b.angebot.betrag);
}

/** Text der Mail an die Firma — nur Betreff, Link und Absender; der Inhalt steht hinter dem Link. */
export function anfrageMail(opts: { firma: string; titel: string; link: string; absender: string | null }) {
  const betreff = `Angebotsanfrage: ${opts.titel}`;
  const text =
    `Guten Tag${opts.firma ? ` ${opts.firma}` : ""},\n\n` +
    `ich bitte um ein Angebot für folgende Arbeit: ${opts.titel}.\n` +
    `Die Einzelheiten und das Antwortformular finden Sie hier:\n${opts.link}\n\n` +
    `Der Link gilt 30 Tage. Vielen Dank!\n\n${opts.absender ?? ""}`.trimEnd();
  return { betreff, text };
}

export function mailtoLink(email: string | null, betreff: string, text: string): string {
  // Nur eine schlichte Adresse übernehmen — `?`/`&` darin würden Betreff oder Text kapern.
  const an = email && /^[^\s@?&#]+@[^\s@?&#]+$/.test(email) ? email : "";
  return `mailto:${an}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
}
