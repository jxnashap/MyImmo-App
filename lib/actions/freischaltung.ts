"use server";

// Server-Action des Willkommens-Gates: prüft den Zugangscode SERVERSEITIG
// (nicht nur im Formular) und dokumentiert die Zustimmung. Erst danach
// bekommt ein neu registriertes Konto Zugriff auf die App.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { darfWeiter, ZU_VIELE } from "@/lib/net/bremse";

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
  // Der Beta-Code ist EIN gemeinsames Geheimnis fuer alle — damit die
  // lohnendste Angriffsflaeche der App. Ohne Bremse liesse er sich in Ruhe
  // durchprobieren; niemand wuerde es merken. 8 Versuche in 15 Minuten je IP
  // reichen fuer Vertipper und machen Raten unpraktikabel.
  if (!(await darfWeiter("betacode", 8, 900))) {
    return { ok: false, fehler: ZU_VIELE };
  }

  const erwartet = erwarteterCode();
  if (!erwartet) {
    return {
      ok: false,
      fehler:
        "Die Registrierung ist derzeit nicht freigeschaltet. Bitte wende dich an info@myimmoapp.de.",
    };
  }
  if (code.trim() !== erwartet) {
    return {
      ok: false,
      fehler:
        "Zugangscode stimmt nicht. MyImmo ist noch im Early Access — einen Code bekommst du unter info@myimmoapp.de.",
    };
  }
  return { ok: true };
}

export async function schalteKontoFrei(
  formData: FormData,
): Promise<{ ok: boolean; fehler?: string; rolle?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };

  // ZWEI Schreibweisen, und das ist kein Zufall:
  //
  //   `code`      — unveraendert, nur getrimmt. So wie ihn auch der
  //                 Registrierungspfad an `pruefeBetaCode` gibt.
  //   `codeGross` — grossgeschrieben, NUR fuer Einladungscodes (Format
  //                 MI-XXXX-XXXX). Die sind immer gross; ein auf dem Handy
  //                 getipptes "mi-abcd-2345" soll trotzdem gehen.
  //
  // Vorher lief BEIDES ueber die grossgeschriebene Fassung. Der Beta-Zugangscode
  // enthaelt aber Klein- und Grossbuchstaben, Ziffern und Sonderzeichen — die
  // Grossschreibung zerstoerte ihn, und `pruefeBetaCode` vergleicht exakt.
  // Folge (gemeldet 31.08.2026): Derselbe Code, der bei der Registrierung
  // funktionierte, wurde hier als falsch abgewiesen.
  const code = String(formData.get("code") ?? "").trim();
  const codeGross = code.toUpperCase();
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
  // Diese Action probiert BEIDE Code-Arten durch und ist damit ein zweiter
  // Weg, Codes zu raten — die Bremse muss hier genauso greifen.
  if (!(await darfWeiter("freischaltung", 10, 900))) {
    return { ok: false, fehler: ZU_VIELE };
  }

  const geprueft = await pruefeBetaCode(code);
  if (geprueft.ok) {
    const { error } = await supabase.rpc("konto_freischalten", { p_quelle: "code" });
    if (error) return { ok: false, fehler: "Freischaltung fehlgeschlagen — bitte erneut versuchen." };
    return { ok: true };
  }

  const { data, error: rpcFehler } = await supabase.rpc("einladungscode_einloesen", { p_code: codeGross });
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

/**
 * Registrierung vorbereiten: Zugangscode pruefen UND die Freischaltung
 * serverseitig vormerken.
 *
 * Ersetzt den frueheren blossen `pruefeBetaCode`-Aufruf im Registrierungspfad.
 * Vorher wurde der Code nur geprueft und nichts gespeichert — die Freischaltung
 * braucht `auth.uid()`, die es vor der E-Mail-Bestaetigung nicht gibt. Deshalb
 * fragte das Willkommens-Gate beim ersten Login ein ZWEITES Mal nach dem Code.
 *
 * Pruefung und Vormerkung liegen bewusst in EINER Action: Waeren es zwei,
 * koennte man die Vormerkung direkt aufrufen und sich eine beliebige Adresse
 * am Zugangscode vorbei freischalten.
 *
 * Schlaegt das Vormerken fehl (fehlender Service-Role-Key), wird die
 * Registrierung NICHT abgebrochen — der Nutzer landet dann wie bisher auf
 * /willkommen und traegt den Code dort ein. Ein funktionierender Rueckfallweg
 * ist besser als eine abgebrochene Anmeldung.
 */
export async function bereiteRegistrierungVor(
  code: string,
  email: string,
  consent: boolean,
): Promise<{ ok: boolean; fehler?: string; vorgemerkt?: boolean }> {
  const geprueft = await pruefeBetaCode(code);
  if (!geprueft.ok) return geprueft;
  if (!consent) return { ok: false, fehler: "Bitte stimme AGB, Datenschutz und Auftragsverarbeitung zu." };

  const adresse = email.trim().toLowerCase();
  if (!adresse) return { ok: false, fehler: "Bitte E-Mail-Adresse angeben." };

  const admin = createAdminClient();
  if (!admin) {
    console.error("Registrierungs-Vormerkung uebersprungen: SUPABASE_SERVICE_ROLE_KEY fehlt.");
    return { ok: true, vorgemerkt: false };
  }

  const { error } = await admin.from("registrierung_freigaben").upsert(
    { email: adresse, consent: true, quelle: "registrierung" },
    { onConflict: "email" },
  );
  if (error) {
    console.error("Registrierungs-Vormerkung fehlgeschlagen:", error.message);
    return { ok: true, vorgemerkt: false };
  }
  return { ok: true, vorgemerkt: true };
}
