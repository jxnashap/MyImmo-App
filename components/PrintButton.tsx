"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label = "Drucken / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
      onClick={() => window.print()}
    >
      <Printer size={14} /> {label}
    </button>
  );
}
