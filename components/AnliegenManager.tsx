"use client";

// Vermieter-Seite /anliegen: eingegangene Mieter-Anliegen bearbeiten
// (Status setzen + Antwort schreiben) + Terminkoordination: bis zu drei
// Slots vorschlagen, der Mieter bestätigt einen im Portal.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Wrench, FileText, MessageCircleQuestion, Save, Paperclip, CalendarClock, CalendarPlus, type LucideIcon } from "lucide-react";
import { bearbeiteAnliegen, schlageTermineVor, terminInKalender } from "@/lib/actions/anliegen";
import { useToast } from "@/components/Toast";

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
  dateien: { id: string; name: string }[];
  terminVorschlaege: string[];
  terminBestaetigt: string | null;
};

// "2026-07-22T14:30" → "Mi., 22.07.2026, 14:30 Uhr"
export const slotLabel = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : `${d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
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
  const toast = useToast();
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

  const termineSenden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await schlageTermineVor(fd);
      if (r?.error) setFehler(r.error);
      else toast("Terminvorschläge an den Mieter gesendet ✓");
    });

  const inKalender = () =>
    startTransition(async () => {
      const r = await terminInKalender(a.id);
      toast(r?.error ?? "Termin im Kalender angelegt ✓");
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
        {a.terminBestaetigt ? (
          <span className="badge badge-green"><CalendarClock size={11} style={{ verticalAlign: "-1px" }} /> {slotLabel(a.terminBestaetigt)}</span>
        ) : a.terminVorschlaege.length > 0 ? (
          <span className="badge badge-amber"><CalendarClock size={11} style={{ verticalAlign: "-1px" }} /> Terminwahl beim Mieter</span>
        ) : null}
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.mieterName} · {a.objektName}</span>
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
          {new Date(a.created_at).toLocaleDateString("de-DE")}
        </span>
      </div>
      {a.beschreibung && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>
      )}
      {a.dateien.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {a.dateien.map((d) => (
            <a key={d.id} href={`/api/anliegen-datei/${d.id}`} target="_blank" rel="noopener noreferrer" className="badge badge-neutral" style={{ textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
              <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {d.name}
            </a>
          ))}
        </div>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-gold" disabled={pending} style={{ fontSize: 12 }}>
              <Save size={13} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Speichern"}
            </button>
            <Link
              href={`/anliegen?tab=service&titel=${encodeURIComponent(a.titel)}&text=${encodeURIComponent(`${a.mieterName}, ${a.objektName}: ${a.beschreibung ?? ""}`.slice(0, 1500))}`}
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
            >
              <Wrench size={13} style={{ verticalAlign: "-2px" }} /> An Service weiterleiten
            </Link>
          </div>
        </form>
      )}
      {offen && (
        <div style={{ marginTop: 8, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <CalendarClock size={12} style={{ verticalAlign: "-2px" }} /> Terminkoordination
          </div>
          {a.terminBestaetigt ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
              <span className="badge badge-green">Mieter hat bestätigt: {slotLabel(a.terminBestaetigt)}</span>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={inKalender}>
                <CalendarPlus size={13} style={{ verticalAlign: "-2px" }} /> In den Kalender
              </button>
            </div>
          ) : (
            <>
              {a.terminVorschlaege.length > 0 && (
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 8px" }}>
                  Vorgeschlagen: {a.terminVorschlaege.map(slotLabel).join("  ·  ")} — wartet auf die Wahl des Mieters.
                  Neue Vorschläge ersetzen die alten.
                </p>
              )}
              <form action={termineSenden} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={a.id} />
                {(["slot1", "slot2", "slot3"] as const).map((k, i) => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    Vorschlag {i + 1}{i > 0 ? " (optional)" : ""}
                    <input type="datetime-local" name={k} className="input" defaultValue={a.terminVorschlaege[i] ?? ""} style={{ fontSize: 12 }} />
                  </label>
                ))}
                <button type="submit" className="btn btn-outline" disabled={pending} style={{ fontSize: 12 }}>
                  {pending ? "…" : "Termine vorschlagen"}
                </button>
              </form>
            </>
          )}
        </div>
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
