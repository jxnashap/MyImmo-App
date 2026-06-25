"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addIban, deleteIban } from "@/lib/actions/ibans";
import { isValidIban, normalizeIban } from "@/lib/iban";
import type { Iban } from "@/lib/types";

const fmt = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export default function IbanManager({ ibans }: { ibans: Iban[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return; // Doppelklick abfangen
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const ibanRaw = String(fd.get("iban") ?? "");
    const iban = normalizeIban(ibanRaw);

    // Sofort-Feedback ohne Serverrunde
    if (!isValidIban(iban)) {
      setError("Die IBAN ist nicht korrekt – bitte prüfen.");
      return;
    }
    if (ibans.some((x) => normalizeIban(x.iban) === iban)) {
      setError("Diese IBAN ist bereits hinterlegt.");
      return;
    }

    setSaving(true);
    try {
      const res = await addIban(fd);
      if (!res?.ok) {
        setError(res?.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      form.reset();
      startTransition(() => router.refresh());
    } catch {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteIban(id);
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card mt-6">
      <h2 className="mb-1 text-lg">🏦 IBANs / Bankkonten</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Hinterlege ein oder mehrere Konten. Beim Erstellen von Mahnungen, Zahlungserinnerungen,
        Mieterhöhungen und NK-Abrechnungen kannst du das passende Konto auswählen – es erscheint
        dann als Zahlungshinweis im Dokument.
      </p>

      {ibans.length > 0 ? (
        <ul className="mb-5 flex flex-col gap-2">
          {ibans.map((x) => (
            <li
              key={x.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg3)] px-4 py-3"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{x.kontoname}</div>
                {x.inhaber && <div className="text-xs text-[var(--muted)]">{x.inhaber}</div>}
                <div className="mt-0.5 font-mono text-sm tracking-wide text-[var(--text)]">{fmt(x.iban)}</div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(x.id)}
                disabled={deletingId === x.id}
                className="rounded-md border border-[var(--line)] px-2 py-1 text-sm text-[var(--red)] hover:bg-[var(--red-dim)] disabled:opacity-50"
                title="IBAN entfernen"
              >
                {deletingId === x.id ? "…" : "🗑"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-[var(--muted)]">Noch keine IBANs gespeichert.</p>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Bezeichnung *</span>
          <input name="kontoname" required placeholder="z. B. Mietkonto" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Kontoinhaber</span>
          <input name="inhaber" placeholder="Max Mustermann" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">IBAN *</span>
          <input
            name="iban"
            required
            placeholder="DE12 3456 7890 1234 5678 90"
            className="input uppercase"
            style={{ textTransform: "uppercase" }}
            onChange={() => error && setError(null)}
          />
        </label>

        {error && (
          <div
            className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
            style={{ background: "var(--red-dim)", borderColor: "rgba(224,92,75,0.4)", color: "var(--red)" }}
            role="alert"
          >
            ⚠️ {error}
          </div>
        )}

        <div className="sm:col-span-2">
          <button className="btn-gold" disabled={saving}>
            {saving ? "Speichern…" : "IBAN hinzufügen"}
          </button>
        </div>
      </form>
    </div>
  );
}
