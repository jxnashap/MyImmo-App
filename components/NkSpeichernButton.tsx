"use client";
import { Save } from "lucide-react";

// „Speichern" neben dem NK-Download: erzeugt dasselbe PDF serverseitig und
// legt es beim Mieter + im Archiv ab (Server-Action speichereNk).

import { useTransition } from "react";
import { useToast } from "@/components/Toast";
import { speichereNk } from "@/lib/actions/dokumente";

export default function NkSpeichernButton({ mieterId, jahr }: { mieterId: string; jahr: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const speichern = (zustellen: boolean) =>
    startTransition(async () => {
      const res = await speichereNk(mieterId, jahr, zustellen);
      toast(
        res.ok
          ? zustellen
            ? "Gespeichert & im Mieterportal zugestellt ✓"
            : "Beim Mieter & im Archiv gespeichert ✓"
          : res.error ?? "Speichern fehlgeschlagen.",
      );
    });

  return (
    <>
      <button type="button" className="btn btn-outline" disabled={pending} onClick={() => speichern(false)}>
        {pending ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern</>}
      </button>
      <button
        type="button"
        className="btn btn-gold"
        disabled={pending}
        title="Speichert die Abrechnung und macht sie sofort im Mieterportal sichtbar"
        onClick={() => speichern(true)}
      >
        {pending ? "…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern &amp; zustellen</>}
      </button>
    </>
  );
}
