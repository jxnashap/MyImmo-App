"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import Select, { type SelectOption } from "./Select";
import Segmented from "./Segmented";
import { FILTER_ICONS, type FilterIcon } from "./icons";

export type FilterDef = {
  name: string;                       // searchParam-Schlüssel
  label: string;                      // für aria + Chip
  icon?: FilterIcon;                  // Icon-Name (serialisierbar)
  variant?: "select" | "segmented";   // default: select
  defaultValue?: string;              // Wert, der „kein Filter" bedeutet (default "")
  options: SelectOption[];            // vollständige Liste inkl. der Default-/Alle-Option
};

// Einheitliche, sofort anwendende Filterleiste. Schreibt die Auswahl direkt
// in die URL-Query → Server rendert die Liste gefiltert neu (kein Button).
export default function FilterBar({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const defOf = (f: FilterDef) => f.defaultValue ?? "";
  const currentOf = (f: FilterDef) => sp.get(f.name) ?? defOf(f);

  function navigate(mut: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    mut(params);
    const qs = params.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  const setValue = (f: FilterDef, value: string) =>
    navigate((p) => (value === defOf(f) ? p.delete(f.name) : p.set(f.name, value)));
  const clearOne = (f: FilterDef) => navigate((p) => p.delete(f.name));
  const resetAll = () => navigate((p) => filters.forEach((f) => p.delete(f.name)));

  const aktive = filters.filter((f) => currentOf(f) !== defOf(f));

  return (
    <div className="filterbar">
      {pending && <span className="filterbar-loading" aria-hidden />}

      <button className="fb-toggle" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={15} /> Filter{aktive.length ? ` (${aktive.length})` : ""}
      </button>

      <div className={`fb-controls${open ? " open" : ""}`}>
        {filters.map((f) => {
          const val = currentOf(f);
          const Icon = f.icon ? FILTER_ICONS[f.icon] : undefined;
          return f.variant === "segmented" ? (
            <Segmented key={f.name} value={val} options={f.options} icon={Icon} ariaLabel={f.label} onChange={(v) => setValue(f, v)} />
          ) : (
            <Select key={f.name} value={val} options={f.options} icon={Icon} ariaLabel={f.label} onChange={(v) => setValue(f, v)} />
          );
        })}
      </div>

      {aktive.length > 0 && (
        <>
          <span className="fb-spacer" />
          <div className="fb-chips">
            {aktive.map((f) => {
              const val = currentOf(f);
              const lbl = f.options.find((o) => o.value === val)?.label ?? val;
              const Icon = f.icon ? FILTER_ICONS[f.icon] : undefined;
              return (
                <span className="fb-chip" key={f.name}>
                  {Icon && <Icon size={12} />}
                  {lbl}
                  <button type="button" aria-label={`Filter ${f.label} entfernen`} onClick={() => clearOne(f)}>
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            <button type="button" className="fb-reset" onClick={resetAll}>Zurücksetzen</button>
          </div>
        </>
      )}
    </div>
  );
}
