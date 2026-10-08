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
    <button data-demo-sperre
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: "3px 8px", color: freigegeben ? "var(--green)" : "var(--muted)" }}
      title={freigegeben ? "Beleg ist für alle Mieter des Objekts sichtbar — Klick zum Zurückziehen" : "Beleg im Portal freigeben — sichtbar für alle verbundenen Mieter dieses Objekts, deren Mietzeit das Belegjahr umfasst (Belegeinsicht)"}
      disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await setzeBelegFreigabe(kostenId, !freigegeben);
        const f = actionFehler(r);
        if (f) return toast(f, "error");
        // S7: sagen, WEM der Beleg jetzt angezeigt wird — „alle Mieter“ war zu unbestimmt.
        if (!freigegeben && "sichtbarFuer" in r) {
          const n = r.sichtbarFuer;
          if (n === null) toast("Beleg freigegeben. Wie viele Mieter ihn sehen, ließ sich gerade nicht ermitteln.", "info");
          else if (n === 0) toast("Beleg freigegeben — derzeit sieht ihn niemand: Kein Mieter dieses Objekts mit Mietzeit im Belegjahr hat ein verbundenes Konto.", "info");
          else toast(`Beleg freigegeben — sichtbar für ${n} ${n === 1 ? "verbundenes Mieterkonto" : "verbundene Mieterkonten"} in diesem Objekt.`);
        }
      })}
    >
      {freigegeben
        ? <><Eye size={12} style={{ verticalAlign: "-2px" }} /> Portal</>
        : <><EyeOff size={12} style={{ verticalAlign: "-2px" }} /></>}
    </button>
  );
}
