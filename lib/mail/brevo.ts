import "server-only";

// Anbindung an Brevo (vormals Sendinblue) — Transaktionsmails und Kontaktliste.
//
// Warum Brevo: Sitz in Frankreich, Verarbeitung in der EU, AVV über das
// Brevo-Konto abschließbar. Damit entfällt die Drittland-Diskussion, die bei
// US-Anbietern in der Datenschutzerklärung sonst zu führen wäre.
//
// Warum kein SDK: Es sind drei REST-Aufrufe. Ein Paket dafür bringt
// Abhängigkeiten und Bundle mit, ohne etwas abzunehmen.
//
// Grundsatz für alle Funktionen hier: Fehlt die Konfiguration, wird NICHT
// geworfen, sondern `false` zurückgegeben. Eine fehlende Env darf die Website
// nicht zum Absturz bringen — der Aufrufer entscheidet, was er dem Besucher
// sagt.

const API = "https://api.brevo.com/v3";

export type BrevoKonfig = {
  key: string;
  listId: number | null;
  absenderEmail: string;
  absenderName: string;
};

/**
 * Liest die Konfiguration aus der Umgebung. `null`, wenn Pflichtangaben fehlen.
 *
 * Env (Vercel, nie ins Repo):
 * - `BREVO_API_KEY`        — API-Schlüssel v3
 * - `BREVO_ABSENDER_EMAIL` — verifizierte Absenderadresse
 * - `BREVO_ABSENDER_NAME`  — optional, Default „MyImmo"
 * - `BREVO_LIST_ID`        — optional; ohne sie wird kein Kontakt einsortiert
 */
export function brevoKonfig(): BrevoKonfig | null {
  const key = process.env.BREVO_API_KEY;
  const absenderEmail = process.env.BREVO_ABSENDER_EMAIL;
  if (!key || !absenderEmail) return null;
  const roh = process.env.BREVO_LIST_ID;
  const listId = roh && /^\d+$/.test(roh) ? Number(roh) : null;
  return {
    key,
    listId,
    absenderEmail,
    absenderName: process.env.BREVO_ABSENDER_NAME || "MyImmo",
  };
}

export const brevoBereit = (): boolean => brevoKonfig() !== null;

async function ruf(
  konfig: BrevoKonfig,
  pfad: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${API}${pfad}`, {
    method: init.method,
    headers: {
      "api-key": konfig.key,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // Kein Cache: Es sind ausschließlich schreibende Aufrufe.
    cache: "no-store",
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

/** Verschickt eine Transaktionsmail. `false`, wenn nicht konfiguriert oder abgelehnt. */
export async function sendeMail(opts: {
  an: string;
  betreff: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const konfig = brevoKonfig();
  if (!konfig) return false;
  try {
    const { ok, status, text } = await ruf(konfig, "/smtp/email", {
      method: "POST",
      body: {
        sender: { email: konfig.absenderEmail, name: konfig.absenderName },
        to: [{ email: opts.an }],
        subject: opts.betreff,
        htmlContent: opts.html,
        textContent: opts.text,
      },
    });
    // Bewusst ohne die Adresse im Log: Fehlersuche braucht den Status, nicht
    // die personenbezogene Angabe.
    if (!ok) console.error(`Brevo: Mailversand abgelehnt (${status})`, text.slice(0, 300));
    return ok;
  } catch (e) {
    console.error("Brevo: Mailversand fehlgeschlagen", e);
    return false;
  }
}

/**
 * Legt den Kontakt an oder aktualisiert ihn und sortiert ihn in die Liste.
 *
 * Wird erst NACH der Bestätigung aufgerufen — vorher gehört eine Adresse nicht
 * in den Verteiler, sonst wäre das Double-Opt-in wertlos.
 */
export async function kontaktEintragen(
  email: string,
  attribute: Record<string, string> = {},
): Promise<boolean> {
  const konfig = brevoKonfig();
  if (!konfig) return false;
  try {
    const { ok, status, text } = await ruf(konfig, "/contacts", {
      method: "POST",
      body: {
        email,
        updateEnabled: true,
        attributes: attribute,
        listIds: konfig.listId ? [konfig.listId] : undefined,
      },
    });
    if (!ok) console.error(`Brevo: Kontakt abgelehnt (${status})`, text.slice(0, 300));
    return ok;
  } catch (e) {
    console.error("Brevo: Kontakt fehlgeschlagen", e);
    return false;
  }
}

/**
 * Trägt die Adresse bei Brevo aus (Blacklist), damit sie auch dann keine Post
 * mehr bekommt, wenn sie über einen anderen Weg wieder in eine Liste gerät.
 */
export async function kontaktAbmelden(email: string): Promise<boolean> {
  const konfig = brevoKonfig();
  if (!konfig) return false;
  try {
    const { ok, status } = await ruf(konfig, `/contacts/${encodeURIComponent(email)}`, {
      method: "PUT",
      body: { emailBlacklisted: true },
    });
    // 404 = Kontakt war nie angelegt. Für den Abmeldenden ist das derselbe
    // Erfolg: Er bekommt nichts mehr.
    return ok || status === 404;
  } catch (e) {
    console.error("Brevo: Abmeldung fehlgeschlagen", e);
    return false;
  }
}
