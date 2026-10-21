"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Home, Wrench, Building2, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";
import { bereiteRegistrierungVor, pruefeEinladungscode } from "@/lib/actions/freischaltung";
import { PASSWORT_LECK_HINWEIS, PASSWORT_MIN, PASSWORT_REGEL, passwortAblehnung, pruefePasswort } from "@/lib/passwort";
import { RESET_ZIEL } from "@/lib/passwortWechsel";
import { HILFE_MAILTO } from "@/lib/preise";
import { istEmail } from "@/lib/newsletter";
import { sicheresZiel } from "@/lib/flash";
import { herkunftDieserSeite } from "@/lib/herkunft";
import MfaAbfrage from "@/components/MfaAbfrage";
import { mussMfaNachholen } from "@/lib/auth/sitzung";
import { bestaetigungsZiel, zielNachAnmeldung } from "@/lib/auth/anmeldeZiel";

// Zugangs-Rollen (Businessplan Kap. 14): Vermieter & Hausverwaltung nutzen
// die volle App, Mieter und Service haben eigene Portale.
const ROLLEN: Record<string, { label: string; icon: LucideIcon }> = {
  vermieter: { label: "Vermieter", icon: KeyRound },
  mieter: { label: "Mieter", icon: Home },
  service: { label: "Service / Hausmeister", icon: Wrench },
  hausverwaltung: { label: "Hausverwaltung", icon: Building2 },
};

