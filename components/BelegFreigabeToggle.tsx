"use client";

// Schalter "Beleg im Mieterportal einsehbar" für eine Kostenbuchung
// (§ 556 Abs. 4 BGB Belegeinsicht).
import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setzeBelegFreigabe } from "@/lib/actions/archivFreigabe";

export default function BelegFreigabeToggle({ kostenId, freigegeben }: { kostenId: string; freigegeben: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: "3px 8px", color: freigegeben ? "var(--green)" : "var(--muted)" }}
      title={freigegeben ? "Beleg ist für den Mieter sichtbar — Klick zum Zurückziehen" : "Beleg für den Mieter im Portal freigeben (Belegeinsicht)"}
      disabled={pending}
      onClick={() => startTransition(async () => { await setzeBelegFreigabe(kostenId, !freigegeben); })}
    >
      {freigegeben
        ? <><Eye size={12} style={{ verticalAlign: "-2px" }} /> Portal</>
        : <><EyeOff size={12} style={{ verticalAlign: "-2px" }} /></>}
    </button>
  );
}
