"use client";

// Schalter "im Mieterportal sichtbar" für ein Archiv-Dokument.
import { useTransition } from "react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { Eye, EyeOff } from "lucide-react";
import { setzeMieterFreigabe } from "@/lib/actions/archivFreigabe";

export default function FreigabeToggle({ notizId, freigegeben }: { notizId: string; freigegeben: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  // Antwort AUSWERTEN (30.09.2026): Sie wurde verworfen — scheiterte die
  // Action, blieb der Schalter stumm stehen und niemand erfuhr es.
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: "4px 10px", color: freigegeben ? "var(--green)" : "var(--muted)" }}
      title={freigegeben ? "Für den Mieter sichtbar — Klick zum Zurückziehen" : "Für den Mieter im Portal freigeben"}
      disabled={pending}
      onClick={() => startTransition(async () => {
        const f = actionFehler(await setzeMieterFreigabe(notizId, !freigegeben));
        if (f) toast(f, "error");
      })}
    >
      {freigegeben
        ? <><Eye size={12} style={{ verticalAlign: "-2px" }} /> Im Portal</>
        : <><EyeOff size={12} style={{ verticalAlign: "-2px" }} /> Freigeben</>}
    </button>
  );
}
