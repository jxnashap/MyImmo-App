import type { Property } from "@/lib/types";

type Field = {
  name: keyof Property;
  label: string;
  type?: "text" | "number";
  step?: string;
};

const FIELDS: Field[] = [
  { name: "bezeichnung", label: "Bezeichnung" },
  { name: "typ", label: "Typ (ETW, MFH, …)" },
  { name: "adresse", label: "Adresse" },
  { name: "obj_status", label: "Status" },
  { name: "kaufpreis", label: "Kaufpreis (€)", type: "number", step: "0.01" },
  { name: "wert", label: "Aktueller Wert (€)", type: "number", step: "0.01" },
  { name: "miete", label: "Soll-Miete/Monat (€)", type: "number", step: "0.01" },
  { name: "hausgeld", label: "Hausgeld/Monat (€)", type: "number", step: "0.01" },
  { name: "flaeche", label: "Fläche (m²)", type: "number", step: "0.01" },
  { name: "zimmer", label: "Zimmer", type: "number", step: "0.5" },
  { name: "baujahr", label: "Baujahr", type: "number" },
  { name: "energieklasse", label: "Energieklasse" },
];

export default function PropertyForm({
  action,
  property,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  property?: Property;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.label}</span>
          <input
            name={f.name}
            type={f.type ?? "text"}
            step={f.step}
            required={f.name === "bezeichnung"}
            defaultValue={(property?.[f.name] as string | number | null) ?? ""}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-gold"
          />
        </label>
      ))}
      <div className="sm:col-span-2 mt-2">
        <button className="rounded-lg bg-gold px-5 py-2 font-medium text-ink">{submitLabel}</button>
      </div>
    </form>
  );
}
