import type { Ampel, PruefPunkt } from "./typen";

// Betriebsbereitschaft — was ist scharf, was fehlt noch.
//
// **Zweck und Grenze:** Die Punkte hier werden ZUR LAUFZEIT aus Env und Code
// abgeleitet, nicht aus einer Notiz übernommen. Eine Checkliste, die aus einer
// Markdown-Datei gespeist wird, erzählt irgendwann etwas anderes als das
// System — dieses Projekt hat damit mehrfach Zeit verloren (Punkte standen
// monatelang als offen, obwohl sie gebaut waren, und umgekehrt).
//
// Deshalb zwei getrennte Herkünfte:
//   `gemessen` — aus `process.env` / Code-Schaltern dieses Laufs.
//   `doku`     — Handarbeit, nur mit Stand-Datum und Quelle (lib/cockpit/doku.ts).
// Im Cockpit stehen beide untereinander, aber sichtbar unterschieden.

/**
 * Ist eine Besuchermessung eingebunden?
 *
 * Von Hand gepflegt — und genau deshalb bewacht: `tests/cockpit.test.ts` wird
 * rot, sobald ein Analytics-Paket in der `package.json` steht, diese Konstante
 * aber noch `false` sagt. Eine Angabe über das eigene System darf nicht
 * stillschweigend veralten.
 *
 * Beim Einschalten NICHT vergessen: `/datenschutz` Ziffer 2 sagt derzeit
 * „keine Analyse-Tools“.
 */
export const BESUCHER_MESSUNG_AKTIV = false;

/** Schnappschuss der Lage. Der Aufrufer liest Env und Schalter, hier wird
 *  nur bewertet — damit die Bewertung ohne Server testbar ist. */
export type Betriebslage = {
  billingAktiv: boolean;
  preiseSichtbar: boolean;
  registrierungOffen: boolean;
  brevoBereit: boolean;
  betaCode: boolean;
  verschluesselung: boolean;
  cronSecret: boolean;
  serviceRoleKey: boolean;
  anthropicKey: boolean;
  bedrockVollstaendig: boolean;
  besucherMessung: boolean;
  agencyVerbunden: boolean;
  githubVerbunden: boolean;
  ownerGesetzt: boolean;
};

const ja = (b: boolean): Ampel => (b ? "ok" : "offen");

/**
 * Bewertet die Lage zu Prüfpunkten.
 *
 * Bewusst NICHT jeder Schalter ist „offen = schlecht“: Solange MyImmo nicht
 * gestartet ist, sind ausgeschaltete Kasse und ausgeblendete Preise der
 * GEWOLLTE Zustand. Sie stehen hier als Tatsache mit Ampel „offen“, nicht als
 * Fehler — die Beschreibung sagt, was sie bedeuten.
 */
