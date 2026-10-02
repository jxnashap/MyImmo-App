"use client";

// Mietkonto → „Kontoauszug abgleichen“ (02.10.2026). Die CSV-Datei wird NUR im Browser gelesen
// (FileReader); zum Server gehen allein die bestätigten Buchungen über `bestaetigeMehrere`
// (Dublettenschutz je Mietmonat). Logik: lib/kontoauszug.ts.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/Toast";
import { bestaetigeMehrere, type BatchZeile } from "@/lib/actions/mietkonto";
import { erwarteteMonate, dedup, monatLabel, ymPlus, zuJahrMonat } from "@/lib/mietkonto";
import { leseKontoauszug, gleicheAb, normIban, type AbgleichMieter, type Treffer, type Zahlung } from "@/lib/kontoauszug";
import type { NacherfassungMieter } from "@/components/MietkontoBestaetigung";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const datumDe = (s: string) => s.split("-").reverse().join(".");

/** Text einer Datei lesen: UTF-8, bei Ersatzzeichen noch einmal als Windows-1252 (Sparkasse, Volksbank). */
async function leseDatei(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function KontoauszugAbgleich({ nacherfassung }: { nacherfassung: NacherfassungMieter[] }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ treffer: Treffer[]; ohneZuordnung: Zahlung[]; ausgaenge: number; datei: string } | null>(null);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [monatWahl, setMonatWahl] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const lesen = async (f: File | undefined) => {
    setFehler(null);
    setErgebnis(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setFehler("Die Datei ist größer als 5 MB — bitte einen kürzeren Zeitraum exportieren.");
    const a = leseKontoauszug(await leseDatei(f));
    if (!a.ok) return setFehler(a.fehler);
    if (a.zahlungen.length === 0) return setFehler("Im Auszug sind keine Geldeingänge.");

    // Offene Soll-Monate im Zeitraum des Auszugs (± Puffer) — dieselbe Rechnung wie „Nacherfassen“.
    const monate = a.zahlungen.map((z) => zuJahrMonat(z.datum)!).sort();
    const von = ymPlus(monate[0], -3);
    const bis = ymPlus(monate[monate.length - 1], 1);
    const mieter: AbgleichMieter[] = nacherfassung.map((n) => ({
      mieterId: n.mieterId,
      propId: n.propId,
      name: n.name,
      nachname: n.nachname ?? null,
      ibanHash: n.ibanHash ?? null,
      offen: dedup(
        erwarteteMonate(n.mieter, n.zeitraeume, von, bis),
        n.gebuchteMonate.map((ym) => ({ buchungsdatum: `${ym}-15`, kategorie: "Miete" })),
      )
        .filter((m) => !m.schonGebucht && m.gesamt > 0)
        .map((m) => ({ jahrMonat: m.jahrMonat, gesamt: m.gesamt, nk: m.nk })),
    }));

    const hashe = new Map<number, string>();
    for (const z of a.zahlungen) if (normIban(z.iban)) hashe.set(z.zeile, await sha256Hex(normIban(z.iban)));

    const erg = gleicheAb(a.zahlungen, mieter, hashe);
    setErgebnis({ ...erg, ausgaenge: a.ausgaenge, datei: f.name });
    setAuswahl(new Set(erg.treffer.filter((t) => t.stufe === "sicher").map((t) => t.zahlung.zeile)));
    setMonatWahl({});
  };

  const gewaehlt = useMemo(() => (ergebnis?.treffer ?? []).filter((t) => auswahl.has(t.zahlung.zeile)), [ergebnis, auswahl]);

  // Zwei Zeilen auf denselben Mietmonat desselben Mieters? Dann nicht buchen (der Server würde die zweite ohnehin verwerfen).
  const doppelt = useMemo(() => {
    const seen = new Set<string>();
    return gewaehlt.some((t) => {
      const k = `${t.mieterId}:${monatWahl[t.zahlung.zeile] ?? t.jahrMonat}`;
      if (seen.has(k)) return true;
      seen.add(k);
      return false;
    });
  }, [gewaehlt, monatWahl]);

  const buchen = () =>
    startTransition(async () => {
      const zeilen: BatchZeile[] = gewaehlt.map((t) => ({
        mieter_id: t.mieterId,
        prop_id: t.propId,
        buchungsdatum: t.zahlung.datum,
        betrag: t.zahlung.betrag,
        nk_anteil: t.nkAnteil,
        soll_monat: monatWahl[t.zahlung.zeile] ?? t.jahrMonat,
      }));
      try {
        const r = await bestaetigeMehrere(zeilen);
        if (!r.ok) return toast(r.error ?? "Buchen fehlgeschlagen.", "error");
        toast(`${r.anzahl} Mieteingänge aus dem Kontoauszug gebucht ✓`);
        setErgebnis(null);
        router.refresh();
      } catch {
        toast("Buchen fehlgeschlagen.", "error");
      }
    });

  return (
    <div>
      <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="btn btn-gold" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} data-demo-erlaubt>
            <FileUp size={15} /> CSV-Kontoauszug wählen
            <input type="file" accept=".csv,.txt,text/csv" style={{ display: "none" }} onChange={(e) => { void lesen(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 220 }}>
            Exportiere im Online-Banking die Umsätze als CSV (z. B. die letzten 3 Monate). MyImmo schlägt je Geldeingang
            vor, welche offene Miete er ausgleicht — gebucht wird erst, was du bestätigst.
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--green)", margin: "10px 0 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Die Datei wird nur in deinem Browser gelesen und nicht hochgeladen. Gespeichert werden ausschließlich die Mieteingänge, die du unten bestätigst.
        </p>
      </div>

      {fehler && <p role="alert" style={{ fontSize: 13, color: "var(--red)" }}>{fehler}</p>}

      {ergebnis && (
        <div className="section">
          <div className="section-header">
            <div>
              <h3>{ergebnis.treffer.length} {ergebnis.treffer.length === 1 ? "Zuordnung" : "Zuordnungen"} aus „{ergebnis.datei}“</h3>
              <div className="section-sub">
                {ergebnis.ohneZuordnung.length} Eingänge ohne Bezug zu einer offenen Miete · {ergebnis.ausgaenge} Ausgänge übersprungen
              </div>
            </div>
          </div>
          <div className="section-body">
            {ergebnis.treffer.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                Keinem Eingang ließ sich eine offene Miete zuordnen. Zugeordnet wird nur bei IBAN des Mieters oder Nachname plus
                passendem Betrag — trage die IBAN beim Mieter ein, dann klappt es öfter.
              </p>
            ) : (
              <>
                <div className="table-scroll"><table style={{ fontSize: 12, minWidth: 640 }}>
                  <thead><tr><th></th><th>Eingang</th><th>Zahler / Zweck</th><th>Mieter</th><th>Mietmonat</th><th>Grund</th></tr></thead>
                  <tbody>
                    {ergebnis.treffer.map((t) => {
                      const an = auswahl.has(t.zahlung.zeile);
                      return (
                        <tr key={t.zahlung.zeile} style={{ opacity: an ? 1 : 0.65 }}>
                          <td>
                            <input type="checkbox" checked={an} aria-label="übernehmen" data-demo-erlaubt
                              onChange={() => setAuswahl((s) => { const n = new Set(s); if (n.has(t.zahlung.zeile)) n.delete(t.zahlung.zeile); else n.add(t.zahlung.zeile); return n; })} />
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}><strong>{eur(t.zahlung.betrag)}</strong><div style={{ color: "var(--muted)" }}>{datumDe(t.zahlung.datum)}</div></td>
                          <td style={{ maxWidth: 240 }}>
                            <div>{t.zahlung.name || "–"}</div>
                            <div style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.zahlung.zweck}>{t.zahlung.zweck}</div>
                          </td>
                          <td>{t.name}</td>
                          <td>
                            <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt
                              value={monatWahl[t.zahlung.zeile] ?? t.jahrMonat}
                              onChange={(e) => setMonatWahl((s) => ({ ...s, [t.zahlung.zeile]: e.target.value }))}>
                              {t.monate.map((m) => <option key={m.jahrMonat} value={m.jahrMonat}>{monatLabel(m.jahrMonat)} · Soll {eur(m.gesamt)}</option>)}
                            </select>
                          </td>
                          <td>
                            <span className={`badge ${t.stufe === "sicher" ? "badge-green" : "badge-amber"}`}>{t.stufe}</span>
                            <div style={{ color: "var(--faint)", fontSize: 11 }}>{t.gruende.join(" + ")}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
                {doppelt && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: "8px 0 0" }}>Zwei ausgewählte Eingänge zeigen auf denselben Mietmonat desselben Mieters — bitte einen Monat umstellen oder abwählen.</p>}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-gold" disabled={pending || gewaehlt.length === 0 || doppelt} onClick={buchen}>
                    {pending ? "Bucht…" : `${gewaehlt.length} ${gewaehlt.length === 1 ? "Eingang" : "Eingänge"} buchen · ${eur(gewaehlt.reduce((s, t) => s + t.zahlung.betrag, 0))}`}
                  </button>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    Gebucht wird der tatsächlich eingegangene Betrag mit dem Datum aus dem Auszug. Schon bestätigte Monate werden nicht doppelt gebucht.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
