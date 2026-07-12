"use client";

// Mieterportal: Anfragen des Vermieters sehen und beantworten
// (Erledigt / Ablehnen mit optionaler Nachricht).
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Gauge, DoorOpen, TrendingUp, Users, Contact, PiggyBank, FileText, KeyRound,
  MessageCircleQuestion, type LucideIcon,
} from "lucide-react";
import { beantworteVermieterAnfrage } from "@/lib/actions/vermieterAnfragen";

export type PortalAnfrageRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  termin: string | null;
  faellig_bis: string | null;
  status: string;
  antwort: string | null;
  created_at: string;
};

const TYP_ICON: Record<string, LucideIcon> = {
  zaehlerstand: Gauge, zutritt: DoorOpen, mieterhoehung: TrendingUp, personenzahl: Users,
  kontaktdaten: Contact, kaution: PiggyBank, dokument: FileText, uebergabe: KeyRound, sonstiges: MessageCircleQuestion,
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
};

function Eintrag({ a }: { a: PortalAnfrageRow }) {
  const [antwortOffen, setAntwortOffen] = useState<null | "erledigt" | "abgelehnt">(null);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const Icon = TYP_ICON[a.typ] ?? MessageCircleQuestion;
  const s = STATUS_META[a.status] ?? STATUS_META.offen;

  const senden = (status: "erledigt" | "abgelehnt") =>
    startTransition(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set("id", a.id);
      fd.set("status", status);
      fd.set("antwort", text);
      const r = await beantworteVermieterAnfrage(fd);
      if (r?.error) setFehler(r.error);
      else setAntwortOffen(null);
    });

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon size={14} color="var(--gold)" />
        <span style={{ fontWeight: 600 }}>{a.titel}</span>
        <span className={`badge ${s.cls}`}>{s.label}</span>
        {a.termin && <span className="badge badge-neutral">Termin {new Date(a.termin).toLocaleDateString("de-DE")}</span>}
        {a.faellig_bis && <span style={{ fontSize: 11, color: "var(--muted)" }}>erbeten bis {new Date(a.faellig_bis).toLocaleDateString("de-DE")}</span>}
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
          {new Date(a.created_at).toLocaleDateString("de-DE")}
        </span>
      </div>
      {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
      {a.antwort && (
        <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
          <strong>Deine Antwort:</strong> {a.antwort}
        </p>
      )}
      {a.status === "offen" && (
        <div style={{ marginTop: 8 }}>
          {a.typ === "zaehlerstand" && (
            <Link href="/portal?tab=zaehler" className="btn btn-gold" style={{ fontSize: 11, padding: "5px 12px", marginRight: 6 }}>
              Zählerstand jetzt melden
            </Link>
          )}
          {antwortOffen ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <textarea rows={2} maxLength={1000} className="input" value={text} onChange={(e) => setText(e.target.value)}
                placeholder={antwortOffen === "erledigt" ? "Antwort/Info an den Vermieter (optional, z. B. 2 Personen im Haushalt)" : "Kurze Begründung (empfohlen)"} />
              {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-gold" disabled={pending} onClick={() => senden(antwortOffen)}>
                  {pending ? "…" : antwortOffen === "erledigt" ? "Als erledigt senden" : "Ablehnung senden"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setAntwortOffen(null)}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--green)" }} onClick={() => setAntwortOffen("erledigt")}>
                Erledigt / Antworten
              </button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)" }} onClick={() => setAntwortOffen("abgelehnt")}>
                Ablehnen
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnfragenVomVermieter({ anfragen }: { anfragen: PortalAnfrageRow[] }) {
  if (anfragen.length === 0) return null;
  const offene = anfragen.filter((a) => a.status === "offen").length;
  return (
    <div className="section">
      <div className="section-header">
        <h3>Anfragen deines Vermieters</h3>
        {offene > 0 && <span className="badge badge-amber">{offene} offen</span>}
      </div>
      <div className="section-body">
        {anfragen.map((a) => <Eintrag key={a.id} a={a} />)}
      </div>
    </div>
  );
}
