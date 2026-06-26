"use client";

import { Check } from "lucide-react";

// Ein-/Aus-Schalter als Pill-Button (z. B. „Umlagefähig").
export default function Toggle({
  active,
  label,
  onChange,
}: {
  active: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" className="fbtgl" aria-pressed={active} onClick={() => onChange(!active)}>
      <span className="dot" aria-hidden>{active && <Check size={10} strokeWidth={3} />}</span>
      {label}
    </button>
  );
}
