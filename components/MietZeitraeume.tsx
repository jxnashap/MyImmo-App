"use client";
import { X, Plus } from "lucide-react";

// Miet-Zeiträume beim Mieter: Liste mit inline bearbeitbaren Perioden
// (von/bis als Monat, Kaltmiete/NK/Stellplatz) + Zeile zum Hinzufügen.
// Autosave onBlur/onChange wie im PositionsManager.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eur2 } from "@/lib/format";
import {
  createMietZeitraum,
  updateMietZeitraum,
  deleteMietZeitraum,
} from "@/lib/actions/mietzeitraeume";
import { useToast } from "@/components/Toast";
import type { MietZeitraum } from "@/lib/types";

type RowState = {
  id: string;
  von: string; // YYYY-MM
  bis: string; // YYYY-MM oder ""
  kaltmiete: string;
  nk: string;
  stellplatz: string;
};

const zuMonat = (d: string | null) => (d ? d.slice(0, 7) : "");
const toRow = (z: MietZeitraum): RowState => ({
  id: z.id,
  von: zuMonat(z.von),
  bis: zuMonat(z.bis),
  kaltmiete: z.kaltmiete != null ? String(z.kaltmiete) : "",
  nk: z.nk_vorauszahlung != null ? String(z.nk_vorauszahlung) : "",
  stellplatz: z.stellplatz_miete != null ? String(z.stellplatz_miete) : "",
});

const fd = (r: Omit<RowState, "id">) => {
  const f = new FormData();
  f.set("von", r.von);
  f.set("bis", r.bis);
  f.set("kaltmiete", r.kaltmiete);
  f.set("nk_vorauszahlung", r.nk);
  f.set("stellplatz_miete", r.stellplatz);
  return f;
};

const monatLabel = (m: string) =>
  m ? new Date(`${m}-01`).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" }) : "";

