// In-Memory-Datenbank mit der Supabase-Abfragekette (B05–B11, 11.10.2026).
//
// Anders als `actionHarness.fakeSupabase` (zeichnet Zugriffe auf, liefert feste Antworten) FILTERT,
// SORTIERT, BLÄTTERT und SCHREIBT diese Attrappe wirklich:
//   · PostgREST-Grenze: Ohne `.range()` kommen höchstens `maxZeilen` (Standard 1.000) Zeilen zurück,
//     OHNE Fehler. Genau daran sind Export und Auswertungen still gescheitert.
//   · UNIQUE-Regeln (`eindeutig`): Ein doppelter Schlüssel ergibt 23505 wie in Postgres (NULL ist
//     verschieden); `upsert(…, { onConflict, ignoreDuplicates: true })` überspringt still.
//   · Jeder Aufruf ist EINE Anweisung — ein Fehler schreibt nichts (atomar je Anweisung).
//   · Zwischen zwei `await` kann eine zweite Action laufen — gleichzeitige Aufrufe (`Promise.all`)
//     verzahnen sich so wie zwei Anfragen am Server.
//
// Fehler gezielt: `fehlerBei: { "tabelle" | "tabelle:op": "meldung" }` (op = select/insert/update/
// upsert/delete), `fehlerAbSeite: { tabelle: n }` erst ab der n-ten Seite (0-basiert).

type Row = Record<string, unknown>;
type Fehler = { message: string; code?: string; hint?: string } | null;
type Op = "select" | "insert" | "update" | "upsert" | "delete";

export type SpeicherDbInit = {
  tabellen?: Record<string, Row[]>;
  /** Storage: Bucket → Pfad → Inhalt. */
  dateien?: Record<string, Record<string, string | Uint8Array>>;
  fehlerBei?: Record<string, string>;
  fehlerAbSeite?: Record<string, number>;
  /** Zusatz zu `fehlerBei`: `hint` des Fehlers (wie `raise … using hint` in Postgres). */
  fehlerHint?: Record<string, string>;
  /** Fehler nur für bestimmte Abfragen, z. B. (t, op, f) => t === "mieter" && f.includes("eq:id=m2") ? "reset" : null. */
  fehlerWenn?: (tabelle: string, op: Op, filter: string[]) => string | null;
  maxZeilen?: number;
  /**
   * UNIQUE-Regeln je Tabelle, z. B. { einnahmen: [["user_id", "zahlung_ref"]] }. Ein Teil-Index
   * (`… where status = 'angefragt'`) als { spalten, wo }.
   */
  eindeutig?: Record<string, (string[] | { spalten: string[]; wo: (r: Row) => boolean })[]>;
  /** Spalten-Vorgaben beim Einfügen (wie `default` in Postgres), z. B. { auftraege: () => ({ public_token: "t" }) }. */
  vorgaben?: Record<string, () => Row>;
  /** Angemeldetes Konto für `auth.getUser()`. */
  nutzer?: { id: string; email?: string } | null;
  /**
   * Datenbankfunktionen für `client.rpc(name, args)` — laufen auf denselben Tabellen und zwischen zwei
   * `await` am Stück (wie eine Anweisung in Postgres). Fehlt eine, antwortet rpc mit „function not found“.
   */
  rpc?: Record<string, (args: Record<string, unknown>, tabellen: Record<string, Row[]>, nutzerId: string | null) => { data: unknown; error: Fehler }>;
};

let laufendeId = 0;

