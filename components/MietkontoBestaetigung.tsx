"use client";
import { Rewind, Info } from "lucide-react";

// Mietkonto: zwei Modi.
// 1. „Monat bestätigen": pro Mieter eine Karte mit Soll-Betrag, editierbarem
//    Eingangsdatum (Default 1. des Monats) und Haken-Animation.
// 2. „Nacherfassen": offene Vormonate (bis 10 Jahre zurück) als Tabelle,
//    Batch-Bestätigung in einem Rutsch — mit 10-Tage-Regel-Hinweis an der
//    Jahresgrenze (§ 11 EStG).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eur2 } from "@/lib/format";
import {
  ymPlus,
  erwarteteMonate,
  dedup,
  type MietkontoMieter,
  type MietkontoZeitraum,
} from "@/lib/mietkonto";
import { bestaetigeMieteingang, bestaetigeMehrere, type BatchZeile } from "@/lib/actions/mietkonto";
import { useToast } from "@/components/Toast";

export type MietkontoZeile = {
  mieterId: string;
  propId: string | null;
  name: string;
  objekt: string;
  kaltmiete: number;
  nk: number;
  stellplatz: number;
  gesamt: number;
  schonGebucht: boolean;
};

export type NacherfassungMieter = {
  mieterId: string;
  propId: string | null;
  name: string;
  objekt: string;
  mieter: MietkontoMieter;
  zeitraeume: MietkontoZeitraum[];
  gebuchteMonate: string[]; // YYYY-MM
};

const monatLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
const monatKurz = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" });

function Haken() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10.5" stroke="var(--green)" strokeWidth="1.6" opacity="0.5" />
      <path
        className="haken-draw"
        d="M7 12.5l3.2 3.2L17 9"
        stroke="var(--green)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 24 }}
      />
    </svg>
  );
}

// 10-Tage-Regel: relevant für Dezember- und Januar-Mieten (§ 11 EStG).
const jahresgrenze = (ym: string) => ym.endsWith("-12") || ym.endsWith("-01");

