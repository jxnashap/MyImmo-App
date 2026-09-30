"use client";

// Knopf zum Hinweis „Objekt-Miete weicht von den Mietern ab" (Objektseite).
// Der Betrag wird serverseitig neu berechnet (gleicheObjektMieteAn).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { gleicheObjektMieteAn } from "@/lib/actions/properties";
import { useToast } from "@/components/Toast";

export default function MieteAngleichen({ id, betrag }: { id: string; betrag: string }) {
  const [laeuft, starte] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const res = await gleicheObjektMieteAn(id);
          if (res.ok) {
            toast(`Objekt-Miete auf ${betrag} gesetzt.`, "success");
            router.refresh();
          } else {
            toast(res.error ?? "Nicht gespeichert.", "error");
          }
        })
      }
    >
      {laeuft ? "Speichert …" : `Objekt-Miete auf ${betrag} setzen`}
    </button>
  );
}
