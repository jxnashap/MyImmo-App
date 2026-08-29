"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kuendigeSubscription, paddleKonfiguriert } from "@/lib/billing/paddle";

// DSGVO Art. 17: löscht das eigene Konto samt aller Daten über die
// SECURITY-DEFINER-Funktion delete_own_account() und meldet danach ab.
//
// Security-Review-Fix (24.07.2026): Vor der Löschung wird ein laufendes
// Paddle-Abo SOFORT gekündigt — sonst würde Paddle nach der Kontolöschung
// weiter abbuchen, ohne dass der Kunde in der App noch kündigen könnte.
// Schlägt die Kündigung fehl, wird die Löschung abgebrochen (kein stilles
// Weiterlaufen von Zahlungen).
export type LoeschErgebnis = { ok: false; fehler: string };

/**
 * Löscht das eigene Konto.
 *
 * Gibt bei einem Problem `{ ok: false, fehler }` ZURÜCK, statt zu werfen.
 * Vorher warf die Action einen `Error` mit ausführlichem Text — aus einem
 * `<form action={…}>` heraus redigiert Next.js die Meldung in Produktion aber
 * zu „An error occurred in the Server Components render", und der Nutzer landet
 * auf `app/error.tsx`. Wer sein Konto löschen wollte, sah also eine allgemeine
 * Fehlerseite und erfuhr nie, dass zuerst das Abo gekündigt werden muss.
 *
 * Im Erfolgsfall wird weiterhin umgeleitet (die Funktion kehrt dann nicht zurück).
 */
export async function deleteAccount(): Promise<LoeschErgebnis | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: abo } = await supabase
    .from("abos")
    .select("provider_subscription_id,status")
    .maybeSingle();
  const sub = (abo as { provider_subscription_id: string | null; status: string } | null);
  const laufend =
    !!sub?.provider_subscription_id &&
    ["aktiv", "testphase", "ueberfaellig", "pausiert"].includes(sub.status);

  if (laufend) {
    const gekuendigt = paddleKonfiguriert() && (await kuendigeSubscription(sub!.provider_subscription_id!));
    if (!gekuendigt) {
      // Rollengerecht: Mieter- und Service-Konten kommen gar nicht auf
      // /einstellungen (das Layout leitet sie um) — ein Verweis dorthin waere
      // eine Anweisung, die sie nicht ausfuehren koennen.
      const { data: rolleRow } = await supabase
        .from("nutzer_rollen").select("rolle").eq("user_id", user.id).maybeSingle();
      const nurPortal = rolleRow?.rolle === "mieter" || rolleRow?.rolle === "service";
      return {
        ok: false,
        fehler: nurPortal
          ? "Dein laufendes Abo konnte nicht automatisch gekündigt werden. " +
            "Bitte melde dich bei info@myimmoapp.de — wir kündigen es und löschen dein Konto."
          : "Dein laufendes Abo konnte nicht automatisch gekündigt werden. " +
            "Bitte kündige es zuerst unter Einstellungen → Abo (Zahlung & Kündigung verwalten) " +
            "oder melde dich beim Support — danach kannst du das Konto löschen.",
      };
    }
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { ok: false, fehler: "Konto konnte nicht gelöscht werden: " + error.message };
  }

  // Session beenden (Cookies löschen) und zur Login-Seite.
  await supabase.auth.signOut();
  redirect("/login?geloescht=1");
}
