"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";

// Freundliche deutsche Texte für die häufigsten Supabase-Fehler.
function uebersetze(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (m.includes("email not confirmed")) return "Bitte bestätige zuerst die E-Mail in deinem Postfach.";
  if (m.includes("user already registered")) return "Diese E-Mail ist bereits registriert.";
  if (m.includes("password should be at least")) return "Das Passwort ist zu kurz (mind. 6 Zeichen).";
  if (m.includes("provider is not enabled")) return "Google-Login ist noch nicht aktiviert (in Supabase einrichten).";
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
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(uebersetze(error.message));
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(uebersetze(error.message));
      else setInfo("Fast geschafft — bitte bestätige die E-Mail in deinem Postfach.");
    }
    setLoading(false);
  }

  async function googleLogin() {
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
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

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl border p-8 sm:p-10"
        style={{
          background: "var(--bg2)",
          borderColor: "var(--line2)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 18px 50px -20px rgba(0,0,0,0.28)",
        }}
      >
        <BrandMark size="lg" />

        <div className="my-7 h-px w-full" style={{ background: "var(--line)" }} />

        {/* Google */}
        <button
          type="button"
          onClick={googleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-lg border py-2.5 text-[15px] font-medium transition hover:brightness-95"
          style={{ background: "#ffffff", borderColor: "rgba(0,0,0,0.16)", color: "#1f1f1f" }}
        >
          <GoogleIcon />
          Mit Google einloggen
        </button>

        <div className="my-5 flex items-center gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
          <div className="h-px flex-1" style={{ background: "var(--line)" }} />
          oder
          <div className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--muted)" }}>
              E-Mail
            </label>
            <input
              type="email"
              required
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full text-[15px]"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12.5px] font-medium" style={{ color: "var(--muted)" }}>
                Passwort
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-[12px] transition hover:underline"
                  style={{ color: "var(--gold)" }}
                >
                  Passwort vergessen?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full text-[15px]"
            />
          </div>

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "var(--red-dim)", color: "var(--red)" }}
            >
              {error}
            </p>
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
            className="w-full rounded-lg py-2.5 text-[15px] font-semibold transition hover:brightness-95 disabled:opacity-60"
            style={{ background: "var(--gold)", color: "#1a1a17" }}
          >
            {loading ? "…" : mode === "login" ? "Einloggen" : "Registrieren"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            className="text-[13px] transition"
            style={{ color: "var(--muted)" }}
          >
            {mode === "login" ? (
              <>
                Noch kein Konto? <span style={{ color: "var(--gold)", fontWeight: 600 }}>Registrieren</span>
              </>
            ) : (
              <>
                Schon registriert? <span style={{ color: "var(--gold)", fontWeight: 600 }}>Einloggen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
