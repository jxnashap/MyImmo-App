"use client";

// Mieterportal: Anliegen erstellen (inkl. Foto-/PDF-Anhängen) + eigene
// Anliegen mit Status und Verlauf (seit 02.10.2026, VorgangVerlauf) — der Mieter antwortet dort. Terminkoordination: vom Vermieter
// vorgeschlagene Slots per Klick bestätigen.
// Seit 03.10.2026: Liste mit EINER Zeile je Anliegen; ein Klick öffnet die Detailansicht
// (`…&vorgang=<id>`) mit Meldung, Terminwahl und Verlauf samt Antwortfeld.
import Link from "next/link";
import { useAnhaenge } from "@/components/useAnhaenge";
import { FOTO_ODER_PDF } from "@/lib/anhaenge";
import { useRef, useState, useTransition } from "react";
import { Wrench, FileText, MessageCircleQuestion, Plus, Paperclip, CalendarClock, ChevronRight, ArrowLeft, type LucideIcon } from "lucide-react";
import { erstelleAnliegen, bestaetigeAnliegenTermin } from "@/lib/actions/anliegen";
import VorschauHinweis from "@/components/VorschauHinweis";
import VorgangVerlauf from "@/components/VorgangVerlauf";
import SchadenAssistent from "@/components/SchadenAssistent";
import type { Ereignis } from "@/lib/vorgang";
import { mieterMerkmal, mitVorgang, gesendetText, type NeuesAnliegen } from "@/lib/anliegenListe";

export type AnliegenRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  created_at: string;
  termin_vorschlaege: string[] | null;
  termin_bestaetigt: string | null;
};

// "2026-07-22T14:30" → "Mi., 22.07.2026, 14:30 Uhr"
const slotLabel = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : `${d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
};

function TerminWahl({ a, nurLesen }: { a: AnliegenRow; nurLesen?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const slots = a.termin_vorschlaege ?? [];

  if (a.termin_bestaetigt) {
    return (
      <p style={{ fontSize: 12, marginTop: 8 }}>
        <span className="badge badge-green">
          <CalendarClock size={11} style={{ verticalAlign: "-1px" }} /> Termin bestätigt: {slotLabel(a.termin_bestaetigt)}
        </span>
      </p>
    );
  }
  if (slots.length === 0 || a.status === "erledigt") return null;

  return (
    <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--line)" }}>
      <p style={{ fontSize: 12, margin: "0 0 8px", fontWeight: 600 }}>
        <CalendarClock size={12} style={{ verticalAlign: "-2px" }} /> Dein Vermieter schlägt Termine vor — wähle einen:
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {slots.map((s) => (
          <button data-demo-sperre
            key={s}
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 12 }}
            disabled={pending || nurLesen}
            onClick={() =>
              startTransition(async () => {
                setFehler(null);
                const r = await bestaetigeAnliegenTermin(a.id, s);
                if (r?.error) setFehler(r.error);
              })
            }
          >
            {slotLabel(s)}
          </button>
        ))}
      </div>
      {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>{fehler}</p>}
      <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8, marginBottom: 0 }}>
        Passt keiner? Schreib es deinem Vermieter unten im Verlauf.
      </p>
    </div>
  );
}

export type DateiRef = { id: string; name: string; anliegen_id: string };

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

export function AnhangLinks({ dateien }: { dateien: DateiRef[] }) {
  if (dateien.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
      {dateien.map((d) => (
        <a
          key={d.id}
          href={`/api/anliegen-datei/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="badge badge-neutral"
          style={{ textDecoration: "none" }}
        >
          <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {d.name}
        </a>
      ))}
    </div>
  );
}

const datumKurz = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

