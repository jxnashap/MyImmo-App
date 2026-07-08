"use client";
import { Bot, Hourglass, TriangleAlert, X } from "lucide-react";

// „Aus Anzeige übernehmen": Exposé-LINK laden (Server holt + KI liest) ODER
// Text einfügen (Fallback). Beide Wege liefern dieselbe Response-Shape
// ({ data: {...} }) und zeigen danach einen bleibenden Prüf-Hinweis mit
// Konfidenz, bis der Nutzer ihn schließt oder ein übernommenes Feld ändert.

import { useEffect, useRef, useState } from "react";

export type KalkImportResult = {
  name?: string | null;
  adresse?: string | null;
  kaufpreis?: number | null;
  wert?: number | null;
  flaeche?: number | null;
  zimmer?: number | null;
  baujahr?: number | null;
  miete?: number | null;
  konfidenz?: number | null;
};

export default function KalkImport({
  onResult,
  beobachten,
}: {
  onResult: (d: KalkImportResult) => void;
  // Optional: Feldwerte des Elternteils — ändert der Nutzer eines davon,
  // verschwindet der Prüf-Hinweis (Werte wurden geprüft/korrigiert).
  beobachten?: unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState<"url" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<{ konfidenz: number | null } | null>(null);

  // Prüf-Hinweis schließen, sobald sich ein beobachtetes Feld NACH der
  // Übernahme ändert. Direkt nach onResult ändern sich die Werte durch die
  // Übernahme selbst — erster Effekt-Lauf nimmt daher nur den Schnappschuss.
  const beobachtetJson = JSON.stringify(beobachten ?? []);
  const schnappschuss = useRef<string | null>(null);
  useEffect(() => {
    if (!hinweis) return;
    if (schnappschuss.current === null) {
      schnappschuss.current = beobachtetJson;
      return;
    }
    if (beobachtetJson !== schnappschuss.current) {
      setHinweis(null);
      schnappschuss.current = null;
    }
  }, [beobachtetJson, hinweis]);

  async function rufeAb(endpoint: string, body: object, modus: "url" | "text") {
    setError(null);
    setHinweis(null);
    schnappschuss.current = null;
    setLoading(modus);
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const basis = json.error || "Auslesen fehlgeschlagen.";
        setError(modus === "url" ? `${basis} …oder Text unten einfügen.` : basis);
        return;
      }
      const d = (json.data ?? {}) as KalkImportResult;
      onResult(d);
      setHinweis({ konfidenz: d.konfidenz ?? null });
    } catch (err) {
      setError(`Fehler: ${(err as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  const konfidenz = hinweis?.konfidenz ?? null;
  const niedrig = konfidenz != null && konfidenz < 70;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="card-title"><Bot size={16} style={{ verticalAlign: "-3px" }} /> Aus Anzeige übernehmen</div>
          <div className="card-sub">Exposé-Link einfügen oder Text — MyImmo füllt die Felder</div>
        </div>
        <span style={{ color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="card-body">
          {/* Link-Weg */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… Link zu Exposé, Inserat oder PDF"
              style={{ flex: "1 1 260px" }}
            />
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => rufeAb("/api/import-url", { url: url.trim() }, "url")}
              disabled={loading !== null || !/^https?:\/\/.+\..+/.test(url.trim())}
            >
              {loading === "url" ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> Lade &amp; werte Seite aus…</> : "Aus Link laden"}
            </button>
          </div>

          <div style={{ margin: "10px 0 6px", fontSize: 11.5, color: "var(--faint)" }}>
            …oder Exposé-Text einfügen:
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Exposé / Anzeigentext hier einfügen…"
            style={{ resize: "vertical", width: "100%" }}
          />

          {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {error}</div>}

          {hinweis && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 12.5,
                background: "var(--gold-pale, rgba(184,144,43,.12))",
                border: `1px solid ${niedrig ? "var(--red)" : "var(--gold-dim, var(--gold))"}`,
                color: "var(--text)",
              }}
            >
              <TriangleAlert size={15} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong>Automatisch aus dem Exposé ausgelesen</strong> — bitte alle übernommenen
                Werte prüfen und ggf. korrigieren (ohne Gewähr).
                {konfidenz != null && (
                  <span style={{ fontWeight: 700, color: niedrig ? "var(--red)" : "var(--gold)" }}>
                    {" "}
                    Konfidenz: {konfidenz} %{niedrig ? " — niedrig, Angaben besonders genau prüfen!" : ""}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setHinweis(null);
                  schnappschuss.current = null;
                }}
                title="Hinweis schließen"
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, lineHeight: "18px" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => rufeAb("/api/import", { text }, "text")}
              disabled={loading !== null || text.trim().length < 30}
            >
              {loading === "text" ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> Claude liest…</> : "Auslesen & übernehmen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
