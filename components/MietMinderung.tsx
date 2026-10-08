"use client";

// Mietminderung erfassen (Gesamtprüfung P7 / B15). Eine Minderung tritt kraft Gesetzes ein
// (§ 536 Abs. 1 BGB) — erfasst gilt ein geminderter Monat mit dem geminderten Betrag als bezahlt
// (Mietkonto, Rückstands-Wächter, Dashboard und Mieterportal rechnen über `sollFuerMonat`).
// MyImmo beurteilt NICHT, ob oder in welcher Höhe gemindert werden darf — es rechnet nur damit.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { fuegeMinderungHinzu, entferneMinderung } from "@/lib/actions/mietzeitraeume";
import { monatLabel, type Minderung } from "@/lib/mietkonto";
import { eur2 } from "@/lib/format";

export default function MietMinderung({ mieterId, minderungen }: { mieterId: string; minderungen: Minderung[] }) {
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<"prozent" | "betrag">("prozent");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const speichern = (fd: FormData) =>
    start(async () => {
      try {
        if (art === "prozent") fd.delete("betrag"); else fd.delete("prozent");
        const r = await fuegeMinderungHinzu(mieterId, fd);
        if (!r.ok) return toast(r.error ?? "Speichern fehlgeschlagen.", "error");
        toast("Minderung erfasst.");
        setOffen(false);
        router.refresh();
      } catch {
        toast("Speichern fehlgeschlagen.", "error");
      }
    });

  const entfernen = (i: number) =>
    start(async () => {
      try {
        const r = await entferneMinderung(mieterId, i);
        if (!r.ok) return toast(r.error ?? "Entfernen fehlgeschlagen.", "error");
        toast("Minderung entfernt.");
        router.refresh();
      } catch {
        toast("Entfernen fehlgeschlagen.", "error");
      }
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3>Mietminderung</h3>
        {!offen && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOffen(true)}>
            + Minderung erfassen
          </button>
        )}
      </div>
      <div className="section-body">
        {minderungen.length === 0 && !offen && (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            Zahlt der Mieter wegen eines Mangels weniger, erfasse die Minderung hier — dann gilt der Monat
            mit dem geminderten Betrag als bezahlt und erscheint nicht als offen.
          </p>
        )}
        {minderungen.length > 0 && (
          <div className="listen">
            {minderungen.map((md, i) => (
              <div key={`${md.von}-${i}`} className="listen-zeile">
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">
                    {md.prozent != null ? `${md.prozent.toLocaleString("de-DE")} %` : `${eur2(md.betrag ?? 0)} je Monat`}
                    {md.grund ? ` · ${md.grund}` : ""}
                  </span>
                  <span className="listen-zeile-sub">
                    ab {monatLabel(md.von)}{md.bis ? ` bis ${monatLabel(md.bis)}` : " · läuft noch"}
                  </span>
                </span>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={pending} onClick={() => entfernen(i)}>
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
        {offen && (
          <form action={speichern} className="form-box" style={{ padding: 0, border: "none", background: "none", boxShadow: "none", maxWidth: "none" }}>
            <div className="form-row">
              <div className="form-group"><label>Ab Monat *</label><input type="month" name="von" required /></div>
              <div className="form-group"><label>Bis Monat (leer = läuft noch)</label><input type="month" name="bis" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Höhe</label>
                <select value={art} onChange={(e) => setArt(e.target.value as "prozent" | "betrag")}>
                  <option value="prozent">Prozent der Miete</option>
                  <option value="betrag">Betrag je Monat (€)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{art === "prozent" ? "Prozent *" : "Betrag (€) *"}</label>
                <input type="number" step="0.01" min="0" name={art} required />
              </div>
            </div>
            <div className="form-group"><label>Grund (z. B. Heizungsausfall)</label><input type="text" name="grund" maxLength={200} /></div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 10px" }}>
              Prozent beziehen sich auf die Bruttomiete (Kaltmiete + Nebenkosten). Ob und in welcher Höhe
              eine Minderung berechtigt ist, beurteilt MyImmo nicht.
            </p>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOffen(false)}>Abbrechen</button>
              <button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Speichern"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
