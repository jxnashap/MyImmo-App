import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { berechneKennzahlen, type Kennzahlen, type KontoRoh } from "@/lib/kennzahlen";
import { istZahlend, type AboStatus } from "@/lib/plan";

// EINE Stelle, die den Trichter lädt — benutzt von `/api/intern/kennzahlen`
// (für den n8n-Wochenbericht) UND vom Betreiber-Cockpit. Zwei Ladewege
// hätten früher oder später zwei verschiedene Zahlen geliefert.
//
// Braucht den Service-Role-Key (liest die Kontenliste) → nur in geschützten
// Server-Kontexten aufrufen: die Cron-geschützte Route und die
// Betreiber-Seite. Heraus kommen ausschließlich Aggregate, nie eine Adresse.
//
// **Ausschluss `@myimmo.test`, nicht nur die eine Demo-Adresse:** Seit dem
// 01.10.2026 gibt es Demo-Konten für Mieter und drei Dienstleister unter
// derselben Domain. Wer nur `demo.vermieter@…` ausschließt, zählt die anderen
// als Kunden.

const STANDARD_AUSSCHLUSS = ["@myimmo.test", "@example.com"];

export type TrichterErgebnis =
  | { ok: false; fehler: string }
  | { ok: true; kennzahlen: Kennzahlen & { besucher7t: null } };

export async function ladeTrichter(): Promise<TrichterErgebnis> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, fehler: "SUPABASE_SERVICE_ROLE_KEY nicht gesetzt" };

  const konten: KontoRoh[] = [];
  for (let seite = 1; seite <= 20; seite++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: seite, perPage: 200 });
    if (error) return { ok: false, fehler: error.message };
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

  const [objekte, mieter, einnahmen, kosten, rollen, abos] = await Promise.all([
    supabase.from("properties").select("user_id"),
    supabase.from("mieter").select("user_id"),
    supabase.from("einnahmen").select("user_id"),
    supabase.from("kosten").select("user_id"),
    supabase.from("nutzer_rollen").select("user_id"),
    supabase.from("abos").select("status"),
  ]);

  const fehler =
    objekte.error ?? mieter.error ?? einnahmen.error ?? kosten.error ?? rollen.error ?? abos.error;
  if (fehler) return { ok: false, fehler: fehler.message };

  const zaehle = (rows: { user_id: string }[] | null, ziel: Record<string, number>) => {
    for (const r of rows ?? []) ziel[r.user_id] = (ziel[r.user_id] ?? 0) + 1;
    return ziel;
  };

  const objekteJeKonto = zaehle(objekte.data as { user_id: string }[], {});
  const mieterJeKonto = zaehle(mieter.data as { user_id: string }[], {});
  const buchungenJeKonto = zaehle(kosten.data as { user_id: string }[], zaehle(einnahmen.data as { user_id: string }[], {}));

  const rollenKonten = new Set(((rollen.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const aktiveAbos = ((abos.data ?? []) as { status: AboStatus }[]).filter((a) => istZahlend(a.status)).length;

  const zusatz = (process.env.INTERN_AUSSCHLUSS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const kennzahlen = berechneKennzahlen({
    konten,
    objekteJeKonto,
    mieterJeKonto,
    buchungenJeKonto,
    rollenKonten,
    ausschluss: [...STANDARD_AUSSCHLUSS, ...zusatz],
    aktiveAbos,
  });

  // Bewusst `null`, nicht 0: nicht gemessen ist etwas anderes als keine Besucher.
  return { ok: true, kennzahlen: { ...kennzahlen, besucher7t: null } };
}