export function bewerteBetrieb(l: Betriebslage): PruefPunkt[] {
  const p: PruefPunkt[] = [];
  const m = (
    id: string,
    titel: string,
    ampel: Ampel,
    detail: string,
    wer: PruefPunkt["wer"] = "betreiber",
  ) => p.push({ id, titel, ampel, detail, wer, herkunft: "gemessen" });

  // ---- Kasse ----
  m(
    "kasse",
    "Bezahlsystem scharf",
    ja(l.billingAktiv),
    l.billingAktiv
      ? "BILLING_ENFORCED=true — Tarif-Schranken greifen."
      : "BILLING_ENFORCED ist nicht gesetzt. Early Access: alles frei, kein Euro einnehmbar. Vorher: AGB/Widerruf anwaltlich, Paddle verifiziert.",
  );
  m(
    "preise",
    "Preise öffentlich",
    ja(l.preiseSichtbar),
    l.preiseSichtbar
      ? "PREISE_SICHTBAR = true — /preise und die Teaser sind sichtbar."
      : "PREISE_SICHTBAR = false in lib/preise.ts — Tarife sind auf der Website ausgeblendet.",
    "code",
  );
  m(
    "registrierung",
    "Registrierung offen",
    ja(l.registrierungOffen),
    l.registrierungOffen
      ? "REGISTRIERUNG_OFFEN = true — Start-Knöpfe führen in die Registrierung."
      : 'REGISTRIERUNG_OFFEN = false — Start-Knöpfe zeigen „Coming soon“, Zugang nur über den Beta-Code.',
    "code",
  );
  m(
    "betacode",
    "Zugangscode gesetzt",
    ja(l.betaCode),
    l.betaCode
      ? "BETA_CODE ist gesetzt — Registrierung mit Code möglich."
      : "BETA_CODE fehlt → JEDE Registrierung scheitert. In Vercel setzen und neu deployen.",
  );

  // ---- Messen ----
  m(
    "messung",
    "Besucher werden gemessen",
    ja(l.besucherMessung),
    l.besucherMessung
      ? "Eine Besuchermessung ist eingebunden."
      : "Keine Besuchermessung eingebunden — oberhalb der Registrierung ist nichts messbar. Achtung: /datenschutz sagt derzeit „keine Analyse-Tools“; der Passus muss mitgeändert werden.",
    "code",
  );

  // ---- Betrieb ----
  m(
    "mail",
    "E-Mail-Versand bereit",
    ja(l.brevoBereit),
    l.brevoBereit
      ? "Brevo ist konfiguriert — Einladungen, Double-Opt-in und Hinweis-Mails gehen hinaus."
      : "BREVO_API_KEY und/oder BREVO_ABSENDER_EMAIL fehlen. Formulare bleiben ausgeblendet, Einladungen kommen nicht an. Nach dem Eintragen NEU DEPLOYEN.",
  );
  m(
    "verschluesselung",
    "Bankdaten-Schlüssel",
    ja(l.verschluesselung),
    l.verschluesselung
      ? "DATA_ENCRYPTION_KEY ist gesetzt — IBAN, Darlehensnummer und Kautionsbank werden verschlüsselt."
      : "DATA_ENCRYPTION_KEY fehlt → Bankdaten liegen unverschlüsselt, und die Zugriffsbremse fällt auf schwächeres Hashen zurück.",
  );
  m(
    "cron",
    "Wert-Cron abgesichert",
    l.cronSecret && l.serviceRoleKey ? "ok" : "offen",
    l.cronSecret && l.serviceRoleKey
      ? "CRON_SECRET und SUPABASE_SERVICE_ROLE_KEY sind gesetzt."
      : `Fehlt: ${[!l.cronSecret && "CRON_SECRET", !l.serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ")}. Ohne beide antwortet die Cron-Route mit 503 — Route aus, nicht offen.`,
  );
  m(
    "owner",
    "Cockpit-Zugang gebunden",
    ja(l.ownerGesetzt),
    l.ownerGesetzt
      ? "OWNER_USER_ID ist gesetzt — nur dieses Konto sieht das Cockpit."
      : "OWNER_USER_ID fehlt. Diese Seite wäre dann für niemanden erreichbar (fail-closed).",
  );

  // ---- KI ----
  m(
    "ki",
    "KI-Verarbeitung",
    l.bedrockVollstaendig ? "ok" : l.anthropicKey ? "warnung" : "offen",
    l.bedrockVollstaendig
      ? "Bedrock (AWS Frankfurt) vollständig konfiguriert — OCR und KI-Import bleiben in der EU."
      : l.anthropicKey
        ? "Läuft über die Anthropic-API (USA, SCCs). Für EU-Verarbeitung die vier BEDROCK_*-Variablen setzen."
        : "Kein ANTHROPIC_API_KEY und kein Bedrock — OCR und KI-Import sind aus.",
  );

  // ---- Agency ----
  m(
    "agency",
    "Agency angebunden",
    ja(l.agencyVerbunden),
    l.agencyVerbunden
      ? "Agency-Datenbank erreichbar — Vorgänge, Audits und Monatsausgaben werden unten gezeigt."
      : "AGENCY_SUPABASE_URL / AGENCY_SUPABASE_SERVICE_KEY fehlen. Einrichtung: agency/README.md, Schritte 1–7.",
  );
  m(
    "github",
    "GitHub angebunden",
    ja(l.githubVerbunden),
    l.githubVerbunden
      ? "GITHUB_TOKEN ist gesetzt — Prüfläufe und offene PRs werden gezeigt."
      : "GITHUB_TOKEN fehlt. Ohne ihn bleibt unsichtbar, ob main grün ist — genau der Punkt, an dem fünf Pushes unbemerkt rot waren.",
  );

  return p;
}

/** Zählt die Ampeln — für die Kopfzeile des Cockpits. */
export function ampelBilanz(punkte: PruefPunkt[]): Record<Ampel, number> {
  const b: Record<Ampel, number> = { ok: 0, offen: 0, warnung: 0, kritisch: 0, unbekannt: 0 };
  for (const p of punkte) b[p.ampel]++;
  return b;
}
