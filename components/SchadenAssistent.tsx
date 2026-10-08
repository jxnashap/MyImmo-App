"use client";

// Geführte Schadensmeldung (02.10.2026, Schritt 5 des Mieterportal-Plans). Drei Schritte:
// Art → Rückfragen → Details. Deutet eine Antwort auf Gefahr, steht ZUERST der
// Notfall-Hinweis da (NotfallSofort), erst danach die Meldung. Die Fragen und der Text,
// der beim Vermieter ankommt, stehen in lib/schadensmeldung.ts; gesendet wird über
// dieselbe Action wie jedes Anliegen (erstelleAnliegen) — der Server leitet Vermieter und
// Wohnung aus dem Zugang ab, nicht aus dem Formular.
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, Paperclip } from "lucide-react";
import { erstelleAnliegen } from "@/lib/actions/anliegen";
import {
  KATEGORIEN, SEIT_OPTIONEN, BESCHREIBUNG_MAX, baueMeldung, kategorie, notfallFuer,
} from "@/lib/schadensmeldung";
import { NotfallSofort } from "@/components/NotfallHinweis";

export default function SchadenAssistent({ onFertig, onAbbruch }: { onFertig: () => void; onAbbruch: () => void }) {
  const [katKey, setKatKey] = useState<string | null>(null);
  const [antworten, setAntworten] = useState<Record<string, string>>({});
  const [raum, setRaum] = useState("");
  const [seit, setSeit] = useState("");
  const [text, setText] = useState("");
  const [erreichbar, setErreichbar] = useState("");
  const [dateiNamen, setDateiNamen] = useState<string[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dateiRef = useRef<HTMLInputElement>(null);

  const k = katKey ? kategorie(katKey) : undefined;
  const notfall = k ? notfallFuer(k, antworten) : null;
  const alleBeantwortet = !!k && k.fragen.every((f) => antworten[f.key]);
  const meldung = k ? baueMeldung(k, antworten, { raum, seit, text, erreichbar }) : null;

  const senden = () =>
    startTransition(async () => {
      if (!k || !meldung) return;
      setFehler(null);
      const fd = new FormData();
      fd.set("typ", "schaden");
      fd.set("titel", meldung.titel);
      fd.set("beschreibung", meldung.beschreibung);
      for (const f of Array.from(dateiRef.current?.files ?? [])) fd.append("dateien", f);
      const r = await erstelleAnliegen(fd);
      if (r?.error) setFehler(r.error);
      else onFertig();
    });

  const kasten = { display: "grid", gap: 12, marginBottom: 18, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" } as const;
  const knopf = (aktiv: boolean) => ({
    fontSize: 12.5, padding: "8px 12px", textAlign: "left" as const,
    border: `1px solid ${aktiv ? "var(--gold)" : "var(--line)"}`, background: aktiv ? "var(--gold-pale)" : "var(--bg2)",
  });

  // Schritt 1: Art des Schadens.
  if (!k) {
    return (
      <div style={kasten}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Was ist kaputt?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
          {KATEGORIEN.map((x) => (
            <button key={x.key} type="button" className="btn" style={{ ...knopf(false), ...(x.notfall ? { color: "var(--red)", borderColor: "var(--red)" } : {}) }}
              onClick={() => { setKatKey(x.key); setAntworten({}); }}>
              {x.label}
            </button>
          ))}
        </div>
        <div><button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onAbbruch}>Abbrechen</button></div>
      </div>
    );
  }

  return (
    <div style={kasten}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => setKatKey(null)} aria-label="Andere Art wählen">
          <ArrowLeft size={13} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{k.label}</span>
      </div>

      {notfall && <NotfallSofort art={notfall} />}

      {k.fragen.map((f) => (
        <fieldset key={f.key} style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{f.frage}</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {f.optionen.map((o) => (
              <button key={o} type="button" className="btn" aria-pressed={antworten[f.key] === o} style={knopf(antworten[f.key] === o)}
                onClick={() => setAntworten((a) => ({ ...a, [f.key]: o }))}>
                {o}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {(alleBeantwortet || k.fragen.length === 0) && (
        <>
          <div className="form-row" style={{ gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              Raum / Ort
              <input className="input" value={raum} onChange={(e) => setRaum(e.target.value)} maxLength={60} placeholder="z. B. Bad, Küche, Treppenhaus" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              Seit wann?
              <select className="input" value={seit} onChange={(e) => setSeit(e.target.value)}>
                <option value="">– bitte wählen –</option>
                {SEIT_OPTIONEN.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            Was sollte dein Vermieter noch wissen? (optional)
            <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={BESCHREIBUNG_MAX - 400} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            Wann bist du erreichbar, wie kommt ein Handwerker in die Wohnung? (optional)
            <input className="input" value={erreichbar} onChange={(e) => setErreichbar(e.target.value)} maxLength={200} placeholder="z. B. werktags ab 16 Uhr, Schlüssel bei Nachbarn" />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            Fotos oder PDF (max. 3 Dateien à 4 MB) — ein Foto spart oft eine Besichtigung
            <input ref={dateiRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="input"
              onChange={(e) => setDateiNamen(Array.from(e.target.files ?? []).map((f) => f.name))} />
            {dateiNamen.length > 0 && <span><Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {dateiNamen.join(" · ")}</span>}
          </label>

          {meldung && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              <div style={{ marginBottom: 4 }}>So kommt es bei deinem Vermieter an:</div>
              <div style={{ padding: "8px 10px", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--line)", whiteSpace: "pre-wrap", color: "var(--text)" }}>
                <strong>{meldung.titel}</strong>{"\n"}{meldung.beschreibung}
              </div>
            </div>
          )}

          {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button data-demo-sperre type="button" className="btn btn-gold" disabled={pending} onClick={senden}>
              {pending ? "Wird gesendet …" : notfall ? "Zusätzlich an den Vermieter melden" : "Schaden melden"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onAbbruch}>Abbrechen</button>
          </div>
        </>
      )}
    </div>
  );
}
