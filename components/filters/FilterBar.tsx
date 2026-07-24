"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import Select, { type SelectOption } from "./Select";
import Segmented from "./Segmented";
import Toggle from "./Toggle";
import { FILTER_ICONS, type FilterIcon } from "./icons";

export type FilterDef = {
  name: string;                                   // searchParam-Schlüssel
  label: string;                                  // für aria + Chip
  icon?: FilterIcon;                              // Icon-Name (serialisierbar)
  variant?: "select" | "segmented" | "toggle" | "search"; // default: select
  defaultValue?: string;                          // Wert, der „kein Filter" bedeutet (default "")
  placeholder?: string;                           // nur variant "search"
  options: SelectOption[];                        // bei toggle: options[0] = „An"-Zustand; bei search leer
};

// Debounced Freitextsuche — schreibt wie die anderen Varianten in die URL-Query.
function SearchField({ value, placeholder, ariaLabel, onCommit }: {
  value: string; placeholder?: string; ariaLabel: string; onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => setText(value), [value]); // extern zurückgesetzt (Chip-X / Zurücksetzen)
  return (
    <input
      className="set-input fb-search"
      type="search"
      value={text}
      placeholder={placeholder ?? "Suchen…"}
      aria-label={ariaLabel}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => onCommit(v.trim()), 350);
      }}
    />
  );
}

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
          if (f.variant === "search")
            return <SearchField key={f.name} value={val} placeholder={f.placeholder} ariaLabel={f.label} onCommit={(v) => setValue(f, v)} />;
          if (f.variant === "segmented")
            return <Segmented key={f.name} value={val} options={f.options} ariaLabel={f.label} onChange={(v) => setValue(f, v)} />;
          if (f.variant === "toggle") {
            const on = f.options[0];
            return <Toggle key={f.name} active={val === on.value} label={on.label} onChange={(next) => setValue(f, next ? on.value : defOf(f))} />;
          }
          return <Select key={f.name} value={val} options={f.options} icon={Icon} ariaLabel={f.label} onChange={(v) => setValue(f, v)} />;
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
