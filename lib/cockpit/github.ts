import "server-only";
import type { Ampel } from "./typen";

// Prüfläufe und offene Pull Requests — damit „gemergt“ nicht mit „grün“
// verwechselt wird. Genau dieser Fall ist am 02.10.2026 passiert: `main` war
// fünf Pushes lang rot, weil GitHub den Merge trotz roter CI zulässt.
//
// Env: `GITHUB_TOKEN` (Fine-grained, nur Lesezugriff auf dieses Repo),
// optional `GITHUB_REPO` (Standard `jxnashap/myimmo-app`).
// Ohne Token wird NICHT geraten — die Karte sagt „nicht verbunden“.

const REPO = process.env.GITHUB_REPO?.trim() || "jxnashap/myimmo-app";
const ZEITLIMIT_MS = 6000;

export type GithubLage =
  | { verbunden: false; grund: string }
  | {
      verbunden: true;
      zweig: string;
      commit: { sha: string; titel: string; am: string | null } | null;
      pruefungen: { name: string; ergebnis: string | null; laeuft: boolean }[];
      offenePrs: { nr: number; titel: string; aktualisiert: string }[];
    };

async function hole<T>(pfad: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${pfad}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Netzfehler, Zeitüberschreitung, 403 vom Proxy — die Karte sagt dann
    // „nicht erreichbar“. Ein Cockpit darf an einer fremden API nicht scheitern.
    return null;
  }
}

export async function ladeGithub(): Promise<GithubLage> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return { verbunden: false, grund: "GITHUB_TOKEN nicht gesetzt" };

  type Commit = { sha: string; commit: { message: string; committer?: { date?: string } } };
  type Checks = { check_runs: { name: string; status: string; conclusion: string | null }[] };
  type Pr = { number: number; title: string; updated_at: string; draft: boolean };

  const [commit, checks, prs] = await Promise.all([
    hole<Commit>(`/repos/${REPO}/commits/main`, token),
    hole<Checks>(`/repos/${REPO}/commits/main/check-runs?per_page=20`, token),
    hole<Pr[]>(`/repos/${REPO}/pulls?state=open&per_page=10&sort=updated&direction=desc`, token),
  ]);

  if (!commit && !checks && !prs) {
    return { verbunden: false, grund: "GitHub nicht erreichbar (Token gültig? Rechte?)" };
  }

  return {
    verbunden: true,
    zweig: "main",
    commit: commit
      ? {
          sha: commit.sha.slice(0, 7),
          titel: commit.commit.message.split("\n")[0],
          am: commit.commit.committer?.date ?? null,
        }
      : null,
    pruefungen: (checks?.check_runs ?? []).map((c) => ({
      name: c.name,
      ergebnis: c.conclusion,
      laeuft: c.status !== "completed",
    })),
    offenePrs: (prs ?? [])
      .filter((p) => !p.draft)
      .map((p) => ({ nr: p.number, titel: p.title, aktualisiert: p.updated_at })),
  };
}

/** Ampel für die Prüfläufe: rot schlägt laufend schlägt grün. */
export function pruefAmpel(
  pruefungen: { ergebnis: string | null; laeuft: boolean }[],
): Ampel {
  if (pruefungen.length === 0) return "unbekannt";
  // Ein roter Prüflauf auf main ist nicht „offen“, sondern kaputt.
  if (pruefungen.some((p) => p.ergebnis === "failure" || p.ergebnis === "timed_out")) return "kritisch";
  if (pruefungen.some((p) => p.laeuft)) return "warnung";
  if (pruefungen.every((p) => p.ergebnis === "success" || p.ergebnis === "neutral" || p.ergebnis === "skipped")) return "ok";
  return "unbekannt";
}
