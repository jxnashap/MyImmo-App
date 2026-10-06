"use client";

// Sanierungsrechner / Sanierungs-Guide (BuyImmo): EIN Entwurf, DREI Ansichten — Schritt für Schritt
// (eine Seite je Bildschirm), Übersicht (alle Seiten untereinander) und Ergebnis. Welche Seite offen
// ist, entscheidet `offeneSeiten()` (lib/sanierung/guide.ts); gerechnet wird nur in
// lib/sanierung/auswertung.ts — hier wird eingegeben, navigiert und angezeigt.
//
// Wiedereinstieg (Auftrag Jonas, 05.10.2026): Wer mit einem angefangenen Entwurf in den Guide geht,
// bekommt nur die Seiten, auf denen noch etwas fehlt — „auch wenn nur eine Zahl fehlt“.
//
// Der Entwurf liegt im Browser (localStorage, in try/catch): Wer bei der Besichtigung am Handy misst,
// verliert beim Neuladen nichts. Ins Konto gespeichert wird über die Projektleiste (Stufe C,
// components/sanierung/ProjektLeiste.tsx) — dann ist er auf jedem Gerät zu öffnen. Welches
// gespeicherte Projekt offen ist, merkt sich der Browser ebenfalls (`PROJEKT_SPEICHER`).
//
// Förderung: geschätzter Zuschuss für eigene Posten mit Förderart und für Fenster/Wärmepumpe aus
// der Technik-Seite. Er steckt NICHT in der Summe für den Kauf-Assistenten — sicher ist er erst
// mit der Zusage.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { euro } from "@/lib/format";
import type { Katalog } from "@/lib/sanierung/rechner";
import { entwurfAus, leererEntwurf, zuFoerderEingabe, type Entwurf } from "@/lib/sanierung/eingabe";
import { entwurfFuerKaufpruefung, kaufLinkMitSanierung, type KaufpruefungStart } from "@/lib/sanierung/uebergabe";
import { berechneFoerderung } from "@/lib/sanierung/foerderung";
import { auswerten, foerderPosten } from "@/lib/sanierung/auswertung";
import { AUTO_WEITER_MS, SEITEN, autoWeiter, bestaetigeMassnahmen, offeneSeiten, seiteNach, seiteNoetig, type SeiteId } from "@/lib/sanierung/guide";
import { SEITEN_INHALT, type Aendern } from "@/components/sanierung/GuideSeiten";
import GuideErgebnis, { spanne } from "@/components/sanierung/GuideErgebnis";
import ProjektLeiste, { type ProjektStand } from "@/components/sanierung/ProjektLeiste";

const SPEICHER = "buyimmo:sanierung-entwurf";
const ANSICHT_SPEICHER = "buyimmo:sanierung-ansicht";
const PROJEKT_SPEICHER = "buyimmo:sanierung-projekt";

function projektStandAus(roh: unknown): ProjektStand | null {
  const o = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  return typeof o.id === "string" && typeof o.stand === "string" && typeof o.json === "string" ? { id: o.id, stand: o.stand, json: o.json } : null;
}
const START_ID = "start";

export type Ansicht = "guide" | "uebersicht" | "ergebnis";
const ANSICHTEN: { id: Ansicht; label: string }[] = [
  { id: "guide", label: "Schritt für Schritt" },
  { id: "uebersicht", label: "Übersicht" },
  { id: "ergebnis", label: "Ergebnis" },
];

const neueId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** Noch nichts eingegeben — dann führt der Guide durch alle Seiten, nicht nur durch die offenen. */
const istNeu = (e: Entwurf) => e.raeume.length === 0 && !e.projekt.name.trim() && e.projekt.etw === "" && !e.projekt.wohnflaeche.trim();

const index = (id: SeiteId) => SEITEN.findIndex((s) => s.id === id);

