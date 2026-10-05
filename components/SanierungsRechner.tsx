"use client";

// Sanierungsrechner (BuyImmo, 05.10.2026): Räume ausmessen, Maßnahmen anhaken, Material von–bis,
// Arbeitszeit nach eigenem Stundensatz, eigene Posten. Die Rechnung steht in lib/sanierung/ —
// hier wird nur eingegeben und angezeigt.
//
// Der Entwurf liegt NUR in diesem Browser (localStorage, in try/catch): Wer bei der Besichtigung
// am Handy misst, verliert beim Neuladen nichts. Ins Konto gespeichert wird (noch) nicht — das
// sagt die Seite auch.
//
// Förderung: geschätzter Zuschuss nur für eigene Posten mit Förderart (lib/sanierung/foerderung.ts).
// Er steckt NICHT in der Summe für den Kauf-Assistenten — sicher ist er erst mit der Zusage.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, Plus, Trash2, TriangleAlert } from "lucide-react";
import { euro } from "@/lib/format";
import {
  MASSNAHMEN,
  VERSCHNITT_BODEN,
  VERSCHNITT_LEISTE,
  VERSCHNITT_TAPETE,
  berechneSanierung,
  flaechen,
  type Katalog,
  type MassnahmeId,
  type MaterialId,
  type Spanne,
} from "@/lib/sanierung/rechner";
import {
  entwurfAus,
  leererEntwurf,
  mitKopie,
  neuerPosten,
  neuerRaum,
  zuEingabe,
  zuFoerderEingabe,
  type Entwurf,
  type FoerderFelder,
  type LohnFeld,
  type PostenFeld,
  type RaumFeld,
} from "@/lib/sanierung/eingabe";
import { zahlDe0 } from "@/lib/zahl";
import { kaufLinkMitSanierung } from "@/lib/sanierung/uebergabe";
import { FOERDER_ARTEN, FOERDER_STAND_SANIERUNG, berechneFoerderung, type FoerderArt } from "@/lib/sanierung/foerderung";

const SPEICHER = "buyimmo:sanierung-entwurf";
const START_ID = "start";

