// Vollständig laden statt still abschneiden (B05/B08, Prüfstand 11.10.2026).
//
// AUSGANGSLAGE: Supabase (PostgREST) liefert je Anfrage höchstens `max-rows` Zeilen — im Projekt
// der Standard von 1.000. Eine Abfrage ohne `.range()` bekommt also bei 1.001 Buchungen die ersten
// 1.000, OHNE Fehler und ohne Hinweis. Ein `.limit(10000)` hilft nicht (die Grenze gilt trotzdem).
// Dazu wurde der `error` vielerorts nicht ausgewertet: Eine gescheiterte Abfrage sah aus wie
// „keine Buchungen“ — Cashflow 0, Nebenkosten 0, Export leer, und alles wirkte vollständig.
//
// REGEL: Wer ALLE Zeilen braucht (Auswertung, Export, Abrechnung), lädt über `ladeAlle()` — mit
// einer STABILEN Sortierung, die mit einem eindeutigen Schlüssel endet (sonst können Zeilen beim
// Blättern doppelt kommen oder fehlen). Scheitert eine Seite, wirft `ladeAlle` — ein Teilergebnis
// wird nie als Ganzes zurückgegeben.

/** Seitengröße — gleich der PostgREST-Grenze, damit eine volle Seite „es gibt mehr“ bedeutet. */
export const SEITE = 1000;
/** Schutz vor Endlosschleifen: mehr Seiten als das gelten als „nicht vollständig ladbar“. */
export const MAX_SEITEN = 500;

export class DatenUnvollstaendig extends Error {
  constructor(
    public readonly quelle: string,
    public readonly ursache: string,
  ) {
    super(`Daten aus „${quelle}“ konnten nicht vollständig geladen werden: ${ursache}`);
    this.name = "DatenUnvollstaendig";
  }
}

type Antwort<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Lädt alle Zeilen seitenweise. `seite(von, bis)` baut die Abfrage MIT stabiler Sortierung und hängt
 * `.range(von, bis)` an (beide Grenzen einschließlich, wie bei Supabase).
 */
export async function ladeAlle<T>(
  quelle: string,
  seite: (von: number, bis: number) => PromiseLike<Antwort<T>>,
  groesse: number = SEITE,
  maxSeiten: number = MAX_SEITEN,
): Promise<T[]> {
  const alle: T[] = [];
  for (let i = 0; i < maxSeiten; i++) {
    const von = i * groesse;
    const { data, error } = await seite(von, von + groesse - 1);
    if (error) throw new DatenUnvollstaendig(quelle, error.message);
    if (!data) throw new DatenUnvollstaendig(quelle, "keine Antwort");
    alle.push(...data);
    if (data.length < groesse) return alle;
  }
  throw new DatenUnvollstaendig(quelle, `mehr als ${maxSeiten * groesse} Zeilen`);
}

/** Teilt eine ID-Liste für `.in()`-Filter (lange URLs scheitern sonst an der Anfragegrenze). */
export function stapel<T>(werte: readonly T[], groesse = 100): T[][] {
  const aus: T[][] = [];
  for (let i = 0; i < werte.length; i += groesse) aus.push(werte.slice(i, i + groesse));
  return aus;
}