// Freundliche deutsche Texte für die häufigsten Supabase-Fehler.
function uebersetze(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (m.includes("email not confirmed")) return "Bitte bestätige zuerst die E-Mail in deinem Postfach.";
  if (m.includes("user already registered")) return "Diese E-Mail ist bereits registriert.";
  if (m.includes("password should be at least")) return `Das Passwort ist zu kurz (${PASSWORT_REGEL}).`;
  // Supabase meldet ein zu schwaches Bestandspasswort beim LOGIN — zusammen mit
  // einer gueltigen Session (siehe handleSubmit). Ohne diesen Fall sah der
  // Nutzer die englische Rohmeldung.
  if (m.includes("weak") && m.includes("password"))
    return `Dein Passwort erfüllt die aktuellen Sicherheitsregeln nicht mehr (${PASSWORT_REGEL}). Bitte ändere es gleich hier.`;
  if (m.includes("validate email") || m.includes("invalid format") || (m.includes("email") && m.includes("invalid")))
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (m.includes("provider is not enabled")) return "Google-Login ist noch nicht aktiviert (in Supabase einrichten).";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Zu viele Anfragen in kurzer Zeit — bitte in ein paar Minuten erneut versuchen (oder „Mit Google anmelden“).";
  return msg;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState(""); // nur Registrierung: Tippfehler abfangen
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState(""); // Zugangs-/Einladungscode (nur Registrierung)
  const [firma, setFirma] = useState(""); // Firmenname (nur Service-Registrierung)
  const [rolle, setRolle] = useState<string>("vermieter"); // Standard: Vermieter (zählt nur beim Registrieren)
  // Aus der Einladungsmail gekommen: Satz über dem Formular, Code-Feld als „erkannt“.
  const [eingeladen, setEingeladen] = useState(false);
  // Rücksprung nach dem Login (Deep-Link aus einer E-Mail o. Ä.) — nur relative Pfade.
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  // Zweiter Schritt (2FA): Passwort stimmt, Konto verlangt einen Code.
  const [mfaOffen, setMfaOffen] = useState(false);

  // Query-Parameter erst nach dem Mount lesen (verhindert Hydration-
  // Mismatch, da window serverseitig nicht existiert).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("geloescht")) {
      // B02 (11.10.2026): „rest“ = Konto und Daten gelöscht, aber einzelne Beleg-Dateien nicht —
      // das wird gesagt, nicht als vollständige Löschung gemeldet.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen — beim Server-Rendern gibt es ihn nicht (Hydration)
      setInfo(params.get("geloescht") === "rest"
        ? "Dein Konto und deine Daten wurden gelöscht. Einzelne Beleg-Dateien ließen sich nicht sofort entfernen — bitte schreib an info@myimmoapp.de, wir löschen sie von Hand."
        : "Dein Konto und alle Daten wurden gelöscht.");
    }
    if (params.get("info") === "passwort-neu") {
      setInfo("Dein Passwort wurde geändert. Melde dich jetzt damit an.");
    }
    // Warum steht der Nutzer hier? Bis 01.10.2026 stand er nach Auto-Abmeldung
    // oder Token-Ablauf kommentarlos vor dem Formular („Ist die App abgestürzt?").
    const grund = params.get("grund");
    if (grund === "inaktiv") {
      const min = params.get("min");
      setInfo(`Du warst ${min ? `${min} Minuten` : "eine Weile"} inaktiv — zur Sicherheit wurdest du abgemeldet. Alles Gespeicherte ist noch da.`);
    } else if (grund === "geschlossen") {
      setInfo("Der Browser war geschlossen — nach deiner Einstellung wurdest du dabei abgemeldet.");
    } else if (grund === "abgelaufen") {
      setInfo("Deine Sitzung ist abgelaufen. Melde dich bitte neu an — du landest danach wieder dort, wo du warst.");
    }
    // Bestätigungslink aus der Registrierungsmail, in einem anderen Browser geöffnet
    // (siehe /auth/callback): Die Adresse ist bestätigt, angemeldet ist hier noch niemand.
    if (params.get("bestaetigt") === "1") {
      setInfo("Deine E-Mail-Adresse ist bestätigt. Melde dich jetzt mit E-Mail und Passwort an.");
    }
    const fehlerArt = params.get("fehler");
    if (fehlerArt === "reset") {
      // Der Grund kommt aus app/(app)/auth/passwort/route.ts. Ohne ihn hiess
      // jeder Fehlschlag „abgelaufen oder schon benutzt" — auch dann, wenn der
      // Link tadellos war und nur im falschen Browser geoeffnet wurde.
      const grund = params.get("grund");
      setError(
        grund === "geraet"
          ? "Dieser Link lässt sich nur in dem Browser öffnen, in dem du das Zurücksetzen " +
              "angefordert hast. Fordere unten einen neuen an und öffne die E-Mail auf " +
              "demselben Gerät — oder klicke den Link erneut, falls du ihn schon einmal benutzt hast."
          : // Betreiber: Tritt das wiederholt auf, nutzt die Supabase-Vorlage
            // „Reset Password“ noch nicht `token_hash` (CLAUDE.md, Punkt 2).
            grund === "ohne-token"
            ? "Der Link enthielt keine Kennung, die wir prüfen können. Bitte fordere unten " +
              "einen neuen an. Falls das erneut passiert, schreib uns über „Hilfe & Kontakt“ unten."
            : "Der Link zum Zurücksetzen ist abgelaufen oder wurde schon benutzt. " +
              "Fordere unten einfach einen neuen an.",
      );
    } else if (fehlerArt === "google") {
      setError("Die Anmeldung mit Google hat nicht geklappt. Bitte erneut versuchen.");
    }
    const r = params.get("rolle");
    if (r && ROLLEN[r]) setRolle(r);
    // Link aus der Einladungsmail (lib/actions/einladung.ts): Code vorausfüllen
    // und direkt die Registrierung zeigen. Nur der Code steht im Link — die
    // Adresse NICHT (sie landete sonst in Server-Logs); der Mieter tippt sie.
    const einladung = params.get("einladung");
    if (einladung && /^MI-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(einladung)) {
      setCode(einladung.toUpperCase());
      setMode("signup");
      setEingeladen(true);
    }
    // Open-Redirect verhindern: nur app-interne Pfade — dieselbe Pruefung wie
    // bei den back-Redirects der Server-Actions (lib/flash.ts).
    const n = params.get("next");
    if (n) {
      const ziel = sicheresZiel(n, "");
      if (ziel) setNextUrl(ziel);
    }
    // Vom Layout hergeschickt: angemeldet, aber der zweite Faktor fehlt noch.
    if (params.has("mfa")) {
      void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
        if (mussMfaNachholen(data)) setMfaOffen(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nach bestandenem zweiten Schritt: dorthin, wo der Nutzer hinwollte.
  const nachMfa = (wiederhergestellt: boolean) => {
    window.location.assign(wiederhergestellt ? "/einstellungen?tab=sicherheit&mfa=neu" : (nextUrl ?? "/"));
  };
  const mfaAbbrechen = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setMfaOffen(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Registrierung: Passwörter müssen übereinstimmen — sonst wäre das Konto
    // mit einem vertippten Passwort angelegt und der nächste Login scheitert.
    if (mode === "signup" && password !== password2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    // Dieselbe Regel wie in den Einstellungen (lib/passwort.ts). Ohne die
    // Pruefung hier galt der Supabase-Standard von 6 Zeichen — wer sich damit
    // registrierte, konnte sein Passwort spaeter nicht mehr auf denselben Wert
    // setzen, weil die Aenderung 8 verlangte.
    if (mode === "signup") {
      const pwFehler = pruefePasswort(password);
      if (pwFehler) {
        setError(pwFehler);
        return;
      }
    }

    setLoading(true);

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // Sonderfall „schwaches Bestandspasswort": Ist ein altes Passwort kuerzer
      // als die inzwischen verschaerfte Supabase-Regel, liefert die API BEIDES —
      // eine gueltige Session UND einen WeakPasswordError. Der Fehler ist ein
      // Hinweis, keine Abweisung. Wer ihn wie jeden anderen behandelt, wirft die
      // Session weg und sperrt genau die Bestandsnutzer aus, die aus der Phase
      // stammen, in der die Registrierung hier noch keine 8 Zeichen verlangte.
      // Erkannt wird er an der Kombination Fehler + Session, nicht am Fehlercode
      // — das bleibt auch bei einer Umbenennung in supabase-js stabil.
      const schwachesPasswort = !!error && !!data?.session;
      if (error && !schwachesPasswort) {
        setError(uebersetze(error.message));
        setLoading(false);
        return;
      }
      // Die Rolle des KONTOS entscheidet, wohin es geht — nicht die oben gewählte
      // (lib/auth/anmeldeZiel.ts). Bis 21.10.2026 wurde ein Mieter, der nach dem
      // Abmelden auf der Vermieter-Voreinstellung landete, mit richtigem Passwort
      // wieder abgemeldet. (Konten ohne Rollen-Eintrag sind Vermieter.)
      const { data: rolleRow } = await supabase
        .from("nutzer_rollen")
        .select("rolle")
        .eq("user_id", data.user!.id)
        .maybeSingle();
      const kontoRolle = rolleRow?.rolle ?? "vermieter";
      // Zwei-Faktor: Verlangt das Konto einen Code, ist die Sitzung erst aal1 —
      // das Layout ließe sie nicht in die App. Hier den zweiten Schritt zeigen.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mussMfaNachholen(aal)) {
        setMfaOffen(true);
        setLoading(false);
        return;
      }
      // Harte Navigation: stellt sicher, dass der Server die neue Session-
      // Cookie sofort sieht — kein manuelles Neuladen mehr nötig.
      // Bei schwachem Bestandspasswort zuerst in die Einstellungen (Sicherheit),
      // damit der Wechsel nicht untergeht; der Deep-Link tritt dahinter zurueck.
      window.location.assign(
        schwachesPasswort && kontoRolle !== "mieter" && kontoRolle !== "service"
          ? "/einstellungen?pw=schwach"
          : zielNachAnmeldung(kontoRolle, nextUrl),
      );
    } else if (rolle === "mieter" || rolle === "service") {
      // Mieter/Service-Registrierung: Einladungscode des Vermieters.
      const eingabe = code.trim().toUpperCase();
      // Serverseitig (HMAC-Bremse, Service-Role) — die fruehere RPC aus dem
      // Browser schrieb die IP im Klartext in die Zugriffsbremse.
      const gueltig = await pruefeEinladungscode(eingabe, rolle, email);
      if (!gueltig.ok) {
        setError(gueltig.fehler ?? "Dieser Einladungscode ist ungültig oder abgelaufen.");
        setLoading(false);
        return;
      }
      if (!consent) {
        setError("Bitte stimme AGB und Datenschutzerklärung zu.");
        setLoading(false);
        return;
      }
      // Rolle + Code in die User-Metadaten — der DB-Trigger löst den Code
      // beim Anlegen des Kontos ein und stellt die Verknüpfung her.
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: bestaetigungsZiel(window.location.origin, rolle),
          data:
            rolle === "mieter"
              ? { rolle: "mieter", einladungscode: eingabe }
              : { rolle: "service", einladungscode: eingabe, firma: firma.trim() },
        },
      });
      if (error) setError(passwortAblehnung(error) ?? uebersetze(error.message));
      else
        setInfo(
          "Fast geschafft — wir haben dir eine E-Mail geschickt. Tippe auf den Link darin: " +
            "Auf diesem Gerät bist du danach gleich angemeldet, auf einem anderen meldest du dich " +
            "hier mit E-Mail und Passwort an. " +
            (rolle === "mieter" ? "Deine Wohnung findest du dann im Mieterportal." : "Deine Aufträge findest du dann im Service-Portal."),
        );
      setLoading(false);
    } else {
      // Vermieter & Hausverwaltung: Beta-Zugangscode + volle App.
      // Die Prüfung läuft SERVERSEITIG — der Code darf nicht im ausgelieferten
      // JavaScript stehen (siehe lib/actions/freischaltung.ts).
      if (!consent) {
        setError("Bitte stimme AGB, Datenschutz und Auftragsverarbeitung zu.");
        setLoading(false);
        return;
      }
      // Prüft den Code UND merkt die Freischaltung serverseitig vor. Ohne die
      // Vormerkung fragte das Willkommens-Gate beim ersten Login ein zweites
      // Mal nach demselben Code — die Freischaltung braucht eine angemeldete
      // Sitzung, die es vor der E-Mail-Bestätigung noch nicht gibt.
      const codeGeprueft = await bereiteRegistrierungVor(code, email, consent);
      if (!codeGeprueft.ok) {
        setError(codeGeprueft.fehler ?? "Ungültiger Zugangscode.");
        setLoading(false);
        return;
      }
      // Herkunftsmarke aus dem Link (`?von=welle1`), nur zum Zählen — siehe
      // lib/herkunft.ts. Entscheidet über nichts, darf also aus den
      // Metadaten kommen, die der Browser setzt.
      const herkunft = herkunftDieserSeite();
      const daten = {
        ...(rolle === "hausverwaltung" ? { rolle: "hausverwaltung" } : {}),
        ...(herkunft ? { herkunft } : {}),
      };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: bestaetigungsZiel(window.location.origin, rolle),
          ...(Object.keys(daten).length ? { data: daten } : {}),
        },
      });
      if (error) setError(passwortAblehnung(error) ?? uebersetze(error.message));
      else
        setInfo(
          "Fast geschafft — wir haben dir eine E-Mail geschickt. Tippe auf den Link darin: " +
            "Auf diesem Gerät bist du danach gleich angemeldet, auf einem anderen meldest du dich " +
            "hier mit E-Mail und Passwort an. Der Zugangscode wird nicht noch einmal gebraucht.",
        );
      setLoading(false);
    }
  }

  async function googleLogin() {
    setError(null);
    setInfo(null);
    // Die gewählte Rolle mit an den Callback geben. Ohne sie führte der
    // Google-Weg jede Rollenprüfung ins Leere: Wer sich als „Vermieter"
    // durchklickte und dann Google nutzte, landete kommentarlos im
    // Mieterportal — oder legte, ohne bestehendes Konto, ungewollt ein neues
    // Vermieter-Konto an. Der Passwort-Login prüft das längst (siehe oben).
    const ziel =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?rolle=${encodeURIComponent(rolle)}` +
          (nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : "")
        : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: ziel },
    });
    if (error) setError(uebersetze(error.message));
  }

  async function resetPassword() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Bitte zuerst deine E-Mail oben eingeben.");
      return;
    }
    // Vorher prüfen: Supabase antwortete auf „abc“ englisch („Unable to validate email address:
    // invalid format“, Gesamtprüfung C54). `uebersetze()` fängt den Text zusätzlich ab.
    if (!istEmail(email)) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    // Ziel ist die Einlöse-Route, NICHT /login: Dort wurde der Link früher
    // nirgends eingelöst, und ein Formular für ein neues Passwort gab es auch
    // nicht — der Weg endete im Nichts (siehe app/(app)/auth/passwort/route.ts).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}${RESET_ZIEL}` : undefined,
    });
    if (error) setError(uebersetze(error.message));
    else setInfo("Wir haben dir eine E-Mail zum Zurücksetzen geschickt.");
  }

  const wechsel = (m: "login" | "signup") => {
    setMode(m);
    setPassword2("");
    setError(null);
    setInfo(null);
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="role-card zoom-in w-full max-w-[420px] rounded-2xl border p-8 sm:p-10"
        style={{
          background: "var(--bg2)",
          borderColor: "var(--line2)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 18px 50px -20px rgba(0,0,0,0.28)",
        }}
      >
        <BrandMark size="lg" />

        {/* Links zurück zur Rollen-Auswahl (Pfeil zeigt dorthin), rechts die
            aktuell gewählte Rolle — gilt für jeden Zugang (Vermieter, Mieter …). */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Link
            href="/anmelden"
            className="tipp-flaeche inline-flex items-center gap-1 text-[12px] transition hover:underline"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft size={12} /> Rolle wechseln
          </Link>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: "var(--gold-pale)", color: "var(--gold)", border: "1px solid var(--gold-dim)" }}
          >
            {(() => { const I = ROLLEN[rolle].icon; return <I size={13} />; })()}
            {ROLLEN[rolle].label}
          </span>
        </div>

        {mfaOffen ? (
          <div className="mt-7">
            <MfaAbfrage onErfolg={nachMfa} onAbbruch={mfaAbbrechen} />
          </div>
        ) : (
        <>
        {/* Umschalter Anmelden / Registrieren */}
        <div
          className="mt-7 mb-6 flex gap-1 rounded-xl p-1"
          style={{ background: "var(--bg3)", border: "1px solid var(--line)" }}
        >
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => wechsel(m)}
              className="flex-1 rounded-sm py-2 text-[13px] font-medium transition"
              style={
                mode === m
                  ? { background: "var(--bg5)", color: "var(--text)" }
                  : { background: "transparent", color: "var(--muted)" }
              }
            >
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>

        {/* Aus der Einladungsmail: ein Satz Kontext statt eines nackten Formulars. */}
        {eingeladen && mode === "signup" && (
          <p className="mb-4 text-[13px]" style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            Dein Vermieter hat dich eingeladen. Wähle ein Passwort — mit der E-Mail-Adresse, an die die
            Einladung ging. Schon registriert? Dann oben auf „Anmelden“.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <input
            type="email"
            required
            placeholder="E-Mail"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
          <input
            type="password"
            required
            minLength={mode === "signup" ? PASSWORT_MIN : undefined}
            placeholder={mode === "signup" ? `Passwort (${PASSWORT_REGEL})` : "Passwort"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              // Eine Meldung aus dem letzten Absenden („Passwörter stimmen nicht überein“) gilt nach
              // einer Korrektur nicht mehr (Gesamtprüfung C55).
              if (error) setError(null);
            }}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
          {mode === "signup" && (
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, margin: "-4px 2px 0" }}>
              {PASSWORT_LECK_HINWEIS}.
            </p>
          )}

          {/* Registrierung: zweite Eingabe gegen Tippfehler — ein falsch
              getipptes Passwort fiele sonst erst beim nächsten Login auf. */}
          {mode === "signup" && (
            <div>
              <input
                type="password"
                required
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => {
                  setPassword2(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={password2.length > 0 && password2 !== password}
                className="input w-full text-[15px]"
                style={{
                  padding: "12px 14px",
                  borderColor: password2.length > 0 && password2 !== password ? "var(--red)" : undefined,
                }}
              />
              {password2.length > 0 && password2 !== password && (
                <div style={{ fontSize: 12, color: "var(--red)", marginTop: 5 }}>
                  Die Passwörter stimmen nicht überein.
                </div>
              )}
            </div>
          )}

          {mode === "signup" && rolle === "service" && (
            <input
              type="text"
              placeholder="Firma / Betrieb (optional, z. B. Sanitär Müller)"
              autoComplete="organization"
              value={firma}
              onChange={(e) => setFirma(e.target.value)}
              className="input w-full text-[15px]"
              style={{ padding: "12px 14px" }}
            />
          )}

          {mode === "signup" && eingeladen && code && (
            <label htmlFor="einladungscode" className="block text-[12px]" style={{ color: "var(--muted)", margin: "0 2px -8px" }}>
              Einladungscode aus deiner E-Mail
            </label>
          )}
          {mode === "signup" && (
            <input
              id="einladungscode"
              type="text"
              required
              placeholder={
                rolle === "mieter"
                  ? "Einladungscode (vom Vermieter, z. B. MI-XXXX-XXXX)"
                  : rolle === "service"
                    ? "Einladungscode (vom Vermieter, z. B. SV-XXXX-XXXX)"
                    : "Zugangscode (Beta)"
              }
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              className="input w-full text-[15px]"
              style={{ padding: "12px 14px" }}
            />
          )}


          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (error) setError(null);
                }}
                style={{ marginTop: 3 }}
              />
              <span>
                Ich akzeptiere die{" "}
                <Link href="/agb" target="_blank" style={{ color: "var(--gold)" }}>
                  AGB
                </Link>
                . Die{" "}
                <Link href="/datenschutz" target="_blank" style={{ color: "var(--gold)" }}>
                  Datenschutzerklärung
                </Link>{" "}
                habe ich zur Kenntnis genommen.
                {rolle !== "mieter" && rolle !== "service" && (
                  <>
                    {" "}Zudem akzeptiere ich den{" "}
                    <Link href="/avv" target="_blank" style={{ color: "var(--gold)" }}>
                      Auftragsverarbeitungsvertrag
                    </Link>{" "}
                    für die Verarbeitung der von mir eingegebenen Mieterdaten in meinem Auftrag.
                  </>
                )}
              </span>
            </label>
          )}

          {error && (
            <div role="alert"
              className="rounded-sm px-3 py-2 text-[13px]"
              style={{ background: "var(--red-dim)", color: "var(--red)" }}
            >
              {error}
            </div>
          )}
          {info && (
            <p
              className="rounded-sm px-3 py-2 text-[13px]"
              style={{ background: "var(--green-dim)", color: "var(--green)" }}
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm py-3 text-[15px] font-semibold transition hover:brightness-95 disabled:opacity-60"
            style={{ background: "var(--gold-fill)", color: "var(--btn-gold-text)" }}
          >
            {loading ? "…" : mode === "login" ? "Anmelden" : "Registrieren"}
          </button>
        </form>
        </>
        )}

        {/* Mit Google anmelden — während der Beta nur im Login-Modus,
            damit die Registrierung nicht am Zugangscode vorbei läuft */}
        {mode === "login" && (
          <button
            type="button"
            onClick={googleLogin}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-sm border py-3 text-[15px] font-medium transition hover:brightness-110"
            style={{ background: "var(--bg3)", borderColor: "var(--line2)", color: "var(--text)" }}
          >
            <GoogleIcon />
            Mit Google anmelden
          </button>
        )}

        {mode === "login" && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={resetPassword}
              className="tipp-flaeche text-[13px] transition hover:underline"
              style={{ color: "var(--muted)" }}
            >
              Passwort vergessen?
            </button>
          </div>
        )}

        <div
          className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t pt-4 text-[12px]"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <a href={HILFE_MAILTO} className="hover:underline whitespace-nowrap py-1">Hilfe &amp; Kontakt</a>
          <Link href="/agb" className="hover:underline whitespace-nowrap py-1">AGB</Link>
          <Link href="/datenschutz" className="hover:underline whitespace-nowrap py-1">Datenschutz</Link>
          <Link href="/avv" className="hover:underline whitespace-nowrap py-1">AVV</Link>
          <Link href="/impressum" className="hover:underline whitespace-nowrap py-1">Impressum</Link>
        </div>
      </div>
    </div>
  );
}
