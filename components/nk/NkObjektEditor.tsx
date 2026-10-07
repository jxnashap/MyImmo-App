"use client";

// Nebenkosten am Objekt bearbeiten (Stufe 1, 07.10.2026): Grundlagen des Hauses und die
// Kostenarten — jede EINMAL mit dem Gesamtbetrag. Die Verteilung zeigt die Seite darunter
// (serverseitig gerechnet, lib/nkObjekt.ts). Speichern über lib/actions/nkObjekt.ts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { eur2 } from "@/lib/format";
import { NK_SCHLUESSEL, SCHLUESSEL_LABEL, standardSchluessel, type NkSchluessel } from "@/lib/nkObjekt";
import {
  speichereNkGrundlagen,
  speichereNkKosten,
  loescheNkKosten,
  uebernehmeNkVorschlaege,
  uebernehmeNkKi,
} from "@/lib/actions/nkObjekt";

export type EditorMieter = { id: string; name: string; flaeche: number | null; tage: number };
export type EditorKosten = {
  id: string;
  bezeichnung: string;
  betrag: number;
  schluessel: NkSchluessel;
  umlagefaehig: boolean;
  lohnanteil: number | null;
  art_35a: string | null;
  nenner: number | null;
  werte: Record<string, number>;
  quelle: string | null;
};

type Form = {
  id: string | null;
  bezeichnung: string;
  betrag: string;
  schluessel: NkSchluessel;
  umlagefaehig: boolean;
  lohnanteil: string;
  art35a: string;
  nenner: string;
  werte: Record<string, string>;
  /** Schlüssel von Hand gewählt — dann folgt er der Bezeichnung nicht mehr. */
  manuell: boolean;
};

const LEER: Form = { id: null, bezeichnung: "", betrag: "", schluessel: "flaeche", umlagefaehig: true, lohnanteil: "", art35a: "", nenner: "", werte: {}, manuell: false };
const deZahl = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const QUELLE: Record<string, string> = { vorjahr: "aus dem Vorjahr — Betrag prüfen", buchungen: "aus Buchungen", ki: "aus der hochgeladenen Abrechnung" };

