"use client";

// Vermieter-Seite /anliegen: eingegangene Mieter-Anliegen bearbeiten
// (Status setzen + Nachricht in den Verlauf, seit 02.10.2026) + Terminkoordination: bis zu drei
// Slots vorschlagen, der Mieter bestätigt einen im Portal.
//
// Seit 03.10.2026 (Betreiber: „nicht so viel Text, Anliegen öffnen, eigene Seite“): Die Liste
// zeigt je Anliegen EINE Zeile; ein Klick öffnet `/anliegen?vorgang=<id>` mit Verlauf, Antwort,
// Termin und Angeboten nebeneinander. Vorher klappte alles in der Liste auf.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Wrench, FileText, MessageCircleQuestion, Save, Paperclip, CalendarClock, ChevronRight, ArrowLeft, type LucideIcon } from "lucide-react";
import { bearbeiteAnliegen, schlageTermineVor } from "@/lib/actions/anliegen";
import IcsKnopf from "@/components/IcsKnopf";
import { berlinZuIso } from "@/lib/freigabeTermin";
import { AuftragAbschliessen, KostenUebernahme, AUFTRAG_STATUS, type AuftragRow } from "@/components/ServiceManager";
import { weiterleitenHref, statusBeimAntworten } from "@/lib/anliegenListe";
import { useToast } from "@/components/Toast";
import VorgangVerlauf from "@/components/VorgangVerlauf";
import { NACHRICHT_MAX, type Ereignis } from "@/lib/vorgang";
import AngeboteEinholen, { type AngebotFirma } from "@/components/AngeboteEinholen";
import type { Angebotsanfrage } from "@/lib/angebote";
import { vorgangMerkmal, vorgangUrl } from "@/lib/anliegenListe";

/** Daten für „Angebote einholen“ — einmal je Seite geladen, je Vorgang gefiltert. */
export type AngebotKontext = {
  firmen: AngebotFirma[];
  anfragen: Record<string, Angebotsanfrage[]>;
  kostengrenze: number | null;
  auftragTokens: Record<string, string>;
  absender: string | null;
};

