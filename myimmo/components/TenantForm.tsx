import type { Tenant, Property } from "@/lib/types";

export default function TenantForm({
  action,
  tenant,
  properties,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  tenant?: Tenant;
  properties: Pick<Property, "id" | "bezeichnung">[];
  submitLabel: string;
}) {
  const val = (k: keyof Tenant) => (tenant?.[k] as string | number | null) ?? "";

  const text: { name: keyof Tenant; label: string; type?: string }[] = [
    { name: "vorname", label: "Vorname" },
    { name: "nachname", label: "Nachname" },
    { name: "email", label: "E-Mail", type: "email" },
    { name: "telefon", label: "Telefon" },
    { name: "einheit", label: "Einheit (z.B. EG links)" },
    { name: "mieter_adresse", label: "Adresse des Mieters" },
    { name: "mietbeginn", label: "Mietbeginn", type: "date" },
    { name: "mietende", label: "Mietende", type: "date" },
    { name: "kaltmiete", label: "Kaltmiete (€)", type: "number" },
    { name: "nk_vorauszahlung", label: "NK-Vorauszahlung (€)", type: "number" },
    { name: "kaution", label: "Kaution (€)", type: "number" },
    { name: "flaeche", label: "Fläche (m²)", type: "number" },
  ];

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-white/60">Objekt</span>
        <select
          name="prop_id"
          defaultValue={tenant?.prop_id ?? ""}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-gold"
        >
          <option value="">— kein Objekt —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.bezeichnung}
            </option>
          ))}
        </select>
      </label>

      {text.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.label}</span>
          <input
            name={f.name}
            type={f.type ?? "text"}
            step={f.type === "number" ? "0.01" : undefined}
            defaultValue={val(f.name)}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-gold"
          />
        </label>
      ))}

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-white/60">Notiz</span>
        <textarea
          name="notiz"
          rows={3}
          defaultValue={val("notiz")}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-gold"
        />
      </label>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-gold px-5 py-2 font-medium text-ink">{submitLabel}</button>
      </div>
    </form>
  );
}
