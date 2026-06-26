"use client";

import type { LucideIcon } from "lucide-react";
import type { SelectOption } from "./Select";

// Segmented-/Pill-Control für Filter mit wenigen Optionen (z. B. Umlage).
export default function Segmented({
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
  return (
    <div className="fbseg" role="group" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {Icon && i === 0 && <Icon size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
