// Animierter Rollen-Flow: „So schnell läuft eine Reparatur" — ein Dokument
// wandert in Sekunden Mieter → Hausmeister → Vermieter/Hausverwaltung → Firma.
// Reines CSS (CSP-konform), Endlos-Schleife in 4 Phasen; bei
// prefers-reduced-motion stehen alle Schritte statisch da.
import { User, Wrench, Building2, Hammer, Camera, ClipboardList, CheckCircle2, CalendarClock } from "lucide-react";

const SCHRITTE = [
  { ico: User, rolle: "Mieter", tat: "meldet den Schaden", detail: "mit Foto — 20 Sekunden", step: Camera },
  { ico: Wrench, rolle: "Hausmeister", tat: "erstellt den Auftrag", detail: "wählt die Firma aus dem Verzeichnis", step: ClipboardList },
  { ico: Building2, rolle: "Vermieter / Verwaltung", tat: "gibt frei", detail: "ein Klick — auch vom Strand", step: CheckCircle2 },
  { ico: Hammer, rolle: "Handwerksfirma", tat: "bekommt den Termin-Link", detail: "mit Kontakt des Mieters", step: CalendarClock },
] as const;

export default function RollenFlow() {
  return (
    <div className="rf" aria-label="Ablauf einer Reparaturmeldung über die vier Rollen">
      <div className="rf-track" aria-hidden>
        <div className="rf-line" />
        <div className="rf-doc">📄</div>
      </div>
      <div className="rf-nodes">
        {SCHRITTE.map((s, i) => (
          <div key={s.rolle} className={`rf-node rf-n${i + 1}`}>
            <div className="rf-avatar"><s.ico size={22} /></div>
            <div className="rf-rolle">{s.rolle}</div>
            <div className="rf-tat"><s.step size={12} /> {s.tat}</div>
            <div className="rf-detail">{s.detail}</div>
          </div>
        ))}
      </div>
      <p className="rf-fazit">
        Vier Beteiligte, ein Vorgang, <strong>keine einzige Telefonkette</strong> — Dokumente,
        Freigaben und Termine fließen in Sekunden durch die App.
      </p>
    </div>
  );
}
