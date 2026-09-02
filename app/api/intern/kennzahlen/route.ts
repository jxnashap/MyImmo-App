import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { berechneKennzahlen, type KontoRoh } from "@/lib/kennzahlen";
import { istZahlend, type AboStatus } from "@/lib/plan";
import { DEMO_EMAIL } from "@/lib/demo";

// Die fünf Zahlen des Wochenberichts (docs/zukunft/AI-AGENCY-OS.md, 4.3).
// Aufrufer ist der n8n-Wochenbericht (agency/n8n/03-wochenbericht.json) —
// deshalb dieselbe Absicherung wie beim Wert-Refresh-Cron:
// `Authorization: Bearer <CRON_SECRET>` oder `?secret=`.
//
// Warum eine Route und kein Direktzugriff aus n8n: Der Service-Role-Key darf
// die Automatisierung NICHT erreichen — er umgeht RLS und damit alle Mieter-
// und Vermieterdaten. Hier liegt er auf dem Server, n8n bekommt nur Aggregate.
//
// Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// Optional INTERN_AUSSCHLUSS: Komma-Liste eigener/Test-Konten (E-Mail, Domain
// oder Präfix). Demo-Konto und `@example.com` sind immer ausgeschlossen.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STANDARD_AUSSCHLUSS = [DEMO_EMAIL, "@example.com"];

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nicht gesetzt" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const fromQuery = new URL(req.url).searchParams.get("secret") ?? "";
  if (bearer !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY nicht gesetzt" }, { status: 503 });
  }

  // Konten seitenweise holen (listUsers liefert standardmäßig 50 je Seite).
  const konten: KontoRoh[] = [];
  for (let seite = 1; seite <= 20; seite++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: seite, perPage: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const nutzer = data?.users ?? [];
    for (const u of nutzer) {
      konten.push({
        id: u.id,
        email: u.email ?? null,
        erstellt: u.created_at,
        letzterLogin: u.last_sign_in_at ?? null,
      });
    }
    if (nutzer.length < 200) break;
  }

  const [objekte, rollen, abos] = await Promise.all([
    supabase.from("properties").select("user_id"),
    supabase.from("nutzer_rollen").select("user_id"),
    supabase.from("abos").select("status"),
  ]);

  const fehler = objekte.error ?? rollen.error ?? abos.error;
  if (fehler) {
    return NextResponse.json({ error: fehler.message }, { status: 500 });
  }

  const objekteJeKonto: Record<string, number> = {};
  for (const o of (objekte.data ?? []) as { user_id: string }[]) {
    objekteJeKonto[o.user_id] = (objekteJeKonto[o.user_id] ?? 0) + 1;
  }

  const rollenKonten = new Set(
    ((rollen.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
  );

  const aktiveAbos = ((abos.data ?? []) as { status: AboStatus }[]).filter((a) =>
    istZahlend(a.status),
  ).length;

  const zusatz = (process.env.INTERN_AUSSCHLUSS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const kennzahlen = berechneKennzahlen({
    konten,
    objekteJeKonto,
    rollenKonten,
    ausschluss: [...STANDARD_AUSSCHLUSS, ...zusatz],
    aktiveAbos,
  });

  // Besucherzahl bewusst `null` statt 0: nicht gemessen ist etwas anderes als
  // keine Besucher. Sobald @vercel/analytics läuft, wird das hier gefüllt.
  return NextResponse.json({ ...kennzahlen, besucher7t: null });
}
