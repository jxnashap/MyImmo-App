"use client";

// Vermieter-Seite /anliegen: eingegangene Mieter-Anliegen bearbeiten
// (Status setzen + Antwort schreiben).
import { useState, useTransition } from "react";
import { Wrench, FileText, MessageCircleQuestion, Save, type LucideIcon } from "lucide-react";
import { bearbeiteAnliegen } from "@/lib/actions/anliegen";

export type AnliegenVermieterRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  antwort: string | null;
  created_at: string;
  mieterName: string;
  objektName: string;
};

const TYP_META: Record<string, { label: string; icon: LucideIcon }> = {
  schaden: { label: "Schaden", icon: Wrench },
  dokument: { label: "Dokument", icon: FileText },
  frage: { label: "Frage", icon: MessageCircleQuestion },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  in_arbeit: { label: "In Arbeit", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
};

function Eintrag({ a }: { a: AnliegenVermieterRow }) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = TYP_META[a.typ] ?? TYP_META.frage;
  const s = STATUS_META[a.status] ?? STATUS_META.offen;
  const Icon = t.icon;

  const speichern = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await bearbeiteAnliegen(fd);
      if (r?.error) setFehler(r.error);
      else setOffen(false);
    });

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", cursor: "pointer" }}
        onClick={() => setOffen((o) => !o)}
      >
        <Icon size={14} color="var(--gold)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{a.titel}</span>
        <span className={`badge ${s.cls}`}>{s.label}</span>
        <span className="badge badge-neutral">{t.label}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.mieterName} · {a.objektName}</span>
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
          {new Date(a.created_at).toLocaleDateString("de-DE")}
        </span>
      </div>
      {a.beschreibung && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>
      )}
      {offen && (
        <form action={speichern} style={{ display: "grid", gap: 8, marginTop: 10, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
          <input type="hidden" name="id" value={a.id} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>Status</label>
            <select name="status" defaultValue={a.status} className="input" style={{ width: "auto" }}>
              <option value="offen">Offen</option>
              <option value="in_arbeit">In Arbeit</option>
              <option value="erledigt">Erledigt</option>
            </select>
          </div>
          <textarea name="antwort" rows={2} maxLength={2000} defaultValue={a.antwort ?? ""} className="input" placeholder="Antwort an den Mieter (optional)" />
          {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
          <div>
            <button type="submit" className="btn btn-gold" disabled={pending} style={{ fontSize: 12 }}>
              <Save size={13} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Speichern"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AnliegenManager({ rows }: { rows: AnliegenVermieterRow[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--faint)" }}>
        Keine Anliegen. Sobald verknüpfte Mieter etwas melden, erscheint es hier.
      </p>
    );
  }
  return (
    <div>
      {rows.map((a) => (
        <Eintrag key={a.id} a={a} />
      ))}
    </div>
  );
}
