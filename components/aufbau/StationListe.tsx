import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Station, StationStatus } from "@/lib/fahrplan";

// Stationen des Fahrplans als Liste — EINE Darstellung für /fahrplan (alle Schritte) und die
// Schritt-Seiten des Kaufwegs (z. B. /abschluss). Texte und Status: lib/fahrplan.ts.

const BADGE: Record<StationStatus["art"], string> = {
  erledigt: "badge-green",
  teilweise: "badge-amber",
  offen: "badge-neutral",
  info: "badge-neutral",
};

export default function StationListe({ stationen, start = 1 }: { stationen: Station[]; start?: number }) {
  return (
    <ol className="fahrplan" start={start}>
      {stationen.map((s, i) => (
        <li key={s.id} className={`fahrplan-station${s.status?.art === "erledigt" ? " fertig" : ""}`}>
          <span className="fahrplan-nummer" aria-hidden>{start + i}</span>
          <div className="fahrplan-inhalt">
            <div className="fahrplan-kopf">
              <h4>{s.titel}</h4>
              {s.status && <span className={`badge ${BADGE[s.status.art]}`}>{s.status.text}</span>}
            </div>
            <p>{s.satz}</p>
            {s.punkte.length > 0 && (
              <ul>
                {s.punkte.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {s.ziel && (
              <Link href={s.ziel.href} className="fahrplan-link">
                {s.ziel.label} <ChevronRight size={14} aria-hidden />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
