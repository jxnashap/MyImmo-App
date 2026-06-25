"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/actions/account";

export default function AccountManager({
  email,
  provider,
}: {
  email?: string | null;
  provider?: string | null;
}) {
  const supabase = createClient();
  const istGoogle = !!provider && provider !== "email";

  // --- Passwort ändern ---
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (pw1.length < 6) {
      setPwError("Das neue Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (pw1 !== pw2) {
      setPwError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPw1("");
    setPw2("");
    setPwOk(true);
  }

  // --- Konto löschen ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const darfLoeschen = confirmText.trim().toUpperCase() === "LÖSCHEN";

  return (
    <>
      {/* Passwort ändern */}
      <div className="card mt-6">
        <h2 className="mb-1 text-lg">🔒 Passwort ändern</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Ändere das Passwort für dein Konto{email ? ` (${email})` : ""}.
          {istGoogle && (
            <>
              {" "}
              <br />
              Du meldest dich aktuell mit Google an. Hier kannst du zusätzlich ein Passwort
              setzen, um dich auch direkt per E-Mail anzumelden.
            </>
          )}
        </p>
        <form onSubmit={changePassword} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Neues Passwort</span>
            <input
              type="password"
              value={pw1}
              onChange={(e) => {
                setPw1(e.target.value);
                pwError && setPwError(null);
              }}
              autoComplete="new-password"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Wiederholen</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => {
                setPw2(e.target.value);
                pwError && setPwError(null);
              }}
              autoComplete="new-password"
              className="input"
            />
          </label>

          {pwError && (
            <div
              className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
              style={{ background: "var(--red-dim)", borderColor: "rgba(224,92,75,0.4)", color: "var(--red)" }}
              role="alert"
            >
              ⚠️ {pwError}
            </div>
          )}
          {pwOk && (
            <div
              className="sm:col-span-2 rounded-md px-3 py-2 text-sm"
              style={{ background: "var(--green-dim)", color: "var(--green)" }}
            >
              ✓ Passwort geändert.
            </div>
          )}

          <div className="sm:col-span-2">
            <button className="btn-gold" disabled={pwSaving}>
              {pwSaving ? "Speichern…" : "Passwort ändern"}
            </button>
          </div>
        </form>
      </div>

      {/* Datenexport */}
      <div className="card mt-6">
        <h2 className="mb-1 text-lg">⬇️ Meine Daten exportieren</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Lade alle zu deinem Konto gespeicherten Daten (inkl. Mieter, Buchungen und Dokumente)
          als maschinenlesbare JSON-Datei herunter — DSGVO-Recht auf Datenübertragbarkeit.
        </p>
        <a href="/api/export" className="btn-gold" style={{ display: "inline-block" }}>
          Daten als JSON herunterladen
        </a>
      </div>

      {/* Rechtliches */}
      <div className="card mt-6">
        <h2 className="mb-1 text-lg">📄 Rechtliches</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Informationen zum Datenschutz und Anbieterkennzeichnung.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/datenschutz" className="hover:underline" style={{ color: "var(--gold)" }}>
            Datenschutzerklärung
          </Link>
          <Link href="/avv" className="hover:underline" style={{ color: "var(--gold)" }}>
            Auftragsverarbeitungsvertrag
          </Link>
          <Link href="/impressum" className="hover:underline" style={{ color: "var(--gold)" }}>
            Impressum
          </Link>
        </div>
      </div>

      {/* Konto löschen (Danger Zone) */}
      <div
        className="card mt-6"
        style={{ borderColor: "rgba(224,92,75,0.5)" }}
      >
        <h2 className="mb-1 text-lg" style={{ color: "var(--red)" }}>
          🗑 Konto löschen
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Löscht dein Konto und <strong>unwiderruflich</strong> alle deine Daten — Immobilien,
          Mieter, Buchungen, Kredite, Dokumente und Einstellungen. Dies kann nicht rückgängig
          gemacht werden. Exportiere vorher bei Bedarf deine Daten.
        </p>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "rgba(224,92,75,0.5)", color: "var(--red)" }}
          >
            Konto löschen…
          </button>
        ) : (
          <form action={deleteAccount} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">
                Zum Bestätigen <strong>LÖSCHEN</strong> eingeben:
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="LÖSCHEN"
                className="input"
                style={{ maxWidth: 220 }}
                autoFocus
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!darfLoeschen}
                className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--red)", color: "#fff" }}
              >
                Konto endgültig löschen
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                className="rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