export default function SanierungsRechner({
  katalog,
  stand,
  heute,
  ansicht: startAnsicht,
  demo = false,
  kaufpruefung = null,
}: {
  katalog: Katalog;
  stand: string;
  heute: string;
  ansicht?: Ansicht;
  /** Demo-Konto: kein Speichern ins Konto (die Datenbank lehnt es ohnehin ab). */
  demo?: boolean;
  /** Aus dem Vergleich (`/sanierung?objekt=<id>`, Kaufweg 1 → 2): die Kaufprüfung, die besichtigt wird. */
  kaufpruefung?: KaufpruefungStart | null;
}) {
  const [entwurf, setEntwurf] = useState<Entwurf>(() => leererEntwurf(START_ID));
  const [geladen, setGeladen] = useState(false);
  const [ansicht, setAnsicht] = useState<Ansicht>(startAnsicht ?? "guide");
  const [seite, setSeite] = useState<SeiteId>("projekt");
  const [nurOffene, setNurOffene] = useState(false);
  const [projekt, setProjekt] = useState<ProjektStand | null>(null);
  // Besichtigung für einen Kandidaten, während ein anderer Entwurf offen ist: erst fragen.
  const [objektAngebot, setObjektAngebot] = useState<KaufpruefungStart | null>(null);

  const aendern: Aendern = (f) => setEntwurf(f);
  const offene = useMemo(() => offeneSeiten(entwurf), [entwurf]);
  const istOffen = (id: SeiteId) => offene.some((o) => o.seite === id);

  /**
   * In den Guide: neu → alle Seiten; angefangen → nur die offenen; nichts offen → Hinweis „fertig“.
   * `nurOffeneErzwingen`: aus einer Vorlage — die Entscheidungen stehen schon, gefragt wird nur der Rest.
   */
  const starteGuide = (e: Entwurf, nurOffeneErzwingen = false) => {
    const offen = offeneSeiten(e);
    const nur = nurOffeneErzwingen || !istNeu(e);
    setNurOffene(nur);
    setSeite(nur && offen.length > 0 ? offen[0].seite : "projekt");
    setAnsicht("guide");
  };

  // Entwurf erst nach dem Mount lesen — beim Server-Rendern gibt es keinen Browser-Speicher.
  useEffect(() => {
    let e: Entwurf | null = null;
    let gemerkt: string | null = null;
    let p: ProjektStand | null = null;
    try {
      const roh = localStorage.getItem(SPEICHER);
      e = roh ? entwurfAus(JSON.parse(roh)) : null;
      gemerkt = localStorage.getItem(ANSICHT_SPEICHER);
      const rohP = localStorage.getItem(PROJEKT_SPEICHER);
      p = rohP ? projektStandAus(JSON.parse(rohP)) : null;
    } catch {
      /* kaputter oder gesperrter Speicher: mit leerem Entwurf weiter */
    }
    let start = e ?? leererEntwurf(START_ID);
    // Kaufweg 1 → 2: Besichtigung für einen Kandidaten. Ein leerer Entwurf wird direkt ersetzt (nichts
    // geht verloren), ein angefangener für ein anderes Objekt nur nach Rückfrage.
    let fuerObjekt = false;
    if (kaufpruefung && start.kaufObjekt !== kaufpruefung.id) {
      if (istNeu(start)) {
        start = entwurfFuerKaufpruefung(kaufpruefung, neueId());
        fuerObjekt = true;
        p = null;
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen (Hydration)
        setObjektAngebot(kaufpruefung);
      }
    }
    if (e || fuerObjekt) setEntwurf(start);
    // Ein gemerktes Projekt ohne Entwurf gehört zu nichts mehr.
    if (e && p) setProjekt(p);
    const wahl = startAnsicht ?? gemerkt;
    if (!fuerObjekt && (wahl === "uebersicht" || wahl === "ergebnis")) setAnsicht(wahl);
    else starteGuide(start, fuerObjekt);
    setGeladen(true);
    // Nur beim ersten Laden — danach führt der Nutzer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!geladen) return; // sonst überschriebe der leere Start den gespeicherten Entwurf
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(entwurf));
      localStorage.setItem(ANSICHT_SPEICHER, ansicht);
      if (projekt) localStorage.setItem(PROJEKT_SPEICHER, JSON.stringify(projekt));
      else localStorage.removeItem(PROJEKT_SPEICHER);
    } catch {
      /* privates Fenster o. Ä. — die Rechnung funktioniert trotzdem */
    }
  }, [entwurf, ansicht, projekt, geladen]);

  const a = useMemo(() => auswerten(entwurf, katalog), [entwurf, katalog]);
  const foerderung = useMemo(
    () => ({
      von: berechneFoerderung(zuFoerderEingabe(entwurf, heute, foerderPosten(a, "von"))),
      bis: berechneFoerderung(zuFoerderEingabe(entwurf, heute, foerderPosten(a, "bis"))),
    }),
    [entwurf, heute, a],
  );
  // In den Vergleich (Kaufprüfung): obere Spanne MIT Puffer, OHNE Eigenleistung (kein Geld) und VOR Zuschuss (unsicher).
  const fuerKauf = Math.max(0, a.gesamt.max);

  const props = { e: entwurf, aendern, auswertung: a, neueId };
  /** Entwurf ersetzen (Projekt geöffnet, Vorlage gewählt, neu) und in den Guide. */
  const ersetze = (neu: Entwurf, nurOffeneErzwingen: boolean) => {
    setEntwurf(neu);
    starteGuide(neu, nurOffeneErzwingen);
  };

  // ---- Guide-Navigation ------------------------------------------------------------------------
  const noetig = SEITEN.filter((s) => seiteNoetig(s.id, entwurf)).map((s) => s.id);
  const naechste = (): SeiteId | null => {
    const nach = SEITEN.slice(index(seite) + 1).map((s) => s.id);
    // Nur offene: die nächste Seite, auf der JETZT noch etwas fehlt (auch eine, die erst durch
    // neue Räume nötig wurde). Alle Seiten: die nächste, die in diesem Projekt etwas fragt.
    return nach.find((id) => (nurOffene ? istOffen(id) : seiteNoetig(id, entwurf))) ?? null;
  };
  const vorige = (): SeiteId | null => {
    const vor = SEITEN.slice(0, index(seite)).map((s) => s.id).reverse();
    return vor.find((id) => seiteNoetig(id, entwurf)) ?? null;
  };
  const weiter = () => {
    // „Maßnahmen“ gesehen = Vorschläge bestätigt (Risiko 5 im Plan: sonst bliebe die Seite ewig offen).
    if (seite === "massnahmen") setEntwurf((e) => ({ ...e, raeume: bestaetigeMassnahmen(e.raeume) }));
    const n = naechste();
    if (n) setSeite(n);
    else setAnsicht("ergebnis");
  };
  const oeffneImGuide = (id: SeiteId) => {
    setNurOffene(false);
    setSeite(id);
    setAnsicht("guide");
  };

  // Lern-App-Ablauf (Jonas, 06.10.2026): Macht eine AUSWAHL (Radio) die Seite fertig, geht es nach
  // kurzer Pause von selbst weiter (`autoWeiter` in lib/sanierung/guide.ts entscheidet, welche Seiten).
  // Textfelder springen nie weg — dort geht es mit Enter oder „Weiter“.
  const auswahlRef = useRef(false);
  const vorherRef = useRef(entwurf);
  const weiterRef = useRef(weiter);
  const seiteRef = useRef(seite);
  useEffect(() => {
    weiterRef.current = weiter;
    seiteRef.current = seite;
  });
  useEffect(() => {
    const vorher = vorherRef.current;
    vorherRef.current = entwurf;
    const durchAuswahl = auswahlRef.current;
    auswahlRef.current = false;
    if (!durchAuswahl || ansicht !== "guide" || !autoWeiter(seite, vorher, entwurf)) return;
    const geplant = seite;
    const t = setTimeout(() => {
      // Hat der Nutzer in der Pause selbst die Seite gewechselt, nicht hinterherspringen.
      if (seiteRef.current === geplant) weiterRef.current();
    }, AUTO_WEITER_MS);
    return () => clearTimeout(t);
    // Nur auf Änderungen am Entwurf reagieren — Seite und Ansicht werden beim Auslösen gelesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entwurf]);

  const aktuelleSeite = seiteNach(seite);
  const Inhalt = SEITEN_INHALT[seite];
  const fehltHier = offene.find((o) => o.seite === seite)?.fehlt ?? [];
  const schritt = Math.max(1, noetig.indexOf(seite) + 1);
  const fertig = nurOffene && offene.length === 0;

  // `data-demo-erlaubt`: In der Demo bleibt der Rechner bedienbar — er schreibt nichts in die
  // Datenbank, der Entwurf liegt nur im Browser des Besuchers (DemoNurLesen sperrt sonst jedes Feld).
  return (
    <div className="sanierung" data-demo-erlaubt>
      {geladen && <ProjektLeiste entwurf={entwurf} projekt={projekt} setProjekt={setProjekt} ersetze={ersetze} neueId={neueId} demo={demo} />}
      {objektAngebot && (
        <div className="projekt-rueckfrage no-print" role="alert">
          <span>
            Besichtigung für „{objektAngebot.name}“ starten? Dein aktueller Entwurf „{entwurf.projekt.name.trim() || "ohne Namen"}“ wird
            ersetzt{projekt ? " — gespeichert bleibt er im Konto." : " und ist nicht gespeichert."}
          </span>
          <span className="projekt-knoepfe">
            <button type="button" className="btn btn-gold btn-sm" onClick={() => { const k = objektAngebot; setObjektAngebot(null); setProjekt(null); ersetze(entwurfFuerKaufpruefung(k, neueId()), true); }}>
              Für „{objektAngebot.name}“ neu anfangen
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setObjektAngebot(null)}>Beim aktuellen bleiben</button>
          </span>
        </div>
      )}
      <div className="guide-kopf no-print">
        <div className="tabs" role="tablist" aria-label="Ansicht">
          {ANSICHTEN.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={ansicht === x.id}
              className={`tab-btn${ansicht === x.id ? " active" : ""}`}
              onClick={() => (x.id === "guide" ? starteGuide(entwurf) : setAnsicht(x.id))}
            >
              {x.label}
              {x.id === "uebersicht" && offene.length > 0 && <span className="badge badge-gold guide-badge" title={`${offene.length} ${offene.length === 1 ? "Seite" : "Seiten"} offen`}>{offene.length}<span className="sr-only"> offen</span></span>}
            </button>
          ))}
        </div>
        {entwurf.raeume.length > 0 && <span className="guide-stand zahl">Stand jetzt: {spanne(a.gesamt, euro)}</span>}
      </div>

      {ansicht === "guide" && (
        <div className="section">
          {fertig ? (
            <div className="section-body guide-fertig">
              <Check size={18} aria-hidden />
              <div>
                <strong>Alles ausgefüllt.</strong> Es fehlt auf keiner Seite mehr etwas.
                <div className="guide-nav">
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => setAnsicht("ergebnis")}>Zum Ergebnis <ArrowRight size={14} aria-hidden /></button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNurOffene(false); setSeite("projekt"); }}>Alle Seiten durchgehen</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div>
                  <div className="guide-schritt">
                    {nurOffene ? `Noch offen: ${offene.length} ${offene.length === 1 ? "Seite" : "Seiten"}` : `Schritt ${schritt} von ${noetig.length}`} · {aktuelleSeite.titel}
                    {!aktuelleSeite.pflicht && " · optional"}
                  </div>
                  <h3>{aktuelleSeite.frage}</h3>
                </div>
              </div>
              <div className="guide-fortschritt" aria-hidden>
                <div style={{ width: `${Math.round((nurOffene ? 1 - offene.length / Math.max(1, noetig.length) : schritt / noetig.length) * 100)}%` }} />
              </div>
              {nurOffene && (
                <div className="guide-wiedereinstieg sanierung-klein">
                  Du hast schon angefangen — wir zeigen nur die Seiten, auf denen noch etwas fehlt.{" "}
                  <button type="button" className="btn-link" onClick={() => setNurOffene(false)}>Alle Seiten zeigen</button>
                </div>
              )}
              {/* Formular nur für Enter = Weiter; gespeichert wird nichts per Absenden. onChange merkt sich, ob
                  die letzte Änderung eine Auswahl war (Radio) — nur dann darf der Guide von selbst weiter. */}
              <form
                className="section-body guide-inhalt"
                onSubmit={(ev) => { ev.preventDefault(); weiter(); }}
                onChange={(ev) => { const t: EventTarget = ev.target; if (t instanceof HTMLInputElement && t.type === "radio") auswahlRef.current = true; }}
              >
                <Inhalt {...props} />
                {fehltHier.length > 0 && (
                  <div className="guide-fehlt-liste sanierung-klein">
                    {/* „Zustand: Innentüren“ bleibt zusammen; lange Einträge dürfen weiter umbrechen. */}
                    Noch offen: {fehltHier.map((f) => f.replace(/: /g, ":\u00a0")).join(" · ")}
                  </div>
                )}
                <div className="guide-nav">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!vorige()} onClick={() => { const v = vorige(); if (v) setSeite(v); }}>
                    <ArrowLeft size={14} aria-hidden /> Zurück
                  </button>
                  <button type="submit" className="btn btn-gold btn-sm">
                    {naechste() ? "Weiter" : "Zum Ergebnis"} <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {ansicht === "uebersicht" &&
        SEITEN.filter((s) => seiteNoetig(s.id, entwurf)).map((s) => {
          const fehlt = offene.find((o) => o.seite === s.id)?.fehlt ?? [];
          const SeitenInhalt = SEITEN_INHALT[s.id];
          return (
            <div key={s.id} className="section" id={`seite-${s.id}`}>
              <div className="section-header">
                <div>
                  <h3>{s.titel}{!s.pflicht && <span className="guide-optional"> · optional</span>}</h3>
                  <div className="section-sub">{s.frage}</div>
                </div>
                {fehlt.length > 0 && (
                  <button type="button" className="badge badge-gold guide-badge-knopf" title={fehlt.join(" · ")} onClick={() => oeffneImGuide(s.id)}>
                    {fehlt.length} fehlt
                  </button>
                )}
              </div>
              <div className="section-body guide-inhalt">
                <SeitenInhalt {...props} />
              </div>
            </div>
          );
        })}

      {ansicht === "ergebnis" && <GuideErgebnis e={entwurf} aendern={aendern} a={a} katalog={katalog} stand={stand} foerderung={foerderung} />}

      {ansicht !== "guide" && (
        <div className="sanierung-summe no-print">
          <div>
            <div className="kpi-label">Gesamt</div>
            <div className="sanierung-summe-zahl">{spanne(a.gesamt, euro)}</div>
          </div>
          <div className="sanierung-summe-teile">
            {a.material.length > 0 && <span>Material {spanne(a.materialKosten, euro)}</span>}
            {a.zeilen.length > 0 && <span>Arbeiten {spanne(a.zeilenKosten, euro)}</span>}
            {a.pufferProzent > 0 && <span>Puffer {spanne(a.puffer, euro)}</span>}
            {a.eigenleistung > 0 && <span>Eigenleistung {euro(a.eigenleistung)} (kein Geld, nicht in die Kaufprüfung)</span>}
            {foerderung.bis.zuschuss > 0 && <span>Möglicher Zuschuss {spanne({ min: foerderung.von.zuschuss, max: foerderung.bis.zuschuss }, euro)} (nicht abgezogen)</span>}
            {a.offen.length > 0 && <span>{a.offen.length} Posten ohne Preis (nicht in der Summe)</span>}
            {a.budget && <span>Budget {euro(a.budget.betrag)}: {a.budget.lage === "darunter" ? "reicht" : a.budget.lage === "innerhalb" ? "liegt in der Spanne" : "reicht nicht"}</span>}
          </div>
          {/* Obere Spanne in die Kaufprüfung (Schritt 1) — lieber zu viel eingeplant als zu wenig. Lief die
              Besichtigung für einen Kandidaten, öffnet der Vergleich genau diesen. */}
          {fuerKauf > 0 && (
            <Link href={kaufLinkMitSanierung(fuerKauf, entwurf.kaufObjekt)} className="btn btn-gold btn-sm sanierung-uebernehmen">
              {euro(fuerKauf)} in den Vergleich <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      )}

      <div className="sanierung-fuss no-print">
        <p>
          Eine Schätzung, kein Kostenvoranschlag. Solange du nicht speicherst, liegt dein Entwurf nur in diesem Browser —
          auf einem anderen Gerät siehst du ihn erst nach „Speichern“.
        </p>
      </div>
    </div>
  );
}
