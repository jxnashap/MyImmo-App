import { vi } from "vitest";

// Prüfstand für Server-Actions (T2 der Start-Checkliste).
//
// AUSGANGSLAGE (04.09.2026): 53 Testdateien, und KEINE EINZIGE hat `lib/actions`
// jemals ausgeführt. `tests/registrierung.test.ts` liest die Action per
// `readFileSync` und sucht Zeichenketten darin — das prüft, dass eine bestimmte
// Schreibweise im Quelltext steht, nicht dass sie funktioniert. Solche Tests
// bleiben grün, wenn die Logik daneben kaputtgeht.
//
// Server-Actions liessen sich bisher nicht ausführen, weil sie drei Dinge
// voraussetzen, die es im Test nicht gibt: `next/cache`, `next/navigation` und
// einen Supabase-Client aus `next/headers`-Cookies. Dieser Prüfstand ersetzt
// genau diese drei — und NICHTS SONST. Die Action selbst läuft unverändert.

/** Ein aufgezeichneter Datenbank-Zugriff. */
export type Zugriff = {
  tabelle: string;
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  /** Bei insert/update/upsert: die geschriebenen Felder. */
  daten?: Record<string, unknown>;
  /** Angehängte Filter, z. B. ["eq:id=abc"]. */
  filter: string[];
};

export type FakeDb = {
  zugriffe: Zugriff[];
  /** Antworten je Tabelle, die `select`-Ketten zurückgeben sollen. */
  antworten: Record<string, unknown>;
  /**
   * Antworten IN REIHENFOLGE — für Actions, die dieselbe Tabelle mehrfach mit
   * unterschiedlicher Erwartung abfragen (z. B. `ibans`: erst Dubletten-
   * prüfung, dann Liste). Wird der Reihe nach abgeräumt; ist die Folge leer,
   * greift `antworten`.
   *
   * Der Schlüssel darf `"tabelle"` ODER `"tabelle:op"` sein (`op` = select /
   * insert / update / delete / upsert). Die genauere Form gewinnt. Das ist
   * kein Luxus: `await …delete().eq(…)` liefert ebenfalls eine Antwort und
   * würde sonst den Eintrag verbrauchen, der für die nachfolgende Abfrage
   * gedacht war — genau darüber ist der erste Entwurf gestolpert.
   */
  antwortFolge: Record<string, unknown[]>;
  /** Werte für `select(..., { count: "exact" })`. */
  zaehler: Record<string, number>;
  /** Fehler, den der nächste Schreibvorgang melden soll. */
  fehler: { message: string; code?: string } | null;
  /** Rückgaben für `rpc(name, …)`. */
  rpc: Record<string, unknown>;
};

/**
 * Supabase-Attrappe, die jeden Zugriff mitschreibt.
 *
 * Bewusst KEIN vollständiger Nachbau des Query-Builders: Jede Kettenmethode
 * gibt dasselbe Objekt zurück und ist `await`-bar. Das genügt, um zu prüfen,
 * WAS eine Action schreiben will — und darum geht es bei Geschäftslogik.
 */