export default function MietZeitraeume({
  mieterId,
  zeitraeume,
}: {
  mieterId: string;
  zeitraeume: MietZeitraum[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startSave] = useTransition();
  const [rows, setRows] = useState<RowState[]>(zeitraeume.map(toRow));
  useEffect(() => setRows(zeitraeume.map(toRow)), [zeitraeume]);

  const leer = { von: "", bis: "", kaltmiete: "", nk: "", stellplatz: "" };
  const [neu, setNeu] = useState(leer);
  const [adding, startAdd] = useTransition();

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const speichere = (r: RowState) => {
    const orig = zeitraeume.find((z) => z.id === r.id);
    if (orig && JSON.stringify(toRow(orig)) === JSON.stringify(r)) return; // nichts geändert
    if (!r.von) return;
    startSave(async () => {
      const res = await updateMietZeitraum(r.id, mieterId, fd(r));
      toast(res.ok ? "Gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.");
      if (res.ok) router.refresh();
    });
  };

  const loesche = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    startSave(async () => {
      await deleteMietZeitraum(id, mieterId);
      router.refresh();
    });
  };

  const hinzufuegen = () => {
    if (!neu.von || adding) return;
    startAdd(async () => {
      const res = await createMietZeitraum(mieterId, fd(neu));
      toast(res.ok ? "Zeitraum hinzugefügt ✓" : res.error ?? "Speichern fehlgeschlagen.");
      if (res.ok) {
        setNeu(leer);
        router.refresh();
      }
    });
  };

  const inputStil: React.CSSProperties = {
    background: "var(--bg3)",
    border: "1px solid var(--line2)",
    color: "var(--text)",
    borderRadius: 7,
    padding: "7px 9px",
    fontSize: 12.5,
    width: "100%",
  };
  const feld = (breite: number | string): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    color: "var(--muted)",
    width: breite,
  });

  return (
    <div className="section">
      <div className="section-header">
        <h3>Miet-Zeiträume</h3>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          unterschiedliche Miete je Zeitraum — Basis für die Monatsbestätigung
        </span>
      </div>
      <div className="section-body">
        {rows.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 12, marginBottom: 12 }}>
            Noch keine Zeiträume. Lege z. B. „01/2021 – 12/2023 · 800 €" und „ab 01/2024 · 900 €" an —
            die Monatsbestätigung nutzt dann automatisch den passenden Betrag.
          </p>
        ) : (
          rows.map((r) => {
            const laufend = !r.bis;
            return (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--line)" }}
              >
                <label style={feld(120)}>
                  <span>Von (Monat)</span>
                  <input type="month" style={inputStil} value={r.von} onChange={(e) => setRow(r.id, { von: e.target.value })} onBlur={() => speichere({ ...r })} />
                </label>
                <label style={feld(120)}>
                  <span>Bis (leer = läuft)</span>
                  <input type="month" style={inputStil} value={r.bis} onChange={(e) => setRow(r.id, { bis: e.target.value })} onBlur={() => speichere({ ...r })} />
                </label>
                <label style={feld(96)}>
                  <span>Kaltmiete (€)</span>
                  <input type="number" step="0.01" style={inputStil} value={r.kaltmiete} onChange={(e) => setRow(r.id, { kaltmiete: e.target.value })} onBlur={() => speichere({ ...r })} />
                </label>
                <label style={feld(96)}>
                  <span>NK-VZ (€)</span>
                  <input type="number" step="0.01" style={inputStil} value={r.nk} onChange={(e) => setRow(r.id, { nk: e.target.value })} onBlur={() => speichere({ ...r })} />
                </label>
                <label style={feld(96)}>
                  <span>Stellplatz (€)</span>
                  <input type="number" step="0.01" style={inputStil} value={r.stellplatz} onChange={(e) => setRow(r.id, { stellplatz: e.target.value })} onBlur={() => speichere({ ...r })} />
                </label>
                <span className={`badge ${laufend ? "badge-green" : "badge-teal"}`} style={{ marginBottom: 8 }}>
                  {laufend ? `ab ${monatLabel(r.von)} · laufend` : `${monatLabel(r.von)} – ${monatLabel(r.bis)}`}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 9 }}>
                  Warm: {eur2((Number(r.kaltmiete) || 0) + (Number(r.nk) || 0) + (Number(r.stellplatz) || 0))}
                </span>
                <button
                  type="button"
                  className="delete-btn"
                  title="Zeitraum löschen"
                  onClick={() => loesche(r.id)}
                  style={{ marginBottom: 6, marginLeft: "auto" }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}

        {/* Neue Zeile */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            hinzufuegen();
          }}
          style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 12, padding: "12px 14px", background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10 }}
        >
          <label style={feld(120)}>
            <span>Von (Monat) *</span>
            <input type="month" required style={inputStil} value={neu.von} onChange={(e) => setNeu((n) => ({ ...n, von: e.target.value }))} />
          </label>
          <label style={feld(120)}>
            <span>Bis (optional)</span>
            <input type="month" style={inputStil} value={neu.bis} onChange={(e) => setNeu((n) => ({ ...n, bis: e.target.value }))} />
          </label>
          <label style={feld(96)}>
            <span>Kaltmiete (€)</span>
            <input type="number" step="0.01" style={inputStil} value={neu.kaltmiete} onChange={(e) => setNeu((n) => ({ ...n, kaltmiete: e.target.value }))} />
          </label>
          <label style={feld(96)}>
            <span>NK-VZ (€)</span>
            <input type="number" step="0.01" style={inputStil} value={neu.nk} onChange={(e) => setNeu((n) => ({ ...n, nk: e.target.value }))} />
          </label>
          <label style={feld(96)}>
            <span>Stellplatz (€)</span>
            <input type="number" step="0.01" style={inputStil} value={neu.stellplatz} onChange={(e) => setNeu((n) => ({ ...n, stellplatz: e.target.value }))} />
          </label>
          <button className="btn btn-gold" disabled={adding} style={{ marginBottom: 2 }}>
            {adding ? "Speichert…" : <><Plus size={14} style={{ verticalAlign: "-2px" }} /> Zeitraum</>}
          </button>
        </form>
      </div>
    </div>
  );
}
