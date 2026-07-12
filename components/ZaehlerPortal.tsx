"use client";

// Mieterportal: Zählerstand melden (mit Foto) + eigene Meldungen sehen.
import { useRef, useState, useTransition } from "react";
import { Gauge, Plus, Paperclip, CheckCircle2, Clock } from "lucide-react";
import { meldeZaehlerstand } from "@/lib/actions/zaehler";

export type ZaehlerMeldungRow = {
  id: string;
  art: string;
  zaehlernummer: string | null;
  stand: number;
  einheit: string;
  ablesedatum: string;
  notiz: string | null;
  foto_name: string | null;
  uebernommen_am: string | null;
  created_at: string;
};

const EINHEIT_JE_ART: Record<string, string> = {
  Strom: "kWh", Gas: "kWh", Wasser: "m³", Warmwasser: "m³", "Fernwärme": "kWh", "Öl": "l", Sonstiges: "",
};

export default function ZaehlerPortal({ meldungen }: { meldungen: ZaehlerMeldungRow[] }) {
  const [offenForm, setOffenForm] = useState(false);
  const [art, setArt] = useState("Strom");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await meldeZaehlerstand(fd);
      if (r?.error) setFehler(r.error);
      else {
        formRef.current?.reset();
        setOffenForm(false);
      }
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3>Zählerstände</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => setOffenForm((o) => !o)}>
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> Zählerstand melden
        </button>
      </div>
      <div className="section-body">
        {offenForm && (
          <form
            ref={formRef}
            action={senden}
            style={{ display: "grid", gap: 10, marginBottom: 18, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Zähler</label>
                <select name="art" className="input" value={art} onChange={(e) => setArt(e.target.value)}>
                  {Object.keys(EINHEIT_JE_ART).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Zählernummer (optional)</label>
                <input name="zaehlernummer" maxLength={40} className="input" placeholder="steht auf dem Zähler" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Zählerstand *</label>
                <input name="stand" required inputMode="decimal" className="input" placeholder="z. B. 14382,5" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Einheit</label>
                <input name="einheit" className="input" key={art} defaultValue={EINHEIT_JE_ART[art] ?? ""} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Ablesedatum</label>
                <input name="ablesedatum" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: "var(--muted)" }}>Foto vom Zähler (empfohlen)</label>
                <input name="foto" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="input" />
              </div>
            </div>
            <textarea name="notiz" rows={2} maxLength={500} className="input" placeholder="Anmerkung (optional)" />
            {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "Wird gesendet …" : "Melden"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOffenForm(false)}>Abbrechen</button>
            </div>
          </form>
        )}

        {meldungen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Meldungen — melde deine Zählerstände (z. B. bei Ein-/Auszug oder zur
            Jahresablesung) direkt an deinen Vermieter, gern mit Foto als Beleg.
          </p>
        ) : (
          meldungen.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <Gauge size={14} color="var(--gold)" />
              <span style={{ fontWeight: 600 }}>{m.art}</span>
              {m.zaehlernummer && <span style={{ fontSize: 11, color: "var(--muted)" }}>Nr. {m.zaehlernummer}</span>}
              <span>{m.stand.toLocaleString("de-DE")} {m.einheit}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(m.ablesedatum).toLocaleDateString("de-DE")}</span>
              {m.foto_name && (
                <a href={`/api/zaehler-foto/${m.id}`} target="_blank" rel="noopener noreferrer" className="badge badge-neutral" style={{ textDecoration: "none" }}>
                  <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> Foto
                </a>
              )}
              <span className={`badge ${m.uebernommen_am ? "badge-green" : "badge-amber"}`} style={{ marginLeft: "auto" }}>
                {m.uebernommen_am
                  ? <><CheckCircle2 size={11} style={{ verticalAlign: "-1px" }} /> Übernommen</>
                  : <><Clock size={11} style={{ verticalAlign: "-1px" }} /> Gemeldet</>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
