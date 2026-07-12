"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Home, Wrench, Building2, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";

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
  if (m.includes("password should be at least")) return "Das Passwort ist zu kurz (mind. 6 Zeichen).";
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
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState(""); // Zugangs-/Einladungscode (nur Registrierung)
  const [firma, setFirma] = useState(""); // Firmenname (nur Service-Registrierung)
  const [rolle, setRolle] = useState<string>("vermieter"); // Standard: Vermieter
  const [falscheRolle, setFalscheRolle] = useState<string | null>(null); // Konto-Rolle bei Fehlanmeldung

  // Query-Parameter erst nach dem Mount lesen (verhindert Hydration-
  // Mismatch, da window serverseitig nicht existiert).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("geloescht")) {
      setInfo("Dein Konto und alle Daten wurden gelöscht.");
    }
    const r = params.get("rolle");
    if (r && ROLLEN[r]) setRolle(r);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setFalscheRolle(null);
    setLoading(true);

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(uebersetze(error.message));
        setLoading(false);
        return;
      }
      // Rollen-Check: Zugangsdaten müssen zur gewählten Rolle passen.
      // (Konten ohne Rollen-Eintrag sind Vermieter.)
      const { data: rolleRow } = await supabase
        .from("nutzer_rollen")
        .select("rolle")
        .eq("user_id", data.user!.id)
        .maybeSingle();
      const kontoRolle = rolleRow?.rolle ?? "vermieter";
      if (kontoRolle !== rolle) {
        await supabase.auth.signOut();
        setFalscheRolle(kontoRolle);
        setError(
          `Diese Zugangsdaten gehören zu einem ${ROLLEN[kontoRolle].label}-Konto — die Anmeldung hier ist für ${ROLLEN[rolle].label} gedacht.`
        );
        setLoading(false);
        return;
      }
      // Harte Navigation: stellt sicher, dass der Server die neue Session-
      // Cookie sofort sieht — kein manuelles Neuladen mehr nötig.
      window.location.assign("/");
    } else if (rolle === "mieter" || rolle === "service") {
      // Mieter/Service-Registrierung: Einladungscode des Vermieters.
      const eingabe = code.trim().toUpperCase();
      const { data: gueltig, error: rpcError } = await supabase.rpc("einladungscode_pruefen", {
        p_code: eingabe,
        p_rolle: rolle, // Code muss zur gewählten Rolle passen (MI ≠ SV)
      });
      if (rpcError || !gueltig) {
        setError("Dieser Einladungscode ist ungültig oder abgelaufen. Bitte frage den Vermieter nach einem neuen Code.");
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
          data:
            rolle === "mieter"
              ? { rolle: "mieter", einladungscode: eingabe }
              : { rolle: "service", einladungscode: eingabe, firma: firma.trim() },
        },
      });
      if (error) setError(uebersetze(error.message));
      else
        setInfo(
          rolle === "mieter"
            ? "Fast geschafft — bitte bestätige die E-Mail in deinem Postfach. Danach findest du deine Wohnung im Mieterportal."
            : "Fast geschafft — bitte bestätige die E-Mail in deinem Postfach. Danach findest du deine Aufträge im Service-Portal."
        );
      setLoading(false);
    } else {
      // Vermieter & Hausverwaltung: Beta-Zugangscode + volle App.
      if (code.trim() !== process.env.NEXT_PUBLIC_BETA_CODE) {
        setError("Ungültiger Zugangscode.");
        setLoading(false);
        return;
      }
      if (!consent) {
        setError("Bitte stimme AGB, Datenschutz und Auftragsverarbeitung zu.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: rolle === "hausverwaltung" ? { data: { rolle: "hausverwaltung" } } : undefined,
      });
      if (error) setError(uebersetze(error.message));
      else setInfo("Fast geschafft — bitte bestätige die E-Mail in deinem Postfach.");
      setLoading(false);
    }
  }

  async function googleLogin() {
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
    if (error) setError(uebersetze(error.message));
    else setInfo("Wir haben dir eine E-Mail zum Zurücksetzen geschickt.");
  }

  const wechsel = (m: "login" | "signup") => {
    setMode(m);
    setError(null);
    setInfo(null);
    setFalscheRolle(null);
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

        {/* Gewählte Rolle + Wechsel zurück zur Auswahl */}
        <div className="mt-5 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: "var(--gold-pale)", color: "var(--gold)", border: "1px solid var(--gold-dim)" }}
          >
            {(() => { const I = ROLLEN[rolle].icon; return <I size={13} />; })()}
            {ROLLEN[rolle].label}
          </span>
          <Link
            href="/anmelden"
            className="inline-flex items-center gap-1 text-[12px] transition hover:underline"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft size={12} /> Rolle wechseln
          </Link>
        </div>

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
              className="flex-1 rounded-lg py-2 text-[13px] font-medium transition"
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <input
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
          <input
            type="password"
            required
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />

          {mode === "signup" && rolle === "service" && (
            <input
              type="text"
              placeholder="Firma / Betrieb (optional, z. B. Sanitär Müller)"
              value={firma}
              onChange={(e) => setFirma(e.target.value)}
              className="input w-full text-[15px]"
              style={{ padding: "12px 14px" }}
            />
          )}

          {mode === "signup" && (
            <input
              type="text"
              required
              placeholder={
                rolle === "mieter"
                  ? "Einladungscode (vom Vermieter, z. B. MI-XXXX-XXXX)"
                  : rolle === "service"
                    ? "Einladungscode (vom Vermieter, z. B. SV-XXXX-XXXX)"
                    : "Zugangscode (Beta)"
              }
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                error && setError(null);
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
                  error && setError(null);
                }}
                style={{ marginTop: 3 }}
              />
              <span>
                Ich habe die{" "}
                <Link href="/agb" target="_blank" style={{ color: "var(--gold)" }}>
                  AGB
                </Link>{" "}
                und die{" "}
                <Link href="/datenschutz" target="_blank" style={{ color: "var(--gold)" }}>
                  Datenschutzerklärung
                </Link>{" "}
                gelesen und akzeptiere sie.
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
            <div
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "var(--red-dim)", color: "var(--red)" }}
            >
              {error}
              {falscheRolle && (
                <button
                  type="button"
                  className="mt-2 block w-full rounded-lg border py-2 text-[13px] font-medium transition hover:brightness-110"
                  style={{ background: "var(--bg3)", borderColor: "var(--line2)", color: "var(--text)" }}
                  onClick={() => {
                    setRolle(falscheRolle);
                    setFalscheRolle(null);
                    setError(null);
                    const url = new URL(window.location.href);
                    url.searchParams.set("rolle", falscheRolle);
                    window.history.replaceState(null, "", url.toString());
                  }}
                >
                  Als {ROLLEN[falscheRolle].label} anmelden
                </button>
              )}
            </div>
          )}
          {info && (
            <p
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "var(--green-dim)", color: "var(--green)" }}
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3 text-[15px] font-semibold transition hover:brightness-95 disabled:opacity-60"
            style={{ background: "var(--gold)", color: "#1a1a17" }}
          >
            {loading ? "…" : mode === "login" ? "Anmelden" : "Registrieren"}
          </button>
        </form>

        {/* Mit Google anmelden — während der Beta nur im Login-Modus,
            damit die Registrierung nicht am Zugangscode vorbei läuft */}
        {mode === "login" && (
          <button
            type="button"
            onClick={googleLogin}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-lg border py-3 text-[15px] font-medium transition hover:brightness-110"
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
              className="text-[13px] transition hover:underline"
              style={{ color: "var(--muted)" }}
            >
              Passwort vergessen?
            </button>
          </div>
        )}

        <div
          className="mt-6 flex justify-center gap-4 border-t pt-4 text-[12px]"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <Link href="/agb" className="hover:underline">AGB</Link>
          <Link href="/datenschutz" className="hover:underline">Datenschutz</Link>
          <Link href="/avv" className="hover:underline">AVV</Link>
          <Link href="/impressum" className="hover:underline">Impressum</Link>
        </div>
      </div>
    </div>
  );
}
