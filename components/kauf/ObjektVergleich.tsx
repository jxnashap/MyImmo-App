"use client";

import Link from "next/link";
import { Crown, PaintRoller, Pencil, Trash2 } from "lucide-react";
import { bestesObjekt, type VglMetrik } from "@/lib/kauf/auswahl";
import type { Kalkulation } from "@/lib/types";

// Objekte vergleichen (Kaufweg Schritt 1, Umbau 06.10.2026): Die Kandidaten stehen direkt auf der
// Seite nebeneinander — vorher lag der Vergleich in einem Fenster hinter einem Knopf. Je Objekt:
// Besichtigung starten (Sanierungs-Guide mit Adresse, Fläche, Baujahr) und für die Finanzierung
// wählen. Die Krone zählt Bestwerte (wie bisher, `bestesObjekt`) — eine Zählung, kein Urteil.

export const VERGLEICH_MAX = 5;

const eur = (n: number) => "€ " + Math.round(n || 0).toLocaleString("de-DE");
const pct = (n: number) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
const fmt1 = (n: number) => (n || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Zeilen des Vergleichs. `better: none` = nur Anzeige, zählt nicht für die Krone. */
export const VERGLEICH_ZEILEN: { key: string; label: string; fmt: (v: number) => string; better: VglMetrik["better"] }[] = [
  { key: "kp", label: "Kaufpreis", fmt: eur, better: "low" },
  // Endsumme: Kaufpreis + Nebenkosten + Sanierung. Nicht gezählt — der Kaufpreis zählt schon.
  { key: "gesamtInvest", label: "Gesamtinvestition", fmt: (v) => (v > 0 ? eur(v) : "–"), better: "none" },
  { key: "sanierung", label: "davon Sanierung", fmt: (v) => (v > 0 ? eur(v) : "–"), better: "none" },
  { key: "preisM2", label: "Preis / m²", fmt: (v) => (v > 0 ? eur(v) + "/m²" : "–"), better: "low" },
  { key: "brutto", label: "Bruttorendite", fmt: (v) => (v > 0 ? pct(v) : "–"), better: "high" },
  { key: "nettomiet", label: "Nettorendite", fmt: (v) => (v > 0 ? pct(v) : "–"), better: "high" },
  { key: "faktor", label: "Kaufpreisfaktor", fmt: (v) => (v > 0 ? fmt1(v) + "×" : "–"), better: "low" },
  { key: "marktwert", label: "Marktwert (geschätzt)", fmt: (v) => (v > 0 ? eur(v) : "–"), better: "high" },
];
const METRIKEN: VglMetrik[] = VERGLEICH_ZEILEN.map((m) => ({ key: m.key, better: m.better }));

/** Bester Wert einer Zeile unter den gewählten — null, wenn es keinen eindeutigen gibt. */
export function bestWert(objekte: Kalkulation[], key: string, better: VglMetrik["better"]): number | null {
  if (better === "none" || objekte.length < 2) return null;
  const vals = objekte.map((k) => k.summary?.[key]).filter((v): v is number => typeof v === "number" && v > 0);
  if (vals.length < 2) return null;
  const best = better === "high" ? Math.max(...vals) : Math.min(...vals);
  return vals.every((v) => v === best) ? null : best;
}

export default function ObjektVergleich({
  liste,
  auswahl,
  setAuswahl,
  bearbeiteId,
  gewaehltId,
  onBearbeiten,
  onLoeschen,
  onWaehlen,
}: {
  liste: Kalkulation[];
  /** Gewählte Kandidaten (höchstens VERGLEICH_MAX). */
  auswahl: string[];
  setAuswahl: (ids: string[]) => void;
  bearbeiteId: string | null;
  /** Das für die Finanzierung gewählte Objekt (localStorage, lib/kauf/auswahl.ts). */
  gewaehltId: string | null;
  onBearbeiten: (k: Kalkulation) => void;
  onLoeschen: (id: string) => void;
  onWaehlen: (k: Kalkulation) => void;
}) {
  const sel = auswahl.map((id) => liste.find((k) => k.id === id)).filter((k): k is Kalkulation => !!k);
  const sieger = bestesObjekt(sel.map((k) => ({ id: k.id, summary: k.summary })), METRIKEN);
  const umschalten = (id: string) =>
    setAuswahl(auswahl.includes(id) ? auswahl.filter((x) => x !== id) : auswahl.length >= VERGLEICH_MAX ? auswahl : [...auswahl, id]);

  return (
    <div className="section" id="vergleich" style={{ marginBottom: 0 }}>
      <div className="section-header">
        <div>
          <h3>Deine Kandidaten im Vergleich</h3>
          <div className="section-sub">
            {liste.length === 0
              ? "Noch nichts gespeichert"
              : liste.length > VERGLEICH_MAX
                ? `${liste.length} gespeichert · bis zu ${VERGLEICH_MAX} nebeneinander`
                : `${liste.length} gespeichert`}
          </div>
        </div>
      </div>
      <div className="section-body">
        {liste.length === 0 ? (
          <p className="sanierung-leer">
            Rechne oben ein Objekt durch und speichere es. Mit zwei bis fünf Kandidaten siehst du hier nebeneinander, welches
            wo vorn liegt.
          </p>
        ) : (
          <>
            {liste.length > VERGLEICH_MAX && (
              <div className="massnahmen-wahl" role="group" aria-label="Objekte für den Vergleich wählen">
                {liste.map((k) => {
                  const an = auswahl.includes(k.id);
                  const voll = !an && auswahl.length >= VERGLEICH_MAX;
                  return (
                    <label key={k.id} className="massnahme-chip" style={voll ? { opacity: 0.45 } : undefined}>
                      <input type="checkbox" checked={an} disabled={voll} onChange={() => umschalten(k.id)} />
                      {k.name}
                    </label>
                  );
                })}
              </div>
            )}
            <div className="vergleich-scroll">
              <table className="cmp-table vergleich-tabelle">
                <thead>
                  <tr>
                    <th scope="col">Kennzahl</th>
                    {sel.map((k) => {
                      const krone = sieger.eindeutig && sieger.id === k.id && sel.length >= 2;
                      return (
                        <th key={k.id} scope="col" className={k.id === bearbeiteId ? "vergleich-aktiv" : undefined}>
                          <span className="vergleich-name">
                            {krone && <Crown size={13} aria-label="meiste Bestwerte" />} {k.name}
                          </span>
                          {sel.length >= 2 && <span className="vergleich-punkte">{sieger.punkte[k.id] ?? 0} Bestwerte</span>}
                          {k.id === gewaehltId && <span className="badge badge-gold">für die Finanzierung gewählt</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {VERGLEICH_ZEILEN.map((m) => {
                    const best = bestWert(sel, m.key, m.better);
                    return (
                      <tr key={m.key}>
                        <th scope="row">{m.label}</th>
                        {sel.map((k) => {
                          const v = k.summary?.[m.key];
                          const istBest = best != null && v === best;
                          return (
                            <td key={k.id} className={istBest ? "vergleich-best" : undefined}>
                              {typeof v === "number" ? m.fmt(v) : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    {sel.map((k) => (
                      <td key={k.id} className="vergleich-aktionen">
                        <div className="vergleich-knoepfe">
                          <Link href={`/sanierung?objekt=${encodeURIComponent(k.id)}`} className="btn btn-ghost btn-sm">
                            <PaintRoller size={13} aria-hidden /> Besichtigen
                          </Link>
                          <button type="button" className={`btn btn-sm ${k.id === gewaehltId ? "btn-gold" : "btn-ghost"}`} onClick={() => onWaehlen(k)}>
                            {k.id === gewaehltId ? "Gewählt" : "Für die Finanzierung wählen"}
                          </button>
                          <span className="vergleich-klein">
                            <button type="button" className="btn-link" onClick={() => onBearbeiten(k)}>
                              <Pencil size={12} aria-hidden /> Bearbeiten
                            </button>
                            <button type="button" className="btn-link" onClick={() => onLoeschen(k.id)} aria-label={`${k.name} löschen`}>
                              <Trash2 size={12} aria-hidden /> Löschen
                            </button>
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            {sel.length === 1 && (
              <p className="sanierung-klein">Trag mindestens einen zweiten Kandidaten ein — dann zeigt die Tabelle die Bestwerte.</p>
            )}
            <p className="sanierung-klein">
              Grün = bester Wert unter den gewählten. Die Krone zählt nur Bestwerte; ob ein Objekt zu dir passt, entscheidest du
              — nach der Besichtigung.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
