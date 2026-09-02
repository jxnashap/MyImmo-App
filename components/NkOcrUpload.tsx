"use client";
import { FileText, Hourglass, Paperclip, TriangleAlert, CheckCircle2, ArrowRight } from "lucide-react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uebernehmeNkOcr } from "@/lib/actions/positions";
import { ordneZu, type Abgleich, type BestehendePosition, type ErkanntePosition } from "@/lib/nkOcrAbgleich";

// Abrechnung der Hausverwaltung hochladen → Claude liest die Positionen aus →
// ABGLEICH mit den beim Mieter angelegten Positionen → Vorschau → Übernahme.
//
// Drei Gruppen statt blindem Anfügen:
//   1. Zugeordnet  — vorhandene Position bekommt den neuen Betrag (Update).
//   2. Neu erkannt — im Dokument, aber nicht angelegt → als neue Position.
//   3. Fehlt       — angelegt, aber nicht im Dokument (z. B. Grundsteuer, die
//                    kommt vom Finanzamt) → Hinweis, Betrag selbst ergänzen.
// Nichts wird ohne den letzten Klick gespeichert.

export type OcrBestehend = BestehendePosition & { aufteilung: string | null };

type Pos = ErkanntePosition;
const eur = (n: number) => "€ " + (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NkOcrUpload({
  mieterId,
  jahr,
  bestehend,
}: {
  mieterId: string;
  jahr: number;
  bestehend: OcrBestehend[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abgleich, setAbgleich] = useState<Abgleich<OcrBestehend> | null>(null);
  const [checkTreffer, setCheckTreffer] = useState<boolean[]>([]);
  const [checkNeu, setCheckNeu] = useState<boolean[]>([]);
  const [flaecheGesamt, setFlaecheGesamt] = useState<string>("");
  const [dokJahr, setDokJahr] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setAbgleich(null); setDokJahr(null); setLoading(true);
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
      const erg = ordneZu(bestehend, list);
      setAbgleich(erg);
      setCheckTreffer(erg.treffer.map(() => true));
      setCheckNeu(erg.neu.map(() => true));
      setFlaecheGesamt(json.flaecheGesamt != null ? String(json.flaecheGesamt) : "");
      setDokJahr(typeof json.jahr === "number" ? json.jahr : null);
    } catch (err) {
      setError(`Fehler: ${(err as Error).message}`);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  // Welcher Betrag gehört in die Position? Hängt an der VORHANDENEN Struktur:
  // Aufteilungen wie 'flaeche'/'zeit'/'hkvo' erwarten die Gebäude-Gesamtkosten
  // als Betrag; 'voll' erwartet den fertigen Wohnungsanteil.
  function neuerBetrag(v: OcrBestehend, e: Pos): { betrag: number | null; hinweis?: string } {
    const erwartetGesamt = v.aufteilung != null && v.aufteilung !== "voll";
    if (erwartetGesamt) {
      if (e.gesamt != null) return { betrag: e.gesamt };
      return e.anteil != null
        ? { betrag: e.anteil, hinweis: "nur Wohnungsanteil im Dokument — bitte prüfen, die Position erwartet Gesamtkosten" }
        : { betrag: null };
    }
    if (e.anteil != null) return { betrag: e.anteil };
    return e.gesamt != null
      ? { betrag: e.gesamt, hinweis: "nur Gesamtkosten im Dokument — Betrag ist NICHT der Wohnungsanteil, bitte prüfen" }
      : { betrag: null };
  }

  async function uebernehmen() {
    if (!abgleich) return;
    const fgRoh = Number(flaecheGesamt.replace(",", "."));
    const fg = Number.isFinite(fgRoh) && fgRoh > 0 ? fgRoh : null;

    const updates = abgleich.treffer
      .filter((_, i) => checkTreffer[i])
      .map(({ vorhanden, erkannt }) => {
        // Direkt erfasste Position + Gesamtkosten + Fläche → auf Flächen-
        // Aufteilung anheben, damit die Abrechnung den Rechenweg ausweist.
        const anheben = (vorhanden.aufteilung == null || vorhanden.aufteilung === "voll")
          && erkannt.gesamt != null && fg != null;
        const b = anheben ? erkannt.gesamt : neuerBetrag(vorhanden, erkannt).betrag;
        return b == null ? null : {
          id: vorhanden.id,
          betrag: b,
          alsFlaeche: anheben,
          flaecheGesamt: anheben ? fg : undefined,
        };
      })
      .filter(Boolean);

    const neue = abgleich.neu
      .filter((_, i) => checkNeu[i])
      .map((p) => {
        const alsFlaeche = p.gesamt != null && fg != null;
        const betrag = alsFlaeche ? p.gesamt : (p.anteil ?? p.gesamt);
        return betrag == null ? null : { name: p.name, betrag, alsFlaeche, flaecheGesamt: alsFlaeche ? fg : undefined };
      })
      .filter(Boolean);

    if (updates.length === 0 && neue.length === 0) return;
    setSaving(true);
    try {
      const erg = await uebernehmeNkOcr(mieterId, jahr, JSON.stringify({ updates, neue }));
      if (!erg.ok) { setError(erg.fehler || "Speichern fehlgeschlagen."); return; }
      setAbgleich(null);
      router.refresh();
    } catch (err) {
      setError(`Speichern fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const zeile: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><div><div className="card-title"><FileText size={16} style={{ verticalAlign: "-3px" }} /> Abrechnung der Hausverwaltung hochladen</div><div className="card-sub">PDF/Bild — erkannte Beträge werden den Positionen des Jahres {jahr} zugeordnet</div></div></div>
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

        {error && <div role="alert" style={{ marginTop: 10, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--red)" }}><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {error}</div>}

        {abgleich && (
          <div style={{ marginTop: 14 }}>
            {dokJahr != null && dokJahr !== jahr && (
              <div style={{ marginBottom: 10, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Das Dokument nennt das
                Abrechnungsjahr <strong>{dokJahr}</strong>, übernommen wird in <strong>{jahr}</strong>.
                Falls das nicht stimmt: oben das Jahr wechseln und erneut hochladen.
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
              <span>Gesamtwohnfläche des Gebäudes (m²):</span>
              <input
                className="input" type="number" step="0.01" value={flaecheGesamt}
                onChange={(e) => setFlaecheGesamt(e.target.value)}
                placeholder="z. B. 400" style={{ width: 100, fontSize: 12 }}
              />
              <span style={{ color: "var(--faint)" }}>— mit Fläche werden Gesamtkosten automatisch nach m² aufgeteilt</span>
            </div>

            {abgleich.treffer.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Zugeordnet — Beträge werden aktualisiert ({abgleich.treffer.length})
                </div>
                {abgleich.treffer.map(({ vorhanden, erkannt }, i) => {
                  const nb = neuerBetrag(vorhanden, erkannt);
                  return (
                    <label key={vorhanden.id} style={{ ...zeile, cursor: "pointer" }}>
                      <input type="checkbox" checked={checkTreffer[i]} onChange={(e) => setCheckTreffer((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} style={{ width: "auto" }} />
                      <span style={{ flex: 1 }}>
                        {vorhanden.bezeichnung}
                        {erkannt.name !== vorhanden.bezeichnung && (
                          <span style={{ color: "var(--faint)", fontSize: 11 }}> (im Dokument: {erkannt.name})</span>
                        )}
                        {nb.hinweis && (
                          <div style={{ fontSize: 11, color: "var(--gold)" }}>⚠ {nb.hinweis}</div>
                        )}
                      </span>
                      <span style={{ color: "var(--faint)", fontSize: 12 }}>{vorhanden.betrag != null ? eur(vorhanden.betrag) : "—"}</span>
                      <ArrowRight size={12} style={{ color: "var(--faint)", flexShrink: 0 }} aria-hidden />
                      <strong>{nb.betrag != null ? eur(nb.betrag) : "—"}</strong>
                    </label>
                  );
                })}
              </div>
            )}

            {abgleich.neu.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Neu erkannt — als weitere umlagefähige Position anlegen ({abgleich.neu.length})
                </div>
                {abgleich.neu.map((p, i) => (
                  <label key={i} style={{ ...zeile, cursor: "pointer" }}>
                    <input type="checkbox" checked={checkNeu[i]} onChange={(e) => setCheckNeu((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} style={{ width: "auto" }} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {p.gesamt != null && <span style={{ fontSize: 11, color: "var(--muted)" }}>Gesamt {eur(p.gesamt)}</span>}
                    <strong>{p.anteil != null ? eur(p.anteil) : p.gesamt != null ? eur(p.gesamt) : "—"}</strong>
                  </label>
                ))}
              </div>
            )}

            {abgleich.fehlend.length > 0 && (
              <div style={{ marginBottom: 12, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Nicht im Dokument gefunden
                </div>
                Diese angelegten Positionen kommen im Dokument nicht vor — die Beträge bitte aus der
                jeweiligen Quelle ergänzen (z. B. Grundsteuer aus dem Bescheid des Finanzamts, sie
                steht nicht in der Hausverwaltungs-Abrechnung):
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {abgleich.fehlend.map((p) => (
                    <li key={p.id}>{p.bezeichnung}{p.betrag != null ? ` (bisher ${eur(p.betrag)})` : " (noch ohne Betrag)"}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAbgleich(null)}>Verwerfen</button>
              <button type="button" className="btn btn-gold" onClick={uebernehmen} disabled={saving}>{saving ? "Speichern…" : <><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> Auswahl übernehmen</>}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
