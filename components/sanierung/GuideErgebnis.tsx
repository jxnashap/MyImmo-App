"use client";

// Ergebnis des Sanierungs-Guides: Kostenaufstellung, Annahmen, offene Posten, Hinweise, Förderung,
// Einkaufszettel und Reihenfolge — alles aus `auswerten()` (lib/sanierung/auswertung.ts), hier wird
// nur angezeigt und überschrieben (eigene Preise, Mengen, Angebote).

import { Printer } from "lucide-react";
import { euro } from "@/lib/format";
import { ARBEITEN, preisSpanne } from "@/lib/sanierung/arbeiten";
import {
  VERSCHNITT_BODEN,
  VERSCHNITT_FLIESE,
  VERSCHNITT_LEISTE,
  VERSCHNITT_TAPETE,
  type Katalog,
  type MaterialId,
  type Spanne,
} from "@/lib/sanierung/rechner";
import type { Auswertung, GuideZeile } from "@/lib/sanierung/auswertung";
import type { FoerderErgebnis } from "@/lib/sanierung/foerderung";
import { FOERDER_STAND_SANIERUNG } from "@/lib/sanierung/foerderung";
import type { Entwurf } from "@/lib/sanierung/eingabe";
import type { Aendern } from "@/components/sanierung/GuideSeiten";

const zahl = (n: number, stellen = 2) => n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
/** Preise immer mit zwei Nachkommastellen — „19,40“, nicht „19,4“. */
const geld = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const spanne = (s: Spanne, fmt: (n: number) => string) => (s.min === s.max ? fmt(s.min) : `${fmt(s.min)} – ${fmt(s.max)}`);
const prozent = (s: Spanne) => `${zahl(s.min * 100, 0)}–${zahl(s.max * 100, 0)} %`;

const HERKUNFT: Record<GuideZeile["herkunft"], { text: string; titel: string }> = {
  neutral: { text: "neutral", titel: "Neutrale Quelle (z. B. Verbraucherzentrale, co2online)" },
  bki: { text: "BKI-Mittel", titel: "Mittelwerte aus abgerechneten Projekten (BKI)" },
  portal: { text: "Portal", titel: "Handwerker- oder Vermittlungsportal — Verzerrung unbekannt" },
  nutzer: { text: "dein Wert", titel: "Von dir eingetragen" },
};
const ART: Record<GuideZeile["art"], string> = { zustand: "Technik", handwerker: "Handwerker", rueckbau: "Rückbau", entsorgung: "Entsorgung" };

