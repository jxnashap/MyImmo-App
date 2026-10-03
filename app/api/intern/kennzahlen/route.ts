import { NextResponse } from "next/server";
import { ladeTrichter } from "@/lib/cockpit/trichter";
import { bearerStimmt } from "@/lib/net/geheimnis";

// Die fünf Zahlen des Wochenberichts (docs/zukunft/AI-AGENCY-OS.md, 4.3).
// Aufrufer ist der n8n-Wochenbericht (agency/n8n/03-wochenbericht.json) —
// deshalb dieselbe Absicherung wie beim Wert-Refresh-Cron:
// `Authorization: Bearer <CRON_SECRET>`, NUR im Header. Ein `?secret=` in der
// URL landet in den Vercel-Zugriffslogs (aus der Cron-Route am 08.09.2026
// entfernt) — nicht wieder einbauen.
//
// Warum eine Route und kein Direktzugriff aus n8n: Der Service-Role-Key darf
// die Automatisierung NICHT erreichen — er umgeht RLS und damit alle Mieter-
// und Vermieterdaten. Hier liegt er auf dem Server, n8n bekommt nur Aggregate.
//
// Gerechnet wird in `lib/cockpit/trichter.ts` — dieselbe Stelle, aus der das
// Betreiber-Cockpit liest. Zwei Ladewege lieferten sonst zwei Wahrheiten.
//
// Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// Optional INTERN_AUSSCHLUSS: Komma-Liste eigener/Test-Konten (E-Mail, Domain
// oder Präfix). Demo-Konten (@myimmo.test) und `@example.com` sind immer aus.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  if (!bearerStimmt(req, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const erg = await ladeTrichter();
  if (!erg.ok) {
    const code = erg.fehler.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ error: erg.fehler }, { status: code });
  }
  return NextResponse.json(erg.kennzahlen);
}
