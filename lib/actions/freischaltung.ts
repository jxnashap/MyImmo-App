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
): Promise<{ ok: boolean; fehler?: string; rolle?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };

  // Grossschreibung wie im Registrierungspfad (app/login/page.tsx): Codes sind
  // immer Grossbuchstaben, die RPC vergleicht exakt. Ohne diese Normalisierung
  // scheiterte ein auf dem Handy getipptes "mi-abcd-2345" — genau bei der
  // Gruppe, fuer die das nachtraegliche Einloesen gebaut wurde.
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  if (!consent) return { ok: false, fehler: "Bitte AGB und Datenschutz zustimmen." };

  // Zwei Code-Arten sind hier gültig:
  //
  // 1. Der Vermieter-BETA-CODE → volle App.
  // 2. Ein EINLADUNGSCODE des Vermieters (Mieter/Service). Normalerweise wird
  //    der beim Registrieren vom Trigger eingelöst — der schluckt aber jeden
  //    Fehler still. Ging dabei etwas schief, saß der Nutzer dauerhaft auf
  //    dieser Seite fest und bekam „Ungültiger Zugangscode" zu einem Beta-Code
  //    gezeigt, den er als Mieter nie erhalten kann. Hier holen wir die
  //    Einlösung nach.
  const geprueft = await pruefeBetaCode(code);
  if (geprueft.ok) {
    const { error } = await supabase.rpc("konto_freischalten", { p_quelle: "code" });
    if (error) return { ok: false, fehler: "Freischaltung fehlgeschlagen — bitte erneut versuchen." };
    return { ok: true };
  }

  const { data, error: rpcFehler } = await supabase.rpc("einladungscode_einloesen", { p_code: code });
  const erg = data as { ok: boolean; fehler?: string; rolle?: string } | null;
  if (!rpcFehler && erg?.ok) return { ok: true, rolle: erg.rolle };

  // Beides passt nicht — die Meldung muss beide Wege benennen, sonst rät der
  // Nutzer, welche Art Code gemeint ist.
  return {
    ok: false,
    fehler:
      "Dieser Code passt weder als Zugangscode noch als Einladung deines Vermieters. " +
      "Als Mieter oder Handwerksbetrieb bekommst du den Code von deinem Vermieter — " +
      "frag dort nach einem neuen, falls deiner abgelaufen ist.",
  };
}
