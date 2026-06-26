"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";

export type SelectOption = { value: string; label: string };

// Zugängliche, eigene Select-Komponente (Listbox) — Tastatur, Outside-Click,
// animiertes Öffnen, Gold-Fokus. Ersetzt das native <select>.
export default function Select({
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, options, value]);

  // Aktive Option ins Sichtfeld scrollen (über Index – useId() enthält
  // Doppelpunkte und wäre als CSS-Selektor ungültig).
  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active].value); }
    else if (e.key === "Tab") { setOpen(false); }
  }

  return (
    <div className="fbsel" ref={rootRef}>
      <button
        type="button"
        className="fbsel-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        {Icon && <span className="fbsel-icon"><Icon size={15} /></span>}
        <span className="lbl">{current?.label}</span>
        <ChevronDown size={15} className="chev" />
      </button>

      {open && (
        <ul className="fbsel-pop" role="listbox" aria-label={ariaLabel} ref={listRef} tabIndex={-1}>
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={selected}
                className={`fbsel-opt${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
              >
                <span style={{ width: 14, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>
                  {selected && <Check size={14} />}
                </span>
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
