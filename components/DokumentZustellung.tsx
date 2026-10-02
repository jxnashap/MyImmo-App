"use client";

// Zustellstatus eines Archiv-Dokuments auf der Mieterseite (02.10.2026) — ersetzt den
// Schalter „Im Portal / Freigeben“. Zeigt, AN WEN zugestellt wurde, wann, ob abgerufen
// und ggf. bestätigt; „Zurückziehen“ macht es sofort unsichtbar, das Protokoll bleibt.
// Zustellen öffnet zuerst eine Karte mit Empfänger und Prüfung — wie bei der NK-Abrechnung.
import { useState, useTransition } from "react";
import { Send, Undo2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { stelleDokumentZu, zieheZustellungZurueck } from "@/lib/actions/zustellung";
import { datum } from "@/lib/format";
import type { ZustellPruefung } from "@/lib/mieterZugang";

export type ZustellZeile = {
  id: string;
  empfaenger_email: string | null;
  zugestellt_am: string;
  gelesen_am: string | null;
  bestaetigung_noetig: boolean;
  bestaetigt_am: string | null;
  zurueckgezogen_am: string | null;
};

export default function DokumentZustellung({
  notizId,
  mieterId,
  titel,
  hatDatei,
  mieterName,
  pruefung,
  zustellungen,
}: {
  notizId: string;
  mieterId: string;
  titel: string;
  hatDatei: boolean;
  mieterName: string;
  /** Prüfung ohne Jahresbezug (pruefeZustellung mit jahr = null), serverseitig berechnet. */
  pruefung: ZustellPruefung & { email: string | null };
  zustellungen: ZustellZeile[];
}) {
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [bestaetigung, setBestaetigung] = useState(false);
  const [rueckfrage, setRueckfrage] = useState<string | null>(null);
  const toast = useToast();

  const aktiv = zustellungen.filter((z) => !z.zurueckgezogen_am);
  const zurueck = zustellungen.filter((z) => z.zurueckgezogen_am);

  const zustellen = () =>
    startTransition(async () => {
      const r = await stelleDokumentZu(notizId, bestaetigung);
      const f = actionFehler(r);
      if (f) { toast(f, "error"); return; }
      setOffen(false);
      const an = "an" in r && r.an?.length ? r.an.join(", ") : mieterName;
      toast(`Zugestellt — sichtbar im Mieterportal von ${an}`);
    });

  const zurueckziehen = (id: string) =>
    startTransition(async () => {
      const f = actionFehler(await zieheZustellungZurueck(id, mieterId));
      if (f) { toast(f, "error"); return; }
      setRueckfrage(null);
      toast("Zurückgezogen — der Mieter sieht das Dokument nicht mehr.");
    });

  return (
    <div style={{ flexBasis: "100%", fontSize: 11.5, color: "var(--muted)", display: "grid", gap: 4 }}>
      {aktiv.map((z) => (
        <div key={z.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="badge badge-green">Zugestellt</span>
          <span>an <strong style={{ color: "var(--text)" }}>{z.empfaenger_email ?? "Portal-Konto"}</strong> am {datum(z.zugestellt_am)}</span>
          <span>· {z.gelesen_am ? `abgerufen ${datum(z.gelesen_am)}` : "noch nicht abgerufen"}</span>
          {z.bestaetigung_noetig && <span>· {z.bestaetigt_am ? `bestätigt ${datum(z.bestaetigt_am)}` : "Bestätigung offen"}</span>}
          {rueckfrage === z.id ? (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {z.gelesen_am && (
                <span style={{ color: "var(--red)" }} title="Art. 33 DSGVO">
                  Bereits abgerufen — ging es an die falsche Person, prüfe die Meldepflicht (72 h).
                </span>
              )}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)" }} disabled={pending} onClick={() => zurueckziehen(z.id)}>
                {pending ? "…" : "Ja, zurückziehen"}
              </button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} disabled={pending} onClick={() => setRueckfrage(null)}>Abbrechen</button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} disabled={pending} onClick={() => setRueckfrage(z.id)}>
              <Undo2 size={11} style={{ verticalAlign: "-1px" }} /> Zurückziehen
            </button>
          )}
        </div>
      ))}
      {zurueck.map((z) => (
        <div key={z.id} style={{ color: "var(--faint)" }}>
          Zurückgezogen am {datum(z.zurueckgezogen_am!)} (zugestellt an {z.empfaenger_email ?? "Portal-Konto"} am {datum(z.zugestellt_am)}
          {z.gelesen_am ? `, abgerufen ${datum(z.gelesen_am)}` : ", nie abgerufen"})
        </div>
      ))}

      {aktiv.length === 0 && hatDatei && (
        <div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} disabled={pending} onClick={() => setOffen((o) => !o)}>
            <Send size={11} style={{ verticalAlign: "-1px" }} /> Ins Mieterportal zustellen…
          </button>
          {offen && (
            <div role="dialog" aria-label="Zustellung prüfen" style={{ marginTop: 6, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 16, background: "var(--bg2)", maxWidth: 520, color: "var(--text)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>„{titel}“ zustellen an</div>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                {mieterName} · Portal-Konto: <strong>{pruefung.sperre ? "— keins verbunden —" : (pruefung.email ?? "Adresse unbekannt")}</strong>
              </div>
              {pruefung.sperre ? (
                <p role="alert" style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 8px" }}>{pruefung.sperre}</p>
              ) : (
                <>
                  {pruefung.warnungen.length > 0 && (
                    <ul style={{ fontSize: 12.5, color: "var(--gold)", margin: "0 0 8px", paddingLeft: 18 }}>
                      {pruefung.warnungen.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, marginBottom: 8 }}>
                    <input type="checkbox" checked={bestaetigung} onChange={(e) => setBestaetigung(e.target.checked)} />
                    Mieter soll „gelesen und bestätigt“ klicken (keine Unterschrift)
                  </label>
                </>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!pruefung.sperre && (
                  <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending} onClick={zustellen}>
                    {pending ? "…" : `Ja, an ${pruefung.email ?? mieterName} zustellen`}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={() => setOffen(false)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
