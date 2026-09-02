// Die fünf Zahlen, an denen das Geschäft gemessen wird (siehe
// `docs/zukunft/AI-AGENCY-OS.md`, Abschnitt 4.3). Bewusst reine Funktionen:
// die Route holt die Rohdaten, gerechnet wird hier — testbar ohne Datenbank.
//
// Wichtig für die Aussagekraft: Rollen-Konten (Mieter, Service, Hausverwaltung),
// das Demo-Konto und die eigenen Test-Konten zählen NICHT als Kunden. Wer sie
// mitzählt, misst sich selbst.

export type KontoRoh = {
  id: string;
  email: string | null;
  erstellt: string; // ISO
  letzterLogin: string | null; // ISO
};

export type KennzahlenEingabe = {
  konten: KontoRoh[];
  /** user_id → Anzahl Objekte */
  objekteJeKonto: Record<string, number>;
  /** user_id-Menge mit einem Eintrag in `nutzer_rollen` (Mieter/Service/HV) */
  rollenKonten: Set<string>;
  /** E-Mails bzw. Domains/Präfixe, die als eigene/Test-Konten gelten */
  ausschluss: string[];
  /** Anzahl aktiver Abos */
  aktiveAbos: number;
  /** Bezugszeitpunkt (für Tests fixierbar) */
  jetzt?: Date;
};

export type Kennzahlen = {
  stand: string;
  externeKonten: number;
  neueKonten7t: number;
  mitObjekt: number;
  aktivierungsquote: number | null;
  rueckkehrer: number;
  rueckkehrerquote: number | null;
  zahlendeKunden: number;
  ausgeschlossen: { rollen: number; eigeneUndTest: number };
};

const TAG_MS = 86_400_000;

/** Zählt ein Konto als eigenes/Test-Konto? Vergleich case-insensitiv, Treffer
 *  als Teilstring — so decken „@myimmo.test" und „j.scharp" beide Fälle ab. */
export function istAusgeschlossen(email: string | null, ausschluss: string[]): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return ausschluss.some((a) => a && e.includes(a.toLowerCase()));
}

/** Kam das Konto an einem SPÄTEREN Kalendertag wieder? Gleicher Tag zählt nicht:
 *  Anmelden und Umsehen ist ein Besuch, keine Rückkehr. */
export function istRueckkehrer(konto: KontoRoh): boolean {
  if (!konto.letzterLogin) return false;
  return konto.letzterLogin.slice(0, 10) > konto.erstellt.slice(0, 10);
}

export function berechneKennzahlen(e: KennzahlenEingabe): Kennzahlen {
  const jetzt = e.jetzt ?? new Date();
  const grenze7t = new Date(jetzt.getTime() - 7 * TAG_MS).toISOString();

  let rollen = 0;
  let eigeneUndTest = 0;
  const extern: KontoRoh[] = [];

  for (const k of e.konten) {
    if (e.rollenKonten.has(k.id)) {
      rollen++;
      continue;
    }
    if (istAusgeschlossen(k.email, e.ausschluss)) {
      eigeneUndTest++;
      continue;
    }
    extern.push(k);
  }

  const mitObjekt = extern.filter((k) => (e.objekteJeKonto[k.id] ?? 0) > 0).length;
  const rueckkehrer = extern.filter(istRueckkehrer).length;
  const quote = (zaehler: number) =>
    extern.length === 0 ? null : Math.round((zaehler / extern.length) * 1000) / 10;

  return {
    stand: jetzt.toISOString(),
    externeKonten: extern.length,
    neueKonten7t: extern.filter((k) => k.erstellt >= grenze7t).length,
    mitObjekt,
    aktivierungsquote: quote(mitObjekt),
    rueckkehrer,
    rueckkehrerquote: quote(rueckkehrer),
    zahlendeKunden: e.aktiveAbos,
    ausgeschlossen: { rollen, eigeneUndTest },
  };
}