export default function GuideErgebnis({
  e,
  aendern,
  a,
  katalog,
  stand,
  foerderung,
}: {
  e: Entwurf;
  aendern: Aendern;
  a: Auswertung;
  katalog: Katalog;
  stand: string;
  foerderung: { von: FoerderErgebnis; bis: FoerderErgebnis };
}) {
  const setPreis = (id: MaterialId, wert: string) => aendern((d) => ({ ...d, preise: { ...d.preise, [id]: wert } }));
  const zuschuss = { min: foerderung.von.zuschuss, max: foerderung.bis.zuschuss };
  const hinweiseFoerderung = [...new Set([...foerderung.bis.ausgeschlossen.map((x) => `${x.bezeichnung || "Posten"}: ${x.grund}.`), ...foerderung.bis.hinweise])];
  const leer = a.material.length === 0 && a.zeilen.length === 0 && a.lohnGeld === 0 && a.eigene === 0;

  const drucken = () => {
    try {
      document.documentElement.dataset.druck = "einkauf";
      const weg = () => {
        delete document.documentElement.dataset.druck;
        window.removeEventListener("afterprint", weg);
      };
      window.addEventListener("afterprint", weg);
      window.print();
    } catch {
      /* Drucken nicht verfügbar — der Zettel bleibt auf dem Bildschirm */
    }
  };
  const abhaken = (key: string) => aendern((d) => ({ ...d, abgehakt: d.abgehakt.includes(key) ? d.abgehakt.filter((k) => k !== key) : [...d.abgehakt, key] }));

  return (
    <>
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Kostenaufstellung</h3>
            <div className="section-sub">Spannen aus Quellen, Stand {stand} — jede Zeile lässt sich mit deinem Wert überschreiben</div>
          </div>
        </div>
        <div className="section-body guide-ergebnis">
          {leer && <p className="sanierung-leer">Noch nichts zu rechnen — lege Räume an und wähle Maßnahmen oder den Zustand der Technik.</p>}

          {a.zeilen.length > 0 && (
            <div className="table-scroll">
              <table className="sanierung-tabelle guide-tabelle guide-tabelle-arbeiten">
                <thead>
                  <tr>
                    <th>Arbeit</th>
                    <th>Menge</th>
                    <th>Angebot €</th>
                    <th style={{ textAlign: "right" }}>Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {a.zeilen.map((z) => {
                    const arbeit = ARBEITEN[z.arbeit];
                    const p = preisSpanne(arbeit);
                    return (
                      <tr key={z.arbeit}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{z.label}</div>
                          <div className="sanierung-klein">
                            {ART[z.art]} · <span className="badge" title={HERKUNFT[z.herkunft].titel}>{HERKUNFT[z.herkunft].text}</span>{" "}
                            {spanne(p, euro)} {arbeit.einheit}
                            {z.angebotEinholen ? " · Angebot einholen" : ""}
                          </div>
                          {z.mengeAnnahme && <div className="sanierung-klein">Menge: {z.mengeAnnahme}</div>}
                          {z.mengeFehlt && <div className="sanierung-klein guide-fehlt">Menge fehlt</div>}
                          <details className="sanierung-quellen guide-quellen">
                            <summary>Quellen</summary>
                            <ul>
                              {arbeit.quellen.map((q) => (
                                <li key={q.name}>
                                  <a href={q.url} target="_blank" rel="noreferrer">{q.name}</a> ({q.stand}, {q.mwst === "netto" ? "netto, ×1,19" : q.mwst}): „{q.zitat}“
                                </li>
                              ))}
                              {arbeit.einzelquelle && <li>Nur eine unabhängige Quelle: {arbeit.einzelquelle}</li>}
                              {arbeit.hinweis && <li>{arbeit.hinweis}</li>}
                            </ul>
                          </details>
                        </td>
                        <td data-label="Menge">
                          <input
                            className="input sanierung-preis"
                            inputMode="decimal"
                            aria-label={`Menge ${z.label}`}
                            placeholder={zahl(z.menge)}
                            value={e.arbeitMengen[z.arbeit] ?? ""}
                            onChange={(x) => aendern((d) => ({ ...d, arbeitMengen: { ...d.arbeitMengen, [z.arbeit]: x.target.value } }))}
                          />
                        </td>
                        <td data-label="Angebot €">
                          <input
                            className="input sanierung-preis"
                            inputMode="decimal"
                            aria-label={`Angebot für ${z.label} in Euro`}
                            value={e.arbeitPreise[z.arbeit] ?? ""}
                            onChange={(x) => aendern((d) => ({ ...d, arbeitPreise: { ...d.arbeitPreise, [z.arbeit]: x.target.value } }))}
                          />
                        </td>
                        <td data-label="Kosten" className="zahl" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{spanne({ min: z.von, max: z.bis }, euro)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 600 }}>Arbeiten gesamt</td>
                    <td className="zahl" style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{spanne(a.zeilenKosten, euro)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {a.material.length > 0 && (
            <div className="table-scroll">
              <table className="sanierung-tabelle guide-tabelle">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Menge</th>
                    <th>Kaufen</th>
                    <th>Preis je Gebinde</th>
                    <th style={{ textAlign: "right" }}>Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {a.material.map((z) => (
                    <tr key={z.material.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{z.material.name}</div>
                        <div className="sanierung-klein">{z.material.produkt}</div>
                      </td>
                      <td data-label="Menge" className="zahl">{spanne(z.menge, (n) => zahl(n, 1))} {z.material.einheit}</td>
                      <td data-label="Kaufen" className="zahl">{spanne(z.gebinde, (n) => zahl(n, 0))} × {z.material.gebindeName}</td>
                      <td data-label="Preis je Gebinde">
                        <input
                          className="input sanierung-preis"
                          inputMode="decimal"
                          aria-label={`Preis je Gebinde ${z.material.name}`}
                          placeholder={geld(z.material.preis)}
                          value={e.preise[z.material.id] ?? ""}
                          onChange={(x) => setPreis(z.material.id, x.target.value)}
                        />
                      </td>
                      <td data-label="Kosten" className="zahl" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{spanne(z.kosten, euro)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 600 }}>Material gesamt</td>
                    <td className="zahl" style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{spanne(a.materialKosten, euro)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="guide-teilsummen">
            {a.lohnGeld > 0 && <span>Bezahlte Arbeitszeit {euro(a.lohnGeld)}</span>}
            {a.eigene > 0 && <span>Eigene Posten {euro(a.eigene)}</span>}
            <span>Puffer {zahl(a.pufferProzent, 1)} %: {spanne(a.puffer, euro)}</span>
            {a.eigenleistung > 0 && <span>Eigenleistung {euro(a.eigenleistung)} — kein Geld, nicht in der Summe</span>}
            {a.portalAnteil > 0 && <span>Davon allein auf Portalpreisen: {zahl(a.portalAnteil * 100, 0)} %</span>}
          </div>

          {a.material.length > 0 && (
            <details className="sanierung-quellen">
              <summary>Woher die Zahlen kommen</summary>
              <ul>
                {Object.values(katalog).map((m) => (
                  <li key={m.id}>
                    <strong>{m.name}</strong> ({m.produkt}): €{"\u00a0"}{geld(m.preis)} je {m.gebindeName} — {m.quelle.preis}.{" "}
                    {/* „1 m² je m²“ (Tapete, Boden) sagt nichts — dann nur die Quelle. */}
                    {m.verbrauch.min === 1 && m.verbrauch.max === 1
                      ? `Menge: ${m.quelle.verbrauch}.`
                      : `Verbrauch ${spanne(m.verbrauch, (n) => zahl(n, 3))} ${m.einheit} je m² — ${m.quelle.verbrauch}.`}{" "}
                    Stand {m.quelle.stand}.
                  </li>
                ))}
                <li>
                  <strong>Verschnitt</strong> ist eine Annahme von BuyImmo, keine Herstellerangabe: Boden {prozent(VERSCHNITT_BODEN)},
                  Fliesen {prozent(VERSCHNITT_FLIESE)}, Tapete {prozent(VERSCHNITT_TAPETE)}, Sockelleisten {prozent(VERSCHNITT_LEISTE)}.
                </li>
              </ul>
            </details>
          )}
        </div>
      </div>

      {(a.offen.length > 0 || a.annahmen.length > 0) && (
        <div className="grid-2 sanierung-unten">
          {a.offen.length > 0 && (
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-header"><div><h3>Nicht in der Summe</h3><div className="section-sub">Ohne belegten Preis — erst ein Angebot sagt, was es kostet</div></div></div>
              <div className="section-body">
                <ul className="guide-liste">
                  {a.offen.map((o) => <li key={o.titel}><strong>{o.titel}</strong> — {o.grund}</li>)}
                </ul>
              </div>
            </div>
          )}
          {a.annahmen.length > 0 && (
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-header"><div><h3>Annahmen</h3><div className="section-sub">Gilt, bis du es ersetzt — die Spanne wird dann enger</div></div></div>
              <div className="section-body">
                <ul className="guide-liste">
                  {a.annahmen.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {(a.hinweise.length > 0 || a.pruefpunkte.length > 0) && (
        <div className="section">
          <div className="section-header"><div><h3>Wichtig</h3></div></div>
          <div className="section-body">
            <ul className="guide-liste">
              {a.pruefpunkte.map((p) => <li key={p.titel}><strong>{p.titel}, Sache der Gemeinschaft:</strong> {p.hinweis}</li>)}
              {a.hinweise.map((h) => <li key={h.id}>{h.text}</li>)}
            </ul>
          </div>
        </div>
      )}

      {zuschuss.max > 0 && (
        <div className="section">
          <div className="section-header"><div><h3>Möglicher Zuschuss</h3><div className="section-sub">Geschätzt, Stand {FOERDER_STAND_SANIERUNG} — nicht von der Summe abgezogen, sicher erst mit der Zusage</div></div></div>
          <div className="section-body">
            <div className="sanierung-summe-zahl">{spanne(zuschuss, euro)}</div>
            {hinweiseFoerderung.length > 0 && (
              <ul className="sanierung-hinweise">
                {hinweiseFoerderung.map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {a.einkauf.length > 0 && (
        <div className="section guide-einkauf">
          <div className="section-header">
            <div><h3>Einkaufszettel</h3><div className="section-sub">Ganze Gebinde, über alle Räume gerundet</div></div>
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={drucken}><Printer size={14} /> Drucken</button>
          </div>
          <div className="section-body">
            {a.einkauf.map((g) => (
              <div key={g.id} className="guide-einkauf-gruppe">
                <div className="guide-frage-titel">{g.titel}</div>
                {g.zeilen.map((z) => (
                  <label key={z.key} className="guide-einkauf-zeile">
                    <input type="checkbox" checked={e.abgehakt.includes(z.key)} onChange={() => abhaken(z.key)} />
                    <span>
                      <strong>{z.name}</strong> — {z.menge}
                      {z.hinweis && <span className="sanierung-klein"> · {z.hinweis}</span>}
                    </span>
                    <span className="zahl sanierung-betrag">{z.kosten ? spanne(z.kosten, euro) : "Preis offen"}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {a.reihenfolge.length > 0 && (
        <div className="section">
          <div className="section-header"><div><h3>Reihenfolge</h3><div className="section-sub">So läuft es auf der Baustelle</div></div></div>
          <div className="section-body">
            <ol className="guide-liste">
              {a.reihenfolge.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