export default function AnliegenPortal({
  anliegen,
  dateien,
  verlauf = {},
  nurLesen = false,
  listeHref,
  vorgangId = null,
  neu = null,
  mailHinweis = false,
}: {
  anliegen: AnliegenRow[];
  dateien: DateiRef[];
  verlauf?: Record<string, Ereignis[]>;
  /** Von der Startseite (`…&neu=schaden|frage`, 21.10.2026): gleich das passende Formular öffnen. */
  neu?: NeuesAnliegen | null;
  /** Bekommt der Mieter Hinweis-Mails (Versand an, nicht abgeschaltet)? Nur dann verspricht der Text eine Mail. */
  mailHinweis?: boolean;
  /** Vorschau des Vermieters (01.10.2026): kein Formular, keine Termin-Knöpfe. */
  nurLesen?: boolean;
  /** Adresse der Liste (`/portal?tab=anliegen` oder die Vorschau-URL) — Detail = `…&vorgang=<id>`. */
  listeHref: string;
  /** Geöffnetes Anliegen (Detailansicht), sonst die Liste. */
  vorgangId?: string | null;
}) {
  const [offenForm, setOffenForm] = useState(neu === "frage" && !nurLesen);
  // Schäden laufen seit 02.10.2026 über den geführten Assistenten (Rückfragen + Notfall),
  // Fragen über das kurze Formular, Dokument-Wünsche über den Reiter „Dokumente“.
  const [assistent, setAssistent] = useState(neu === "schaden" && !nurLesen);
  const [gemeldet, setGemeldet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const anhaenge = useAnhaenge({ maxAnzahl: 3, erlaubt: FOTO_ODER_PDF });
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      // Die verkleinerten Fotos statt der Originale (lib/anhaenge.ts).
      fd.delete("dateien");
      for (const f of anhaenge.dateien) fd.append("dateien", f);
      try {
        const r = await erstelleAnliegen(fd);
        if (r?.error) setFehler(r.error);
        else {
          formRef.current?.reset();
          anhaenge.leeren();
          setOffenForm(false);
          // Vorher schloss sich das Formular wortlos — der Mieter wusste nicht, ob es angekommen ist.
          setGemeldet(true);
        }
      } catch {
        setFehler("Senden hat nicht geklappt — deine Angaben bleiben stehen. Bitte noch einmal versuchen.");
      }
    });

  const dateienVon = (id: string) => dateien.filter((d) => d.anliegen_id === id);
  const detailHref = (id: string) => mitVorgang(listeHref, id);

  const offenesAnliegen = vorgangId ? anliegen.find((a) => a.id === vorgangId) ?? null : null;
  if (offenesAnliegen) {
    const a = offenesAnliegen;
    const t = TYP_META[a.typ] ?? TYP_META.frage;
    const s = STATUS_META[a.status] ?? STATUS_META.offen;
    const Icon = t.icon;
    return (
      <div>
        <Link href={listeHref} className="btn btn-ghost btn-sm" style={{ marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} /> Alle Anliegen
        </Link>
        <div className="section">
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--gold-pale)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon size={18} color="var(--gold)" />
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              {/* Silbentrennung statt Bruch mitten im Wort („Nebenkostenabrechnu|ng“, Gesamtprüfung C12);
                  `break-word` bleibt als Rückfall für Zeichenketten ohne Trennstelle. */}
              <h2 style={{ fontSize: 17, fontWeight: 650, margin: 0, overflowWrap: "break-word", hyphens: "auto" }}>{a.titel}</h2>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Gemeldet am {datumKurz(a.created_at)}</div>
            </div>
            <span className={`badge ${s.cls}`} style={{ fontSize: 12.5 }}>{s.label}</span>
          </div>
        </div>
        <TerminWahl a={a} nurLesen={nurLesen} />
        <div className="section" style={{ marginTop: 14 }}>
          <div className="section-header"><h3>Verlauf</h3></div>
          <div className="section-body">
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
              <strong style={{ color: "var(--text)" }}>Du</strong> · {datumKurz(a.created_at)}
            </div>
            <div style={{ padding: "8px 12px", background: "var(--bg3)", borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {a.beschreibung?.trim() || <span style={{ color: "var(--muted)" }}>Ohne Beschreibung.</span>}
            </div>
            <AnhangLinks dateien={dateienVon(a.id)} />
            <div style={{ marginTop: 10 }}>
              <VorgangVerlauf anliegenId={a.id} ereignisse={verlauf[a.id] ?? []} sicht="mieter" nurLesen={nurLesen} anliegenStatus={a.status} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-header">
        <h3>Meine Anliegen</h3>
        {nurLesen ? (
          <VorschauHinweis was="Neues Anliegen" />
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => { setAssistent((o) => !o); setOffenForm(false); setGemeldet(false); }}>
              <Wrench size={13} style={{ verticalAlign: "-2px" }} /> Schaden melden
            </button>
            <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => { setOffenForm((o) => !o); setAssistent(false); setGemeldet(false); }}>
              <Plus size={13} style={{ verticalAlign: "-2px" }} /> Frage stellen
            </button>
          </div>
        )}
      </div>
      <div className="section-body">
        {assistent && !nurLesen && (
          <SchadenAssistent onFertig={() => { setAssistent(false); setGemeldet(true); }} onAbbruch={() => setAssistent(false)} />
        )}
        {gemeldet && (
          <p role="status" style={{ fontSize: 12.5, color: "var(--green)", margin: "0 0 12px" }}>
            {gesendetText(mailHinweis)}
          </p>
        )}
        {offenForm && !nurLesen && (
          <form
            ref={formRef}
            action={senden}
            style={{ display: "grid", gap: 10, marginBottom: 18, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}
          >
            {/* Keine Auswahl „Art“ mehr (21.10.2026): Dokumente haben ihren eigenen Reiter mit
                Vorlagen, und das alte Beispiel („Heizung wird nicht warm“) lenkte Schäden am
                Assistenten vorbei — dort fragt MyImmo nach, was der Vermieter wissen muss. */}
            <input type="hidden" name="typ" value="frage" />
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Deine Frage *</label>
              <input name="titel" required maxLength={120} className="input" placeholder="z. B. Wann wird der Hof gereinigt?" />
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
              Etwas ist kaputt? Dann besser über „Schaden melden“ — dort fragt MyImmo gleich nach, was dein Vermieter wissen muss.
            </p>
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Beschreibung</label>
              <textarea name="beschreibung" rows={3} maxLength={2000} className="input" placeholder="Details, seit wann, wo genau …" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: "var(--muted)" }}>
                Anhänge (Fotos oder PDF, bis zu 3 — Fotos werden automatisch verkleinert)
              </label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="input"
                onChange={(e) => void anhaenge.waehle(e.target.files, e.target)}
              />
              {anhaenge.bereitet && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Fotos werden vorbereitet …</p>}
              {anhaenge.dateien.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {anhaenge.dateien.map((f) => f.name).join(" · ")}
                </p>
              )}
              {anhaenge.fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{anhaenge.fehler}</p>}
            </div>
            {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-gold" disabled={pending || anhaenge.bereitet}>{pending ? "Wird gesendet …" : "Absenden"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOffenForm(false)}>Abbrechen</button>
            </div>
          </form>
        )}

        {anliegen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Anliegen. Melde hier einen Schaden oder stell deinem Vermieter eine Frage — Dokumente forderst du unter „Dokumente“ an.
          </p>
        ) : (
          <div className="listen">
            {anliegen.map((a) => {
              const t = TYP_META[a.typ] ?? TYP_META.frage;
              const s = STATUS_META[a.status] ?? STATUS_META.offen;
              const Icon = t.icon;
              const merkmal = mieterMerkmal(a, verlauf[a.id] ?? []);
              return (
                <Link key={a.id} href={detailHref(a.id)} className="listen-zeile">
                  <Icon size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="listen-zeile-titel">{a.titel}</span>
                    {/* Höchstens EIN Merkmal neben dem Titel (06.10.2026): Mit zwei
                        Badges blieben am Handy ~7 Zeichen für Titel und Datum.
                        Gibt es ein Merkmal, steht der Status in der Unterzeile. */}
                    <span className="listen-zeile-sub">
                      {merkmal ? `${s.label} · gemeldet ${datumKurz(a.created_at)}` : `Gemeldet am ${datumKurz(a.created_at)}`}
                    </span>
                  </span>
                  {merkmal
                    ? <span className={`badge ${merkmal.cls}`} style={{ flexShrink: 0 }}>{merkmal.text}</span>
                    : <span className={`badge ${s.cls}`} style={{ flexShrink: 0 }}>{s.label}</span>}
                  <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
