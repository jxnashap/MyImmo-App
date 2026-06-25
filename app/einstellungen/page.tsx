import { createClient } from "@/lib/supabase/server";
import { saveVermieter } from "@/lib/actions/vermieter";
import IbanManager from "@/components/IbanManager";
import AccountManager from "@/components/AccountManager";
import type { VermieterProfil, Iban } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const supabase = createClient();
  const [{ data }, { data: ibanRows }] = await Promise.all([
    supabase.from("vermieter_profil").select("*").limit(1).maybeSingle(),
    supabase.from("ibans").select("*").order("created_at", { ascending: true }),
  ]);
  const p = (data ?? null) as VermieterProfil | null;
  const ibans = (ibanRows ?? []) as Iban[];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const Field = ({
    name,
    label,
    value,
    type = "text",
    placeholder,
    wide,
  }: {
    name: string;
    label: string;
    value: string | null | undefined;
    type?: string;
    placeholder?: string;
    wide?: boolean;
  }) => (
    <label className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[var(--muted)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="input"
      />
    </label>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl">Einstellungen</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Diese Absenderdaten erscheinen im Briefkopf und in der Fußzeile deiner Dokumente
        (z.&nbsp;B. NK-Abrechnung, Mahnung, Kündigung).
      </p>

      <form action={saveVermieter} className="card">
        <h2 className="mb-4 text-lg">Vermieter / Absender</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="name" label="Name / Firma" value={p?.name} placeholder="Max Mustermann" wide />
          <Field name="strasse" label="Straße & Hausnr." value={p?.strasse} placeholder="Eigentümerweg 12" wide />
          <Field name="plz" label="PLZ" value={p?.plz} placeholder="20095" />
          <Field name="ort" label="Ort" value={p?.ort} placeholder="Hamburg" />
          <Field name="email" label="E-Mail" value={p?.email} type="email" placeholder="max@example.de" />
          <Field name="telefon" label="Telefon" value={p?.telefon} placeholder="040 1234567" />
        </div>

        <h2 className="mb-4 mt-8 text-lg">Bankverbindung (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="bankname" label="Bank" value={p?.bankname} placeholder="Musterbank" />
          <Field name="iban" label="IBAN" value={p?.iban} placeholder="DE00 0000 0000 0000 0000 00" />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button className="btn-gold">Speichern</button>
          {p?.updated_at && (
            <span className="text-xs text-[var(--muted)]">
              Zuletzt gespeichert:{" "}
              {new Date(p.updated_at).toLocaleString("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      </form>

      <IbanManager ibans={ibans} />

      <AccountManager email={user?.email} provider={user?.app_metadata?.provider} />
    </div>
  );
}
