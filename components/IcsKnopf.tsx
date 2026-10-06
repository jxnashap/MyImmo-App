"use client";

// Einen Termin als .ics herunterladen (06.10.2026) — erzeugt im Browser, kein Server-Aufruf.
import { CalendarPlus } from "lucide-react";
import { terminIcs } from "@/lib/freigabeTermin";

export default function IcsKnopf({
  start, titel, ort, beschreibung, uid, dateiname = "termin.ics",
}: {
  start: string;
  titel: string;
  ort?: string | null;
  beschreibung?: string | null;
  uid: string;
  dateiname?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 12 }}
      onClick={() => {
        const blob = new Blob([terminIcs({ start, titel, ort, beschreibung, uid })], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = dateiname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <CalendarPlus size={13} /> In den Kalender
    </button>
  );
}