export default function MietkontoBestaetigung({
  monat,
  aktuellerMonat,
  zeilen,
  nacherfassung,
}: {
  monat: string;
  aktuellerMonat: string;
  zeilen: MietkontoZeile[];
  nacherfassung: NacherfassungMieter[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startBuchen] = useTransition();
  const [modus, setModus] = useState<"monat" | "nacherfassen">("monat");

  // ---------- Modus 1: Monat bestätigen ----------
  const [datum, setDatum] = useState<Record<string, string>>({});
  const [betrag, setBetrag] = useState<Record<string, string>>({});
  const [frisch, setFrisch] = useState<Set<string>>(new Set());
  const [laufend, setLaufend] = useState<string | null>(null);

  const bestaetigt = useMemo(
    () => zeilen.filter((z) => z.schonGebucht || frisch.has(z.mieterId)).length,
    [zeilen, frisch],
  );
  const gesamt = zeilen.length;
  const quote = gesamt > 0 ? bestaetigt / gesamt : 0;
  const R = 26;
  const UMFANG = 2 * Math.PI * R;

  const bestaetige = (z: MietkontoZeile) => {
    if (laufend) return;
    const d = datum[z.mieterId] || `${monat}-01`;
    const b = Number((betrag[z.mieterId] ?? String(z.gesamt)).replace(",", "."));
    if (!Number.isFinite(b) || b <= 0) {
      toast("Bitte einen Betrag > 0 angeben.");
      return;
    }
    setLaufend(z.mieterId);
    startBuchen(async () => {
      const res = await bestaetigeMieteingang({
        mieter_id: z.mieterId,
        prop_id: z.propId,
        buchungsdatum: d,
        betrag: b,
        nk_anteil: z.nk > 0 ? z.nk : null,
      });
      setLaufend(null);
      if (res.ok) {
        setFrisch((s) => new Set(s).add(z.mieterId));
        router.refresh();
      } else {
        toast(res.error ?? "Buchen fehlgeschlagen.");
      }
    });
  };

  // ---------- Modus 2: Nacherfassen ----------
  const zehnJahre = ymPlus(aktuellerMonat, -120);
  const fruehesterBeginn = useMemo(() => {
    const beginne = nacherfassung
      .map((n) => (n.mieter.mietbeginn ?? "").slice(0, 7))
      .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
      .sort();
    const b = beginne[0] ?? zehnJahre;
    return b < zehnJahre ? zehnJahre : b;
  }, [nacherfassung, zehnJahre]);

  const [startMonat, setStartMonat] = useState(fruehesterBeginn);
  const [abgewaehlt, setAbgewaehlt] = useState<Set<string>>(new Set());
  const [nachDatum, setNachDatum] = useState<Record<string, string>>({});
  const [batchLaeuft, startBatch] = useTransition();

  // Offene Monate je Mieter (Engine läuft im Client — bei ~120 Monaten × wenige
  // Mieter unkritisch); bis einschließlich Vormonat.
  const offene = useMemo(() => {
    const bisMonat = ymPlus(aktuellerMonat, -1);
    const rows: {
      key: string;
      mieterId: string;
      propId: string | null;
      name: string;
      objekt: string;
      jahrMonat: string;
      gesamt: number;
      nk: number;
    }[] = [];
    for (const n of nacherfassung) {
      const erwartet = erwarteteMonate(n.mieter, n.zeitraeume, startMonat, bisMonat);
      const markiert = dedup(
        erwartet,
        n.gebuchteMonate.map((ym) => ({ buchungsdatum: `${ym}-15`, kategorie: "Miete" })),
      );
      for (const m of markiert) {
        if (m.schonGebucht || m.gesamt <= 0) continue;
        rows.push({
          key: `${n.mieterId}:${m.jahrMonat}`,
          mieterId: n.mieterId,
          propId: n.propId,
          name: n.name,
          objekt: n.objekt,
          jahrMonat: m.jahrMonat,
          gesamt: m.gesamt,
          nk: m.nk,
        });
      }
    }
    rows.sort((a, b) => a.jahrMonat.localeCompare(b.jahrMonat) || a.name.localeCompare(b.name));
    return rows;
  }, [nacherfassung, startMonat, aktuellerMonat]);

  const ausgewaehlt = offene.filter((r) => !abgewaehlt.has(r.key));
  const alleAn = ausgewaehlt.length === offene.length && offene.length > 0;

  const batchBuchen = () => {
    if (batchLaeuft || ausgewaehlt.length === 0) return;
    const zeilenBatch: BatchZeile[] = ausgewaehlt.map((r) => ({
      mieter_id: r.mieterId,
      prop_id: r.propId,
      buchungsdatum: nachDatum[r.key] || `${r.jahrMonat}-01`,
      betrag: r.gesamt,
      nk_anteil: r.nk > 0 ? r.nk : null,
    }));
    startBatch(async () => {
      const res = await bestaetigeMehrere(zeilenBatch);
      if (res.ok) {
        toast(`${res.anzahl} Mieteingänge gebucht ✓`);
        setAbgewaehlt(new Set());
        router.refresh();
      } else {
        toast(res.error ?? "Buchen fehlgeschlagen.");
      }
    });
  };

  const summeAusgewaehlt = ausgewaehlt.reduce((s, r) => s + r.gesamt, 0);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Mietkonto</div>
          <div className="topbar-sub">Mieteingänge bestätigen &amp; nacherfassen</div>
        </div>
        {modus === "monat" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => router.push(`/mietkonto?monat=${ymPlus(monat, -1)}`)}>←</button>
            <span style={{ fontWeight: 600, minWidth: 130, textAlign: "center" }}>{monatLabel(monat)}</span>
            <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => router.push(`/mietkonto?monat=${ymPlus(monat, 1)}`)}>→</button>
            {monat !== aktuellerMonat && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push("/mietkonto")}>Heute</button>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer (dezent, immer sichtbar) */}
      <div className="glass-card" style={{ padding: "10px 16px", marginBottom: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        Hinweis: MyImmo bucht nach dem von dir bestätigten Zahlungsdatum (Zufluss-/Abflussprinzip,
        § 11 EStG). Dies ist keine Steuerberatung; Angaben ohne Gewähr — im Zweifel Steuerberater fragen.
      </div>

      {/* Modus-Umschalter */}
      <div className="settings-tabs" style={{ position: "static", marginBottom: 18 }}>
        <button type="button" className={`settings-tab${modus === "monat" ? " active" : ""}`} onClick={() => setModus("monat")}>
          ✓ Monat bestätigen
        </button>
        <button type="button" className={`settings-tab${modus === "nacherfassen" ? " active" : ""}`} onClick={() => setModus("nacherfassen")}>
          <Rewind size={14} style={{ verticalAlign: "-2px" }} /> Nacherfassen ({offene.length})
        </button>
      </div>

      {modus === "monat" ? (
        <>
          {/* Fortschritt */}
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r={R} stroke="var(--line2)" strokeWidth="6" fill="none" />
              <circle
                cx="32" cy="32" r={R}
                stroke={quote >= 1 && gesamt > 0 ? "var(--green)" : "var(--gold)"}
                strokeWidth="6" fill="none" strokeLinecap="round"
                strokeDasharray={UMFANG}
                strokeDashoffset={UMFANG * (1 - quote)}
                transform="rotate(-90 32 32)"
                style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
              />
              <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">
                {gesamt > 0 ? `${bestaetigt}/${gesamt}` : "–"}
              </text>
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {gesamt === 0
                  ? "Keine erwarteten Mieteingänge in diesem Monat"
                  : bestaetigt >= gesamt
                    ? "Alle Mieteingänge bestätigt ✓"
                    : `${bestaetigt} von ${gesamt} bestätigt`}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Eingangsdatum = tatsächlicher Geldeingang (Standard 1. des Monats, editierbar).
                {monat > aktuellerMonat && " Hinweis: Dieser Monat liegt in der Zukunft."}
              </div>
            </div>
          </div>

          {zeilen.map((z) => {
            const ok = z.schonGebucht || frisch.has(z.mieterId);
            const istFrisch = frisch.has(z.mieterId);
            return (
              <div
                key={z.mieterId}
                className={`glass-card${istFrisch ? " row-confirming" : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  marginBottom: 12, padding: "16px 18px",
                  border: ok ? "1px solid rgba(76,175,125,0.5)" : undefined,
                  transition: "border-color 0.4s ease",
                }}
              >
                <div style={{ minWidth: 180, flex: "1 1 180px" }}>
                  <div style={{ fontWeight: 600 }}>{z.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{z.objekt}</div>
                </div>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Soll ({monatLabel(monat)})</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{eur2(z.gesamt)}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>
                    {eur2(z.kaltmiete)} Kalt{z.nk > 0 ? ` + ${eur2(z.nk)} NK` : ""}{z.stellplatz > 0 ? ` + ${eur2(z.stellplatz)} Stellpl.` : ""}
                  </div>
                </div>

                {ok ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", color: "var(--green)", fontWeight: 600, fontSize: 13.5 }}>
                    <Haken /> Eingang bestätigt
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                      <span>Eingangsdatum{jahresgrenze(monat) ? <> <Info size={11} style={{ verticalAlign: "-1px" }} /></> : ""}</span>
                      <input
                        type="date"
                        className="input"
                        title={jahresgrenze(monat) ? "10-Tage-Regel: Zahlungen 22.12.–10.01. ggf. dem wirtschaftlich zugehörigen Jahr zuordnen (§ 11 EStG). Buchungsdatum ggf. anpassen." : undefined}
                        value={datum[z.mieterId] ?? `${monat}-01`}
                        onChange={(e) => setDatum((s) => ({ ...s, [z.mieterId]: e.target.value }))}
                        style={{ width: 150 }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                      <span>Betrag (€)</span>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={betrag[z.mieterId] ?? String(z.gesamt)}
                        onChange={(e) => setBetrag((s) => ({ ...s, [z.mieterId]: e.target.value }))}
                        style={{ width: 110, textAlign: "right" }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-gold"
                      disabled={laufend === z.mieterId}
                      onClick={() => bestaetige(z)}
                    >
                      {laufend === z.mieterId ? "Bucht…" : "Eingang bestätigen"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {zeilen.length === 0 && (
            <div className="glass-card" style={{ color: "var(--muted)", fontSize: 13 }}>
              Für {monatLabel(monat)} gibt es keine erwarteten Mieteingänge — entweder waren keine
              Mietverhältnisse aktiv oder es fehlen Kaltmiete/Mietbeginn bei den Mietern.
            </div>
          )}
        </>
      ) : (
        <>
          {/* Nacherfassen */}
          <div className="glass-card" style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              <span>Startmonat (max. 10 Jahre zurück)</span>
              <input
                type="month"
                className="input"
                min={zehnJahre}
                max={ymPlus(aktuellerMonat, -1)}
                value={startMonat}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartMonat(v && v >= zehnJahre ? v : zehnJahre);
                  setAbgewaehlt(new Set());
                }}
                style={{ width: 150 }}
              />
            </label>
            <div style={{ fontSize: 12.5, color: "var(--muted)", paddingBottom: 6 }}>
              {offene.length === 0
                ? "Keine offenen Monate — alles erfasst ✓"
                : `${offene.length} offene Monate · ausgewählt: ${ausgewaehlt.length} · Summe ${eur2(summeAusgewaehlt)}`}
            </div>
            {offene.length > 0 && (
              <button type="button" className="btn btn-gold" disabled={batchLaeuft || ausgewaehlt.length === 0} onClick={batchBuchen} style={{ marginLeft: "auto" }}>
                {batchLaeuft ? "Bucht…" : `${ausgewaehlt.length} Eingänge bestätigen`}
              </button>
            )}
          </div>

          {offene.length > 0 && (
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-body" style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          checked={alleAn}
                          onChange={(e) => setAbgewaehlt(e.target.checked ? new Set() : new Set(offene.map((r) => r.key)))}
                          title="Alle auswählen"
                          style={{ accentColor: "var(--gold)" }}
                        />
                      </th>
                      <th>Monat</th>
                      <th>Mieter</th>
                      <th style={{ textAlign: "right" }}>Soll-Betrag</th>
                      <th>Eingangsdatum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offene.map((r) => (
                      <tr key={r.key} style={{ opacity: abgewaehlt.has(r.key) ? 0.45 : 1 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!abgewaehlt.has(r.key)}
                            onChange={(e) =>
                              setAbgewaehlt((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.delete(r.key);
                                else n.add(r.key);
                                return n;
                              })
                            }
                            style={{ accentColor: "var(--gold)" }}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {monatKurz(r.jahrMonat)}
                          {jahresgrenze(r.jahrMonat) && (
                            <span
                              title="10-Tage-Regel: Zahlungen 22.12.–10.01. ggf. dem wirtschaftlich zugehörigen Jahr zuordnen (§ 11 EStG). Buchungsdatum ggf. anpassen."
                              style={{ marginLeft: 6, color: "var(--amber)", cursor: "help", fontSize: 12 }}
                            >
                              <Info size={12} />
                            </span>
                          )}
                        </td>
                        <td>
                          {r.name} <span style={{ color: "var(--muted)", fontSize: 12 }}>· {r.objekt}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{eur2(r.gesamt)}</td>
                        <td>
                          <input
                            type="date"
                            className="input"
                            value={nachDatum[r.key] ?? `${r.jahrMonat}-01`}
                            onChange={(e) => setNachDatum((s) => ({ ...s, [r.key]: e.target.value }))}
                            style={{ width: 150, padding: "5px 8px", fontSize: 12.5 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>
        Steuerlich zählt der Tag des tatsächlichen Zuflusses (§ 11 EStG; 10-Tage-Regel am
        Jahreswechsel für wiederkehrende Zahlungen). Keine Steuerberatung, ohne Gewähr.
      </p>
    </div>
  );
}
