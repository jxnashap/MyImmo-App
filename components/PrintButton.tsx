"use client";

export default function PrintButton({ label = "🖨 Drucken / PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.print()}>
      {label}
    </button>
  );
}
