import { addIban, deleteIban } from "@/lib/actions/ibans";
import type { Iban } from "@/lib/types";

const fmt = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export default function IbanManager({ ibans }: { ibans: Iban[] }) {
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
              <form action={deleteIban.bind(null, x.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--line)] px-2 py-1 text-sm text-[var(--red)] hover:bg-[var(--red-dim)]"
                  title="IBAN entfernen"
                >
                  🗑
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-[var(--muted)]">Noch keine IBANs gespeichert.</p>
      )}

      <form action={addIban} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          />
        </label>
        <div className="sm:col-span-2">
          <button className="btn-gold">IBAN hinzufügen</button>
        </div>
      </form>
    </div>
  );
}
