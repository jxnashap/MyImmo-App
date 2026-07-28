"use server";

// Server-Action des Willkommens-Gates: prüft den Zugangscode SERVERSEITIG
// (nicht nur im Formular) und dokumentiert die Zustimmung. Erst danach
// bekommt ein neu registriertes Konto Zugriff auf die App.
import { createClient } from "@/lib/supabase/server";

/** Der erwartete Beta-Code — server-only bevorzugt, Fallback auf den alten öffentlichen. */
function erwarteterCode(): string {
  return process.env.BETA_CODE ?? process.env.NEXT_PUBLIC_BETA_CODE ?? "";
}

/**
 * Prüft den Beta-Zugangscode für die Registrierung — SERVERSEITIG.
 *
 * Vorher verglich `app/login/page.tsx` direkt gegen
 * `process.env.NEXT_PUBLIC_BETA_CODE`. Alles mit `NEXT_PUBLIC_`-Präfix landet
 * im ausgelieferten JavaScript: Der Code stand für jeden im Quelltext, die
 * Schranke war damit wirkungslos. Zusätzlich scheiterte JEDE Registrierung mit
 * dem nackten Satz „Ungültiger Zugangscode", wenn die Variable nicht gesetzt
 * war — ohne Hinweis, wie man an einen Code kommt.
 */
export async function pruefeBetaCode(code: string): Promise<{ ok: boolean; fehler?: string }> {
  const erwartet = erwarteterCode();
  if (!erwartet) {
    return {
      ok: false,
      fehler:
        "Die Registrierung ist derzeit nicht freigeschaltet. Bitte wende dich an kontakt@myimmoapp.de.",
    };
  }
  if (code.trim() !== erwartet) {
    return {
      ok: false,
      fehler:
        "Zugangscode stimmt nicht. MyImmo ist noch im Early Access — einen Code bekommst du unter kontakt@myimmoapp.de.",
    };
  }
  return { ok: true };
}

export async function schalteKontoFrei(
  formData: FormData,
): Promise<{ ok: boolean; fehler?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };

  const code = String(formData.get("code") ?? "").trim();
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  if (!consent) return { ok: false, fehler: "Bitte AGB und Datenschutz zustimmen." };

  const geprueft = await pruefeBetaCode(code);
  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };

  const { error } = await supabase.rpc("konto_freischalten", { p_quelle: "code" });
  if (error) return { ok: false, fehler: "Freischaltung fehlgeschlagen — bitte erneut versuchen." };
  return { ok: true };
}