export default function NkObjektEditor(props: {
  propId: string;
  jahr: number;
  jahresTage: number;
  mieter: EditorMieter[];
  grundlagen: { flaecheGesamt: number | null; einheiten: number | null; meaGesamt: number | null; mieter: Record<string, { personen?: number | null; mea?: number | null }> };
  kosten: EditorKosten[];
  vorschlaege: { buchungen: number; vorjahr: number };
}) {
  const { propId, jahr, mieter, kosten } = props;
  const router = useRouter();
  const toast = useToast();
  const [laeuft, starte] = useTransition();
  const g = props.grundlagen;
  const [fl, setFl] = useState(deZahl(g.flaecheGesamt));
  const [ein, setEin] = useState(deZahl(g.einheiten));
  const [mea, setMea] = useState(deZahl(g.meaGesamt));
  const [jeMieter, setJeMieter] = useState<Record<string, { personen: string; mea: string }>>(
    Object.fromEntries(mieter.map((m) => [m.id, { personen: deZahl(g.mieter[m.id]?.personen), mea: deZahl(g.mieter[m.id]?.mea) }])),
  );
  const [form, setForm] = useState<Form | null>(null);
  const [kiLaeuft, setKiLaeuft] = useState(false);

  const brauchtPersonen = kosten.some((k) => k.schluessel === "personen");
  const brauchtMea = kosten.some((k) => k.schluessel === "mea") || !!mea;

  function ergebnis(r: { ok: true; anzahl?: number } | { error: string }, erfolg: string) {
    if ("error" in r) { toast(r.error, "error"); return false; }
    toast(erfolg, "success");
    router.refresh();
    return true;
  }

  function grundlagenSpeichern() {
    starte(async () => {
      try {
        ergebnis(await speichereNkGrundlagen(propId, jahr, { flaecheGesamt: fl, einheiten: ein, meaGesamt: mea, mieter: jeMieter }), "Grundlagen gespeichert.");
      } catch { toast("Speichern fehlgeschlagen.", "error"); }
    });
  }

  function kostenSpeichern() {
    if (!form) return;
    const f = form;
    starte(async () => {
      try {
        const r = await speichereNkKosten(propId, jahr, {
          id: f.id, bezeichnung: f.bezeichnung, betrag: f.betrag, schluessel: f.schluessel, umlagefaehig: f.umlagefaehig,
          lohnanteil: f.lohnanteil, art35a: f.art35a, nenner: f.nenner, werte: f.werte,
        });
        if (ergebnis(r, f.id ? "Gespeichert." : "Kostenart angelegt.")) setForm(null);
      } catch { toast("Speichern fehlgeschlagen.", "error"); }
    });
  }

  function loeschen(id: string) {
    if (!confirm("Diese Kostenart löschen?")) return;
    starte(async () => {
      try {
        if (ergebnis(await loescheNkKosten(propId, id), "Gelöscht.")) setForm(null);
      } catch { toast("Löschen fehlgeschlagen.", "error"); }
    });
  }

  function vorschlaege(art: "buchungen" | "vorjahr") {
    starte(async () => {
      try {
        const r = await uebernehmeNkVorschlaege(propId, jahr, art);
        ergebnis(r, "ok" in r && r.anzahl ? `${r.anzahl} Kostenart${r.anzahl === 1 ? "" : "en"} übernommen — bitte prüfen.` : "Nichts Neues zu übernehmen.");
      } catch { toast("Übernehmen fehlgeschlagen.", "error"); }
    });
  }

  async function kiImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setKiLaeuft(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch("/api/nk-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, mediaType: file.type, isPdf: file.type === "application/pdf" }),
      });
      const json = await resp.json();
      if (!resp.ok) { toast(json.error || json.fehler || "Auslesen fehlgeschlagen.", "error"); return; }
      // Am Objekt zählen GESAMTkosten des Hauses; Positionen ohne Gesamtbetrag übernimmt die
      // Action nicht (den Anteil EINER Wohnung als Hauskosten zu verteilen wäre falsch).
      const liste = (json.positionen ?? []) as { name?: string; gesamt?: number | null }[];
      const ohne = liste.filter((p) => !(typeof p.gesamt === "number" && Number.isFinite(p.gesamt))).length;
      const r = await uebernehmeNkKi(propId, jahr, JSON.stringify(liste));
      if ("error" in r) { toast(r.error, "error"); return; }
      toast(`${r.anzahl ?? 0} Kostenart${r.anzahl === 1 ? "" : "en"} übernommen${ohne ? ` · ${ohne} ohne Gesamtbetrag ausgelassen` : ""} — bitte prüfen.`, "success");
      router.refresh();
    } catch {
      toast("Auslesen fehlgeschlagen.", "error");
    } finally {
      setKiLaeuft(false);
    }
  }

  const bearbeiten = (k: EditorKosten) =>
    setForm({
      id: k.id, bezeichnung: k.bezeichnung, betrag: deZahl(k.betrag), schluessel: k.schluessel, umlagefaehig: k.umlagefaehig,
      lohnanteil: deZahl(k.lohnanteil), art35a: k.art_35a ?? "", nenner: deZahl(k.nenner),
      werte: Object.fromEntries(Object.entries(k.werte ?? {}).map(([id, w]) => [id, deZahl(w)])),
      manuell: true,
    });

  const formular = form && (
    <div className="nk-formular" data-kein-wischen>
      <div className="nk-formular-raster">
        <label>Kostenart
          <input className="input" value={form.bezeichnung} maxLength={120} placeholder="z. B. Müllabfuhr"
            onChange={(e) => setForm({ ...form, bezeichnung: e.target.value, schluessel: form.id || form.manuell ? form.schluessel : standardSchluessel(e.target.value) })} />
        </label>
        <label>Gesamtbetrag des Hauses (€)
          <input className="input" inputMode="decimal" value={form.betrag} placeholder="0,00" onChange={(e) => setForm({ ...form, betrag: e.target.value })} />
        </label>
        <label>Umlageschlüssel
          <select className="input" value={form.schluessel} onChange={(e) => setForm({ ...form, schluessel: e.target.value as NkSchluessel, manuell: true })}>
            {NK_SCHLUESSEL.map((s) => <option key={s} value={s}>{SCHLUESSEL_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="nk-haken">
          <input type="checkbox" checked={form.umlagefaehig} onChange={(e) => setForm({ ...form, umlagefaehig: e.target.checked })} />
          umlagefähig (BetrKV)
        </label>
      </div>
      {form.schluessel === "verbrauch" && (
        <label style={{ display: "block", marginTop: 10 }}>Gesamtverbrauch laut Hauptzähler
          <input className="input" inputMode="decimal" value={form.nenner} placeholder="leer = Summe der Wohnungen" onChange={(e) => setForm({ ...form, nenner: e.target.value })} />
        </label>
      )}
      {(form.schluessel === "verbrauch" || form.schluessel === "direkt") && (
        <div className="nk-werte">
          <div className="nk-werte-titel">{form.schluessel === "verbrauch" ? "Verbrauch je Wohnung" : "Betrag je Wohnung (€, z. B. aus der Heizkostenabrechnung des Messdienstes)"}</div>
          {mieter.map((m) => (
            <label key={m.id}>{m.name}
              <input className="input" inputMode="decimal" value={form.werte[m.id] ?? ""}
                onChange={(e) => setForm({ ...form, werte: { ...form.werte, [m.id]: e.target.value } })} />
            </label>
          ))}
        </div>
      )}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>§ 35a EStG — Lohnanteil für den Mieter ausweisen</summary>
        <div className="nk-formular-raster" style={{ marginTop: 8 }}>
          <label>davon Arbeitskosten (€)
            <input className="input" inputMode="decimal" value={form.lohnanteil} onChange={(e) => setForm({ ...form, lohnanteil: e.target.value })} />
          </label>
          <label>Art
            <select className="input" value={form.art35a} onChange={(e) => setForm({ ...form, art35a: e.target.value })}>
              <option value="">—</option>
              <option value="haushaltsnah">haushaltsnahe Dienstleistung</option>
              <option value="handwerker">Handwerkerleistung</option>
            </select>
          </label>
        </div>
      </details>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="btn btn-gold" disabled={laeuft} onClick={kostenSpeichern}>{form.id ? "Speichern" : "Hinzufügen"}</button>
        <button type="button" className="btn btn-ghost" disabled={laeuft} onClick={() => setForm(null)}>Abbrechen</button>
        {form.id && <button type="button" className="btn btn-ghost" disabled={laeuft} onClick={() => loeschen(form.id!)} style={{ color: "var(--red)" }}>Löschen</button>}
      </div>
    </div>
  );

  return (
    <>
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Grundlagen {jahr}</h3>
            <div className="section-sub">Das ganze Haus — Leerstand trägt der Vermieter, deshalb zählt die Gesamtfläche, nicht die Summe der Mieter.</div>
          </div>
        </div>
        <div className="section-body">
          <div className="nk-formular-raster">
            <label>Gesamtwohnfläche (m²)
              <input className="input" inputMode="decimal" value={fl} onChange={(e) => setFl(e.target.value)} />
            </label>
            <label>Wohneinheiten
              <input className="input" inputMode="numeric" value={ein} onChange={(e) => setEin(e.target.value)} />
            </label>
            <label>Miteigentumsanteile gesamt
              <input className="input" inputMode="decimal" value={mea} placeholder="nur bei Schlüssel MEA" onChange={(e) => setMea(e.target.value)} />
            </label>
          </div>
          {mieter.length > 0 && (
            <div className="nk-mieter-liste">
              {mieter.map((m) => (
                <div key={m.id} className="nk-mieter-zeile">
                  <div style={{ minWidth: 0 }}>
                    <div className="nk-name">{m.name}</div>
                    <div className="nk-klein">
                      {m.flaeche ? `${deZahl(m.flaeche)} m²` : "Wohnfläche fehlt"} · {m.tage >= props.jahresTage ? "ganzes Jahr" : `${m.tage} von ${props.jahresTage} Tagen`}
                    </div>
                  </div>
                  <label className="nk-klein-feld">Personen
                    <input className="input" inputMode="numeric" value={jeMieter[m.id]?.personen ?? ""} placeholder={brauchtPersonen ? "nötig" : ""}
                      onChange={(e) => setJeMieter({ ...jeMieter, [m.id]: { ...(jeMieter[m.id] ?? { mea: "" }), personen: e.target.value } })} />
                  </label>
                  {brauchtMea && (
                    <label className="nk-klein-feld">MEA
                      <input className="input" inputMode="decimal" value={jeMieter[m.id]?.mea ?? ""}
                        onChange={(e) => setJeMieter({ ...jeMieter, [m.id]: { ...(jeMieter[m.id] ?? { personen: "" }), mea: e.target.value } })} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} disabled={laeuft} onClick={grundlagenSpeichern}>Grundlagen speichern</button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Kosten {jahr}</h3>
            <div className="section-sub">Jede Kostenart einmal mit dem Betrag für das ganze Haus.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {props.vorschlaege.buchungen > 0 && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={laeuft} onClick={() => vorschlaege("buchungen")}>
                Aus Buchungen ({props.vorschlaege.buchungen})
              </button>
            )}
            {props.vorschlaege.vorjahr > 0 && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={laeuft} onClick={() => vorschlaege("vorjahr")}>
                Wie {jahr - 1} ({props.vorschlaege.vorjahr})
              </button>
            )}
            <label className="btn btn-ghost" style={{ fontSize: 12, cursor: kiLaeuft ? "wait" : "pointer" }}>
              {kiLaeuft ? "Wird gelesen …" : "Abrechnung hochladen"}
              <input type="file" accept="application/pdf,image/*" hidden disabled={kiLaeuft} onChange={kiImport} />
            </label>
          </div>
        </div>
        <div className="section-body">
          {kosten.length === 0 && !form && (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
              Noch keine Kosten für {jahr}. Trag die Kostenarten aus Grundsteuerbescheid, Versicherung, Müll- und
              Wasserrechnung ein — oder übernimm sie aus deinen Buchungen oder dem Vorjahr.
            </p>
          )}
          {kosten.map((k) =>
            form?.id === k.id ? <div key={k.id}>{formular}</div> : (
              <button key={k.id} type="button" className="listen-zeile nk-kosten-zeile" onClick={() => bearbeiten(k)}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="nk-name">{k.bezeichnung}</span>
                  <span className="nk-klein">
                    {k.umlagefaehig ? SCHLUESSEL_LABEL[k.schluessel] : "nicht umlagefähig"}
                    {k.quelle && QUELLE[k.quelle] ? ` · ${QUELLE[k.quelle]}` : ""}
                  </span>
                </span>
                <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{eur2(k.betrag)}</span>
              </button>
            ),
          )}
          {form && !form.id ? formular : !form && (
            <button type="button" className="btn btn-gold" style={{ marginTop: 12 }} onClick={() => setForm(LEER)}>+ Kostenart</button>
          )}
        </div>
      </div>
    </>
  );
}
