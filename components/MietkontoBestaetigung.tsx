"use client";

// Mietkonto-Monatsbestätigung: pro Mieter eine Karte mit Soll-Betrag,
// editierbarem Eingangsdatum (Default 1. des Monats, § 11 EStG: Zufluss)
// und „Eingang bestätigen". Bestätigte Zeilen bekommen einen animierten
// SVG-Haken; der Gold-Ring im Kopf füllt sich mit.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eur2 } from "@/lib/format";
import { ymPlus } from "@/lib/mietkonto";
import { bestaetigeMieteingang } from "@/lib/actions/mietkonto";
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

const monatLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

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

export default function MietkontoBestaetigung({
  monat,
  aktuellerMonat,
  zeilen,
}: {
  monat: string;
  aktuellerMonat: string;
  zeilen: MietkontoZeile[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startBuchen] = useTransition();

  // Eingaben je Mieter (Datum default 1. des Monats, Betrag default Soll)
  const [datum, setDatum] = useState<Record<string, string>>({});
  const [betrag, setBetrag] = useState<Record<string, string>>({});
  // Frisch bestätigte Zeilen (für die Animation, bevor der Server-Refresh kommt)
  const [frisch, setFrisch] = useState<Set<string>>(new Set());
  const [laufend, setLaufend] = useState<string | null>(null);

  const bestaetigt = useMemo(
    () => zeilen.filter((z) => z.schonGebucht || frisch.has(z.mieterId)).length,
    [zeilen, frisch],
  );
  const gesamt = zeilen.length;
  const quote = gesamt > 0 ? bestaetigt / gesamt : 0;

  // Fortschritts-Ring (SVG, Umfang 2πr)
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

  const monatIstZukunft = monat > aktuellerMonat;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Mietkonto</div>
          <div className="topbar-sub">Monatliche Mieteingänge bestätigen · Zufluss-Prinzip (§ 11 EStG) · ohne Gewähr</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => router.push(`/mietkonto?monat=${ymPlus(monat, -1)}`)}>←</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: "center" }}>{monatLabel(monat)}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => router.push(`/mietkonto?monat=${ymPlus(monat, 1)}`)}>→</button>
          {monat !== aktuellerMonat && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push("/mietkonto")}>Heute</button>
          )}
        </div>
      </div>

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
            {monatIstZukunft && " Hinweis: Dieser Monat liegt in der Zukunft."}
          </div>
        </div>
      </div>

      {/* Zeilen */}
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
                  <span>Eingangsdatum</span>
                  <input
                    type="date"
                    className="input"
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

      <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>
        Steuerlich zählt der Tag des tatsächlichen Zuflusses (§ 11 EStG; 10-Tage-Regel am
        Jahreswechsel für wiederkehrende Zahlungen). Keine Steuerberatung, ohne Gewähr.
      </p>
    </div>
  );
}
