"use client";

// Willkommens-Gate für neu registrierte Konten (auch via Google): Zustimmung
// zu AGB/Datenschutz + Zugangscode, bevor die App genutzt werden kann.
import { useState, useTransition } from "react";
import Link from "next/link";
import { schalteKontoFrei } from "@/lib/actions/freischaltung";

export default function FreischaltForm({ email }: { email?: string | null }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const absenden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await schalteKontoFrei(fd);
      if (!r.ok) setFehler(r.fehler ?? "Freischaltung fehlgeschlagen.");
      else window.location.assign("/"); // harte Navigation: Server sieht Freischaltung sofort
    });

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border p-8 sm:p-10"
        style={{ background: "var(--bg2)", borderColor: "var(--line2)", boxShadow: "0 18px 50px -20px rgba(0,0,0,0.28)" }}
      >
        <div className="sidebar-logo" style={{ padding: 0, borderBottom: "none", marginBottom: 8 }}>
          <h1>My<span>Immo</span></h1>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>Willkommen — kurz bestätigen</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          Bevor es losgeht, brauchen wir während der Beta deinen Zugangscode und deine
          Zustimmung.{email ? ` Angemeldet als ${email}.` : ""}
        </p>

        <form action={absenden} className="space-y-3.5" style={{ marginTop: 18 }}>
          <input
            type="text"
            name="code"
            required
            placeholder="Zugangscode (Beta)"
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
          <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
            <input type="checkbox" name="consent" style={{ marginTop: 3 }} />
            <span>
              Ich habe die{" "}
              <Link href="/agb" target="_blank" style={{ color: "var(--gold)" }}>AGB</Link>, die{" "}
              <Link href="/datenschutz" target="_blank" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>{" "}
              und den{" "}
              <Link href="/avv" target="_blank" style={{ color: "var(--gold)" }}>Auftragsverarbeitungsvertrag</Link>{" "}
              gelesen und akzeptiere sie.
            </span>
          </label>
          {fehler && (
            <div className="rounded-lg px-3 py-2 text-[13px]" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
              {fehler}
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg py-3 text-[15px] font-semibold transition hover:brightness-95 disabled:opacity-60"
            style={{ background: "var(--gold)", color: "#1a1a17" }}
          >
            {pending ? "…" : "Freischalten & starten"}
          </button>
        </form>

        <form action="/auth/signout" method="post" style={{ marginTop: 14, textAlign: "center" }}>
          <button type="submit" className="text-[12px]" style={{ color: "var(--muted)" }}>Abmelden</button>
        </form>
      </div>
    </div>
  );
}
