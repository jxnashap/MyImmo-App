"use client";

// Umlagepositionen als kleine Tabelle mit IMMER bearbeitbaren Feldern:
// jede gespeicherte Zeile inline änderbar (Autosave onBlur/onChange),
// unten dauerhaft eine leere Eingabezeile für neue Positionen.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eur2 } from "@/lib/format";
import { addPosition, deletePosition, updatePosition } from "@/lib/actions/positions";
import { useToast } from "@/components/Toast";

export type Position = {
  id: string;
  bezeichnung: string;
  betrag: number | null;
  umlageschluessel: string | null;
  umlagefaehig: boolean | null;
  jahr: number | null;
};

const SCHLUESSEL = ["Fläche", "Anzahl", "Personen", "Einheit", "Verbrauch", "direkt"];
const JETZT = new Date().getFullYear();
const JAHRE = [JETZT, JETZT - 1, JETZT - 2, JETZT - 3];

// Häufige umlagefähige Positionen als Schnellauswahl
const VORLAGEN = ["Grundsteuer", "Müll", "Abwasser", "Wasser", "Versicherung", "Hausmeister", "Aufzug", "Allgemeinstrom", "Gartenpflege", "Straßenreinigung"];

type RowState = {
  id: string;
  bezeichnung: string;
  betrag: string; // Eingabewert (String, damit leeres Feld möglich)
  jahr: number | null;
  umlageschluessel: string;
  umlagefaehig: boolean;
};

const toRow = (p: Position): RowState => ({
  id: p.id,
  bezeichnung: p.bezeichnung ?? "",
  betrag: p.betrag != null ? String(p.betrag) : "",
  jahr: p.jahr,
  umlageschluessel: p.umlageschluessel ?? "",
  umlagefaehig: !!p.umlagefaehig,
});

const parseBetrag = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

