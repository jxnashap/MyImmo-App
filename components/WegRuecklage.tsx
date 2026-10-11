"use client";

// WEG-Erhaltungsrücklage je Steuerjahr (10.10.2026). Die Zuführung steckt im Hausgeld, ist aber keine
// Werbungskosten (BFH, Urteil vom 14.01.2025, IX R 19/24); abziehbar ist erst die Entnahme für eine
// Erhaltung. Beide Beträge stehen in der WEG-Jahresabrechnung. Rechnung: lib/wegRuecklage.ts + Anlage V.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { setzeWegRuecklage, entferneWegRuecklage } from "@/lib/actions/properties";
import { eur2 } from "@/lib/format";
import type { WegRuecklageJahr } from "@/lib/wegRuecklage";

export default function WegRuecklage({
  propId,
  eintraege,
  vorschlagJahr,
}: {
  propId: string;
  eintraege: ({ jahr: number } & WegRuecklageJahr)[];
  vorschlagJahr: number;
}) {
  const [offen, setOffen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const speichern = (fd: FormData) =>
    start(async () => {
      try {
        const r = await setzeWegRuecklage(propId, fd);
        if (!r.ok) return toast(r.error, "error");
        toast("Rücklage gespeichert.");
        setOffen(false);
        router.refresh();
      } catch {
        toast("Speichern fehlgeschlagen.", "error");
      }
    });

  const entfernen = (jahr: number) =>
    start(async () => {
      try {
        const r = await entferneWegRuecklage(propId, jahr);
        if (!r.ok) return toast(r.error, "error");
        toast("Eintrag entfernt.");
        router.refresh();
      } catch {
        toast("Entfernen fehlgeschlagen.", "error");
      }
    });

  return (
    <div id="ruecklage" data-anker className="section mb-20">
      <div className="section-header">
        <h3>Erhaltungsrücklage (WEG)</h3>
        {!offen && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOffen(true)}>
            + Jahr eintragen
          </button>
        )}
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
          Im Hausgeld steckt meist eine Zuführung zur Erhaltungsrücklage. Sie ist <strong>keine</strong> Werbungskosten
          (BFH, Urteil vom 14.01.2025, IX R 19/24) — abziehbar ist erst, was die Gemeinschaft daraus für eine
          Erhaltung ausgibt. Beide Beträge stehen in deiner WEG-Jahresabrechnung. MyImmo rechnet sie in der
          Anlage V heraus bzw. hinzu; deine Buchungen bleiben unverändert.
        </p>
        {eintraege.length > 0 && (
          <div className="listen">
            {eintraege.map((e) => (
              <div key={e.jahr} className="listen-zeile">
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">{e.jahr}</span>
                  <span className="listen-zeile-sub">
                    Zuführung {eur2(e.zufuehrung)} · Entnahme für Erhaltung {eur2(e.entnahme)}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  disabled={pending}
                  data-demo-sperre="loeschen"
                  onClick={() => entfernen(e.jahr)}
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
        {offen && (
          <form action={speichern} className="form-box" style={{ padding: 0, border: "none", background: "none", boxShadow: "none", maxWidth: "none" }}>
            <div className="form-row">
              <div className="form-group">
                <label>Jahr der Abrechnung *</label>
                <input type="number" name="jahr" min={2000} max={2100} step={1} defaultValue={vorschlagJahr} required />
              </div>
              <div className="form-group">
                <label>Zuführung zur Rücklage (€)</label>
                <input type="text" inputMode="decimal" name="zufuehrung" placeholder="z. B. 600" />
              </div>
              <div className="form-group">
                <label>Entnahme für Erhaltung, dein Anteil (€)</label>
                <input type="text" inputMode="decimal" name="entnahme" placeholder="0" />
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 10px" }}>
              Ein vorhandener Eintrag desselben Jahres wird ersetzt. Leere Felder gelten als 0 €.
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
