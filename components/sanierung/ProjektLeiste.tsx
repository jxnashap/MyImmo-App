"use client";

// Projektleiste des Sanierungs-Guides (Stufe C): Speichern ins Konto, Projekte öffnen, Vorlagen.
// Der Entwurf selbst gehört dem SanierungsRechner — die Leiste schlägt nur vor, ihn zu ersetzen
// (`ersetze`), und fragt vorher, wenn dabei Ungespeichertes verloren ginge.
//
// Ohne Tabelle (SQL noch nicht ausgeführt) und im Demo-Konto gibt es kein Speichern; die
// mitgelieferten Vorlagen funktionieren trotzdem — sie stehen im Code, nicht in der Datenbank.

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Save } from "lucide-react";
import { actionFehler } from "@/lib/actionErgebnis";
import { leererEntwurf, type Entwurf } from "@/lib/sanierung/eingabe";
import {
  MITGELIEFERTE_VORLAGEN,
  NAME_MAX,
  entwurfAusVorlage,
  speicherName,
  vorlageAusEntwurf,
  type ProjektZeile,
  type Vorlage,
} from "@/lib/sanierung/projekte";
import {
  ladeSanierungsprojekt,
  ladeSanierungsprojekte,
  loescheSanierungsprojekt,
  speichereSanierungsprojekt,
} from "@/lib/actions/sanierungsprojekte";

/** Welches gespeicherte Projekt gerade offen ist — `json` ist der gespeicherte Stand zum Vergleich. */
export type ProjektStand = { id: string; stand: string; json: string };

type Meldung = { art: "ok" | "fehler"; text: string; konflikt?: boolean };
type Rueckfrage = { text: string; los: () => void };

const ZEIT = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const zeitpunkt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : ZEIT.format(d);
};

/** Noch nichts eingegeben (höchstens eine Vorlage gewählt) — dann geht beim Ersetzen nichts verloren. */
const istLeer = (e: Entwurf) => e.raeume.length === 0 && !e.projekt.name.trim() && !e.projekt.wohnflaeche.trim() && e.eigene.length === 0;

