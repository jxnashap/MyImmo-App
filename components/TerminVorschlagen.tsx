"use client";

// Termin auf der öffentlichen Bank- bzw. Makler-Seite (06.10.2026, Vorgabe des Betreibers): ENTWEDER
// 1–3 Termine zur Auswahl ODER eine Telefonnummer für einen Rückruf. Darunter der Stand: offen,
// bestätigt (mit Kalenderdatei), „keiner passt“ (dann neu vorschlagen) oder erledigt.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Phone, Plus, TriangleAlert, X } from "lucide-react";
import { schlageTerminVor } from "@/lib/actions/freigabeTerminPublic";
import { TERMIN_MAX_VORSCHLAEGE, TERMIN_STATUS_TEXT, terminText, type OeffentlicherTermin, type TerminModus } from "@/lib/freigabeTermin";
import type { FreigabeArt } from "@/lib/freigabeCode";
import IcsKnopf from "@/components/IcsKnopf";

export default function TerminVorschlagen({
  art,
  token,
  termine,
}: {
  art: FreigabeArt;
  token: string;
  termine: OeffentlicherTermin[];
}) {
  const router = useRouter();
  const [modus, setModus] = useState<TerminModus>("termine");
  const [felder, setFelder] = useState(1);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const offen = termine.find((t) => t.status === "offen");

  async function senden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    try {
      const r = await schlageTerminVor(art, token, new FormData(e.currentTarget));
      if ("error" in r) return setFehler(r.error);
      setFelder(1);
      router.refresh();
    } catch {
      setFehler("Senden fehlgeschlagen — bitte später erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      {termine.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {termine.map((t, i) => (
            <div key={`${t.created_at}-${i}`} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13 }}>{t.modus === "rueckruf" ? "Rückruf erbeten" : `${t.vorschlaege.length} Termin${t.vorschlaege.length === 1 ? "" : "e"} vorgeschlagen`}</strong>
                <span className={`badge ${t.status === "bestaetigt" ? "badge-green" : t.status === "offen" ? "badge-gold" : ""}`}>{TERMIN_STATUS_TEXT[t.status]}</span>
              </div>
              {t.status === "bestaetigt" && t.gewaehlt && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <span>Vereinbart: <strong>{terminText(t.gewaehlt)}</strong>{t.ort ? ` · ${t.ort}` : ""}</span>
                  <IcsKnopf start={t.gewaehlt} titel="Termin über MyImmo" ort={t.ort} uid={`freigabe-${token}-${t.created_at}@myimmo`} />
                </div>
              )}
              {t.status !== "bestaetigt" && t.modus === "termine" && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--muted)" }}>
                  {t.vorschlaege.map((z) => <li key={z}>{terminText(z)}</li>)}
                </ul>
              )}
              {t.antwort && <div style={{ fontSize: 12.5 }}>Antwort: {t.antwort}</div>}
            </div>
          ))}
        </div>
      )}

      {offen ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
          Der Eigentümer hat Ihren Vorschlag noch nicht beantwortet. Sobald er einen Termin wählt, steht er hier.
        </p>
      ) : (
        <form onSubmit={senden} style={{ display: "grid", gap: 10 }}>
          <div className="seg" role="radiogroup" aria-label="Wie möchten Sie einen Termin vereinbaren?" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" role="radio" aria-checked={modus === "termine"} className={`btn ${modus === "termine" ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12 }} onClick={() => setModus("termine")}>
              <CalendarClock size={13} /> 1–3 Termine vorschlagen
            </button>
            <button type="button" role="radio" aria-checked={modus === "rueckruf"} className={`btn ${modus === "rueckruf" ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12 }} onClick={() => setModus("rueckruf")}>
              <Phone size={13} /> Telefonnummer hinterlassen
            </button>
          </div>
          <input type="hidden" name="modus" value={modus} />

          {modus === "termine" ? (
            <>
              {Array.from({ length: felder }, (_, i) => (
                <div key={i} className="field" style={{ margin: 0, display: "flex", gap: 6, alignItems: "end" }}>
                  <div style={{ flex: 1 }}>
                    <label>Termin {i + 1}{i === 0 ? " *" : ""}</label>
                    <input type="datetime-local" name="vorschlag" required={i === 0} step={900} />
                  </div>
                  {i > 0 && i === felder - 1 && (
                    <button type="button" className="btn btn-ghost" aria-label="Termin entfernen" onClick={() => setFelder(felder - 1)}><X size={13} /></button>
                  )}
                </div>
              ))}
              {felder < TERMIN_MAX_VORSCHLAEGE && (
                <div><button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFelder(felder + 1)}><Plus size={13} /> Weiteren Termin</button></div>
              )}
              <div className="field-row">
                <div className="field" style={{ margin: 0 }}><label>Ort</label><input name="ort" maxLength={200} placeholder="z. B. Filiale Hauptstraße 5 oder Videotermin" /></div>
                <div className="field" style={{ margin: 0 }}><label>Telefon (für Rückfragen)</label><input name="telefon" type="tel" maxLength={30} /></div>
              </div>
            </>
          ) : (
            <div className="field" style={{ margin: 0 }}>
              <label>Telefonnummer *</label>
              <input name="telefon" type="tel" required maxLength={30} placeholder="+49 …" />
            </div>
          )}
          <div className="field-row">
            <div className="field" style={{ margin: 0 }}><label>Ihr Name</label><input name="name" maxLength={200} /></div>
            <div className="field" style={{ margin: 0 }}><label>Notiz</label><input name="nachricht" maxLength={1000} placeholder={modus === "rueckruf" ? "z. B. erreichbar Mo–Fr 9–17 Uhr" : "z. B. bitte Ausweis mitbringen"} /></div>
          </div>
          {fehler && (
            <div role="alert" style={{ background: "var(--red-dim)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
              <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
            </div>
          )}
          <div>
            <button className="btn btn-gold" disabled={busy}>{busy ? "Wird gesendet…" : modus === "rueckruf" ? "Rückruf erbitten" : "Termine vorschlagen"}</button>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)" }}>
            Zeiten in deutscher Zeit. Name und Telefonnummer sieht nur der Eigentümer.
          </p>
        </form>
      )}
    </div>
  );
}
