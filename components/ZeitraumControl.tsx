"use client";

import { ZEITRAEUME } from "@/lib/zeitraum";
import { useZeitraum } from "./ZeitraumProvider";

// Segmented-Control (Trade-Republic-Stil): 1M · 1J · 5J · Max.
// Aktiver Button hervorgehoben, Rest dezent; kompakt & mobil-tauglich.
export default function ZeitraumControl() {
  const { zeitraum, setZeitraum } = useZeitraum();
  return (
    <div
      role="group"
      aria-label="Zeitraum wählen"
      style={{
        display: "inline-flex",
        gap: 2,
        background: "var(--bg4)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 2,
      }}
    >
      {ZEITRAEUME.map((z) => {
        const active = z === zeitraum;
        return (
          <button
            key={z}
            type="button"
            aria-pressed={active}
            onClick={() => setZeitraum(z)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              transition: "background 0.12s",
              background: active ? "var(--gold)" : "transparent",
              color: active ? "#1a1a17" : "var(--muted)",
            }}
          >
            {z}
          </button>
        );
      })}
    </div>
  );
}
