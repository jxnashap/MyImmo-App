// Regeln und Texte des Vorlagen-Verteilers.
//
// Diese Datei muss frei von Node-Importen bleiben: Der Einwilligungstext wird
// auch im Formular (Client-Komponente) angezeigt, und genau derselbe Wortlaut
// wird serverseitig als Nachweis gespeichert. Zwei Kopien wären der sichere
// Weg, dass sie auseinanderlaufen. Die Token-Funktionen liegen deshalb in
// `lib/newsletterToken.ts`.

/** Wortlaut der Einwilligung. Wird je Anmeldung mitgespeichert (Art. 7 DSGVO). */
export const EINWILLIGUNG_VERSION = "2026-07-31";
export const EINWILLIGUNGSTEXT =
  "Ich möchte die MyImmo-Vorlagen und gelegentliche Hinweise für Vermieter per E-Mail erhalten. " +
  "Die Einwilligung kann ich jederzeit über den Abmeldelink in jeder E-Mail widerrufen.";

/** Gültigkeitsdauer des Bestätigungslinks. */
export const TOKEN_STUNDEN = 72;

/**
 * Sehr bewusst nachsichtig: Diese Prüfung soll Tippfehler und offensichtlichen
 * Unsinn abfangen, nicht die Grammatik von RFC 5322 nachbauen. Ob die Adresse
 * wirklich existiert, beantwortet ohnehin erst die Bestätigungsmail — das ist
 * der eigentliche Zweck des Double-Opt-ins.
 */
export function istEmail(roh: string): boolean {
  const e = roh.trim();
  if (e.length < 5 || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  const teile = e.split("@");
  if (teile.length !== 2) return false;
  const [lokal, domain] = teile;
  if (!lokal || lokal.length > 64) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return /^[^@]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e);
}

/** Vergleichsform: Groß-/Kleinschreibung spielt bei Adressen praktisch keine Rolle. */
export const normalisiereEmail = (roh: string): string => roh.trim().toLowerCase();

export function bestaetigungsMail(bestaetigenUrl: string): { betreff: string; html: string; text: string } {
  const betreff = "Bitte bestätigen: MyImmo-Vorlagen";
  const text = [
    "Fast geschafft.",
    "",
    "Bitte bestätigen Sie mit einem Klick, dass Sie die MyImmo-Vorlagen und",
    "gelegentliche Hinweise für Vermieter per E-Mail erhalten möchten:",
    "",
    bestaetigenUrl,
    "",
    `Der Link gilt ${TOKEN_STUNDEN} Stunden.`,
    "",
    "Haben Sie sich nicht angemeldet, ignorieren Sie diese E-Mail einfach —",
    "ohne Ihre Bestätigung wird die Adresse nicht in den Verteiler aufgenommen.",
    "",
    "MyImmo — Privates Immobilien-Management",
    "https://www.myimmoapp.de",
  ].join("\n");

  // Inline-Styles statt Stylesheet: E-Mail-Programme entfernen <style>-Blöcke
  // regelmäßig. Gold und Serifen-Wortmarke wie im Dokument-Design.
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#23211c">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e1d4;border-radius:12px;padding:28px">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;margin-bottom:4px">
      My<span style="color:#b8902b;font-style:italic">Immo</span>
    </div>
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b968a;margin-bottom:22px">
      Privates Immobilien-Management
    </div>
    <h1 style="font-size:19px;margin:0 0 12px">Fast geschafft</h1>
    <p style="font-size:15px;line-height:1.65;color:#6b675e;margin:0 0 20px">
      Bitte bestätigen Sie mit einem Klick, dass Sie die MyImmo-Vorlagen und gelegentliche
      Hinweise für Vermieter per E-Mail erhalten möchten.
    </p>
    <p style="margin:0 0 22px">
      <a href="${bestaetigenUrl}" style="display:inline-block;background:#b8902b;color:#1a1a17;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px">
        Anmeldung bestätigen
      </a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9b968a;margin:0 0 8px">
      Der Link gilt ${TOKEN_STUNDEN} Stunden. Falls der Knopf nicht funktioniert:<br>
      <a href="${bestaetigenUrl}" style="color:#856619">${bestaetigenUrl}</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9b968a;margin:0;border-top:1px solid #e7e1d4;padding-top:14px">
      Haben Sie sich nicht angemeldet, ignorieren Sie diese E-Mail. Ohne Ihre Bestätigung
      wird die Adresse nicht in den Verteiler aufgenommen.
    </p>
  </div>
</body></html>`;

  return { betreff, html, text };
}
