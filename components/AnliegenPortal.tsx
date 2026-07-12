"use client";

// Mieterportal: Anliegen erstellen + eigene Anliegen mit Status/Antwort sehen.
import { useRef, useState, useTransition } from "react";
import { Wrench, FileText, MessageCircleQuestion, Plus, type LucideIcon } from "lucide-react";
import { erstelleAnliegen } from "@/lib/actions/anliegen";

export type AnliegenRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  antwort: string | null;
  created_at: string;
};

const TYP_META: Record<string, { label: string; icon: LucideIcon }> = {
  schaden: { label: "Schaden melden", icon: Wrench },
  dokument: { label: "Dokument anfordern", icon: FileText },
  frage: { label: "Frage stellen", icon: MessageCircleQuestion },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  in_arbeit: { label: "In Arbeit", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
};

export default function AnliegenPortal({ anliegen }: { anliegen: AnliegenRow[] }) {
  const [offenForm, setOffenForm] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await erstelleAnliegen(fd);
      if (r?.error) setFehler(r.error);
      else {
        formRef.current?.reset();
        setOffenForm(false);
      }
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3>Meine Anliegen</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => setOffenForm((o) => !o)}>
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> Neues Anliegen
        </button>
      </div>
      <div className="section-body">
        {offenForm && (
          <form
            ref={formRef}
            action={senden}
            style={{ display: "grid", gap: 10, marginBottom: 18, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}
          >
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Art des Anliegens</label>
              <select name="typ" className="input" defaultValue="schaden">
                <option value="schaden">Schaden melden</option>
                <option value="dokument">Dokument anfordern</option>
                <option value="frage">Frage stellen</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Betreff *</label>
              <input name="titel" required maxLength={120} className="input" placeholder="z. B. Heizung im Bad wird nicht warm" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Beschreibung</label>
              <textarea name="beschreibung" rows={3} maxLength={2000} className="input" placeholder="Details, seit wann, wo genau …" />
            </div>
            {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Absenden"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOffenForm(false)}>Abbrechen</button>
            </div>
          </form>
        )}

        {anliegen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Anliegen — melde Schäden, fordere Dokumente an oder stelle Fragen direkt an deinen Vermieter.
          </p>
        ) : (
          anliegen.map((a) => {
            const t = TYP_META[a.typ] ?? TYP_META.frage;
            const s = STATUS_META[a.status] ?? STATUS_META.offen;
            const Icon = t.icon;
            return (
              <div key={a.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Icon size={14} color="var(--gold)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.titel}</span>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
                    {new Date(a.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
                {a.beschreibung && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>
                )}
                {a.antwort && (
                  <p style={{ fontSize: 12, marginTop: 8, padding: "8px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                    <strong>Antwort deines Vermieters:</strong> {a.antwort}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
