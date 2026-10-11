"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kuendigeSubscription, paddleKonfiguriert } from "@/lib/billing/paddle";
import { pruefeFrischeAnmeldung, REAUTH_MELDUNG } from "@/lib/auth/frisch";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDemoKonto } from "@/lib/demo";

// DSGVO Art. 17: löscht das eigene Konto samt aller Daten über die
// SECURITY-DEFINER-Funktion konto_loeschen() (nur Service-Role) und meldet danach ab.
//
// Security-Review-Fix (24.07.2026): Vor der Löschung wird ein laufendes
// Paddle-Abo SOFORT gekündigt — sonst würde Paddle nach der Kontolöschung
// weiter abbuchen, ohne dass der Kunde in der App noch kündigen könnte.
// Schlägt die Kündigung fehl, wird die Löschung abgebrochen (kein stilles
// Weiterlaufen von Zahlungen).
export type LoeschSchritt = "abo" | "dateien" | "daten" | "pruefung";
export type SchrittStand = "erledigt" | "entfaellt" | "fehler" | "offen";
export type LoeschErgebnis = {
  ok: false;
  fehler: string;
  reauth?: boolean;
  /** B02 (11.10.2026): Stand je Schritt — ein Teilfehler wird nie als vollständige Löschung gemeldet. */
  schritte?: Record<LoeschSchritt, SchrittStand>;
};

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
 * B02 (11.10.2026): Die Datenbereinigung (`konto_loeschen`) ist NUR noch für die Service-Role
 * ausführbar — vorher ließ sich `delete_own_account()` per REST direkt aufrufen, an Frische,
 * Abo-Kündigung und Datei-Löschung vorbei. Reihenfolge, jeder Schritt wiederholbar:
 *   1. Abo kündigen (und lokal als gekündigt vermerken — ein zweiter Versuch fragt Paddle nicht neu)
 *   2. Beleg-Dateien löschen
 *   3. Daten + Konto löschen (`konto_loeschen` über die Service-Role, mit der Konto-ID der SITZUNG)
 *   4. Nachprüfen: Konto weg? Ordner leer? (zweiter Datei-Durchgang über die Service-Role)
 * Scheitert 1–3, bleibt das Konto bestehen und die Meldung nennt den Schritt.
 *
 * Im Erfolgsfall wird weiterhin umgeleitet (die Funktion kehrt dann nicht zurück).
 */
