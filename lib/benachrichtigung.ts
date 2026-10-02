import "server-only";

// E-Mail-Benachrichtigungen im Mieterportal (02.10.2026, Schritt 3 aus
// docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
//
// GRUNDSATZ: Die Mail sagt nur, DASS etwas bereitliegt — nie WAS. Kein Titel, kein
// Inhalt, kein Anhang. Eine Schadensmeldung „Schimmel im Bad“ oder eine NK-Abrechnung hat
// in einem Postfach nichts zu suchen, und geht eine Mail trotz Adress-Bindung an die
// falsche Person, erfährt sie nichts.
//
// BESTE MÜHE: Eine Benachrichtigung darf die eigentliche Handlung nie scheitern lassen.
// Fehlt Brevo, ist die Mail abbestellt oder gebremst, passiert still nichts (mit Grund
// als Rückgabe, für Tests und Logs). Die Zustellung selbst steht in der Datenbank.
//
// BREMSE: höchstens eine Mail je Empfänger, Art und Bezug in 10 Minuten — fünf
// Nachrichten hintereinander im selben Vorgang ergeben eine Mail, nicht fünf.
import { brevoBereit, sendeMail } from "@/lib/mail/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { darfWeiter } from "@/lib/net/bremse";
import { basisUrl } from "@/lib/net/basisUrl";
import { istDemoKonto } from "@/lib/demo";

export type BenachrichtigungsArt =
  | "dokument" // Vermieter → Mieter: Dokument zugestellt
  | "nachricht_an_mieter" // Vermieter hat im Vorgang geschrieben
  | "termine" // Vermieter schlägt Termine vor
  | "anfrage" // Vermieter bittet um etwas (vermieter_anfragen)
  | "anliegen_neu" // Mieter → Vermieter: neues Anliegen
  | "nachricht_an_vermieter" // Mieter hat im Vorgang geschrieben
  | "termin_bestaetigt"; // Mieter hat einen Termin gewählt

const AN_MIETER = new Set<BenachrichtigungsArt>(["dokument", "nachricht_an_mieter", "termine", "anfrage"]);

const WAS: Record<BenachrichtigungsArt, string> = {
  dokument: "Dein Vermieter hat dir ein Dokument bereitgestellt.",
  nachricht_an_mieter: "Dein Vermieter hat dir zu einem Anliegen geschrieben.",
  termine: "Dein Vermieter schlägt Termine vor — bitte wähle einen aus.",
  anfrage: "Dein Vermieter bittet dich um etwas.",
  anliegen_neu: "Ein Mieter hat ein neues Anliegen gemeldet.",
  nachricht_an_vermieter: "Ein Mieter hat dir zu einem Anliegen geschrieben.",
  termin_bestaetigt: "Ein Mieter hat einen Termin bestätigt.",
};

export const BREMSE_SEKUNDEN = 600;

/** Die Mail selbst — rein, ohne Netz, damit prüfbar, dass nichts Inhaltliches hineingerät. */
export function benachrichtigungsMail(art: BenachrichtigungsArt, basis: string): { betreff: string; text: string; html: string } {
  const mieter = AN_MIETER.has(art);
  const link = `${basis}${mieter ? "/portal" : "/anliegen"}`;
  const betreff = mieter ? "Neues in deinem Mieterportal" : "Neues im Mieterportal deiner Immobilien";
  const was = WAS[art];
  const einstellung = mieter ? "Konto → Benachrichtigungen" : "Einstellungen → Sicherheit → Benachrichtigungen";
  const text = [
    "Hallo,", "", was, "", `Ansehen: ${link}`, "",
    "Aus Datenschutzgründen steht der Inhalt nur im Portal, nicht in dieser E-Mail.",
    `Diese Hinweise lassen sich unter ${einstellung} abschalten.`, "",
    "MyImmo — Privates Immobilien-Management",
  ].join("\n");
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#23211c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e1d4;border-radius:12px;padding:26px">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;margin-bottom:18px">My<span style="color:#b8902b;font-style:italic">Immo</span></div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px">${was}</p>
    <p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;background:#b8902b;color:#1a1a17;text-decoration:none;font-weight:bold;font-size:15px;padding:11px 20px;border-radius:8px">Im Portal ansehen</a></p>
    <p style="font-size:12.5px;line-height:1.6;color:#9b968a;margin:0;border-top:1px solid #e7e1d4;padding-top:12px">
      Aus Datenschutzgründen steht der Inhalt nur im Portal, nicht in dieser E-Mail.<br>
      Abschalten: ${einstellung}.
    </p>
  </div>
</body></html>`;
  return { betreff, text, html };
}

export type Ergebnis = "gesendet" | "kein_versand" | "kein_konto" | "abbestellt" | "demo" | "gebremst" | "fehler";

/**
 * Benachrichtigt ein Konto. Die Adresse kommt aus dem Auth-Konto (Service-Role), nie vom
 * Aufrufer — so kann keine Action eine fremde Adresse einschleusen.
 */
export async function benachrichtige(userId: string | null | undefined, art: BenachrichtigungsArt, bezug: string): Promise<Ergebnis> {
  try {
    if (!userId) return "kein_konto";
    if (!brevoBereit()) return "kein_versand";
    const admin = createAdminClient();
    if (!admin) return "kein_versand";
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const user = data?.user;
    if (error || !user?.email) return "kein_konto";
    if (istDemoKonto(user.email)) return "demo";
    if (user.user_metadata?.benachrichtigungen_aus === true) return "abbestellt";
    if (!(await darfWeiter("benachrichtigung", 1, BREMSE_SEKUNDEN, `${userId}:${art}:${bezug}`))) return "gebremst";
    const mail = benachrichtigungsMail(art, await basisUrl());
    return (await sendeMail({ an: user.email, ...mail })) ? "gesendet" : "fehler";
  } catch (e) {
    console.error("benachrichtige:", e instanceof Error ? e.message : "unbekannt");
    return "fehler";
  }
}
