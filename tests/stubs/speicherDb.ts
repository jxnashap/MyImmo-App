// In-Memory-Datenbank mit der Supabase-Abfragekette (B05/B08, 11.10.2026).
//
// Anders als `actionHarness.fakeSupabase` (zeichnet Zugriffe auf, liefert feste Antworten) FILTERT,
// SORTIERT und BLÄTTERT diese Attrappe wirklich — und hält die PostgREST-Grenze ein: Ohne `.range()`
// kommen höchstens `maxZeilen` (Standard 1.000) Zeilen zurück, OHNE Fehler. Genau daran sind
// Export und Auswertungen still gescheitert; ein Test gegen feste Antworten sieht das nie.
//
// Fehler gezielt: `fehlerBei: { tabelle: "meldung" }` lässt jede Abfrage dieser Tabelle scheitern,
// `fehlerAbSeite: { tabelle: n }` erst ab der n-ten Seite (0-basiert) — für „Seite 2 bricht ab“.

type Row = Record<string, unknown>;
type Fehler = { message: string } | null;

export type SpeicherDbInit = {
  tabellen?: Record<string, Row[]>;
  /** Storage: Bucket → Pfad → Inhalt. */
  dateien?: Record<string, Record<string, string | Uint8Array>>;
  fehlerBei?: Record<string, string>;
  fehlerAbSeite?: Record<string, number>;
  maxZeilen?: number;
};

export function speicherDb(init: SpeicherDbInit = {}) {
  const tabellen: Record<string, Row[]> = init.tabellen ?? {};
  const max = init.maxZeilen ?? 1000;
  const protokoll: { tabelle: string; filter: string[]; von?: number; bis?: number }[] = [];
  const seiten: Record<string, number> = {};

  function abfrage(tabelle: string) {
    const filter: ((r: Row) => boolean)[] = [];
    const text: string[] = [];
    const ordnung: { spalte: string; auf: boolean }[] = [];
    let von: number | undefined;
    let bis: number | undefined;
    let limit: number | undefined;

    const ausfuehren = (): { data: Row[] | null; error: Fehler; count?: number } => {
      protokoll.push({ tabelle, filter: text, von, bis });
      if (init.fehlerBei?.[tabelle]) return { data: null, error: { message: init.fehlerBei[tabelle] } };
      if (von !== undefined && init.fehlerAbSeite?.[tabelle] !== undefined) {
        const n = seiten[tabelle] ?? 0;
        seiten[tabelle] = n + 1;
        if (n >= init.fehlerAbSeite[tabelle]) return { data: null, error: { message: `Seite ${n} abgebrochen` } };
      }
      let rows = (tabellen[tabelle] ?? []).filter((r) => filter.every((f) => f(r)));
      if (ordnung.length) {
        rows = [...rows].sort((a, b) => {
          for (const o of ordnung) {
            const x = a[o.spalte] as string | number, y = b[o.spalte] as string | number;
            if (x === y) continue;
            if (x == null) return 1;
            if (y == null) return -1;
            return (x < y ? -1 : 1) * (o.auf ? 1 : -1);
          }
          return 0;
        });
      }
      const gesamt = rows.length;
      if (von !== undefined && bis !== undefined) rows = rows.slice(von, bis + 1);
      if (limit !== undefined) rows = rows.slice(0, limit);
      rows = rows.slice(0, max); // PostgREST max-rows: still, ohne Fehler
      return { data: rows.map((r) => ({ ...r })), error: null, count: gesamt };
    };

    const k = {
      select: (_s?: string) => k,
      eq: (s: string, w: unknown) => { filter.push((r) => r[s] === w); text.push(`eq:${s}=${String(w)}`); return k; },
      neq: (s: string, w: unknown) => { filter.push((r) => r[s] !== w); text.push(`neq:${s}=${String(w)}`); return k; },
      in: (s: string, w: unknown[]) => { filter.push((r) => w.includes(r[s])); text.push(`in:${s}=${w.length}`); return k; },
      gte: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) >= w); text.push(`gte:${s}=${w}`); return k; },
      lte: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) <= w); text.push(`lte:${s}=${w}`); return k; },
      lt: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) < w); text.push(`lt:${s}=${w}`); return k; },
      gt: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) > w); text.push(`gt:${s}=${w}`); return k; },
      is: (s: string, w: null) => { filter.push((r) => r[s] === w || (w === null && r[s] === undefined)); text.push(`is:${s}=null`); return k; },
      not: (s: string, _op: string, _w: null) => { filter.push((r) => r[s] != null); text.push(`not:${s}`); return k; },
      order: (s: string, o: { ascending?: boolean } = {}) => { ordnung.push({ spalte: s, auf: o.ascending !== false }); text.push(`order:${s}`); return k; },
      limit: (n: number) => { limit = n; return k; },
      range: (a: number, b: number) => { von = a; bis = b; return Promise.resolve(ausfuehren()); },
      maybeSingle: () => { const r = ausfuehren(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      single: () => { const r = ausfuehren(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      then: (f: (w: ReturnType<typeof ausfuehren>) => unknown, g?: (e: unknown) => unknown) => Promise.resolve(ausfuehren()).then(f, g),
    };
    return k;
  }

  const client = {
    from: (tabelle: string) => abfrage(tabelle),
    storage: {
      from: (bucket: string) => ({
        download: async (pfad: string) => {
          const inhalt = init.dateien?.[bucket]?.[pfad];
          if (inhalt === undefined) return { data: null, error: { message: "Object not found" } };
          const bytes = typeof inhalt === "string" ? new TextEncoder().encode(inhalt) : inhalt;
          return { data: new Blob([new Uint8Array(bytes)]), error: null };
        },
      }),
    },
  };
  return { client, tabellen, protokoll };
}