export async function deleteAccount(): Promise<LoeschErgebnis | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (istDemoKonto(user.email)) return { ok: false, fehler: "Das Demo-Konto kann nicht gelöscht werden." };

  const schritte: Record<LoeschSchritt, SchrittStand> = { abo: "offen", dateien: "offen", daten: "offen", pruefung: "offen" };
  const abbruch = (schritt: LoeschSchritt, fehler: string): LoeschErgebnis => {
    schritte[schritt] = "fehler";
    return { ok: false, fehler, schritte: { ...schritte } };
  };

  // Frische Anmeldung verlangen (08.09.2026): Eine offene Sitzung auf einem
  // fremden Rechner darf kein Konto löschen. Der Dialog in der Oberfläche
  // holt Passwort oder 2FA-Code nach und ruft erneut auf.
  const frisch = await pruefeFrischeAnmeldung(supabase);
  if (!frisch.ok) return { ok: false, fehler: REAUTH_MELDUNG, reauth: true };

  // Ohne Service-Role keine Löschung — der Weg über die Nutzer-Sitzung ist an der Datenbank zu.
  const admin = createAdminClient();
  if (!admin) return { ok: false, fehler: "Die Kontolöschung ist gerade nicht möglich — das Konto wurde NICHT gelöscht. Bitte später erneut versuchen." };

  // Der Abfragefehler MUSS ausgewertet werden: Käme die Abo-Zeile wegen eines
  // Fehlers leer zurück, gälte „kein laufendes Abo" — das Konto würde gelöscht
  // und Paddle buchte weiter ab, ohne dass der Kunde noch kündigen könnte.
  // Genau das, was der Kommentar oben ausschließen will.
  const { data: abo, error: aboFehler } = await supabase
    .from("abos")
    .select("provider_subscription_id,status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (aboFehler) {
    return abbruch("abo", "Der Abo-Status konnte nicht geprüft werden — das Konto wurde NICHT gelöscht. Bitte erneut versuchen.");
  }
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
      return abbruch("abo", nurPortal
        ? "Dein laufendes Abo konnte nicht automatisch gekündigt werden. " +
          "Bitte melde dich bei info@myimmoapp.de — wir kündigen es und löschen dein Konto."
        : "Dein laufendes Abo konnte nicht automatisch gekündigt werden. " +
          "Bitte kündige es zuerst unter Einstellungen → Abo (Zahlung & Kündigung verwalten) " +
          "oder melde dich beim Support — danach kannst du das Konto löschen.");
    }
    // Vermerken: Scheitert ein späterer Schritt, fragt der nächste Versuch Paddle nicht erneut
    // (eine zweite Kündigung derselben Subscription lehnt Paddle ab und blockierte die Löschung).
    // Scheitert der Vermerk, geht es trotzdem weiter: Die Kündigung bei Paddle ist erfolgt, und die
    // Abo-Zeile verschwindet mit dem Konto. Nur ein späterer Wiederholungsversuch fragte Paddle erneut.
    const { error: vermerkFehler } = await admin.from("abos").update({ status: "gekuendigt" }).eq("user_id", user.id);
    if (vermerkFehler) console.warn("[kontoloeschung] Abo gekündigt, Vermerk nicht gespeichert");
    schritte.abo = "erledigt";
  } else {
    schritte.abo = "entfaellt";
  }

  // Beleg-Dateien im Storage-Bucket „belege“ (Pfad `<uid>/…`) erreicht die Datenbank-Funktion
  // nicht — sie lagen nach einer Kontolöschung weiter dort (gefunden 06.10.2026 beim
  // Überarbeiten des AVV, der ihre Löschung zusagt). Erst die Dateien, dann das Konto:
  // Scheitert das Löschen der Dateien, bleibt das Konto bestehen und der Nutzer kann es
  // erneut versuchen — umgekehrt blieben verwaiste Dateien ohne Konto zurück.
  if (!(await loescheEigeneBelege(supabase, user.id))) {
    return abbruch("dateien", "Deine Beleg-Dateien konnten nicht gelöscht werden — das Konto wurde NICHT gelöscht. Bitte erneut versuchen.");
  }
  schritte.dateien = "erledigt";

  // Konto-ID aus der geprüften SITZUNG, nie aus einer Eingabe.
  const { error } = await admin.rpc("konto_loeschen", { p_user: user.id });
  if (error) {
    return abbruch("daten", "Deine Daten konnten nicht gelöscht werden — das Konto besteht weiter. Bitte erneut versuchen.");
  }
  schritte.daten = "erledigt";

  // Nachprüfen statt annehmen: Ist das Konto weg? Zweiter Datei-Durchgang über die Service-Role —
  // eine Datei, die zwischen Schritt 2 und 3 aus einer anderen Sitzung kam, bliebe sonst liegen.
  const { data: nochDa } = await admin.auth.admin.getUserById(user.id);
  if (nochDa?.user) {
    return abbruch("pruefung", "Die Löschung ist nicht vollständig durchgelaufen — dein Konto besteht noch. Bitte erneut versuchen.");
  }
  const restFrei = await loescheEigeneBelege(admin, user.id);

  // Session beenden (Cookies löschen) und zur Login-Seite.
  await supabase.auth.signOut({ scope: "local" });
  redirect(restFrei ? "/login?geloescht=1" : "/login?geloescht=rest");
}

const BELEG_BUCKET = "belege";
const STAPEL = 100;
/** Höchstens so viele Durchgänge — schützt vor einer Endlosschleife, falls Dateien nicht verschwinden. */
const MAX_DURCHGAENGE = 200;

/** Entfernt alle Dateien unter `<uid>/` im Beleg-Bucket. `false` bei jedem Fehler. */
async function loescheEigeneBelege(
  supabase: Pick<Awaited<ReturnType<typeof createClient>>, "storage">,
  uid: string,
): Promise<boolean> {
  const bucket = supabase.storage.from(BELEG_BUCKET);
  for (let i = 0; i < MAX_DURCHGAENGE; i++) {
    const { data, error } = await bucket.list(uid, { limit: STAPEL, offset: 0 });
    if (error || !data) return false;
    if (data.length === 0) return true;
    const { error: entfernFehler } = await bucket.remove(data.map((d) => `${uid}/${d.name}`));
    if (entfernFehler) return false;
  }
  return false;
}
