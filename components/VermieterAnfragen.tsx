"use client";

// Vermieter-Seite: Anfragen an Mieter erstellen (Kachel-Katalog) + Status.
import { useRef, useState, useTransition } from "react";
import {
  Gauge, DoorOpen, TrendingUp, Users, Contact, PiggyBank, FileText, KeyRound,
  MessageCircleQuestion, Plus, Trash2, type LucideIcon,
} from "lucide-react";
import { erstelleVermieterAnfrage, loescheVermieterAnfrage } from "@/lib/actions/vermieterAnfragen";

export type VermieterAnfrageRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  termin: string | null;
  faellig_bis: string | null;
  status: string;
  antwort: string | null;
  created_at: string;
  mieterName: string;
  objektName: string;
};

export const ANFRAGE_META: Record<string, { label: string; hinweis: string; icon: LucideIcon }> = {
  zaehlerstand: { label: "Zählerstand erbitten", hinweis: "Mieter meldet Stand + Foto im Portal", icon: Gauge },
  zutritt: { label: "Zutrittstermin ankündigen", hinweis: "Handwerker, Wartung, Rauchmelder (§ 555a BGB)", icon: DoorOpen },
  mieterhoehung: { label: "Zustimmung Mieterhöhung", hinweis: "§ 558b BGB — Frist: Ende des 2. Monats", icon: TrendingUp },
  personenzahl: { label: "Personenzahl im Haushalt", hinweis: "für den NK-Umlageschlüssel", icon: Users },
  kontaktdaten: { label: "Kontaktdaten aktualisieren", hinweis: "Telefon, E-Mail, Bankverbindung", icon: Contact },
  kaution: { label: "Kaution ausstehend", hinweis: "Erinnerung an offene Kautionszahlung", icon: PiggyBank },
  dokument: { label: "Dokument einreichen", hinweis: "z. B. Untermiet-Info, Nachweis", icon: FileText },
  uebergabe: { label: "Übergabetermin abstimmen", hinweis: "Ein-/Auszug, Wohnungsübergabe", icon: KeyRound },
  sonstiges: { label: "Sonstige Anfrage", hinweis: "freier Text", icon: MessageCircleQuestion },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
};

// Typen, bei denen ein Termin-Feld sinnvoll ist
const MIT_TERMIN = ["zutritt", "uebergabe"];

export default function VermieterAnfragen({
  anfragen,
  mieter,
}: {
  anfragen: VermieterAnfrageRow[];
  mieter: { id: string; name: string }[];
}) {
  const [offenForm, setOffenForm] = useState(false);
  const [typ, setTyp] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await erstelleVermieterAnfrage(fd);
      if (r?.error) setFehler(r.error);
      else {
        formRef.current?.reset();
        setTyp(null);
        setOffenForm(false);
      }
    });

  const loeschen = (id: string) => startTransition(async () => { await loescheVermieterAnfrage(id); });

  return (
    <div className="section">
      <div className="section-header">
        <h3>Anfragen an Mieter</h3>
        <button
          type="button"
          className="btn btn-gold"
          style={{ fontSize: 12 }}
          onClick={() => setOffenForm((o) => !o)}
          disabled={mieter.length === 0}
          title={mieter.length === 0 ? "Erst wenn ein Mieter mit dem Portal verbunden ist" : undefined}
        >
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> Neue Anfrage
        </button>
      </div>
      <div className="section-body">
        {mieter.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--faint)", marginBottom: 10 }}>
            Anfragen erreichen Mieter über das Mieterportal — lade dazu einen Mieter per
            Einladungscode ein (Mieter-Detailseite → Mieterportal-Zugang).
          </p>
        )}
        {offenForm && (
          <form
            ref={formRef}
            action={senden}
            style={{ display: "grid", gap: 10, marginBottom: 18, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}
          >
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Mieter (mit Portal-Zugang)</label>
              <select name="mieterId" className="input" required>
                {mieter.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="grid-2" style={{ gap: 8 }}>
              {Object.entries(ANFRAGE_META).map(([key, v]) => {
                const Icon = v.icon;
                const aktiv = typ === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTyp(aktiv ? null : key)}
                    className="role-tile"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      padding: "10px 12px", borderRadius: 10, border: `1px solid ${aktiv ? "var(--gold)" : "var(--line)"}`,
                      background: "var(--bg2)",
                    }}
                  >
                    <span style={{ display: "flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--gold-pale)", color: "var(--gold)", flexShrink: 0 }}>
                      <Icon size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{v.label}</span>
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>{v.hinweis}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {typ && (
              <>
                <input type="hidden" name="typ" value={typ} />
                <div className="form-group">
                  <label style={{ fontSize: 11, color: "var(--muted)" }}>Betreff *</label>
                  <input name="titel" required maxLength={120} className="input" defaultValue={ANFRAGE_META[typ].label} key={typ} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11, color: "var(--muted)" }}>Nachricht an den Mieter</label>
                  <textarea name="beschreibung" rows={3} maxLength={2000} className="input" placeholder="Details, z. B. welcher Zähler, welcher Zeitraum, Grund …" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {MIT_TERMIN.includes(typ) && (
                    <div className="form-group">
                      <label style={{ fontSize: 11, color: "var(--muted)" }}>Termin</label>
                      <input name="termin" type="date" className="input" />
                    </div>
                  )}
                  <div className="form-group">
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>Erbeten bis (optional)</label>
                    <input name="faelligBis" type="date" className="input" />
                  </div>
                </div>
                {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Anfrage senden"}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setOffenForm(false)}>Abbrechen</button>
                </div>
              </>
            )}
          </form>
        )}

        {anfragen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>Noch keine Anfragen gestellt.</p>
        ) : (
          anfragen.map((a) => {
            const meta = ANFRAGE_META[a.typ] ?? ANFRAGE_META.sonstiges;
            const s = STATUS_META[a.status] ?? STATUS_META.offen;
            const Icon = meta.icon;
            return (
              <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Icon size={14} color="var(--gold)" />
                  <span style={{ fontWeight: 600 }}>{a.titel}</span>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.mieterName} · {a.objektName}</span>
                  {a.termin && <span className="badge badge-neutral">Termin {new Date(a.termin).toLocaleDateString("de-DE")}</span>}
                  {a.faellig_bis && <span style={{ fontSize: 11, color: "var(--muted)" }}>bis {new Date(a.faellig_bis).toLocaleDateString("de-DE")}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>{new Date(a.created_at).toLocaleDateString("de-DE")}</span>
                    {a.status === "offen" && (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)" }} disabled={pending} onClick={() => loeschen(a.id)} title="Anfrage zurückziehen">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </div>
                {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
                {a.antwort && (
                  <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                    <strong>Antwort des Mieters:</strong> {a.antwort}
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
