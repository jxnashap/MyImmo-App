"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-xl font-semibold">
        {mode === "login" ? "Einloggen" : "Konto erstellen"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 outline-none focus:border-gold"
        />
        <input
          type="password"
          required
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 outline-none focus:border-gold"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-green-400">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gold py-2 font-medium text-ink disabled:opacity-60"
        >
          {loading ? "…" : mode === "login" ? "Einloggen" : "Registrieren"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setInfo(null);
        }}
        className="mt-4 text-sm text-white/50 hover:text-white/80"
      >
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon registriert? Einloggen"}
      </button>
    </div>
  );
}
