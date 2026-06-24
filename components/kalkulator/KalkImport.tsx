"use client";

import { useState } from "react";

export type KalkImportResult = {
  name?: string | null;
  kaufpreis?: number | null;
  wert?: number | null;
  flaeche?: number | null;
  zimmer?: number | null;
  baujahr?: number | null;
  miete?: number | null;
  konfidenz?: number | null;
};

export default function KalkImport({ onResult }: { onResult: (d: KalkImportResult) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function auslesen() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const resp = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await resp.json();
      if (!resp.ok) { setError(json.error || "Auslesen fehlgeschlagen."); return; }
      onResult(json as KalkImportResult);
      const k = json.konfidenz != null ? ` · Konfidenz ${json.konfidenz}%` : "";
      setInfo(`✓ Übernommen: ${[json.kaufpreis && "Kaufpreis", json.flaeche && "Fläche", json.miete && "Miete"].filter(Boolean).join(", ") || "—"}${k}`);
    } catch (err) {
      setError(`Fehler: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="card-title">🤖 Aus Anzeige übernehmen</div>
          <div className="card-sub">Exposé-Text einfügen — Claude füllt Kaufpreis, Fläche & Miete</div>
        </div>
        <span style={{ color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="card-body">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Exposé / Anzeigentext hier einfügen…"
            style={{ resize: "vertical", width: "100%" }}
          />
          {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>⚠️ {error}</div>}
          {info && <div style={{ marginTop: 8, fontSize: 12, color: "var(--green)" }}>{info}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button type="button" className="btn btn-gold" onClick={auslesen} disabled={loading || text.trim().length < 30}>
              {loading ? "⏳ Claude liest…" : "Auslesen & übernehmen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
