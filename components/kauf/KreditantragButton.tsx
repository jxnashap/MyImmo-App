"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useToast } from "@/components/Toast";
import { KAUF_AUSWAHL_KEY } from "@/lib/kauf/auswahl";
import { KAUF_DARLEHEN_KEY } from "@/lib/kauf/darlehen";

function lies(key: string): unknown {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}

export default function KreditantragButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function erzeuge() {
    setBusy(true);
    try {
      const res = await fetch("/api/kauf/kreditantrag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auswahl: lies(KAUF_AUSWAHL_KEY), darlehen: lies(KAUF_DARLEHEN_KEY) }),
      });
      if (!res.ok) {
        let msg = "PDF konnte nicht erstellt werden.";
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        toast(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast("Netzwerkfehler beim Erstellen des PDFs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={erzeuge} disabled={busy}>
      <FileText size={14} style={{ verticalAlign: "-2px" }} /> {busy ? "Erstelle…" : "Kreditantrag / Selbstauskunft als PDF"}
    </button>
  );
}