export function fakeSupabase(init: Partial<FakeDb> = {}) {
  const db: FakeDb = {
    zugriffe: [],
    antworten: {},
    antwortFolge: {},
    zaehler: {},
    fehler: null,
    rpc: {},
    ...init,
  };

  const storage: { hochgeladen: string[]; entfernt: string[] } = { hochgeladen: [], entfernt: [] };

  function kette(tabelle: string) {
    const z: Zugriff = { tabelle, op: "select", filter: [] };
    db.zugriffe.push(z);

    const antwort = () => {
      const genau = db.antwortFolge[`${tabelle}:${z.op}`];
      const grob = db.antwortFolge[tabelle];
      const folge = genau && genau.length > 0 ? genau : grob;
      const data = folge && folge.length > 0 ? folge.shift() : (db.antworten[tabelle] ?? null);
      return { data: data ?? null, error: db.fehler, count: db.zaehler[tabelle] };
    };

    const k: Record<string, unknown> = {};
    // Schreiboperationen merken sich die Nutzlast.
    for (const op of ["insert", "update", "upsert", "delete"] as const) {
      k[op] = (daten?: Record<string, unknown>) => {
        z.op = op;
        if (daten) z.daten = daten;
        return k;
      };
    }
    k.select = (..._a: unknown[]) => k;
    // Filter/Modifier protokollieren, damit Tests prüfen können, ob eine
    // Action z. B. wirklich auf die eigene user_id einschränkt.
    for (const m of ["eq", "neq", "in", "gte", "lte", "gt", "lt", "is", "not", "order", "limit", "range"] as const) {
      k[m] = (a?: unknown, b?: unknown) => {
        z.filter.push(b === undefined ? `${m}:${String(a)}` : `${m}:${String(a)}=${String(b)}`);
        return k;
      };
    }
    k.single = async () => antwort();
    k.maybeSingle = async () => antwort();
    // `await supabase.from(...).insert(...)` ohne Kettenende muss auch gehen.
    k.then = (aufloesen: (w: unknown) => unknown) => Promise.resolve(antwort()).then(aufloesen);
    return k;
  }

  const client = {
    from: (tabelle: string) => kette(tabelle),
    rpc: async (name: string, _args?: unknown) => {
      db.zugriffe.push({ tabelle: `rpc:${name}`, op: "rpc", filter: [] });
      return { data: db.rpc[name] ?? null, error: db.fehler };
    },
    auth: {
      getUser: async () => ({ data: { user: { id: "nutzer-1", email: "test@example.org" } } }),
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (pfad: string) => {
          storage.hochgeladen.push(pfad);
          return { error: db.fehler };
        },
        remove: async (pfade: string[]) => {
          storage.entfernt.push(...pfade);
          return { error: null };
        },
      }),
    },
  };

  return { db, client, storage };
}

/** Wird von der `redirect`-Attrappe geworfen — wie in Next auch. */
export class RedirectSignal extends Error {
  constructor(public ziel: string) {
    super(`NEXT_REDIRECT ${ziel}`);
  }
}

export type NextSpuren = { revalidiert: string[]; redirects: string[] };

/**
 * Ersetzt `next/cache`, `next/navigation` und die Supabase-Clients.
 *
 * WICHTIG — `redirect` WIRFT hier, so wie in Next auch. Ein stiller No-op wäre
 * bequemer, würde aber den Kontrollfluss verfälschen: Code nach einem
 * `redirect()` liefe im Test weiter, in Produktion nie. Genau solche
 * Unterschiede lassen Tests grün bleiben, während die App etwas anderes tut.
 */
export function mockeNextUndSupabase(supabase: unknown, admin: unknown = supabase) {
  const spuren: NextSpuren = { revalidiert: [], redirects: [] };

  vi.doMock("next/cache", () => ({
    revalidatePath: (p: string) => {
      spuren.revalidiert.push(p);
    },
    revalidateTag: (t: string) => {
      spuren.revalidiert.push(`tag:${t}`);
    },
  }));

  vi.doMock("next/navigation", () => ({
    redirect: (ziel: string) => {
      spuren.redirects.push(ziel);
      throw new RedirectSignal(ziel);
    },
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  }));

  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));

  return spuren;
}

/**
 * Führt etwas aus, das per `redirect()` endet, und liefert das Ziel.
 * Wirft weiter, wenn ein ANDERER Fehler kam — sonst würde ein echter Absturz
 * als erfolgreicher Redirect durchgehen.
 */
export async function fangeRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof RedirectSignal) return e.ziel;
    throw e;
  }
  throw new Error("Es wurde kein redirect() ausgelöst, obwohl eines erwartet war.");
}

/** FormData aus einem einfachen Objekt (undefined-Werte werden ausgelassen). */
export function fd(werte: Record<string, string | File | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(werte)) if (v !== undefined) f.append(k, v);
  return f;
}
