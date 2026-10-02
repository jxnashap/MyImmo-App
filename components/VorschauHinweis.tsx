// Platzhalter für einen Knopf, den es in der Mieterportal-Vorschau nicht
// gibt (01.10.2026). Der Vermieter sieht, WO sein Mieter etwas auslösen kann,
// ohne dass er es selbst im Namen des Mieters tun könnte.
import { Eye } from "lucide-react";

export default function VorschauHinweis({ was }: { was: string }) {
  return (
    <span className="badge badge-neutral" title="In der Vorschau deaktiviert" style={{ fontSize: 11 }}>
      <Eye size={11} style={{ verticalAlign: "-1px" }} /> Mieter sieht hier: {was}
    </span>
  );
}
