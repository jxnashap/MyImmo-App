"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";

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
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Fast geschafft — bitte bestätige die E-Mail in deinem Postfach.");
    }
    setLoading(false);
  }

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{ background: "#f5f3ee", color: "#1f1e1b" }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl border bg-white p-8 sm:p-10"
        style={{
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 18px 50px -20px rgba(0,0,0,0.18)",
        }}
      >
        <BrandMark size="lg" />

        <div className="my-7 h-px w-full" style={{ background: "rgba(0,0,0,0.07)" }} />

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              className="mb-1.5 block text-[12.5px] font-medium"
              style={{ color: "rgba(0,0,0,0.6)" }}
            >
              E-Mail
            </label>
            <input
              type="email"
              required
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-black/[0.14] bg-white px-4 py-2.5 text-[15px] text-[#1f1e1b] outline-none transition placeholder:text-black/35 focus:border-[#b8902b] focus:ring-2 focus:ring-[#b8902b]/15"
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-[12.5px] font-medium"
              style={{ color: "rgba(0,0,0,0.6)" }}
            >
              Passwort
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-black/[0.14] bg-white px-4 py-2.5 text-[15px] text-[#1f1e1b] outline-none transition placeholder:text-black/35 focus:border-[#b8902b] focus:ring-2 focus:ring-[#b8902b]/15"
            />
          </div>

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "rgba(192,67,47,0.08)", color: "#b03c2b" }}
            >
              {error}
            </p>
          )}
          {info && (
            <p
              className="rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "rgba(47,143,91,0.10)", color: "#2c7d52" }}
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-[15px] font-semibold transition hover:brightness-95 disabled:opacity-60"
            style={{ background: "#b8902b", color: "#1a1a17" }}
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
            style={{ color: "rgba(0,0,0,0.5)" }}
          >
            {mode === "login" ? (
              <>
                Noch kein Konto?{" "}
                <span style={{ color: "#b8902b", fontWeight: 600 }}>Registrieren</span>
              </>
            ) : (
              <>
                Schon registriert?{" "}
                <span style={{ color: "#b8902b", fontWeight: 600 }}>Einloggen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
