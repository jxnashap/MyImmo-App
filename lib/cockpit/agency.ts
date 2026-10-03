import "server-only";

// Die Agency-Seite des Cockpits: Monatsausgaben gegen den Deckel, offene
// Vorgänge, letzte Audit-Urteile.
//
// Liest das EIGENE Agency-Supabase-Projekt (nicht die Produktionsdatenbank —
// Begründung in agency/README.md) über die `public.agency_*`-Funktionen, die
// nur `service_role` ausführen darf.
//
// Env: `AGENCY_SUPABASE_URL`, `AGENCY_SUPABASE_SERVICE_KEY`.
// Ohne beide bleibt die Karte leer und sagt, was zu tun ist — sie erfindet
// keine Nullwerte.

const ZEITLIMIT_MS = 6000;

export type AgencyBudget = {
  deckel_usd: number;
  ausgaben_monat_usd: number;
  rest_usd: number;
  budget_ok: boolean;
  laeufe_monat: number;
};

export type AgencyVorgang = {
  nr: number;
  titel: string;
  status: string;
  risiko: string;
  erstellt: string;
};

export type AgencyLage =
  | { verbunden: false; grund: string }
  | {
      verbunden: true;
      budget: AgencyBudget | null;
      offeneVorgaenge: AgencyVorgang[];
      abgelaufenesWissen: { typ: string; titel: string; gilt_bis: string }[];
    };

async function rpc<T>(name: string): Promise<T | null> {
  const url = process.env.AGENCY_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.AGENCY_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function ladeAgency(): Promise<AgencyLage> {
  if (!process.env.AGENCY_SUPABASE_URL?.trim() || !process.env.AGENCY_SUPABASE_SERVICE_KEY?.trim()) {
    return { verbunden: false, grund: "AGENCY_SUPABASE_URL / AGENCY_SUPABASE_SERVICE_KEY nicht gesetzt" };
  }

  type Kontext = {
    ok?: boolean;
    budget?: AgencyBudget & { ok?: boolean };
    offene_vorgaenge?: AgencyVorgang[];
    abgelaufenes_wissen?: { typ: string; titel: string; gilt_bis: string }[];
  };

  const k = await rpc<Kontext>("agency_kontext");
  if (!k) return { verbunden: false, grund: "Agency-Datenbank nicht erreichbar (Schema eingespielt?)" };

  return {
    verbunden: true,
    budget: k.budget
      ? {
          deckel_usd: Number(k.budget.deckel_usd ?? 0),
          ausgaben_monat_usd: Number(k.budget.ausgaben_monat_usd ?? 0),
          rest_usd: Number(k.budget.rest_usd ?? 0),
          budget_ok: Boolean(k.budget.budget_ok),
          laeufe_monat: Number(k.budget.laeufe_monat ?? 0),
        }
      : null,
    offeneVorgaenge: k.offene_vorgaenge ?? [],
    abgelaufenesWissen: k.abgelaufenes_wissen ?? [],
  };
}

/**
 * Anteil des verbrauchten Monatsbudgets, 0–1 — für den Balken.
 *
 * Deckel 0 heißt „gesperrt, bis eine Zahl entschieden ist“ (so wird das Schema
 * ausgeliefert). Das ist VOLL, nicht leer: sonst sieht ein gesperrtes Budget
 * aus wie ein unberührtes.
 */
export function budgetAnteil(b: Pick<AgencyBudget, "deckel_usd" | "ausgaben_monat_usd">): number {
  if (!(b.deckel_usd > 0)) return 1;
  return Math.min(1, Math.max(0, b.ausgaben_monat_usd / b.deckel_usd));
}
