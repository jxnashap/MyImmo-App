"use client";

// Belegeingang (Ablauf B, Prüfstand 11.10.2026). Je Beleg eine Karte: Datei, Zustand des
// KI-Vorschlags, Felder (vorbelegt aus dem Vorschlag), Prüfliste, Ziel (neu buchen oder an
// vorhandene Kosten hängen). Die Prüfliste rechnet hier live mit derselben Funktion wie der Server
// (lib/belegEingang.ts → pruefeBeleg); gebucht wird nur über `bucheBeleg`, der noch einmal prüft.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Sparkles, TriangleAlert, Info, ExternalLink } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ladeBelegHoch, bucheBeleg, verwirfBeleg } from "@/lib/actions/belegEingang";
import { KOSTEN_KATEGORIEN } from "@/lib/kategorien";
import { istUmlagefaehig } from "@/lib/format";
import { zahlDe } from "@/lib/zahl";
import {
  anzeigeStatus, buchbar, kiMoeglich, pruefeBeleg,
  type BelegVorschlag, type EingangZeile, type KostenZeile,
} from "@/lib/belegEingang";

export type EingangAnzeige = {
  id: string;
  status: string;
  datei_name: string;
  datei_mime: string;
  datei_hash: string;
  versuche: number;
  letzter_versuch: string | null;
  fehler: string | null;
  vorschlag: (BelegVorschlag & { prop_id?: string | null }) | null;
  kosten_id: string | null;
  created_at: string;
};

type Objekt = { id: string; bezeichnung: string | null; adresse: string | null };

const STATUS_TEXT: Record<string, [string, string]> = {
  neu: ["neu", "badge-teal"],
  in_arbeit: ["KI liest …", "badge-teal"],
  vorschlag: ["Vorschlag", "badge-amber"],
  fehler: ["kein Vorschlag", "badge-red"],
  abgebrochen: ["abgebrochen", "badge-red"],
  gebucht: ["gebucht", "badge-green"],
};

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const datumDe = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join(".") : "–");

