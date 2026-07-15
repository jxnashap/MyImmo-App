"use client";
import { FileText, Hourglass, Paperclip, TriangleAlert, CheckCircle2 } from "lucide-react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPositionsBulk } from "@/lib/actions/positions";

type Pos = { name: string; betrag: number };
const eur = (n: number) => "€ " + (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NkOcrUpload({ mieterId }: { mieterId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionen, setPositionen] = useState<Pos[] | null>(null);
  const [check, setCheck] = useState<boolean[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setPositionen(null); setLoading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const isPdf = file.type === "application/pdf";
      const resp = await fetch("/api/nk-ocr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, mediaType: file.type, isPdf }),
      });
      const json = await resp.json();
      if (!resp.ok) { setError(json.error || "Fehler beim Auslesen."); return; }
      const list = (json.positionen ?? []).filter((p: Pos) => p && p.name) as Pos[];
      if (list.length === 0) { setError("Keine umlagefähigen Positionen erkannt."); return; }
      setPositionen(list);
      setCheck(list.map(() => true));
    } catch (err) {
      setError(`Fehler: ${(err as Error).message}`);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function uebernehmen() {
    if (!positionen) return;
    const auswahl = positionen.filter((_, i) => check[i]);
    if (auswahl.length === 0) return;
    setSaving(true);
    try {
      await addPositionsBulk(mieterId, JSON.stringify(auswahl));
      setPositionen(null);
      router.refresh();
    } catch (err) {
      setError(`Speichern fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><div><div className="card-title"><FileText size={16} style={{ verticalAlign: "-3px" }} /> Nebenkostenabrechnung hochladen</div><div className="card-sub">PDF/Bild — Claude liest die umlagefähigen Positionen aus</div></div></div>
      <div className="card-body">
        <label className="btn btn-ghost" style={{ fontSize: 12, cursor: "pointer", display: "inline-flex" }}>
          {loading ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> Claude liest aus…</> : <><Paperclip size={14} style={{ verticalAlign: "-2px" }} /> Datei wählen (PDF/Bild)</>}
          <input type="file" accept="application/pdf,image/*" onChange={onFile} disabled={loading} style={{ display: "none" }} />
        </label>
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
          KI-Auswertung (Anthropic Claude): Das Dokument wird zur Auswertung an die API
          übermittelt (kein Modell-Training mit Ihren Daten). Die KI kann sich irren —
          bitte alle erkannten Beträge vor der Übernahme prüfen.
        </p>

        {error && <div style={{ marginTop: 10, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--red)" }}><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {error}</div>}

        {positionen && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{positionen.length} Position(en) erkannt — auswählen und übernehmen:</div>
            {positionen.map((p, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={check[i]} onChange={(e) => setCheck((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} style={{ width: "auto" }} />
                <span style={{ flex: 1 }}>{p.name}</span>
                <strong>{eur(p.betrag)}</strong>
              </label>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPositionen(null)}>Verwerfen</button>
              <button type="button" className="btn btn-gold" onClick={uebernehmen} disabled={saving}>{saving ? "Speichern…" : <><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> Positionen übernehmen</>}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
