import { eur2 } from "@/lib/format";
import { addPosition, deletePosition } from "@/lib/actions/positions";

export type Position = {
  id: string;
  bezeichnung: string;
  betrag: number | null;
  umlageschluessel: string | null;
  umlagefaehig: boolean | null;
};

const SCHLUESSEL = ["Fläche", "Personen", "Einheit", "Verbrauch", "direkt"];

// Häufige umlagefähige Positionen als Schnellauswahl
const VORLAGEN = ["Grundsteuer", "Müll", "Abwasser", "Wasser", "Versicherung", "Hausmeister", "Aufzug", "Allgemeinstrom", "Gartenpflege", "Straßenreinigung"];

export default function PositionsManager({
  mieterId,
  positions,
}: {
  mieterId: string;
  positions: Position[];
}) {
  const total = positions.reduce((s, p) => s + (p.betrag ?? 0), 0);
  const add = addPosition.bind(null, mieterId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl">Umlagepositionen</h2>
        <span className="text-sm text-white/50">
          Summe <span className="gold">{eur2(total)}</span>
        </span>
      </div>

      {positions.length === 0 ? (
        <p className="mb-4 text-sm text-white/40">
          Noch keine Positionen. Lege z.B. Müll, Abwasser oder Grundsteuer individuell für diesen Mieter an.
        </p>
      ) : (
        <div className="mb-4 overflow-hidden rounded-[10px] border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-white/50">
              <tr>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Schlüssel</th>
                <th className="px-3 py-2 font-medium">Umlage</th>
                <th className="px-3 py-2 text-right font-medium">Betrag</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const del = deletePosition.bind(null, p.id, mieterId);
                return (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{p.bezeichnung}</td>
                    <td className="px-3 py-2 text-white/60">{p.umlageschluessel || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${p.umlagefaehig ? "badge-ja" : "badge-nein"}`}>
                        {p.umlagefaehig ? "umlagefähig" : "nicht umlagef."}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{eur2(p.betrag)}</td>
                    <td className="px-3 py-2 text-right">
                      <form action={del}>
                        <button className="text-white/30 hover:text-red-400" title="Löschen">✕</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Neue Position */}
      <form action={add} className="flex flex-wrap items-end gap-3 rounded-[10px] border border-white/10 bg-white/[0.02] p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Bezeichnung</span>
          <input name="bezeichnung" list="pos-vorlagen" required placeholder="z.B. Müll" className="input" />
          <datalist id="pos-vorlagen">
            {VORLAGEN.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Betrag (€)</span>
          <input name="betrag" type="number" step="0.01" className="input w-28" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Umlageschlüssel</span>
          <select name="umlageschluessel" className="input">
            <option value="">—</option>
            {SCHLUESSEL.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-white/70">
          <input name="umlagefaehig" type="checkbox" defaultChecked /> umlagefähig
        </label>
        <button className="btn-gold mb-0.5">+ Hinzufügen</button>
      </form>
    </div>
  );
}
