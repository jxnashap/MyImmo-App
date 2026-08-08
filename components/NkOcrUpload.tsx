"use client";
import { FileText, Hourglass, Paperclip, TriangleAlert, CheckCircle2 } from "lucide-react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPositionsBulk } from "@/lib/actions/positions";

// Abrechnung der Hausverwaltung hochladen → Claude liest die Positionen aus →
// Vorschau → Übernahme ins angegebene Abrechnungsjahr. Nichts wird ohne den
// letzten Klick gespeichert.
//
// Die API liefert je Position getrennt die Gebäude-Gesamtkosten und den in der
// Abrechnung ausgewiesenen Wohnungsanteil. Liegen Gesamtkosten UND die
// Gesamtwohnfläche vor, wird die Position als Flächen-Aufteilung übernommen —
// die App rechnet den Mieteranteil selbst und weist Gesamtkosten samt
// Rechenweg in der Abrechnung aus (BGH-Pflichtangaben). Sonst wird der
// ausgewiesene Anteil direkt übernommen.

type Pos = { name: string; gesamt: number | null; anteil: number | null };
const eur = (n: number) => "€ " + (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NkOcrUpload({ mieterId, jahr }: { mieterId: string; jahr: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionen, setPositionen] = useState<Pos[] | null>(null);
  const [check, setCheck] = useState<boolean[]>([]);
  const [flaecheGesamt, setFlaecheGesamt] = useState<string>("");
  const [dokJahr, setDokJahr] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setPositionen(null); setDokJahr(null); setLoading(true);
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
      setFlaecheGesamt(json.flaecheGesamt != null ? String(json.flaecheGesamt) : "");
      setDokJahr(typeof json.jahr === "number" ? json.jahr : null);
    } catch (err) {
      setError(`Fehler: ${(err as Error).message}`);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function uebernehmen() {
    if (!positionen) return;
    const fg = Number(flaecheGesamt.replace(",", "."));
    const fgOk = Number.isFinite(fg) && fg > 0 ? fg : null;
    const auswahl = positionen
      .filter((_, i) => check[i])
      .map((p) => ({
        name: p.name,
        // Mit Gesamtfläche → Flächen-Aufteilung aus den Gesamtkosten;
        // ohne → ausgewiesenen Anteil direkt übernehmen.
        gesamt: fgOk != null && p.gesamt != null ? p.gesamt : undefined,
        flaecheGesamt: fgOk != null && p.gesamt != null ? fgOk : undefined,
        betrag: p.anteil ?? p.gesamt ?? undefined,
      }));
    if (auswahl.length === 0) return;
    setSaving(true);
    try {
      await addPositionsBulk(mieterId, JSON.stringify(auswahl), jahr);
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
      <div className="card-header"><div><div className="card-title"><FileText size={16} style={{ verticalAlign: "-3px" }} /> Abrechnung der Hausverwaltung hochladen</div><div className="card-sub">PDF/Bild — Claude liest die Positionen aus und trägt sie ins Jahr {jahr} ein</div></div></div>
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
            {dokJahr != null && dokJahr !== jahr && (
              <div style={{ marginBottom: 10, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Das Dokument nennt das
                Abrechnungsjahr <strong>{dokJahr}</strong>, übernommen wird in <strong>{jahr}</strong>.
                Falls das nicht stimmt: oben das Jahr wechseln und erneut hochladen.
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
              <span>Gesamtwohnfläche des Gebäudes (m²):</span>
              <input
                className="input"
                type="number"
                step="0.01"
                value={flaecheGesamt}
                onChange={(e) => setFlaecheGesamt(e.target.value)}
                placeholder="z. B. 400"
                style={{ width: 100, fontSize: 12 }}
              />
              <span style={{ color: "var(--faint)" }}>
                — mit Fläche werden Gesamtkosten automatisch nach m² aufgeteilt
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{positionen.length} Position(en) erkannt — auswählen und übernehmen:</div>
            {positionen.map((p, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={check[i]} onChange={(e) => setCheck((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} style={{ width: "auto" }} />
                <span style={{ flex: 1 }}>{p.name}</span>
                {p.gesamt != null && (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Gesamt {eur(p.gesamt)}</span>
                )}
                <strong>{p.anteil != null ? eur(p.anteil) : p.gesamt != null ? eur(p.gesamt) : "—"}</strong>
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