export default function BelegEingang({
  offen, gebucht, objekte, kosten, alleEingaenge, kiAn, kiAnbieter, jetzt,
}: {
  offen: EingangAnzeige[];
  gebucht: EingangAnzeige[];
  objekte: Objekt[];
  kosten: KostenZeile[];
  alleEingaenge: EingangZeile[];
  kiAn: boolean;
  /** Wer die Auswertung ausführt (`kiAnbieterText()` in lib/aiRoute.ts, vom Server). */
  kiAnbieter: string;
  jetzt: number;
}) {
  const [laden, startLaden] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const vorschlagHolen = async (id: string): Promise<string | null> => {
    const r = await fetch("/api/beleg-vorschlag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (r.ok) return null;
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    return j?.error ?? `Vorschlag nicht möglich (${r.status}).`;
  };

  const hochladen = (dateien: FileList | null) =>
    startLaden(async () => {
      setMeldung(null);
      if (!dateien || dateien.length === 0) return;
      const fehler: string[] = [];
      for (const d of Array.from(dateien).slice(0, 10)) {
        const fd = new FormData();
        fd.set("datei", d);
        // Nur hochladen — die KI liest erst, wenn der Nutzer „KI-Vorschlag holen“ drückt
        // (Rechtssicherheit 21.10.2026). Vorher ging jeder Beleg nach dem Hochladen automatisch an
        // den KI-Anbieter; Datenschutzerklärung (3 e „freiwillig“) und AVV (Ziffer 2 „nur wenn der
        // Verantwortliche sie auslöst“) sagen etwas anderes.
        try {
          const r = await ladeBelegHoch(fd);
          if (!r.ok) fehler.push(`${d.name}: ${r.error}`);
        } catch {
          fehler.push(`${d.name}: Hochladen fehlgeschlagen.`);
        }
      }
      setMeldung(fehler.length ? fehler.join(" · ") : null);
      if (fehler.length) toast(`${fehler.length} ${fehler.length === 1 ? "Beleg" : "Belege"} mit Hinweis — siehe oben.`, "error");
      else toast("Belege liegen im Eingang ✓", "success");
      router.refresh();
    });

  return (
    <div>
      <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="btn btn-gold" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileUp size={15} /> {laden ? "Lädt …" : "Belege hochladen"}
            <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={laden}
              onChange={(e) => { hochladen(e.target.files); e.target.value = ""; }} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 220 }}>
            PDF oder Foto einer Rechnung. {kiAn ? "Auf Wunsch schlägt die KI Betrag, Datum, Kostenart und Umlagefähigkeit vor — " : "Ohne eingerichteten KI-Anbieter füllst du die Felder selbst aus — "}
            gebucht wird erst, was du prüfst und freigibst.
          </span>
        </div>
        {kiAn && (
          <p style={{ fontSize: 11, color: "var(--faint)", margin: "8px 0 0" }}>
            KI-Auswertung nur auf Klick: Erst „KI-Vorschlag holen“ übermittelt den Beleg zur Auswertung an{" "}
            {kiAnbieter}. Die KI kann sich irren — bitte jeden Vorschlag vor dem Buchen prüfen.
          </p>
        )}
        {meldung && <p role="status" style={{ fontSize: 12.5, color: "var(--amber)", margin: "10px 0 0" }}>{meldung}</p>}
      </div>

      {offen.length === 0 ? (
        <div className="glass-card" style={{ padding: 18, fontSize: 13, color: "var(--muted)" }}>
          Keine offenen Belege. Lade eine Rechnung hoch — sie wartet hier, bis du sie buchst oder verwirfst.
        </div>
      ) : (
        offen.map((e) => (
          <BelegKarte key={e.id} e={e} objekte={objekte} kosten={kosten} alleEingaenge={alleEingaenge} kiAn={kiAn} jetzt={jetzt} vorschlagHolen={vorschlagHolen} />
        ))
      )}

      {gebucht.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Zuletzt gebucht ({gebucht.length})</summary>
          {gebucht.map((e) => (
            <div key={e.id} className="listen-zeile" style={{ fontSize: 12.5 }}>
              <span>{e.datei_name}</span>
              <span style={{ color: "var(--muted)" }}>{datumDe(e.created_at)}</span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function BelegKarte({
  e, objekte, kosten, alleEingaenge, kiAn, jetzt, vorschlagHolen,
}: {
  e: EingangAnzeige;
  objekte: Objekt[];
  kosten: KostenZeile[];
  alleEingaenge: EingangZeile[];
  kiAn: boolean;
  jetzt: number;
  vorschlagHolen: (id: string) => Promise<string | null>;
}) {
  const v = e.vorschlag;
  const [propId, setPropId] = useState<string>(v?.prop_id ?? "");
  const [ohneObjekt, setOhneObjekt] = useState(false);
  const [datum, setDatum] = useState(v?.datum ?? "");
  const [betrag, setBetrag] = useState(v?.betrag != null ? v.betrag.toFixed(2).replace(".", ",") : "");
  const [kategorie, setKategorie] = useState<string>(v?.kategorie ?? "");
  const [umlage, setUmlage] = useState<string>(v?.umlage ?? (v?.kategorie ? istUmlagefaehig(v.kategorie) : ""));
  const [beschreibung, setBeschreibung] = useState([v?.aussteller, v?.leistung, v?.rechnungsnummer ? `Nr. ${v.rechnungsnummer}` : null].filter(Boolean).join(" · "));
  const [ziel, setZiel] = useState<string>("neu");
  const [dubletteOk, setDubletteOk] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const betragZahl = zahlDe(betrag);
  const { punkte, anhaengbar } = pruefeBeleg(
    { eintragId: e.id, datei_hash: e.datei_hash, prop_id: ohneObjekt ? null : propId || null, ohneObjekt, kategorie, umlagefaehig: umlage, betrag: betragZahl, datum, rechnungsnummer: v?.rechnungsnummer ?? null },
    { kosten, eingaenge: alleEingaenge },
  );
  const zielGueltig = ziel === "neu" || anhaengbar.some((k) => k.id === ziel);
  const darf = buchbar(punkte, dubletteOk) && zielGueltig && ["ja", "nein", "unklar"].includes(umlage);
  const hatDublette = punkte.some((p) => p.art === "dublette_datei" || p.art === "dublette_buchung");
  const status = anzeigeStatus(e, jetzt);
  const [statusText, statusKlasse] = STATUS_TEXT[status] ?? [status, "badge-teal"];
  const standard = kategorie ? istUmlagefaehig(kategorie) : null;

  const buchen = () =>
    start(async () => {
      try {
        const r = await bucheBeleg(e.id, {
          prop_id: ohneObjekt ? null : propId || null, ohne_objekt: ohneObjekt, kategorie, umlagefaehig: umlage, betrag, buchungsdatum: datum,
          beschreibung, anhaengen_an: ziel === "neu" ? null : ziel, dublette_ok: dubletteOk,
        });
        if (!r.ok) return toast(r.error, "error");
        toast(r.angehaengt ? "Beleg an die vorhandene Buchung gehängt ✓" : r.schonGebucht ? "War schon gebucht — nichts doppelt angelegt." : "Gebucht ✓", "success");
        router.refresh();
      } catch {
        toast("Buchen fehlgeschlagen.", "error");
      }
    });

  const verwerfen = () =>
    start(async () => {
      try {
        const r = await verwirfBeleg(e.id);
        if (!r.ok) return toast(r.error ?? "Verwerfen fehlgeschlagen.", "error");
        toast("Beleg verworfen.", "success");
        router.refresh();
      } catch {
        toast("Verwerfen fehlgeschlagen.", "error");
      }
    });

  const kiNochmal = () =>
    start(async () => {
      const f = await vorschlagHolen(e.id);
      if (f) toast(f, "error");
      router.refresh();
    });

  return (
    <div className="section" style={{ marginBottom: 14 }} data-beleg={e.id}>
      <div className="section-header">
        <div style={{ minWidth: 0 }}>
          <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.datei_name}</h3>
          <div className="section-sub">
            Hochgeladen {datumDe(e.created_at)} · <span className={`badge ${statusKlasse}`}>{statusText}</span>
            {e.versuche > 0 && ` · KI-Versuch ${e.versuche} von 3`}
          </div>
        </div>
        <a href={`/cashflow/belege/${e.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}>
          <ExternalLink size={13} style={{ verticalAlign: "-2px" }} /> ansehen
        </a>
      </div>
      <div className="section-body">
        {(status === "fehler" || status === "abgebrochen") && (
          <p style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 10px" }}>
            {status === "abgebrochen" ? "Die Auswertung wurde nicht beendet." : e.fehler ?? "Kein Vorschlag."} Du kannst die Felder selbst ausfüllen.
          </p>
        )}
        {kiAn && kiMoeglich(e, jetzt) && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 10 }} disabled={pending} onClick={kiNochmal} data-demo-sperre>
            <Sparkles size={13} style={{ verticalAlign: "-2px" }} /> {e.versuche === 0 ? "KI-Vorschlag holen" : "KI-Vorschlag erneut versuchen"}
          </button>
        )}
        {v && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
            <Sparkles size={12} style={{ verticalAlign: "-2px" }} /> Vorschlag: {v.aussteller ?? "Aussteller unbekannt"}
            {v.kategorieRoh ? ` · Kostenart „${v.kategorieRoh}“ (nicht in der Liste)` : ""}
            {v.umlageGrund ? ` · Umlage: ${v.umlageGrund}` : ""}
            {v.objektHinweis ? ` · Objekt laut Beleg: ${v.objektHinweis}` : ""}. Nur ein Vorschlag — bitte prüfen.
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
          <div className="form-group">
            <label htmlFor={`${e.id}-objekt`}>Objekt</label>
            <select id={`${e.id}-objekt`} value={ohneObjekt ? "__ohne" : propId} aria-label="Objekt"
              onChange={(ev) => { const w = ev.target.value; setOhneObjekt(w === "__ohne"); setPropId(w === "__ohne" ? "" : w); setZiel("neu"); }}>
              <option value="">— Objekt wählen —</option>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung ?? o.adresse ?? "Objekt"}</option>)}
              <option value="__ohne">ohne Objekt (z. B. Kontogebühr)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${e.id}-datum`}>Rechnungsdatum</label>
            <input id={`${e.id}-datum`} type="date" value={datum} onChange={(ev) => { setDatum(ev.target.value); setZiel("neu"); }} aria-label="Rechnungsdatum" />
          </div>
          <div className="form-group">
            <label htmlFor={`${e.id}-betrag`}>Betrag (brutto)</label>
            <input id={`${e.id}-betrag`} inputMode="decimal" value={betrag} onChange={(ev) => { setBetrag(ev.target.value); setZiel("neu"); }} aria-label="Betrag" />
          </div>
          <div className="form-group">
            <label htmlFor={`${e.id}-art`}>Kostenart</label>
            <select id={`${e.id}-art`} value={kategorie} onChange={(ev) => setKategorie(ev.target.value)} aria-label="Kostenart">
              <option value="">— wählen —</option>
              {KOSTEN_KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${e.id}-umlage`}>Umlagefähig (§ 2 BetrKV)</label>
            <select id={`${e.id}-umlage`} value={umlage} onChange={(ev) => setUmlage(ev.target.value)} aria-label="Umlagefähig">
              <option value="">— wählen —</option>
              <option value="ja">ja — in die NK-Abrechnung</option>
              <option value="nein">nein</option>
              <option value="unklar">unklar — später klären</option>
            </select>
            {standard && standard !== "unklar" && <span style={{ fontSize: 11, color: "var(--faint)" }}>üblich bei „{kategorie}“: {standard}</span>}
          </div>
          <div className="form-group">
            <label htmlFor={`${e.id}-text`}>Beschreibung</label>
            <input id={`${e.id}-text`} value={beschreibung} onChange={(ev) => setBeschreibung(ev.target.value)} aria-label="Beschreibung" maxLength={200} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--faint)", margin: "6px 0 0" }}>
          Kostenart und Umlagefähigkeit sind zwei Fragen: Die Kostenart ordnet die Buchung in den Auswertungen ein, die
          Umlagefähigkeit entscheidet, ob der Betrag in die Nebenkostenabrechnung darf.
        </p>

        {anhaengbar.length > 0 && (
          <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
            <legend style={{ fontSize: 12.5, fontWeight: 600 }}>Schon gebucht, aber ohne Beleg:</legend>
            <label style={{ display: "flex", gap: 6, fontSize: 12.5, marginTop: 4 }}>
              <input type="radio" name={`ziel-${e.id}`} checked={ziel === "neu"} onChange={() => setZiel("neu")} /> neu buchen
            </label>
            {anhaengbar.map((k) => (
              <label key={k.id} style={{ display: "flex", gap: 6, fontSize: 12.5, marginTop: 4 }}>
                <input type="radio" name={`ziel-${e.id}`} checked={ziel === k.id} onChange={() => setZiel(k.id)} />
                Beleg anhängen an: {datumDe(k.buchungsdatum)} · {eur(Number(k.betrag) || 0)} · {k.kategorie ?? "ohne Kategorie"}
                {k.prop_id ? ` · ${objekte.find((o) => o.id === k.prop_id)?.bezeichnung ?? ""}` : ""}
              </label>
            ))}
          </fieldset>
        )}

        {punkte.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", fontSize: 12.5 }} aria-label="Prüfliste">
            {punkte.map((p) => (
              <li key={p.art} style={{ display: "flex", gap: 6, color: p.sperrt ? "var(--red)" : "var(--amber)", marginTop: 3 }}>
                {p.sperrt ? <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} /> : <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />}
                {p.text}
              </li>
            ))}
          </ul>
        )}
        {hatDublette && (
          <label style={{ display: "flex", gap: 6, fontSize: 12.5, marginTop: 8 }}>
            <input type="checkbox" checked={dubletteOk} onChange={(ev) => setDubletteOk(ev.target.checked)} />
            Geprüft — das ist keine Dublette, trotzdem buchen.
          </label>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-gold" disabled={pending || !darf} onClick={buchen} data-demo-sperre>
            {pending ? "Bucht …" : ziel === "neu" ? "Buchen" : "Beleg anhängen"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={verwerfen} data-demo-sperre="loeschen">Verwerfen</button>
        </div>
      </div>
    </div>
  );
}