export default function PositionsManager({
  mieterId,
  positions,
}: {
  mieterId: string;
  positions: Position[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startSave] = useTransition();
  const [rows, setRows] = useState<RowState[]>(positions.map(toRow));
  // Server-Refresh (revalidatePath/router.refresh) synct den lokalen Stand.
  useEffect(() => setRows(positions.map(toRow)), [positions]);

  // Neue-Zeile-Eingaben (immer leer nach dem Hinzufügen)
  const [nBez, setNBez] = useState("");
  const [nBetrag, setNBetrag] = useState("");
  const [nJahr, setNJahr] = useState(JETZT);
  const [nSchl, setNSchl] = useState("");
  const [nUml, setNUml] = useState(true);
  const [adding, startAdd] = useTransition();

  const total = rows.reduce((s, r) => s + (parseBetrag(r.betrag) ?? 0), 0);

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Autosave: nur wenn sich gegenüber dem gespeicherten Stand etwas geändert hat.
  const speichere = (r: RowState) => {
    const orig = positions.find((p) => p.id === r.id);
    const neu = {
      bezeichnung: r.bezeichnung.trim(),
      betrag: parseBetrag(r.betrag),
      jahr: r.jahr,
      umlageschluessel: r.umlageschluessel || null,
      umlagefaehig: r.umlagefaehig,
    };
    if (
      orig &&
      (orig.bezeichnung ?? "") === neu.bezeichnung &&
      (orig.betrag ?? null) === neu.betrag &&
      (orig.jahr ?? null) === neu.jahr &&
      (orig.umlageschluessel ?? null) === neu.umlageschluessel &&
      !!orig.umlagefaehig === neu.umlagefaehig
    )
      return; // nichts geändert
    if (!neu.bezeichnung) return; // leere Bezeichnung nicht speichern
    startSave(async () => {
      const res = await updatePosition(r.id, mieterId, neu);
      if (res.ok) {
        toast("Gespeichert ✓");
        router.refresh();
      } else {
        toast("Speichern fehlgeschlagen.");
      }
    });
  };

  const loesche = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    startSave(async () => {
      await deletePosition(id, mieterId);
      router.refresh();
    });
  };

  const hinzufuegen = () => {
    if (!nBez.trim() || adding) return;
    const fd = new FormData();
    fd.set("bezeichnung", nBez.trim());
    fd.set("betrag", nBetrag);
    fd.set("jahr", String(nJahr));
    fd.set("umlageschluessel", nSchl);
    if (nUml) fd.set("umlagefaehig", "on");
    startAdd(async () => {
      await addPosition(mieterId, fd);
      setNBez("");
      setNBetrag("");
      setNJahr(JETZT);
      setNSchl("");
      setNUml(true);
      toast("Position hinzugefügt ✓");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl">Umlagepositionen</h2>
        <span className="text-sm text-[var(--muted)]">
          Summe <span className="gold">{eur2(total)}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mb-4 text-sm text-[var(--muted)]">
          Noch keine Positionen. Lege z.B. Müll, Abwasser oder Grundsteuer individuell für diesen Mieter an.
        </p>
      ) : (
        <div className="mb-4 overflow-hidden rounded-[10px] border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg3)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Jahr</th>
                <th className="px-3 py-2 font-medium">Schlüssel</th>
                <th className="px-3 py-2 font-medium">Umlage</th>
                <th className="px-3 py-2 text-right font-medium">Betrag</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1.5">
                    <input
                      className="input"
                      list="pos-vorlagen"
                      value={r.bezeichnung}
                      onChange={(e) => setRow(r.id, { bezeichnung: e.target.value })}
                      onBlur={() => speichere({ ...r })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className="input"
                      value={r.jahr ?? ""}
                      onChange={(e) => {
                        const jahr = e.target.value ? Number(e.target.value) : null;
                        setRow(r.id, { jahr });
                        speichere({ ...r, jahr });
                      }}
                    >
                      <option value="">—</option>
                      {[...new Set([...(r.jahr ? [r.jahr] : []), ...JAHRE])].sort((a, b) => b - a).map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className="input"
                      value={r.umlageschluessel}
                      onChange={(e) => {
                        setRow(r.id, { umlageschluessel: e.target.value });
                        speichere({ ...r, umlageschluessel: e.target.value });
                      }}
                    >
                      <option value="">—</option>
                      {SCHLUESSEL.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={r.umlagefaehig}
                        onChange={(e) => {
                          setRow(r.id, { umlagefaehig: e.target.checked });
                          speichere({ ...r, umlagefaehig: e.target.checked });
                        }}
                        style={{ accentColor: "var(--gold)" }}
                      />
                      <span className={`badge ${r.umlagefaehig ? "badge-ja" : "badge-nein"}`}>
                        {r.umlagefaehig ? "umlagefähig" : "nicht umlagef."}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      className="input w-28 text-right"
                      type="number"
                      step="0.01"
                      value={r.betrag}
                      onChange={(e) => setRow(r.id, { betrag: e.target.value })}
                      onBlur={() => speichere({ ...r })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => loesche(r.id)}
                      className="text-[var(--faint)] hover:text-[var(--red)]"
                      title="Löschen"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <datalist id="pos-vorlagen">
        {VORLAGEN.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {/* Neue Position — dauerhaft leere Eingabezeile */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          hinzufuegen();
        }}
        className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg3)] p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Bezeichnung</span>
          <input
            list="pos-vorlagen"
            required
            placeholder="z.B. Müll"
            className="input"
            value={nBez}
            onChange={(e) => setNBez(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Betrag (€)</span>
          <input
            type="number"
            step="0.01"
            className="input w-28"
            value={nBetrag}
            onChange={(e) => setNBetrag(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Jahr</span>
          <select className="input" value={nJahr} onChange={(e) => setNJahr(Number(e.target.value))}>
            {JAHRE.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Umlageschlüssel</span>
          <select className="input" value={nSchl} onChange={(e) => setNSchl(e.target.value)}>
            <option value="">—</option>
            {SCHLUESSEL.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={nUml}
            onChange={(e) => setNUml(e.target.checked)}
            style={{ accentColor: "var(--gold)" }}
          />{" "}
          umlagefähig
        </label>
        <button className="btn-gold mb-0.5" disabled={adding}>
          {adding ? "Speichert…" : "+ Hinzufügen"}
        </button>
      </form>
    </div>
  );
}