const zahl = (n: number, stellen = 2) => n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
/** Preise immer mit zwei Nachkommastellen — „19,40“, nicht „19,4“. */
const geld = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const spanne = (s: Spanne, fmt: (n: number) => string) => (s.min === s.max ? fmt(s.min) : `${fmt(s.min)} – ${fmt(s.max)}`);
const prozent = (s: Spanne) => `${zahl(s.min * 100, 0)}–${zahl(s.max * 100, 0)} %`;
const neueId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function SanierungsRechner({ katalog, stand, heute }: { katalog: Katalog; stand: string; heute: string }) {
  const [entwurf, setEntwurf] = useState<Entwurf>(() => leererEntwurf(START_ID));
  const [geladen, setGeladen] = useState(false);
  const [leeren, setLeeren] = useState(false);

  // Entwurf erst nach dem Mount lesen — beim Server-Rendern gibt es keinen Browser-Speicher.
  useEffect(() => {
    try {
      const roh = localStorage.getItem(SPEICHER);
      const e = roh ? entwurfAus(JSON.parse(roh)) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen (Hydration)
      if (e && e.raeume.length > 0) setEntwurf(e);
    } catch {
      /* kaputter oder gesperrter Speicher: mit leerem Entwurf weiter */
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return; // sonst überschriebe der leere Start den gespeicherten Entwurf
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(entwurf));
    } catch {
      /* privates Fenster o. Ä. — die Rechnung funktioniert trotzdem */
    }
  }, [entwurf, geladen]);

  const ergebnis = useMemo(() => berechneSanierung(zuEingabe(entwurf), katalog), [entwurf, katalog]);
  const foerderung = useMemo(() => berechneFoerderung(zuFoerderEingabe(entwurf, heute)), [entwurf, heute]);
  const hatFoerderPosten = entwurf.eigene.some((p) => p.foerderung !== "keine");

  const setRaum = (id: string, teil: Partial<RaumFeld>) =>
    setEntwurf((e) => ({ ...e, raeume: e.raeume.map((r) => (r.id === id ? { ...r, ...teil } : r)) }));
  const setLohn = (id: string, teil: Partial<LohnFeld>) =>
    setEntwurf((e) => ({ ...e, lohn: e.lohn.map((l) => (l.id === id ? { ...l, ...teil } : l)) }));
  const setPosten = (id: string, teil: Partial<PostenFeld>) =>
    setEntwurf((e) => ({ ...e, eigene: e.eigene.map((p) => (p.id === id ? { ...p, ...teil } : p)) }));
  const setPreis = (id: MaterialId, wert: string) => setEntwurf((e) => ({ ...e, preise: { ...e.preise, [id]: wert } }));
  const setFoerder = (teil: Partial<FoerderFelder>) => setEntwurf((e) => ({ ...e, foerder: { ...e.foerder, ...teil } }));

  const zeitGesamt = entwurf.lohn.reduce((s, l) => s + zahlDe0(l.stunden), 0);

  // `data-demo-erlaubt`: In der Demo bleibt der Rechner bedienbar — er schreibt nichts in die
  // Datenbank, der Entwurf liegt nur im Browser des Besuchers (DemoNurLesen sperrt sonst jedes Feld).
  return (
    <div className="sanierung" data-demo-erlaubt>
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Räume</h3>
            <div className="section-sub">Maße in Metern. Fenster und Türen werden von der Wandfläche abgezogen.</div>
          </div>
        </div>
        <div className="section-body sanierung-raeume">
          {entwurf.raeume.map((r) => (
            <RaumKarte
              key={r.id}
              raum={r}
              kannEntfernen={entwurf.raeume.length > 1}
              aendern={(teil) => setRaum(r.id, teil)}
              entfernen={() => setEntwurf((e) => ({ ...e, raeume: e.raeume.filter((x) => x.id !== r.id) }))}
              kopieren={() => setEntwurf((e) => ({ ...e, raeume: mitKopie(e.raeume, r.id, neueId()) }))}
            />
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEntwurf((e) => ({ ...e, raeume: [...e.raeume, neuerRaum(neueId(), e.raeume.length + 1)] }))}
          >
            <Plus size={15} /> Raum hinzufügen
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Material</h3>
            <div className="section-sub">Baumarkt-Richtwerte, Stand {stand} — trag deine eigenen Preise ein, wenn du sie kennst</div>
          </div>
        </div>
        <div className="section-body">
          {ergebnis.material.length === 0 ? (
            <p className="sanierung-leer">Hake in einem Raum an, was gemacht werden soll — dann steht hier, was du kaufen musst.</p>
          ) : (
            <div className="table-scroll">
              <table className="sanierung-tabelle">
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
                  {ergebnis.material.map((z) => (
                    <tr key={z.material.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{z.material.name}</div>
                        <div className="sanierung-klein">{z.material.produkt}</div>
                      </td>
                      <td className="zahl">{spanne(z.menge, (n) => zahl(n, 1))} {z.material.einheit}</td>
                      <td className="zahl">{spanne(z.gebinde, (n) => zahl(n, 0))} × {z.material.gebindeName}</td>
                      <td>
                        <input
                          className="input sanierung-preis"
                          inputMode="decimal"
                          aria-label={`Preis je Gebinde ${z.material.name}`}
                          placeholder={geld(z.material.preis)}
                          value={entwurf.preise[z.material.id] ?? ""}
                          onChange={(e) => setPreis(z.material.id, e.target.value)}
                        />
                      </td>
                      <td className="zahl" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{spanne(z.kosten, euro)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 600 }}>Material gesamt</td>
                    <td className="zahl" style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{spanne(ergebnis.materialKosten, euro)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <details className="sanierung-quellen">
            <summary>Woher die Zahlen kommen</summary>
            <ul>
              {Object.values(katalog).map((m) => (
                <li key={m.id}>
                  <strong>{m.name}</strong> ({m.produkt}): {geld(m.preis)} € je {m.gebindeName} — {m.quelle.preis}.{" "}
                  {/* „1 m² je m²“ (Tapete, Boden) sagt nichts — dann nur die Quelle. */}
                  {m.verbrauch.min === 1 && m.verbrauch.max === 1
                    ? `Menge: ${m.quelle.verbrauch}.`
                    : `Verbrauch ${spanne(m.verbrauch, (n) => zahl(n, 3))} ${m.einheit} je m² — ${m.quelle.verbrauch}.`}{" "}
                  Stand {m.quelle.stand}.
                </li>
              ))}
              <li>
                <strong>Verschnitt</strong> ist eine Annahme von BuyImmo, keine Herstellerangabe: Boden {prozent(VERSCHNITT_BODEN)},
                Tapete {prozent(VERSCHNITT_TAPETE)}, Sockelleisten {prozent(VERSCHNITT_LEISTE)}.
              </li>
            </ul>
          </details>
        </div>
      </div>

      <div className="grid-2 sanierung-unten">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div>
              <h3>Arbeitszeit</h3>
              <div className="section-sub">Stunden × dein Stundensatz — für dich, Helfer oder einen Handwerker</div>
            </div>
          </div>
          <div className="section-body">
            {entwurf.lohn.map((l) => (
              <div key={l.id} className="sanierung-zeile">
                <input className="input" aria-label="Wer oder was" placeholder="z. B. Eigene Arbeit" value={l.bezeichnung} onChange={(e) => setLohn(l.id, { bezeichnung: e.target.value })} />
                <input className="input" inputMode="decimal" aria-label="Stunden" placeholder="Std." value={l.stunden} onChange={(e) => setLohn(l.id, { stunden: e.target.value })} />
                <input className="input" inputMode="decimal" aria-label="Euro je Stunde" placeholder="€/Std." value={l.satz} onChange={(e) => setLohn(l.id, { satz: e.target.value })} />
                <span className="zahl sanierung-betrag">{euro(zahlDe0(l.stunden) * zahlDe0(l.satz))}</span>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Zeile entfernen" onClick={() => setEntwurf((e) => ({ ...e, lohn: e.lohn.filter((x) => x.id !== l.id) }))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEntwurf((e) => ({ ...e, lohn: [...e.lohn, { id: neueId(), bezeichnung: "", stunden: "", satz: "" }] }))}>
              <Plus size={14} /> Zeile
            </button>
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div>
              <h3>Eigene Posten</h3>
              <div className="section-sub">Was du schon kennst — z. B. ein Angebot fürs Bad oder die Elektrik</div>
            </div>
          </div>
          <div className="section-body">
            {entwurf.eigene.map((p) => (
              <div key={p.id} className="sanierung-zeile sanierung-zeile-posten">
                <input className="input" aria-label="Posten" placeholder="z. B. Bad laut Angebot" value={p.bezeichnung} onChange={(e) => setPosten(p.id, { bezeichnung: e.target.value })} />
                <input className="input" inputMode="decimal" aria-label="Betrag in Euro" placeholder="€" value={p.betrag} onChange={(e) => setPosten(p.id, { betrag: e.target.value })} />
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Posten entfernen" onClick={() => setEntwurf((e) => ({ ...e, eigene: e.eigene.filter((x) => x.id !== p.id) }))}>
                  <Trash2 size={14} />
                </button>
                <select
                  className="input sanierung-foerderart"
                  aria-label={`Förderung für ${p.bezeichnung || "diesen Posten"}`}
                  value={p.foerderung}
                  onChange={(e) => setPosten(p.id, { foerderung: e.target.value as FoerderArt })}
                >
                  {FOERDER_ARTEN.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEntwurf((e) => ({ ...e, eigene: [...e.eigene, neuerPosten(neueId())] }))}>
              <Plus size={14} /> Posten
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Förderung</h3>
            <div className="section-sub">Geschätzter Zuschuss für Dämmung, Fenster, Lüftung und Heizung — Stand {FOERDER_STAND_SANIERUNG}</div>
          </div>
        </div>
        <div className="section-body sanierung-foerderung">
          <div className="sanierung-frist" role="note">
            <TriangleAlert size={16} aria-hidden />
            <span>
              <strong>Erst beantragen, dann beauftragen.</strong> Gefördert wird nur, wenn der Antrag steht, bevor du einen
              Handwerker beauftragst oder Material kaufst. Ein Vertrag mit der Bedingung „nur bei Förderzusage“ ist erlaubt.
            </span>
          </div>
          <div className="sanierung-foerder-wahl">
            <div className="form-group">
              <label htmlFor="foerder-we">Betroffene Wohneinheiten</label>
              <input id="foerder-we" inputMode="numeric" value={entwurf.foerder.wohneinheiten} onChange={(e) => setFoerder({ wohneinheiten: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="foerder-nutzung">Nutzung</label>
              <select id="foerder-nutzung" className="input" value={entwurf.foerder.nutzung} onChange={(e) => setFoerder({ nutzung: e.target.value === "eigennutzen" ? "eigennutzen" : "vermieten" })}>
                <option value="vermieten">Ich vermiete</option>
                <option value="eigennutzen">Ich wohne selbst darin</option>
              </select>
            </div>
            <label className="massnahme-chip sanierung-isfp">
              <input type="checkbox" checked={entwurf.foerder.isfp} onChange={(e) => setFoerder({ isfp: e.target.checked })} />
              Mit Sanierungsfahrplan (iSFP)
            </label>
          </div>
          {!hatFoerderPosten ? (
            <p className="sanierung-leer">
              Spachteln, Streichen, Böden und Fliesen werden nicht gefördert. Trag Dämmung, Fenster oder Heizung als eigenen
              Posten ein und wähle dort die Förderart.
            </p>
          ) : (
            <>
              {foerderung.toepfe.length > 0 && (
                <div className="table-scroll">
                  <table className="sanierung-tabelle">
                    <thead>
                      <tr>
                        <th>Programm</th>
                        <th style={{ textAlign: "right" }}>Förderfähig</th>
                        <th style={{ textAlign: "right" }}>Zuschuss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foerderung.toepfe.map((t) => (
                        <tr key={t.programm}>
                          <td>
                            <div>{t.programm}</div>
                            <div className="sanierung-klein zahl">Kosten {euro(t.kosten)}</div>
                          </td>
                          <td className="zahl" style={{ textAlign: "right" }}>{euro(t.foerderfaehig)}</td>
                          <td className="zahl" style={{ textAlign: "right" }}>{euro(t.zuschuss)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ fontWeight: 600 }}>Möglicher Zuschuss</td>
                        <td className="zahl" style={{ textAlign: "right", fontWeight: 600 }}>{euro(foerderung.zuschuss)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {(foerderung.ausgeschlossen.length > 0 || foerderung.hinweise.length > 0) && (
                <ul className="sanierung-hinweise">
                  {foerderung.ausgeschlossen.map((a) => (
                    <li key={a.id}>{a.bezeichnung || "Posten"}: {a.grund}.</li>
                  ))}
                  {foerderung.hinweise.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <details className="sanierung-quellen">
            <summary>Bedingungen und Quellen</summary>
            <ul>
              <li><strong>BAFA</strong> (Dämmung, Fenster, Außentüren, Lüftung, Heizungsoptimierung): 15 %, förderfähig je Gebäude und Jahr bis 30.000 € für die erste Wohneinheit, je 15.000 € für die zweite bis sechste, je 8.000 € ab der siebten. Mit Sanierungsfahrplan doppelt so viel, und 5 Prozentpunkte mehr auf den Teil über der normalen Grenze. Mindestens 300 € je Maßnahme.</li>
              <li><strong>KfW 458</strong> (neue Heizung): 30 % Grundförderung, förderfähig bis 28.000 € für die erste Wohneinheit (sinkt ab 01.02.2027 halbjährlich um 750 €). Boni nur für Selbstnutzer.</li>
              <li><strong>Energieeffizienz-Experte</strong>: Pflicht bei Dämmung, Fenstern und Lüftung; seine Planung und Begleitung wird zu 50 % gefördert (bis 5.000 € beim Ein-/Zweifamilienhaus, sonst 2.000 € je Wohneinheit, höchstens 20.000 €).</li>
              <li><strong>Eigenleistung</strong>: gefördert wird nur das Material, und nur wenn ein Experte oder Fachbetrieb die fachgerechte Ausführung bestätigt.</li>
              <li>Gebäude mindestens 5 Jahre alt; 10 Jahre zweckentsprechend nutzen. Wer zum Vorsteuerabzug berechtigt ist, bekommt nur auf die Nettokosten.</li>
              <li>Quellen: Richtlinie BEG EM vom 17.08.2026 (BAnz AT 27.08.2026 B1), bafa.de „Gebäudehülle“, kfw.de/458 und „Anpassungen 2026“. Eine Schätzung — verbindlich ist nur die Zusage.</li>
            </ul>
          </details>
        </div>
      </div>

      <div className="sanierung-summe">
        <div>
          <div className="kpi-label">Gesamt</div>
          <div className="sanierung-summe-zahl">{spanne(ergebnis.gesamt, euro)}</div>
        </div>
        <div className="sanierung-summe-teile">
          <span>Material {spanne(ergebnis.materialKosten, euro)}</span>
          <span>Arbeitszeit {euro(ergebnis.lohn)}{zeitGesamt > 0 ? ` (${zahl(zeitGesamt, 1)} Std.)` : ""}</span>
          <span>Eigene Posten {euro(ergebnis.eigene)}</span>
          {foerderung.zuschuss > 0 && <span>Möglicher Zuschuss {euro(foerderung.zuschuss)} (nicht abgezogen)</span>}
        </div>
        {/* Obere Spanne in die Kaufprüfung — lieber zu viel eingeplant als zu wenig. */}
        {ergebnis.gesamt.max > 0 && (
          <Link href={kaufLinkMitSanierung(ergebnis.gesamt.max)} className="btn btn-gold btn-sm sanierung-uebernehmen">
            {euro(ergebnis.gesamt.max)} in den Kauf-Assistenten <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>

      <div className="sanierung-fuss">
        <p>
          Eine Schätzung, kein Kostenvoranschlag. Dein Entwurf liegt nur in diesem Browser — auf einem anderen Gerät
          siehst du ihn nicht.
        </p>
        {leeren ? (
          <span className="sanierung-leeren">
            Alles löschen?{" "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEntwurf(leererEntwurf(neueId())); setLeeren(false); }}>Ja, neu anfangen</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLeeren(false)}>Nein</button>
          </span>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLeeren(true)}>Neu anfangen</button>
        )}
      </div>
    </div>
  );
}

function RaumKarte({
  raum,
  kannEntfernen,
  aendern,
  entfernen,
  kopieren,
}: {
  raum: RaumFeld;
  kannEntfernen: boolean;
  aendern: (teil: Partial<RaumFeld>) => void;
  entfernen: () => void;
  kopieren: () => void;
}) {
  const f = flaechen({
    laenge: zahlDe0(raum.laenge),
    breite: zahlDe0(raum.breite),
    hoehe: zahlDe0(raum.hoehe),
    oeffnungen: zahlDe0(raum.oeffnungen),
    fliesenhoehe: zahlDe0(raum.fliesenhoehe),
  });
  const wandGefliest = raum.massnahmen.includes("wand_fliesen");
  const umschalten = (id: MassnahmeId) =>
    aendern({ massnahmen: raum.massnahmen.includes(id) ? raum.massnahmen.filter((m) => m !== id) : [...raum.massnahmen, id] });
  const hinweise = MASSNAHMEN.filter((m) => m.hinweis && raum.massnahmen.includes(m.id));

  return (
    <div className="sanierung-raum">
      <div className="sanierung-raum-kopf">
        <input className="input sanierung-raum-name" aria-label="Name des Raums" value={raum.name} onChange={(e) => aendern({ name: e.target.value })} />
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`${raum.name || "Raum"} kopieren`} title="Raum kopieren" onClick={kopieren}>
          <Copy size={14} />
        </button>
        {kannEntfernen && (
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`${raum.name || "Raum"} entfernen`} onClick={entfernen}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="sanierung-masse">
        {(
          [
            ["laenge", "Länge m"],
            ["breite", "Breite m"],
            ["hoehe", "Höhe m"],
            ["oeffnungen", "Fenster + Türen m²"],
          ] as const
        ).map(([feld, label]) => (
          <div className="form-group" key={feld}>
            <label htmlFor={`${raum.id}-${feld}`}>{label}</label>
            <input id={`${raum.id}-${feld}`} inputMode="decimal" value={raum[feld]} onChange={(e) => aendern({ [feld]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="sanierung-klein">
        Wand {zahl(f.wand, 1)} m² · Decke {zahl(f.decke, 1)} m² · Boden {zahl(f.boden, 1)} m² · Umfang {zahl(f.umfang, 1)} m
        {/* Dieselbe Aufteilung wie im Rechenkern: Fliesen bis zur Fliesenhöhe, der Rest darüber. */}
        {wandGefliest && ` · davon gefliest ${zahl(f.fliesenwand, 1)} m², darüber ${zahl(Math.max(0, f.wand - f.fliesenwand), 1)} m²`}
      </div>
      {wandGefliest && (
        <div className="form-group sanierung-fliesenhoehe">
          <label htmlFor={`${raum.id}-fliesenhoehe`}>Fliesenhöhe m (leer = bis zur Decke)</label>
          <input id={`${raum.id}-fliesenhoehe`} inputMode="decimal" placeholder="z. B. 1,20" value={raum.fliesenhoehe} onChange={(e) => aendern({ fliesenhoehe: e.target.value })} />
        </div>
      )}
      <div className="massnahmen-wahl" role="group" aria-label={`Maßnahmen in ${raum.name || "diesem Raum"}`}>
        {MASSNAHMEN.map((m) => (
          <label key={m.id} className="massnahme-chip">
            <input type="checkbox" checked={raum.massnahmen.includes(m.id)} onChange={() => umschalten(m.id)} />
            {m.label}
          </label>
        ))}
      </div>
      {hinweise.length > 0 && (
        <ul className="sanierung-hinweise">
          {hinweise.map((m) => (
            <li key={m.id}>{m.hinweis}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
