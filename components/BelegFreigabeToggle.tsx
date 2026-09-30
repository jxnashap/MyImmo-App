"use client";

// Schalter "Beleg im Mieterportal einsehbar" für eine Kostenbuchung
// (§ 556 Abs. 4 BGB Belegeinsicht).
import { useTransition } from "react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { Eye, EyeOff } from "lucide-react";
import { setzeBelegFreigabe } from "@/lib/actions/archivFreigabe";

export default function BelegFreigabeToggle({ kostenId, freigegeben }: { kostenId: string; freigegeben: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  // Antwort AUSWERTEN (30.09.2026): Sie wurde verworfen — scheiterte die
  // Action, blieb der Schalter stumm stehen und niemand erfuhr es.
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: "3px 8px", color: freigegeben ? "var(--green)" : "var(--muted)" }}
      title={freigegeben ? "Beleg ist für alle Mieter des Objekts sichtbar — Klick zum Zurückziehen" : "Beleg im Portal freigeben — sichtbar für ALLE Mieter dieses Objekts (Belegeinsicht)"}
      disabled={pending}
      onClick={() => startTransition(async () => {
        const f = actionFehler(await setzeBelegFreigabe(kostenId, !freigegeben));
        if (f) toast(f, "error");
      })}
    >
      {freigegeben
        ? <><Eye size={12} style={{ verticalAlign: "-2px" }} /> Portal</>
        : <><EyeOff size={12} style={{ verticalAlign: "-2px" }} /></>}
    </button>
  );
}
