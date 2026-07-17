// Gemeinsame Helfer für die KI-Routen (/api/import, /api/nk-ocr):
// Auth-Schutz, Anthropic-Call mit Timeout und Größenprüfung für Uploads.
import { createClient } from "@/lib/supabase/server";
import { bedrockKonfiguriert, callBedrock } from "@/lib/bedrock";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** Liefert den eingeloggten Nutzer oder null. KI-Routen ohne Login ablehnen. */
export async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
    return await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
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
