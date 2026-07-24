"use client";

// Abgerufene Kontoumsätze mit Abgleich (Etappe 3): Eingänge bekommen einen
// Miet-Vorschlag („bestätigen" bucht die Einnahme), Ausgänge lassen sich als
// Kosten buchen. Nichts passiert automatisch — immer per Klick.
import { useState, useTransition } from "react";
import { EyeOff, Eye, ReceiptText, Check, ArrowDownToLine } from "lucide-react";
import {
  setzeUmsatzStatus,
  bestaetigeUmsatzAlsMiete,
  bestaetigeUmsatzAlsKosten,
} from "@/lib/actions/banking";
import type { MietVorschlag, KostenVorschlag } from "@/lib/banking/abgleich";
import { monatLabel } from "@/lib/mietkonto";
import { euro, datum } from "@/lib/format";

export type BankUmsatzRow = {
  id: string;
  buchungsdatum: string | null;
  betrag: number;
  gegenpartei: string | null;      // entschlüsselt
  verwendungszweck: string | null; // entschlüsselt
  status: string;
  bankName: string | null;
  propIdVorschlag: string | null; // Objekt aus der Bankverbindung (Prefill für Kosten)
  mietVorschlag: MietVorschlag | null;
  kostenVorschlag: KostenVorschlag | null;
};

export type PropOption = { id: string; bezeichnung: string | null };

const KOSTEN_KAT = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

function MietVorschlagZeile({ u }: { u: BankUmsatzRow }) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const v = u.mietVorschlag!;

  const buchen = () =>
    startTransition(async () => {
      const res = await bestaetigeUmsatzAlsMiete({
        umsatzId: u.id,
        mieterId: v.mieterId,
        propId: v.propId,
        nkAnteil: v.nkAnteil,
        sollMonat: v.jahrMonat,
      });
      if (!res.ok) setFehler(res.error ?? "Buchen fehlgeschlagen.");
    });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "4px 0 8px 84px", fontSize: 12 }}>
      <span className={`badge ${v.konfidenz === "hoch" ? "badge-green" : "badge-neutral"}`}>Vorschlag</span>
      <span>
        Miete <strong>{monatLabel(v.jahrMonat)}</strong> · {v.mieterName}
        {Math.abs(u.betrag - v.sollGesamt) > 0.01 && (
          <span style={{ color: "var(--muted)" }}> (Soll: {euro(v.sollGesamt)})</span>
        )}
      </span>
      {v.schonGebucht ? (
        <span style={{ color: "var(--muted)" }}>— für diesen Monat ist bereits eine Miete gebucht</span>
      ) : null}
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} disabled={pending} onClick={buchen}>
        <Check size={12} style={{ verticalAlign: "-2px" }} /> {v.schonGebucht ? "Trotzdem buchen" : "Als Miete buchen"}
      </button>
      {fehler && <span style={{ color: "var(--red)" }}>{fehler}</span>}
    </div>
  );
}

function KostenForm({ u, properties }: { u: BankUmsatzRow; properties: PropOption[] }) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const v = u.kostenVorschlag!;
  // Objekt aus der Bankverbindung vorbelegen (objektgebundene Konten) — sonst
  // Einzel-Objekt-Fallback. Überschreibbar.
  const [propId, setPropId] = useState<string>(u.propIdVorschlag ?? (properties.length === 1 ? properties[0].id : ""));
  const [kategorie, setKategorie] = useState(v.kategorie);
  const [beschreibung, setBeschreibung] = useState(v.beschreibung);

  const buchen = () =>
    startTransition(async () => {
      const res = await bestaetigeUmsatzAlsKosten({
        umsatzId: u.id,
        propId: propId || null,
        kategorie,
        beschreibung,
        wiederkehrend: v.wiederkehrend,
      });
      if (!res.ok) setFehler(res.error ?? "Buchen fehlgeschlagen.");
    });

  const feld = { fontSize: 11.5, padding: "3px 6px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)" } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "4px 0 8px 84px", fontSize: 12 }}>
      {v.wiederkehrend && <span className="badge badge-neutral" title="Gleiche Gegenpartei + Betrag mehrfach gesehen">wiederkehrend</span>}
      <select style={feld} value={propId} onChange={(e) => setPropId(e.target.value)}>
        <option value="">– Objekt –</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>{p.bezeichnung ?? "Objekt"}</option>
        ))}
      </select>
      <select style={feld} value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
        {KOSTEN_KAT.map((k) => <option key={k}>{k}</option>)}
      </select>
      <input style={{ ...feld, flex: 1, minWidth: 120 }} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} placeholder="Beschreibung" />
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} disabled={pending} onClick={buchen}>
        <ArrowDownToLine size={12} style={{ verticalAlign: "-2px" }} /> Als Kosten buchen
      </button>
      {fehler && <span style={{ color: "var(--red)" }}>{fehler}</span>}
    </div>
  );
}

