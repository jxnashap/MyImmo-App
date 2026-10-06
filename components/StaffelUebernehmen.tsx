"use client";

// Staffelplan → Mietkonto (Paket B, 06.10.2026). Ein Klick legt jede Stufe als Miet-Zeitraum an;
// danach rechnen Mietkonto, Rückstands-Wächter und Dashboard ab dem jeweiligen Monat mit der
// Stufe. Vorher erzeugte der Plan nur eine Erinnerung — das Soll blieb die Anfangsmiete.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { uebernehmeStaffel } from "@/lib/actions/mietzeitraeume";

export default function StaffelUebernehmen({ mieterId, offen }: { mieterId: string; offen: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (offen === 0) {
    return <span style={{ fontSize: 12, color: "var(--green)" }}>Alle Stufen sind im Mietkonto hinterlegt.</span>;
  }
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 12 }}
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const r = await uebernehmeStaffel(mieterId);
            if (!r.ok) return toast(r.error ?? "Übernahme fehlgeschlagen.", "error");
            toast(r.stufen ? `${r.stufen} Stufe${r.stufen === 1 ? "" : "n"} ins Mietkonto übernommen.` : "Schon übernommen.");
            router.refresh();
          } catch {
            toast("Übernahme fehlgeschlagen.", "error");
          }
        })
      }
    >
      {pending ? "…" : `${offen} Stufe${offen === 1 ? "" : "n"} ins Mietkonto übernehmen`}
    </button>
  );
}