export type AnliegenVermieterRow = {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  verlauf: Ereignis[];
  created_at: string;
  mieterName: string;
  objektName: string;
  dateien: { id: string; name: string }[];
  terminVorschlaege: string[];
  terminBestaetigt: string | null;
  /** Mieter-Zeile des Vorgangs (für „Kontakt teilen“ beim Beauftragen). */
  mieterId?: string | null;
  /** Objekt des Vorgangs — wird beim Weiterleiten an den Hausmeister vorbelegt. */
  propId?: string | null;
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

export const ANLIEGEN_STATUS: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  in_arbeit: { label: "In Arbeit", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
};

const STATUS_META = ANLIEGEN_STATUS;

const datumKurz = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

/** Eine Zeile je Anliegen — Klick öffnet die Detailansicht. */
function Zeile({ a }: { a: AnliegenVermieterRow }) {
  const t = TYP_META[a.typ] ?? TYP_META.frage;
  const s = STATUS_META[a.status] ?? STATUS_META.offen;
  const Icon = t.icon;
  const merkmal = vorgangMerkmal(a, (x) => slotLabel(x).replace(/ Uhr$/, ""));
  return (
    <Link href={vorgangUrl(a.id)} className="listen-zeile">
      <Icon size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="listen-zeile-titel">{a.titel}</span>
        <span className="listen-zeile-sub">{a.mieterName} · {a.objektName}</span>
      </span>
      {merkmal && <span className={`badge ${merkmal.cls} listen-zeile-extra`}>{merkmal.text}</span>}
      <span className={`badge ${s.cls}`}>{s.label}</span>
      <span className="listen-zeile-datum">{datumKurz(a.created_at)}</span>
      <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
    </Link>
  );
}

/** Detailansicht eines Anliegens: links Meldung + Verlauf + Antworten, rechts Termin, Angebote, Weiterleiten. */
export function AnliegenDetail({
  a, angebote, auftraege = [], hatPartner = false,
}: {
  a: AnliegenVermieterRow;
  angebote?: AngebotKontext;
  /** Aufträge, die an DIESEM Anliegen hängen — Abschluss und Kostenbuchung direkt hier (21.10.2026). */
  auftraege?: AuftragRow[];
  /** Gibt es einen verknüpften Service-Partner? Sonst führt „Weiterleiten“ ins Leere. */
  hatPartner?: boolean;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  // „In Arbeit“ vorwählen, sobald der Vermieter antwortet (21.10.2026): Ein beantwortetes Anliegen
  // blieb sonst „offen“ und wurde auf dem Dashboard nach 7 Tagen rot. Eine eigene Wahl gewinnt.
  const [status, setStatus] = useState(a.status);
  const [statusGewaehlt, setStatusGewaehlt] = useState(false);
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
      else toast("Gespeichert ✓");
    });

  const termineSenden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await schlageTermineVor(fd);
      if (r?.error) setFehler(r.error);
      else toast("Terminvorschläge an den Mieter gesendet ✓");
    });

  const terminIso = a.terminBestaetigt ? berlinZuIso(a.terminBestaetigt.slice(0, 16)) : null;
  const offeneAuftraege = auftraege.filter((x) => !["erledigt", "abgelehnt", "nicht_freigegeben"].includes(x.status));
  const alleErledigt = auftraege.length > 0 && auftraege.every((x) => x.status === "erledigt") && auftraege.every((x) => !(Number(x.betrag) > 0) || !!x.kosten_id);

  return (
    <div>
      <Link href="/anliegen" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={14} /> Alle Meldungen
      </Link>

      <div className="section" style={{ marginBottom: 18 }}>
        <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--gold-pale)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon size={19} color="var(--gold)" />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 18, fontWeight: 650, margin: 0, overflowWrap: "anywhere" }}>{a.titel}</h2>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
              {t.label} · {a.mieterName} · {a.objektName} · eingegangen am {datumKurz(a.created_at)}
            </div>
          </div>
          <span className={`badge ${s.cls}`} style={{ fontSize: 12.5 }}>{s.label}</span>
        </div>
      </div>

      <div className="dash-haupt">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Verlauf</h3></div>
          <div className="section-body">
            {/* Die Meldung selbst als erster Eintrag — so liest sich der Vorgang von oben nach unten. */}
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
              <strong style={{ color: "var(--gold)" }}>{a.mieterName}</strong> · {new Date(a.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ padding: "8px 12px", background: "var(--gold-pale)", borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {a.beschreibung?.trim() || <span style={{ color: "var(--muted)" }}>Ohne Beschreibung.</span>}
            </div>
            {a.dateien.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {a.dateien.map((d) => (
                  <a key={d.id} href={`/api/anliegen-datei/${d.id}`} target="_blank" rel="noopener noreferrer" className="badge badge-neutral" style={{ textDecoration: "none" }}>
                    <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {d.name}
                  </a>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <VorgangVerlauf anliegenId={a.id} ereignisse={a.verlauf} sicht="vermieter" antworten={false} anliegenStatus={a.status} />
            </div>

            <form action={speichern} style={{ display: "grid", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <input type="hidden" name="id" value={a.id} />
              <textarea name="nachricht" rows={3} maxLength={NACHRICHT_MAX} className="input" placeholder="Antwort an den Mieter (optional) — erscheint im Verlauf"
                onChange={(e) => { if (!statusGewaehlt) setStatus(statusBeimAntworten(a.status, e.target.value)); }} />
              {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  Status
                  <select name="status" value={status} onChange={(e) => { setStatus(e.target.value); setStatusGewaehlt(true); }} className="input" style={{ width: "auto" }}>
                    <option value="offen">Offen</option>
                    <option value="in_arbeit">In Arbeit</option>
                    <option value="erledigt">Erledigt</option>
                  </select>
                </label>
                <button type="submit" className="btn btn-gold" disabled={pending} style={{ marginLeft: "auto" }}>
                  <Save size={13} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <div className="section" style={{ marginBottom: 0 }}>
            <div className="section-header"><h3><CalendarClock size={14} style={{ verticalAlign: "-2px" }} /> Termin</h3></div>
            <div className="section-body">
              {a.terminBestaetigt ? (
                <div style={{ display: "grid", gap: 10, fontSize: 12.5 }}>
                  <span className="badge badge-green" style={{ justifySelf: "start" }}>Mieter hat bestätigt: {slotLabel(a.terminBestaetigt)}</span>
                  {/* Kein eigener Kalendereintrag mehr (21.10.2026): Der Termin steht von selbst in
                      „Termine“ und auf dem Dashboard — vorher legte jeder Klick einen weiteren an. */}
                  <span style={{ color: "var(--muted)" }}>Steht in deinen <Link href="/termine">Terminen</Link>.</span>
                  {terminIso && (
                    <IcsKnopf start={terminIso} titel={`Termin: ${a.titel}`} ort={a.objektName !== "–" ? a.objektName : null}
                      uid={`anliegen-${a.id}@myimmoapp.de`} dateiname="termin-anliegen.ics" />
                  )}
                </div>
              ) : (
                <>
                  {a.terminVorschlaege.length > 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
                      Wartet auf die Wahl des Mieters. Neue Vorschläge ersetzen die alten.
                    </p>
                  )}
                  <form action={termineSenden} style={{ display: "grid", gap: 8 }}>
                    <input type="hidden" name="id" value={a.id} />
                    {(["slot1", "slot2", "slot3"] as const).map((k, i) => (
                      <label key={k} style={{ display: "grid", gap: 3, fontSize: 11.5, color: "var(--muted)" }}>
                        Vorschlag {i + 1}{i > 0 ? " (optional)" : ""}
                        <input type="datetime-local" name={k} className="input" defaultValue={a.terminVorschlaege[i] ?? ""} />
                      </label>
                    ))}
                    <button type="submit" className="btn btn-outline" disabled={pending} style={{ justifySelf: "start" }}>
                      {pending ? "…" : "Termine vorschlagen"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {angebote && a.typ === "schaden" && (
            <AngeboteEinholen
              anliegenId={a.id}
              titel={a.titel}
              beschreibung={a.beschreibung}
              firmen={angebote.firmen}
              anfragen={angebote.anfragen[a.id] ?? []}
              kostengrenze={angebote.kostengrenze}
              auftragTokens={angebote.auftragTokens}
              mieterKontakt={!!a.mieterId}
              absender={angebote.absender}
            />
          )}

          {auftraege.length > 0 && (
            <div className="section" style={{ marginBottom: 0 }} data-anliegen-auftraege>
              <div className="section-header"><h3><Wrench size={14} style={{ verticalAlign: "-2px" }} /> Auftrag</h3></div>
              <div className="section-body" style={{ display: "grid", gap: 12 }}>
                {/* Abschluss und Kostenbuchung hier statt im Reiter Service (21.10.2026): Vorher führte
                    der Weg über die Auftragsliste unter fünf anderen Abschnitten und zurück. Dieselben
                    Bausteine und Actions wie dort — keine zweite Regel. */}
                {auftraege.map((x) => {
                  const st = AUFTRAG_STATUS[x.status] ?? AUFTRAG_STATUS.offen;
                  return (
                    <div key={x.id} style={{ fontSize: 12.5 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ overflowWrap: "anywhere" }}>{x.titel}</strong>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 2 }}>{x.partnerName}</div>
                      <AuftragAbschliessen a={x} />
                      <KostenUebernahme a={x} />
                    </div>
                  );
                })}
                {alleErledigt && a.status !== "erledigt" && (
                  <form action={speichern} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="erledigt" />
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Auftrag erledigt{auftraege.some((x) => x.kosten_id) ? " und gebucht" : ""}.</span>
                    <button type="submit" className="btn btn-gold btn-sm" disabled={pending}>Anliegen abschließen</button>
                  </form>
                )}
                {offeneAuftraege.length > 0 && (
                  <Link href="/anliegen?tab=service" style={{ fontSize: 12 }}>Alle Aufträge im Reiter Service</Link>
                )}
              </div>
            </div>
          )}

          {/* Mit Bezug (21.10.2026): Vorher gingen nur Titel und Text mit — der Auftrag hing an keinem
              Anliegen, der Verlauf blieb leer, Objekt tippte man neu. Ohne Partner kein Knopf. */}
          {hatPartner && (
            <Link
              href={weiterleitenHref({ id: a.id, titel: a.titel, text: `${a.mieterName}, ${a.objektName}: ${a.beschreibung ?? ""}`, propId: a.propId ?? null })}
              className="btn btn-ghost"
              style={{ justifySelf: "start", alignSelf: "flex-start" }}
            >
              <Wrench size={13} style={{ verticalAlign: "-2px" }} /> An Hausmeister/Service weiterleiten
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnliegenManager({ rows }: { rows: AnliegenVermieterRow[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
        Keine Anliegen. Sobald verknüpfte Mieter etwas melden, erscheint es hier.
      </p>
    );
  }
  // Offenes zuerst, Erledigtes darunter — jeweils neueste oben.
  const sortiert = [...rows].sort((x, y) => Number(x.status === "erledigt") - Number(y.status === "erledigt") || y.created_at.localeCompare(x.created_at));
  return (
    <div className="listen">
      {sortiert.map((a) => <Zeile key={a.id} a={a} />)}
    </div>
  );
}