export function speicherDb(init: SpeicherDbInit = {}) {
  const tabellen: Record<string, Row[]> = init.tabellen ?? {};
  const max = init.maxZeilen ?? 1000;
  const protokoll: { tabelle: string; op: Op; filter: string[]; von?: number; bis?: number }[] = [];
  const seiten: Record<string, number> = {};

  const konflikt = (tabelle: string, neu: Row, ausser?: Row): string[] | null => {
    for (const eintrag of init.eindeutig?.[tabelle] ?? []) {
      const regel = Array.isArray(eintrag) ? eintrag : eintrag.spalten;
      const wo = Array.isArray(eintrag) ? () => true : eintrag.wo;
      if (!wo(neu)) continue;
      if (regel.some((s) => neu[s] == null)) continue; // NULL ist in UNIQUE verschieden
      const da = (tabellen[tabelle] ?? []).some((r) => r !== ausser && wo(r) && regel.every((s) => r[s] === neu[s]));
      if (da) return regel;
    }
    return null;
  };

  function abfrage(tabelle: string) {
    const filter: ((r: Row) => boolean)[] = [];
    const text: string[] = [];
    const ordnung: { spalte: string; auf: boolean }[] = [];
    let von: number | undefined;
    let bis: number | undefined;
    let limit: number | undefined;
    let op: Op = "select";
    let nutzlast: Row[] | Row | null = null;
    let upsertOpt: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let zurueck = false; // `.select()` nach einem Schreibvorgang

    const fehlerFuer = (): Fehler => {
      const m = init.fehlerBei?.[`${tabelle}:${op}`] ?? init.fehlerBei?.[tabelle] ?? init.fehlerWenn?.(tabelle, op, text);
      const hint = init.fehlerHint?.[`${tabelle}:${op}`] ?? init.fehlerHint?.[tabelle];
      return m ? { message: m, ...(hint ? { hint } : {}) } : null;
    };
    const passend = () => (tabellen[tabelle] ?? []).filter((r) => filter.every((f) => f(r)));

    const ausfuehren = (): { data: Row[] | null; error: Fehler; count?: number } => {
      protokoll.push({ tabelle, op, filter: text, von, bis });
      const f = fehlerFuer();
      if (f) return { data: null, error: f };
      tabellen[tabelle] ??= [];

      if (op === "insert" || op === "upsert") {
        const neu = (Array.isArray(nutzlast) ? nutzlast : [nutzlast!]).map((r) => ({ id: `id-${++laufendeId}`, ...init.vorgaben?.[tabelle]?.(), ...r }));
        const ziel = upsertOpt.onConflict?.split(",").map((s) => s.trim());
        const eingefuegt: Row[] = [];
        const puffer: Row[] = [];
        for (const r of neu) {
          const gegen = [...tabellen[tabelle], ...puffer];
          const alt = tabellen[tabelle];
          tabellen[tabelle] = gegen;
          const k = konflikt(tabelle, r);
          tabellen[tabelle] = alt;
          if (k) {
            if (op === "upsert" && upsertOpt.ignoreDuplicates && ziel && k.join(",") === ziel.join(",")) continue;
            return { data: null, error: { message: `duplicate key value violates unique constraint (${k.join(",")})`, code: "23505" } };
          }
          puffer.push(r);
          eingefuegt.push(r);
        }
        tabellen[tabelle].push(...puffer);
        return { data: zurueck ? eingefuegt.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === "update") {
        const treffer = passend();
        const patch = nutzlast as Row;
        for (const r of treffer) {
          const k = konflikt(tabelle, { ...r, ...patch }, r);
          if (k) return { data: null, error: { message: "duplicate key", code: "23505" } };
        }
        for (const r of treffer) Object.assign(r, patch);
        return { data: zurueck ? treffer.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === "delete") {
        const treffer = new Set(passend());
        tabellen[tabelle] = tabellen[tabelle].filter((r) => !treffer.has(r));
        return { data: zurueck ? [...treffer].map((r) => ({ ...r })) : null, error: null };
      }

      if (von !== undefined && init.fehlerAbSeite?.[tabelle] !== undefined) {
        const n = seiten[tabelle] ?? 0;
        seiten[tabelle] = n + 1;
        if (n >= init.fehlerAbSeite[tabelle]) return { data: null, error: { message: `Seite ${n} abgebrochen` } };
      }
      let rows = passend();
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
      select: (_s?: string) => { if (op !== "select") zurueck = true; return k; },
      insert: (r: Row[] | Row) => { op = "insert"; nutzlast = r; return k; },
      upsert: (r: Row[] | Row, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) => { op = "upsert"; nutzlast = r; upsertOpt = o; return k; },
      update: (r: Row) => { op = "update"; nutzlast = r; return k; },
      delete: () => { op = "delete"; return k; },
      eq: (s: string, w: unknown) => { filter.push((r) => r[s] === w); text.push(`eq:${s}=${String(w)}`); return k; },
      neq: (s: string, w: unknown) => { filter.push((r) => r[s] !== w); text.push(`neq:${s}=${String(w)}`); return k; },
      in: (s: string, w: unknown[]) => { filter.push((r) => w.includes(r[s])); text.push(`in:${s}=${w.length}`); return k; },
      gte: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) >= w); text.push(`gte:${s}=${w}`); return k; },
      lte: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) <= w); text.push(`lte:${s}=${w}`); return k; },
      lt: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) < w); text.push(`lt:${s}=${w}`); return k; },
      gt: (s: string, w: string | number) => { filter.push((r) => r[s] != null && (r[s] as string | number) > w); text.push(`gt:${s}=${w}`); return k; },
      is: (s: string, w: null) => { filter.push((r) => r[s] === w || (w === null && r[s] === undefined)); text.push(`is:${s}=null`); return k; },
      ilike: (s: string, muster: string) => {
        const re = new RegExp(`^${muster.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
        filter.push((r) => typeof r[s] === "string" && re.test(r[s] as string)); text.push(`ilike:${s}=${muster}`); return k;
      },
      // PostgREST-Oder in der einfachen Form „spalte.eq.wert,spalte.is.null“.
      or: (ausdruck: string) => {
        const teile = ausdruck.split(",").map((t) => {
          const [spalte, op, ...rest] = t.split(".");
          const wert = rest.join(".");
          return (r: Row) => (op === "is" && wert === "null" ? r[spalte] == null : op === "eq" ? String(r[spalte]) === wert : false);
        });
        filter.push((r) => teile.some((f) => f(r))); text.push(`or:${ausdruck}`); return k;
      },
      not: (s: string, _op: string, _w: null) => { filter.push((r) => r[s] != null); text.push(`not:${s}`); return k; },
      order: (s: string, o: { ascending?: boolean } = {}) => { ordnung.push({ spalte: s, auf: o.ascending !== false }); text.push(`order:${s}`); return k; },
      limit: (n: number) => { limit = n; return k; },
      range: (a: number, b: number) => { von = a; bis = b; return Promise.resolve(ausfuehren()); },
      maybeSingle: () => { const r = ausfuehren(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      single: () => { const r = ausfuehren(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error ?? (r.data?.length ? null : { message: "no rows" }) }); },
      then: (f: (w: ReturnType<typeof ausfuehren>) => unknown, g?: (e: unknown) => unknown) => Promise.resolve().then(ausfuehren).then(f, g),
    };
    return k;
  }

  const nutzer = init.nutzer === undefined ? { id: "nutzer-1", email: "test@example.org" } : init.nutzer;
  const client = {
    from: (tabelle: string) => abfrage(tabelle),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      await Promise.resolve(); // wie ein Netzaufruf: andere Anfragen dürfen sich davor schieben
      if (init.fehlerBei?.[`rpc:${name}`]) return { data: null, error: { message: init.fehlerBei[`rpc:${name}`] } };
      const f = init.rpc?.[name];
      if (!f) return { data: null, error: { message: `function ${name} not found`, code: "PGRST202" } };
      return f(args, tabellen, nutzer?.id ?? null);
    },
    auth: {
      getUser: async () => ({ data: { user: nutzer ? { ...nutzer, factors: [] } : null }, error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (pfad: string, inhalt: Uint8Array | string) => {
          if (init.fehlerBei?.[`storage:${bucket}:upload`]) return { data: null, error: { message: init.fehlerBei[`storage:${bucket}:upload`] } };
          const ablage = ((init.dateien ??= {})[bucket] ??= {});
          if (pfad in ablage) return { data: null, error: { message: "The resource already exists" } };
          ablage[pfad] = typeof inhalt === "string" ? inhalt : new Uint8Array(inhalt);
          return { data: { path: pfad }, error: null };
        },
        remove: async (pfade: string[]) => {
          if (init.fehlerBei?.[`storage:${bucket}:remove`]) return { data: null, error: { message: init.fehlerBei[`storage:${bucket}:remove`] } };
          for (const pf of pfade) delete init.dateien?.[bucket]?.[pf];
          return { data: pfade.map((name) => ({ name })), error: null };
        },
        download: async (pfad: string) => {
          const inhalt = init.dateien?.[bucket]?.[pfad];
          if (inhalt === undefined) return { data: null, error: { message: "Object not found" } };
          const bytes = typeof inhalt === "string" ? new TextEncoder().encode(inhalt) : inhalt;
          return { data: new Blob([new Uint8Array(bytes)]), error: null };
        },
      }),
    },
  };
  return { client, tabellen, protokoll, dateien: () => init.dateien ?? {} };
}
