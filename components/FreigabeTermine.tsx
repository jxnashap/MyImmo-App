"use client";

// Termine von Bank oder Makler (06.10.2026) — Seite des Eigentümers. Vorschläge: einen wählen oder
// „keiner passt“ zurückschreiben. Rückruf: anrufen, danach den vereinbarten Termin eintragen oder
// ohne Termin abschließen. Bestätigt landet der Termin zugleich in /termine.
import { useState } from "react";
import { CalendarClock, Phone } from "lucide-react";
import { useToast } from "@/components/Toast";
import IcsKnopf from "@/components/IcsKnopf";
import { bestaetigeFreigabeTermin, lehneFreigabeTerminAb, erledigeFreigabeRueckruf } from "@/lib/actions/freigabeTermin";
import { TERMIN_STATUS_TEXT, telLink, terminText, type FreigabeTerminZeile } from "@/lib/freigabeTermin";

export default function FreigabeTermine({
  zeilen,
  wer,
  jetzt,
}: {
  zeilen: FreigabeTerminZeile[];
  /** „der Bank“ / „dem Makler“ */
  wer: string;
  /** Stichtag vom Server (nie `Date.now()` im Render). */
  jetzt: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<Record<string, string>>({});
  const [vereinbart, setVereinbart] = useState<Record<string, string>>({});

  const offen = zeilen.filter((z) => z.status === "offen");
  const bestaetigt = zeilen.filter((z) => z.status === "bestaetigt" && z.gewaehlt && new Date(z.gewaehlt).getTime() > new Date(jetzt).getTime() - 86400000);
  const erledigt = zeilen.filter((z) => !offen.includes(z) && !bestaetigt.includes(z)).slice(0, 3);

  async function los(id: string, f: () => Promise<{ ok: true } | { error: string }>, ok: string) {
    setBusy(id);
    try {
      const r = await f();
      if ("error" in r) toast(r.error, "error");
      else toast(ok);
    } catch {
      toast("Speichern fehlgeschlagen.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (zeilen.length === 0) return null;

  return (
    <div id="termin" className="section" style={{ marginBottom: 18 }}>
      <div className="section-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarClock size={16} /> Termin mit {wer}
          {offen.length > 0 && <span className="badge badge-gold">Antwort nötig</span>}
        </h3>
      </div>

      {offen.map((z) => (
        <div key={z.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            <strong>{z.modus === "rueckruf" ? "Bitte um Rückruf" : "Terminvorschläge"}</strong>
            {z.name ? ` · ${z.name}` : ""}{z.ort ? ` · ${z.ort}` : ""}
          </div>
          {z.nachricht && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{z.nachricht}</div>}
          {z.telefon && (
            <div style={{ fontSize: 13 }}>
              <Phone size={13} style={{ verticalAlign: "-2px" }} />{" "}
              {telLink(z.telefon) ? <a href={telLink(z.telefon)!} style={{ color: "var(--gold)" }}>{z.telefon}</a> : z.telefon}
            </div>
          )}
          <input
            className="set-input"
            aria-label="Antwort (optional)"
            placeholder="Antwort (optional), z. B. „Ich bringe die Vollmacht mit“"
            maxLength={1000}
            value={antwort[z.id] ?? ""}
            onChange={(e) => setAntwort({ ...antwort, [z.id]: e.target.value })}
          />
          {z.modus === "termine" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {z.vorschlaege.map((v) => (
                <button key={v} className="btn btn-gold" style={{ fontSize: 12 }} disabled={busy === z.id}
                  onClick={() => los(z.id, () => bestaetigeFreigabeTermin(z.id, v, antwort[z.id] ?? ""), "Termin bestätigt und eingetragen.")}>
                  {terminText(v)}
                </button>
              ))}
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy === z.id}
                onClick={() => los(z.id, () => lehneFreigabeTerminAb(z.id, antwort[z.id] ?? ""), "Zurückgemeldet: keiner passt.")}>
                Keiner passt
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="datetime-local" className="set-input" step={900} aria-label="Vereinbarter Termin"
                value={vereinbart[z.id] ?? ""} onChange={(e) => setVereinbart({ ...vereinbart, [z.id]: e.target.value })} />
              <button className="btn btn-gold" style={{ fontSize: 12 }} disabled={busy === z.id || !vereinbart[z.id]}
                onClick={() => los(z.id, () => bestaetigeFreigabeTermin(z.id, vereinbart[z.id], antwort[z.id] ?? ""), "Termin eingetragen.")}>
                Vereinbarten Termin eintragen
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy === z.id}
                onClick={() => los(z.id, () => erledigeFreigabeRueckruf(z.id, antwort[z.id] ?? ""), "Als erledigt markiert.")}>
                Ohne Termin erledigt
              </button>
            </div>
          )}
        </div>
      ))}

      {bestaetigt.map((z) => (
        <div key={z.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
          <span><strong>{terminText(z.gewaehlt!)}</strong>{z.ort ? ` · ${z.ort}` : ""}{z.name ? ` · ${z.name}` : ""}</span>
          <IcsKnopf start={z.gewaehlt!} titel={`Termin mit ${wer.replace(/^(der|dem) /, "")}`} ort={z.ort}
            beschreibung={[z.name, z.telefon].filter(Boolean).join(" · ") || null} uid={`freigabe-${z.id}@myimmo`} />
        </div>
      ))}

      {erledigt.length > 0 && (
        <div style={{ padding: "8px 16px 12px", fontSize: 12.5, color: "var(--muted)" }}>
          {erledigt.map((z) => (
            <div key={z.id}>{new Date(z.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} · {TERMIN_STATUS_TEXT[z.status]}{z.gewaehlt ? ` · ${terminText(z.gewaehlt)}` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}
