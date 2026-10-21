// Gemeinsame Helfer für die KI-Routen (/api/import, /api/nk-ocr):
// Auth-Schutz, Anthropic-Call mit Timeout und Größenprüfung für Uploads.
import { createClient } from "@/lib/supabase/server";
import { bedrockKonfiguriert, callBedrock } from "@/lib/bedrock";
import { liesBegrenzt } from "@/lib/net/grenzen";

/** Höchstgröße einer KI-Antwort (JSON) — eine Extraktion ist wenige KB groß. */
export const KI_ANTWORT_MAX = 2 * 1024 * 1024;

/**
 * Ist ein KI-Anbieter eingerichtet? Bedrock (AWS Frankfurt) ODER der direkte Anthropic-Schlüssel.
 * B16 (11.10.2026): Vorher verlangten alle drei Routen `ANTHROPIC_API_KEY` — auch wenn Bedrock
 * eingerichtet war und der Schlüssel gar nicht benutzt wurde. Wer bewusst nur die EU-Variante
 * einrichtete, bekam 503.
 */
export function kiBereit(): boolean {
  return bedrockKonfiguriert() || !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Wer die KI-Auswertung gerade ausführt — für den Hinweis an der Oberfläche (Datenschutzerklärung
 * Ziffer 3 e, AVV Ziffer 7: „je nach Einrichtung“). Dieselbe Umschaltung wie `callAnthropic`.
 */
export function kiAnbieterText(): string {
  return bedrockKonfiguriert()
    ? "Amazon Bedrock (AWS, Verarbeitung in der EU; der Modellanbieter erhält keinen Zugriff)"
    : "Anthropic (USA; kein Modell-Training mit API-Daten)";
}

/** Meldung, wenn kein Anbieter eingerichtet ist. */
export const KI_NICHT_BEREIT =
  "Kein KI-Anbieter eingerichtet (Bedrock-Zugang oder ANTHROPIC_API_KEY in Vercel unter Settings → Environment Variables).";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** Liefert den eingeloggten Nutzer oder null. KI-Routen ohne Login ablehnen. */
/**
 * Angemeldeten Nutzer UND den Supabase-Client liefern.
 *
 * Der Client wird seit dem Einbau der Tarif-Schranken (04.09.2026) mit
 * zurueckgegeben: Die KI-Routen brauchen ihn fuer `featureSperre()`, und ein
 * zweites `createClient()` je Aufruf waere unnoetig. Alle drei Aufrufer
 * (import, import-url, nk-ocr) wurden mit umgestellt.
 */
export async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

/**
 * Claude-Messages-Call mit hartem Timeout (verhindert hängende Functions).
 * Sind die BEDROCK_*-Env-Variablen gesetzt, läuft der Call über Amazon
 * Bedrock in AWS Frankfurt (EU, kein Drittland-Transfer) — sonst über die
 * direkte Anthropic-API. Beide liefern dasselbe Antwort-Format.
 */
export async function callAnthropic(
  apiKey: string,
  payload: unknown,
  timeoutMs = 45_000
): Promise<Response> {
  if (bedrockKonfiguriert()) return callBedrock(payload, timeoutMs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // B16: Den Body INNERHALB des Zeitgebers und mit Größengrenze lesen — vorher endete der
    // Zeitgeber mit den Kopfzeilen, und ein tröpfelnder Body hielt die Funktion fest.
    const bytes = await liesBegrenzt(res, KI_ANTWORT_MAX);
    return new Response(bytes, { status: res.status, headers: res.headers });
  } finally {
    clearTimeout(timer);
  }
}

/** Dekodierte Byte-Größe eines Base64-Strings (ohne den String zu dekodieren). */
export function base64Bytes(b64: string): number {
  const clean = b64.trim();
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export const MB = 1024 * 1024;
