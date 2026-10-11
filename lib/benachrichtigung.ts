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
// EIN AUFTRAG JE ANLASS (Ablauf F, 11.10.2026): Jede Mail ist ein dauerhafter Schritt in
// `aussen_auftraege` (lib/aussenAuftrag.ts) — Schlüssel, Zustand, Versuche, Fehlergrund. Derselbe Anlass
// zweimal (Doppelklick, Zeitüberlauf, Neustart) ergibt keine zweite Mail; ein fehlgeschlagener Versand wird
// bis zu dreimal wiederholt (Cron `/api/cron/aussen-auftraege`), statt verloren zu gehen. Vorher zählte die
// 10-Minuten-Bremse auch den Fehlschlag, und es gab nie einen zweiten Versuch.
// Einmalige Anlässe (ein Dokument, ein neues Anliegen, eine Mitteilung) haben den Bezug als Schlüssel;
// wiederkehrende (Nachrichten, Terminvorschläge, Anfragen) bekommen zusätzlich ein 10-Minuten-Fenster —
// fünf Nachrichten hintereinander im selben Vorgang ergeben eine Mail, nicht fünf (wie die alte Bremse).
import { brevoBereit, sendeMail } from "@/lib/mail/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { basisUrl } from "@/lib/net/basisUrl";
import { istDemoKonto } from "@/lib/demo";
import { fuehreAus, type AussenErgebnis, type Lauf } from "@/lib/aussenAuftrag";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BenachrichtigungsArt =
  | "dokument" // Vermieter → Mieter: Dokument zugestellt
  | "nachricht_an_mieter" // Vermieter hat im Vorgang geschrieben
  | "termine" // Vermieter schlägt Termine vor
  | "anfrage" // Vermieter bittet um etwas (vermieter_anfragen)
  | "mitteilung" // Vermieter an das Haus / alle Mieter
  | "anliegen_neu" // Mieter → Vermieter: neues Anliegen
  | "nachricht_an_vermieter" // Mieter hat im Vorgang geschrieben
  | "termin_bestaetigt"; // Mieter hat einen Termin gewählt

const AN_MIETER = new Set<BenachrichtigungsArt>(["dokument", "nachricht_an_mieter", "termine", "anfrage", "mitteilung"]);

const WAS: Record<BenachrichtigungsArt, string> = {
  dokument: "Dein Vermieter hat dir ein Dokument bereitgestellt.",
  nachricht_an_mieter: "Dein Vermieter hat dir zu einem Anliegen geschrieben.",
  termine: "Dein Vermieter schlägt Termine vor — bitte wähle einen aus.",
  anfrage: "Dein Vermieter bittet dich um etwas.",
  mitteilung: "Dein Vermieter hat eine Mitteilung an die Mieter geschickt.",
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

export type Ergebnis = "gesendet" | "kein_versand" | "kein_konto" | "abbestellt" | "demo" | "gebremst" | "vorgemerkt" | "fehler";

/** Anlässe, die es je Bezug nur einmal gibt — alle anderen bekommen ein Zeitfenster im Schlüssel. */
const EINMALIG = new Set<BenachrichtigungsArt>(["dokument", "anliegen_neu", "mitteilung"]);

/** Stabiler Schlüssel des Auftrags (je Empfänger eindeutig, die Spalte `user_id` trennt Empfänger). Rein. */
export function hinweisSchluessel(art: BenachrichtigungsArt, bezug: string, jetztMs: number): string {
  if (EINMALIG.has(art)) return `hinweis:${art}:${bezug}`;
  return `hinweis:${art}:${bezug}:${Math.floor(jetztMs / (BREMSE_SEKUNDEN * 1000))}`;
}

/** Der eigentliche Versand — Adresse aus dem Auth-Konto. Ergebnis „erledigt“ auch, wenn bewusst nichts ging. */
export async function sendeHinweis(admin: SupabaseClient, userId: string, art: BenachrichtigungsArt): Promise<Lauf> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return { ok: false, grund: "Konto nicht lesbar" };
  const user = data?.user;
  if (!user?.email) return { ok: true, ergebnis: "kein_konto" };
  if (istDemoKonto(user.email)) return { ok: true, ergebnis: "demo" };
  if (user.user_metadata?.benachrichtigungen_aus === true) return { ok: true, ergebnis: "abbestellt" };
  const mail = benachrichtigungsMail(art, await basisUrl());
  return (await sendeMail({ an: user.email, ...mail })) ? { ok: true, ergebnis: "gesendet" } : { ok: false, grund: "Versand beim Mailanbieter fehlgeschlagen" };
}

/** Stand des Auftrags → Ergebnis für die Oberfläche (lib/zugang.ts → hinweisMailText). Rein. */
export function ergebnisAus(r: AussenErgebnis): Ergebnis {
  switch (r.stand) {
    case "erledigt": return (r.ergebnis as Ergebnis) ?? "gesendet";
    case "schon_erledigt": return r.ergebnis === "gesendet" || !r.ergebnis ? "gebremst" : (r.ergebnis as Ergebnis);
    case "laeuft":
    case "wartet": return "vorgemerkt";
    case "nicht_gespeichert": return r.ergebnis === "gesendet" ? "gesendet" : "fehler";
    case "aufgegeben": return "fehler";
  }
}

/**
 * Benachrichtigt ein Konto. Die Adresse kommt aus dem Auth-Konto (Service-Role), nie vom
 * Aufrufer — so kann keine Action eine fremde Adresse einschleusen.
 */
export async function benachrichtige(
  userId: string | null | undefined,
  art: BenachrichtigungsArt,
  bezug: string,
  ausgeloestVon?: string | null,
): Promise<Ergebnis> {
  try {
    if (!userId) return "kein_konto";
    // Ohne eingerichteten Versand wird nichts vorgemerkt — sonst gingen Wochen später alte Hinweise hinaus.
    if (!brevoBereit()) return "kein_versand";
    const admin = createAdminClient();
    if (!admin) return "kein_versand";
    const r = await fuehreAus(
      admin,
      { userId, ausgeloestVon: ausgeloestVon ?? null, schluessel: hinweisSchluessel(art, bezug, Date.now()), art: "hinweis_mail", nutzlast: { art, bezug } },
      () => sendeHinweis(admin, userId, art),
    );
    return ergebnisAus(r);
  } catch (e) {
    console.error("benachrichtige:", e instanceof Error ? e.message : "unbekannt");
    return "fehler";
  }
}