export default function ProjektLeiste({
  entwurf,
  projekt,
  setProjekt,
  ersetze,
  neueId,
  demo,
}: {
  entwurf: Entwurf;
  projekt: ProjektStand | null;
  setProjekt: (p: ProjektStand | null) => void;
  /** Entwurf ersetzen und den Guide starten (`nurOffene`: nur offene Seiten zeigen). */
  ersetze: (e: Entwurf, nurOffene: boolean) => void;
  neueId: () => string;
  demo: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const [liste, setListe] = useState<ProjektZeile[]>([]);
  const [eingerichtet, setEingerichtet] = useState(true);
  const [laedt, setLaedt] = useState(!demo);
  const [arbeitet, setArbeitet] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [rueckfrage, setRueckfrage] = useState<Rueckfrage | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  const [vorlageName, setVorlageName] = useState("");

  const json = JSON.stringify(entwurf);
  const geaendert = projekt ? projekt.json !== json : !istLeer(entwurf);
  const speichernMoeglich = !demo && eingerichtet;

  const uebernimmListe = (erg: Awaited<ReturnType<typeof ladeSanierungsprojekte>>) => {
    setLaedt(false);
    const f = actionFehler(erg);
    if (f || !("ok" in erg)) return setMeldung({ art: "fehler", text: f ?? "Die gespeicherten Projekte ließen sich nicht laden." });
    setListe(erg.liste);
    setEingerichtet(erg.eingerichtet);
  };

  const ladeListe = async () => {
    if (demo) return;
    setLaedt(true);
    uebernimmListe(await ladeSanierungsprojekte());
  };

  // Beim ersten Anzeigen: Ob Speichern eingerichtet ist, steht erst nach der ersten Abfrage fest.
  useEffect(() => {
    if (demo) return;
    let aktiv = true;
    void ladeSanierungsprojekte().then((erg) => {
      if (aktiv) uebernimmListe(erg);
    });
    return () => {
      aktiv = false;
    };
  }, [demo]);

  /** Etwas tun, das den Entwurf ersetzt — vorher fragen, wenn Ungespeichertes verloren ginge. */
  const mitRueckfrage = (text: string, los: () => void) => {
    if (geaendert) setRueckfrage({ text, los });
    else los();
  };

  const speichere = async (opt: { alsNeu?: boolean; erzwingen?: boolean } = {}) => {
    setArbeitet(true);
    setMeldung(null);
    const name = opt.alsNeu && projekt ? `${speicherName(entwurf).slice(0, NAME_MAX - 8)} (Kopie)` : speicherName(entwurf);
    const erg = await speichereSanierungsprojekt({
      id: opt.alsNeu ? null : projekt?.id ?? null,
      art: "projekt",
      name,
      daten: entwurf,
      stand: projekt?.stand ?? null,
      erzwingen: opt.erzwingen === true,
    });
    setArbeitet(false);
    const f = actionFehler(erg);
    if (f || !("ok" in erg)) {
      return setMeldung({ art: "fehler", text: f ?? "Speichern hat nicht geklappt.", konflikt: "konflikt" in erg && erg.konflikt === true });
    }
    setProjekt({ id: erg.id, stand: erg.stand, json });
    setMeldung({ art: "ok", text: opt.alsNeu ? `Als „${name}“ gespeichert.` : "Gespeichert — auf jedem Gerät mit deinem Konto zu öffnen." });
    void ladeListe();
  };

  const oeffne = async (id: string) => {
    setArbeitet(true);
    setMeldung(null);
    const erg = await ladeSanierungsprojekt(id);
    setArbeitet(false);
    const f = actionFehler(erg);
    if (f || !("ok" in erg)) return setMeldung({ art: "fehler", text: f ?? "Das Projekt ließ sich nicht laden." });
    if (erg.art === "projekt") {
      setProjekt({ id: erg.id, stand: erg.stand, json: JSON.stringify(erg.entwurf) });
      ersetze(erg.entwurf, true);
      setMeldung({ art: "ok", text: `„${erg.name}“ geöffnet.` });
    } else {
      ausVorlage(erg.vorlage, erg.name);
    }
    setOffen(false);
  };

  /** Neues Projekt aus einer Vorlage: noch nicht gespeichert, Guide zeigt nur, was fehlt. */
  const ausVorlage = (v: Vorlage, name: string) => {
    setProjekt(null);
    ersetze(entwurfAusVorlage(v, neueId()), true);
    setMeldung({ art: "ok", text: `Neues Projekt aus „${name}“ — der Guide fragt nur noch, was fehlt.` });
    setOffen(false);
  };

  const neu = () => {
    setProjekt(null);
    ersetze(leererEntwurf(neueId()), false);
    setMeldung(null);
    setOffen(false);
  };

  const loesche = async (z: ProjektZeile) => {
    setArbeitet(true);
    const erg = await loescheSanierungsprojekt(z.id);
    setArbeitet(false);
    setLoeschen(null);
    const f = actionFehler(erg);
    if (f) return setMeldung({ art: "fehler", text: f });
    // Das offene Projekt bleibt als Entwurf im Browser — nur die Verbindung zum Konto ist weg.
    if (projekt?.id === z.id) setProjekt(null);
    setMeldung({ art: "ok", text: `„${z.name}“ gelöscht.` });
    void ladeListe();
  };

  const speichereVorlage = async () => {
    setArbeitet(true);
    setMeldung(null);
    const name = vorlageName.trim() || `${speicherName(entwurf).slice(0, NAME_MAX - 10)} (Vorlage)`;
    const erg = await speichereSanierungsprojekt({ art: "vorlage", name, daten: vorlageAusEntwurf(entwurf) });
    setArbeitet(false);
    const f = actionFehler(erg);
    if (f) return setMeldung({ art: "fehler", text: f });
    setVorlageName("");
    setMeldung({ art: "ok", text: `Vorlage „${name}“ gespeichert.` });
    void ladeListe();
  };

  const projekte = liste.filter((z) => z.art === "projekt");
  const vorlagen = liste.filter((z) => z.art === "vorlage");

  // Renderfunktion, keine Komponente — Komponenten nie innerhalb einer Komponente definieren.
  const zeile = (z: ProjektZeile, knopf: string, los: () => void) => (
    <div key={z.id} className="listen-zeile projekt-zeile">
      <span className="listen-zeile-text">
        <span className="listen-zeile-titel">{z.name}{projekt?.id === z.id && <span className="badge badge-gold projekt-offen">offen</span>}</span>
        <span className="listen-zeile-sub">gespeichert {zeitpunkt(z.aktualisiert)}</span>
      </span>
      {loeschen === z.id ? (
        <span className="projekt-knoepfe">
          Löschen?
          <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => void loesche(z)}>Ja</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLoeschen(null)}>Nein</button>
        </span>
      ) : (
        <span className="projekt-knoepfe">
          <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={los}>{knopf}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => setLoeschen(z.id)}>Löschen</button>
        </span>
      )}
    </div>
  );

  return (
    <div className="projekt-leiste no-print">
      <div className="projekt-leiste-kopf">
        <div className="projekt-leiste-name">
          <strong>{entwurf.projekt.name.trim() || "Neues Projekt"}</strong>
          <span className="sanierung-klein">
            {demo
              ? "Demo: Speichern ist aus — die Vorlagen kannst du ausprobieren."
              : !eingerichtet
                ? "Speichern ins Konto kommt in Kürze — bis dahin bleibt der Entwurf in diesem Browser."
                : projekt
                  ? geaendert ? "Geändert — noch nicht gespeichert" : "Gespeichert"
                  : "Nur in diesem Browser — noch nicht gespeichert"}
          </span>
        </div>
        <div className="projekt-leiste-knoepfe">
          {speichernMoeglich && (
            <button type="button" className={`btn btn-sm ${geaendert ? "btn-gold" : "btn-ghost"}`} disabled={arbeitet || (!!projekt && !geaendert)} onClick={() => void speichere()}>
              <Save size={14} aria-hidden /> Speichern
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => mitRueckfrage("Neues leeres Projekt anfangen?", neu)}>
            <Plus size={14} aria-hidden /> Neu
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={offen} onClick={() => { setOffen(!offen); if (!offen) void ladeListe(); }}>
            <FolderOpen size={14} aria-hidden /> Projekte &amp; Vorlagen
          </button>
        </div>
      </div>

      {rueckfrage && (
        <div className="projekt-rueckfrage" role="alert">
          <span>{rueckfrage.text} Dein aktueller Entwurf hat Änderungen, die nicht gespeichert sind — sie gehen verloren.</span>
          <span className="projekt-knoepfe">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const los = rueckfrage.los; setRueckfrage(null); los(); }}>Verwerfen</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRueckfrage(null)}>Abbrechen</button>
          </span>
        </div>
      )}

      {meldung && (
        <div className={`projekt-meldung${meldung.art === "fehler" ? " fehler" : ""}`} role={meldung.art === "fehler" ? "alert" : "status"}>
          {meldung.text}
          {meldung.konflikt && projekt && (
            <span className="projekt-knoepfe">
              <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => void oeffne(projekt.id)}>Neueren Stand laden</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => void speichere({ alsNeu: true })}>Als Kopie speichern</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => void speichere({ erzwingen: true })}>Trotzdem überschreiben</button>
            </span>
          )}
        </div>
      )}

      {offen && (
        <div className="projekt-panel">
          <div className="projekt-gruppe">
            <h4>Mit einer Vorlage anfangen</h4>
            <p className="sanierung-klein">
              Eine Vorlage bringt nur Entscheidungen mit — was in welchem Raum gemacht wird und welche Technik feststeht. Maße,
              Ist-Zustand und die übrige Technik fragt der Guide bei jeder Wohnung neu. Die Vorschläge siehst du auf der Seite
              „Maßnahmen“ und kannst sie abwählen.
            </p>
            {MITGELIEFERTE_VORLAGEN.map((m) => (
              <div key={m.id} className="listen-zeile projekt-zeile">
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">{m.name}</span>
                  <span className="projekt-beschreibung">{m.beschreibung}</span>
                </span>
                <span className="projekt-knoepfe">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet} onClick={() => mitRueckfrage(`Neues Projekt aus „${m.name}“ anfangen?`, () => ausVorlage(m.vorlage, m.name))}>Damit anfangen</button>
                </span>
              </div>
            ))}
            {vorlagen.map((z) => zeile(z, "Damit anfangen", () => mitRueckfrage(`Neues Projekt aus „${z.name}“ anfangen?`, () => void oeffne(z.id))))}
          </div>

          {speichernMoeglich && (
            <div className="projekt-gruppe">
              <h4>Deine Projekte</h4>
              {laedt && projekte.length === 0 ? (
                <p className="sanierung-klein">Wird geladen …</p>
              ) : projekte.length === 0 ? (
                <p className="sanierung-klein">Noch keins gespeichert. „Speichern“ oben legt dein aktuelles Projekt hier ab.</p>
              ) : (
                projekte.map((z) => zeile(z, projekt?.id === z.id ? "Neu laden" : "Öffnen", () => mitRueckfrage(`„${z.name}“ öffnen?`, () => void oeffne(z.id))))
              )}
            </div>
          )}

          {speichernMoeglich && (
            <div className="projekt-gruppe">
              <h4>Aktuelles Projekt als Vorlage speichern</h4>
              <p className="sanierung-klein">
                Übernommen werden die Maßnahmen je Raumart, angekreuzte Technik-Arbeiten, wer arbeitet, Entsorgung, Puffer, Ziel
                und deine Materialpreise. Nicht übernommen: Adresse, Baujahr, Wohnfläche, Räume und Maße, Ist-Zustand, Mengen,
                Angebote und eigene Posten.
              </p>
              <div className="projekt-vorlage-form">
                <input
                  className="input"
                  aria-label="Name der Vorlage"
                  maxLength={NAME_MAX}
                  placeholder={`${speicherName(entwurf).slice(0, NAME_MAX - 10)} (Vorlage)`}
                  value={vorlageName}
                  onChange={(x) => setVorlageName(x.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-sm" disabled={arbeitet || entwurf.raeume.length === 0} onClick={() => void speichereVorlage()}>
                  Als Vorlage speichern
                </button>
              </div>
              {entwurf.raeume.length === 0 && <p className="sanierung-klein">Lege zuerst Räume an — sonst hätte die Vorlage keine Maßnahmen.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