function Zeile({ u, properties, sel, onSel }: {
  u: BankUmsatzRow; properties: PropOption[]; sel: boolean; onSel: (v: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [zeigeKosten, setZeigeKosten] = useState(false);
  const ausgeblendet = u.status === "ausgeblendet";
  const offen = u.status === "neu";

  return (
    <div style={{ borderBottom: "1px solid var(--line)", opacity: ausgeblendet ? 0.45 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 12.5 }}>
        {u.status !== "bestaetigt" ? (
          <input type="checkbox" checked={sel} onChange={(e) => onSel(e.target.checked)}
            aria-label="Umsatz für Mehrfach-Aktion auswählen"
            style={{ width: 14, height: 14, flexShrink: 0, accentColor: "var(--gold)", cursor: "pointer" }} />
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} aria-hidden="true" />
        )}
        <span style={{ color: "var(--muted)", minWidth: 74 }}>{u.buchungsdatum ? datum(u.buchungsdatum) : "–"}</span>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {u.gegenpartei && <strong>{u.gegenpartei}</strong>}
          {u.gegenpartei && u.verwendungszweck && " · "}
          <span style={{ color: "var(--muted)" }}>{u.verwendungszweck ?? ""}</span>
        </span>
        {u.bankName && <span className="badge badge-neutral">{u.bankName}</span>}
        {u.status === "bestaetigt" && <span className="badge badge-green">Gebucht</span>}
        <span style={{ fontWeight: 600, whiteSpace: "nowrap", color: u.betrag >= 0 ? "var(--green)" : "var(--red)" }}>
          {u.betrag >= 0 ? "+ " : "− "}{euro(Math.abs(u.betrag))}
        </span>
        {offen && u.kostenVorschlag && !zeigeKosten && (
          <button
            type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px", whiteSpace: "nowrap" }}
            title="Diesen Ausgang als Kosten buchen"
            onClick={() => setZeigeKosten(true)}
          >
            Als Kosten…
          </button>
        )}
        {u.status !== "bestaetigt" && (
          <button
            type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}
            title={ausgeblendet ? "Wieder einblenden" : "Privaten/irrelevanten Umsatz ausblenden"}
            disabled={pending}
            onClick={() => startTransition(async () => { await setzeUmsatzStatus(u.id, ausgeblendet ? "neu" : "ausgeblendet"); })}
          >
            {ausgeblendet ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        )}
      </div>
      {offen && u.mietVorschlag && <MietVorschlagZeile u={u} />}
      {offen && u.kostenVorschlag && zeigeKosten && <KostenForm u={u} properties={properties} />}
    </div>
  );
}

export default function BankUmsaetze({ umsaetze, properties }: { umsaetze: BankUmsatzRow[]; properties: PropOption[] }) {
  const [zeigeAusgeblendete, setZeigeAusgeblendete] = useState(false);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const sichtbar = zeigeAusgeblendete ? umsaetze : umsaetze.filter((u) => u.status !== "ausgeblendet");
  const anzahlAusgeblendet = umsaetze.filter((u) => u.status === "ausgeblendet").length;
  const anzahlVorschlaege = umsaetze.filter((u) => u.status === "neu" && u.mietVorschlag && !u.mietVorschlag.schonGebucht).length;

  const setSel = (id: string, v: boolean) =>
    setAuswahl((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  // Bulk wirkt nur auf sichtbare, nicht gebuchte Zeilen der Auswahl.
  const bulkIds = sichtbar.filter((u) => auswahl.has(u.id) && u.status !== "bestaetigt").map((u) => u.id);
  const bulkStatus = (status: "ausgeblendet" | "neu") =>
    startBulk(async () => {
      await Promise.all(bulkIds.map((id) => setzeUmsatzStatus(id, status)));
      setAuswahl(new Set());
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3><ReceiptText size={15} style={{ verticalAlign: "-2px" }} /> Umsätze</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {bulkIds.length > 0 && (
            <>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={bulkPending}
                title="Ausgewählte private/irrelevante Umsätze ausblenden"
                onClick={() => bulkStatus("ausgeblendet")}>
                <EyeOff size={12} style={{ verticalAlign: "-2px" }} /> {bulkIds.length} ausblenden
              </button>
              {zeigeAusgeblendete && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={bulkPending}
                  onClick={() => bulkStatus("neu")}>
                  <Eye size={12} style={{ verticalAlign: "-2px" }} /> {bulkIds.length} einblenden
                </button>
              )}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setAuswahl(new Set())}>
                Auswahl aufheben
              </button>
            </>
          )}
          {anzahlVorschlaege > 0 && (
            <span className="badge badge-green">{anzahlVorschlaege} Miet-Vorschlag{anzahlVorschlaege > 1 ? "e" : ""}</span>
          )}
          {anzahlAusgeblendet > 0 && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setZeigeAusgeblendete(!zeigeAusgeblendete)}>
              {zeigeAusgeblendete ? "Ausgeblendete verbergen" : `${anzahlAusgeblendet} ausgeblendete zeigen`}
            </button>
          )}
        </div>
      </div>
      <div className="section-body">
        {sichtbar.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Umsätze — verbinde ein Konto und klicke „Umsätze abrufen".
          </p>
        ) : (
          sichtbar.map((u) => (
            <Zeile key={u.id} u={u} properties={properties} sel={auswahl.has(u.id)} onSel={(v) => setSel(u.id, v)} />
          ))
        )}
        {sichtbar.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>
            Eingänge werden automatisch mit den erwarteten Mieten abgeglichen (Name + Soll-Betrag),
            Ausgänge lassen sich als Kosten übernehmen. Gebucht wird nur nach deiner Bestätigung.
          </p>
        )}
      </div>
    </div>
  );
}
