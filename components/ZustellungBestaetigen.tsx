"use client";

// Mieter: „Gelesen und zur Kenntnis genommen“ an einem zugestellten Dokument
// (02.10.2026). Bewusst KEINE Unterschrift — nur der Zeitpunkt dieses Klicks wird
// festgehalten (Entscheidung des Betreibers, docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { bestaetigeZustellung } from "@/lib/actions/zustellung";
import VorschauHinweis from "@/components/VorschauHinweis";

export default function ZustellungBestaetigen({ zustellungId, nurLesen = false }: { zustellungId: string; nurLesen?: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  if (nurLesen) return <VorschauHinweis was="„Gelesen und bestätigt“" />;
  return (
    <button
      type="button"
      className="btn btn-gold"
      style={{ fontSize: 11, padding: "4px 10px" }}
      disabled={pending}
      title="Bestätigt, dass du das Dokument gelesen hast — keine Unterschrift, keine Zustimmung zum Inhalt"
      onClick={() => startTransition(async () => {
        const f = actionFehler(await bestaetigeZustellung(zustellungId));
        if (f) toast(f, "error");
        else toast("Bestätigt — dein Vermieter sieht den Zeitpunkt.");
      })}
    >
      <CheckCircle2 size={12} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Gelesen und bestätigt"}
    </button>
  );
}
