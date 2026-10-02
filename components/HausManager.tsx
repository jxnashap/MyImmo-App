"use client";

// Vermieter: Mitteilungen an ein Haus / alle Mieter und Gebäude-Infos je Objekt
// (02.10.2026, Schritt 6 des Mieterportal-Plans). Senden zeigt vorher, wie viele Mieter
// die Mitteilung sehen werden; zurückziehen macht sie für alle sofort unsichtbar.
import { useMemo, useState, useTransition } from "react";
import { Megaphone, Building2, Undo2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { sendeMitteilung, zieheMitteilungZurueck, speichereGebaeudeInfos } from "@/lib/actions/mitteilungen";
import { datum } from "@/lib/format";

export type HausObjekt = { id: string; bezeichnung: string; verbunden: number };
export type GesendeteMitteilung = {
  gruppe: string;
  titel: string;
  nachricht: string;
  zugestellt_am: string;
  empfaenger: number;
  bestaetigt: number;
  bestaetigung_noetig: boolean;
  zurueckgezogen: boolean;
};
export type HausInfo = { prop_id: string; hausmeister: string | null; notdienst: string | null; muell: string | null; hausordnung: string | null; sonstiges: string | null };

const INFO_FELDER: { key: keyof Omit<HausInfo, "prop_id">; label: string; max: number; zeilen: number; hinweis?: string }[] = [
  { key: "hausmeister", label: "Hausmeister / Ansprechpartner", max: 500, zeilen: 2 },
  { key: "notdienst", label: "Notdienste (z. B. Heizung, Schlüssel)", max: 500, zeilen: 2, hinweis: "Erscheint auch im Notfall-Kasten deiner Mieter — als deine Angabe beschriftet." },
  { key: "muell", label: "Müll & Entsorgung", max: 1000, zeilen: 2 },
  { key: "hausordnung", label: "Hausordnung", max: 4000, zeilen: 5 },
  { key: "sonstiges", label: "Sonstiges", max: 2000, zeilen: 3 },
];

export default function HausManager({ objekte, gesendet, infos }: { objekte: HausObjekt[]; gesendet: GesendeteMitteilung[]; infos: HausInfo[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [ziel, setZiel] = useState("alle");
  const [rueckfrage, setRueckfrage] = useState<string | null>(null);
  const [infoObjekt, setInfoObjekt] = useState(objekte[0]?.id ?? "");
  const anzahl = useMemo(
    () => (ziel === "alle" ? objekte.reduce((s, o) => s + o.verbunden, 0) : objekte.find((o) => o.id === ziel)?.verbunden ?? 0),
    [ziel, objekte],
  );
  const info = infos.find((i) => i.prop_id === infoObjekt);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      const r = await sendeMitteilung(fd);
      const f = actionFehler(r);
      if (f) { toast(f, "error"); return; }
      toast(`Gesendet — sichtbar für ${"anzahl" in r ? r.anzahl : anzahl} Mieter.`);
    });

  const zurueck = (gruppe: string) =>
    startTransition(async () => {
      const f = actionFehler(await zieheMitteilungZurueck(gruppe));
      if (f) { toast(f, "error"); return; }
      setRueckfrage(null);
      toast("Zurückgezogen — kein Mieter sieht die Mitteilung mehr.");
    });

  const infoSpeichern = (fd: FormData) =>
    startTransition(async () => {
      const f = actionFehler(await speichereGebaeudeInfos(fd));
      if (f) toast(f, "error");
      else toast("Gebäude-Infos gespeichert ✓");
    });

  return (
    <>
      <div className="section">
        <div className="section-header"><h3><Megaphone size={15} style={{ verticalAlign: "-2px" }} /> Mitteilung an Mieter</h3></div>
        <div className="section-body">
          <form action={senden} style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              An
              <select name="ziel" className="input" value={ziel} onChange={(e) => setZiel(e.target.value)}>
                <option value="alle">Alle Mieter mit Portal-Zugang</option>
                {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung} ({o.verbunden})</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              Betreff *
              <input name="titel" className="input" required maxLength={120} placeholder="z. B. Wasser am Montag abgestellt" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              Text *
              <textarea name="nachricht" className="input" required rows={4} maxLength={4000} />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <input type="checkbox" name="bestaetigung" /> Mieter sollen „gelesen und bestätigt“ klicken (keine Unterschrift)
            </label>
            <p style={{ fontSize: 12, color: anzahl === 0 ? "var(--red)" : "var(--muted)", margin: 0 }}>
              {anzahl === 0
                ? "Hier sieht es niemand — kein Mieter mit Portal-Zugang."
                : `Sichtbar für ${anzahl} Mieter. Gehen nur an Konten mit aktivem Zugang; die E-Mail-Hinweise nennen keinen Inhalt.`}
            </p>
            <div>
              <button type="submit" className="btn btn-gold" disabled={pending || anzahl === 0}>{pending ? "…" : "Mitteilung senden"}</button>
            </div>
          </form>

          {gesendet.length > 0 && (
            <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Gesendet</div>
              {gesendet.map((g) => (
                <div key={g.gruppe} style={{ fontSize: 12.5, borderBottom: "1px solid var(--line)", paddingBottom: 8, opacity: g.zurueckgezogen ? 0.6 : 1 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                    <strong>{g.titel}</strong>
                    <span style={{ color: "var(--muted)" }}>{datum(g.zugestellt_am)} · {g.empfaenger} Mieter{g.bestaetigung_noetig ? ` · ${g.bestaetigt} bestätigt` : ""}</span>
                    {g.zurueckgezogen ? (
                      <span className="badge badge-neutral" style={{ marginLeft: "auto" }}>zurückgezogen</span>
                    ) : rueckfrage === g.gruppe ? (
                      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)" }} disabled={pending} onClick={() => zurueck(g.gruppe)}>Ja, zurückziehen</button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setRueckfrage(null)}>Abbrechen</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px", marginLeft: "auto" }} onClick={() => setRueckfrage(g.gruppe)}>
                        <Undo2 size={11} style={{ verticalAlign: "-1px" }} /> Zurückziehen
                      </button>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.nachricht}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Gebäude-Infos</h3></div>
        <div className="section-body">
          {objekte.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)", margin: 0 }}>Lege zuerst ein Objekt an — die Infos gelten je Haus.</p>
          ) : (
            <form key={infoObjekt} action={infoSpeichern} style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                Objekt
                <select name="prop_id" className="input" value={infoObjekt} onChange={(e) => setInfoObjekt(e.target.value)}>
                  {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung}</option>)}
                </select>
              </label>
              {INFO_FELDER.map((f) => (
                <label key={f.key} style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                  {f.label}
                  <textarea name={f.key} className="input" rows={f.zeilen} maxLength={f.max} defaultValue={info?.[f.key] ?? ""} />
                  {f.hinweis && <span style={{ fontSize: 11 }}>{f.hinweis}</span>}
                </label>
              ))}
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                Sichtbar für die Mieter dieses Objekts mit aktivem Portal-Zugang. Keine privaten Daten anderer Mieter eintragen.
              </p>
              <div><button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Speichern"}</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
