// Auswahl „Art der Arbeit“ (05.10.2026) — Pflicht bei jedem neuen Auftrag. Sie entscheidet, ob
// der Hausmeister selbst erledigen darf (lib/taetigkeiten.ts). Zwei Gruppen, damit man beim
// Auswählen sieht, was die Wahl bedeutet.
import { TAETIGKEITEN } from "@/lib/taetigkeiten";

export default function TaetigkeitWahl({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <select name="taetigkeit" required defaultValue={defaultValue}>
      <option value="" disabled>– Art der Arbeit wählen –</option>
      <optgroup label="Hausmeister darf selbst erledigen">
        {TAETIGKEITEN.filter((t) => t.selbst).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </optgroup>
      <optgroup label="Nur mit Fachbetrieb">
        {TAETIGKEITEN.filter((t) => !t.selbst).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </optgroup>
    </select>
  );
}
