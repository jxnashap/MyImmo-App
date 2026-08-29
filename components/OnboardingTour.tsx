"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Sparkles, Home, User, Banknote, ReceiptText, Archive, Compass, Settings,
  ArrowRight, ArrowLeft, X, type LucideIcon,
} from "lucide-react";

// Onboarding-Tour für neue Nutzer: kurze, durchklickbare Vorstellung der
// wichtigsten Stationen (Objekt → Mieter → Buchungen → Mietkonto → Archiv →
// Steuer/Assistenten). Öffnet sich automatisch, solange noch kein Objekt
// existiert und die Tour nie beendet wurde; jederzeit überspringbar und über
// die Einstellungen erneut startbar.

const DONE_KEY = "myimmo_onboarding_done";
const STATE_KEY = "myimmo_onboarding_state";
export const TOUR_FORCE_KEY = "myimmo_onboarding_force";
// Direktes Startsignal (z. B. aus den Einstellungen): die Tour hängt im
// Layout und bleibt bei Client-Navigation gemountet — ein Event erreicht sie
// sofort, ohne Reload/Redirect.
export const TOUR_EVENT = "myimmo:tour-start";

type TourSchritt = {
  icon: LucideIcon;
  titel: string;
  text: string;
  href?: string;
  linkLabel?: string;
};

const SCHRITTE: TourSchritt[] = [
  {
    icon: Sparkles,
    titel: "Willkommen bei MyImmo",
    text: "Deine Immobilien, Mieter, Finanzen und Dokumente an einem Ort. Diese kurze Tour zeigt dir die wichtigsten Stationen — in der Reihenfolge, in der du sie brauchst. Du kannst sie jederzeit überspringen und später in den Einstellungen neu starten.",
  },
  {
    icon: Home,
    titel: "1 · Dein erstes Objekt anlegen",
    text: "Alles beginnt mit einer Immobilie: Adresse, Typ, Kaufpreis, Fläche. Tipp: Mit dem KI-Import kannst du ein Exposé einfügen und die Felder werden automatisch vorbefüllt.",
    href: "/properties/new",
    linkLabel: "Objekt anlegen",
  },
  {
    icon: User,
    titel: "2 · Mieter erfassen",
    text: "Lege zu deinem Objekt die Mieter an — mit Kaltmiete, Nebenkosten-Vorauszahlung und Mietbeginn. Daraus entstehen später Mietkonto, Nebenkostenabrechnung und Dokumente fast von allein.",
    href: "/tenants/new",
    linkLabel: "Mieter anlegen",
  },
  {
    icon: Banknote,
    titel: "3 · Ein- & Ausgaben buchen",
    // Die Kontoanbindung (Open Banking) wurde am 29.08.2026 komplett aus der App
    // entfernt — sie stand hier noch als Versprechen. Nicht wieder aufnehmen,
    // solange docs/zukunft/OPEN-BANKING.md ein Zukunftsprojekt beschreibt.
    text: "Miete rein, Handwerker raus: Unter „Ein- & Ausgaben“ hältst du alle Zahlungen fest — per Hand oder per CSV-Import. Rechnungen kannst du direkt an die Buchung hängen.",
    href: "/cashflow",
    linkLabel: "Zu Ein- & Ausgaben",
  },
  {
    icon: ReceiptText,
    titel: "4 · Mietkonto im Blick",
    text: "Das Mietkonto gleicht Soll und Ist je Mieter ab: Wer hat gezahlt, wer ist im Rückstand? Rückstände siehst du sofort — inklusive Verlauf.",
    href: "/mietkonto",
    linkLabel: "Zum Mietkonto",
  },
  {
    icon: Archive,
    titel: "5 · Dokumente & Archiv",
    text: "Mietverträge, Übergabeprotokolle, Nebenkostenabrechnungen: Vieles erzeugt MyImmo aus deinen Daten, alles andere legst du im Archiv ab — durchsuchbar und je Objekt sortiert.",
    href: "/archiv",
    linkLabel: "Zum Archiv",
  },
  {
    icon: Compass,
    titel: "6 · Steuer & Assistenten",
    text: "Anlage V, AfA, Spekulationsfrist — der Steuerbereich rechnet mit. Und wenn du kaufen oder verkaufen willst: Die Assistenten führen dich Schritt für Schritt bis zur fertigen Bank-Mappe.",
    href: "/steuer",
    linkLabel: "Zur Steuer",
  },
  {
    icon: Settings,
    titel: "Fertig — leg los!",
    text: "Das war die Tour. Alles Weitere findest du in der Seitenleiste; dein Profil, Vorlagen und diese Tour zum Neustarten liegen in den Einstellungen. Viel Erfolg mit deinen Immobilien!",
  },
];

export default function OnboardingTour({ neuerNutzer = false }: { neuerNutzer?: boolean }) {
  const [offen, setOffen] = useState(false);
  const [minimiert, setMinimiert] = useState(false);
  const [i, setI] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Fokus vor dem Oeffnen merken, damit er beim Schliessen zurueckkehrt —
  // sonst landet er am Seitenanfang und der Tastaturnutzer verliert die Stelle.
  const vorherFokus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_FORCE_KEY) === "1") {
        localStorage.removeItem(TOUR_FORCE_KEY);
        setI(0);
        setOffen(true);
        return;
      }
      // Angefangene Tour fortsetzen (z. B. nach Voll-Reload auf der Zielseite):
      // als „Tour fortsetzen"-Knopf, nicht als aufgerissenes Modal.
      const raw = localStorage.getItem(STATE_KEY);
      if (raw && !localStorage.getItem(DONE_KEY)) {
        const s = JSON.parse(raw) as { i?: number };
        setI(Math.min(SCHRITTE.length - 1, Math.max(0, s.i ?? 0)));
        setMinimiert(true);
        setOffen(true);
        return;
      }
      if (neuerNutzer && !localStorage.getItem(DONE_KEY)) setOffen(true);
    } catch { /* ignore */ }
  }, [neuerNutzer]);

  // „Tour erneut starten" aus den Einstellungen: Event öffnet die Tour sofort.
  useEffect(() => {
    const starte = () => { setI(0); setMinimiert(false); setOffen(true); };
    window.addEventListener(TOUR_EVENT, starte);
    return () => window.removeEventListener(TOUR_EVENT, starte);
  }, []);

  // Laufenden Stand merken (übersteht Seitenwechsel mit Voll-Reload).
  useEffect(() => {
    try {
      if (offen) localStorage.setItem(STATE_KEY, JSON.stringify({ i, min: minimiert ? 1 : 0 }));
    } catch { /* ignore */ }
  }, [offen, i, minimiert]);

  const beenden = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
      localStorage.removeItem(STATE_KEY);
    } catch { /* ignore */ }
    setOffen(false);
    setMinimiert(false);
    vorherFokus.current?.focus?.();
    vorherFokus.current = null;
  }, []);

  // Dialog-Verhalten: Escape schliesst, der Fokus wandert ins Fenster und bleibt
  // darin. Ohne das tabbt man hinter dem Overlay weiter — man sieht das Fenster,
  // bedient aber die Seite dahinter. Betrifft Tastatur- und Screenreader-Nutzung
  // und ist bei einer im Schnitt 58-jaehrigen Zielgruppe kein Randfall.
  // Bewusst NICHT von `i` abhaengig: der Effekt darf beim Schrittwechsel nicht
  // neu laufen. Sonst wuerde (a) `vorherFokus` mit einem Knopf AUS dem Dialog
  // ueberschrieben, der beim Schliessen nicht mehr existiert, und (b) der Fokus
  // bei jedem „Weiter" auf das erste Element springen — man koennte nicht
  // zweimal hintereinander mit der Tastatur weiterklicken. `fokussierbar()`
  // liest ohnehin bei jedem Tastendruck live aus dem DOM.
  useEffect(() => {
    if (!offen || minimiert) return;
    if (!vorherFokus.current) vorherFokus.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const fokussierbar = () =>
      Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    fokussierbar()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        beenden();
        return;
      }
      if (e.key !== "Tab") return;
      const el = fokussierbar();
      if (el.length === 0) return;
      const erster = el[0];
      const letzter = el[el.length - 1];
      if (e.shiftKey && document.activeElement === erster) {
        e.preventDefault();
        letzter.focus();
      } else if (!e.shiftKey && document.activeElement === letzter) {
        e.preventDefault();
        erster.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [offen, minimiert, beenden]);

  // Link-Klick in einem Schritt: Tour NICHT beenden, sondern minimieren und
  // schon zum nächsten Schritt weiterschalten — auf der Zielseite erscheint
  // unten rechts „Tour fortsetzen".
  function zurSeite() {
    setI((x) => Math.min(SCHRITTE.length - 1, x + 1));
    setMinimiert(true);
  }

  if (!offen || typeof document === "undefined") return null;

  // Minimiert: schwebender Fortsetzen-Knopf (bleibt über Client-Navigation
  // gemountet, weil die Tour im Layout hängt).
  if (minimiert) {
    return createPortal(
      <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 1000, display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-gold"
          style={{ fontSize: 12.5, boxShadow: "var(--shadow-2)" }}
          onClick={() => setMinimiert(false)}
        >
          <Sparkles size={14} style={{ verticalAlign: "-2px" }} /> Tour fortsetzen ({i + 1}/{SCHRITTE.length})
        </button>
        <button
          type="button"
          onClick={beenden}
          title="Tour beenden"
          aria-label="Tour beenden"
          style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--line2)", background: "var(--bg2)", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "var(--shadow-2)" }}
        >
          <X size={13} />
        </button>
      </div>,
      document.body,
    );
  }

  const s = SCHRITTE[i];
  const letzter = i === SCHRITTE.length - 1;
  const Icon = s.icon;

  return createPortal(
    <div className="modal-overlay" onClick={beenden}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titel"
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        {/* Kopf: Fortschritt + Überspringen */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 5, background: "var(--line2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${((i + 1) / SCHRITTE.length) * 100}%`, height: "100%", background: "var(--gold)", transition: "width .4s ease" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{i + 1}/{SCHRITTE.length}</span>
          <button type="button" onClick={beenden} title="Tour überspringen" aria-label="Tour überspringen"
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* Inhalt */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "6px 4px 2px" }}>
          {/* Seit „Frosted Paper" (20.08.2026) ist Gold nur noch schmaler Akzent.
              Vorher war hier alles gold: Kreisflaeche, Rand UND Icon — dazu der
              Fortschrittsbalken und beide Knoepfe. Der Kreis ist jetzt neutral,
              das Gold bleibt dem Icon und dem Balken. */}
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--bg3)", border: "1px solid var(--line2)", display: "grid", placeItems: "center" }}>
            <Icon size={24} color="var(--gold)" />
          </div>
          <h3 id="tour-titel" style={{ margin: 0, fontSize: 18 }}>{s.titel}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{s.text}</p>
          {s.href && (
            <Link href={s.href} className="btn btn-outline" style={{ fontSize: 12.5 }} onClick={zurSeite}>
              {s.linkLabel} <ArrowRight size={13} style={{ verticalAlign: "-2px" }} />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5, visibility: i === 0 ? "hidden" : "visible" }} onClick={() => setI((x) => Math.max(0, x - 1))}>
            <ArrowLeft size={13} style={{ verticalAlign: "-2px" }} /> Zurück
          </button>
          <div style={{ display: "flex", gap: 5 }}>
            {SCHRITTE.map((_, d) => (
              <span key={d} style={{ width: 6, height: 6, borderRadius: 99, background: d === i ? "var(--gold)" : "var(--line2)", transition: "background .3s" }} />
            ))}
          </div>
          {letzter ? (
            <button type="button" className="btn btn-gold" style={{ fontSize: 12.5 }} onClick={beenden}>Los geht’s</button>
          ) : (
            <button type="button" className="btn btn-gold" style={{ fontSize: 12.5 }} onClick={() => setI((x) => Math.min(SCHRITTE.length - 1, x + 1))}>
              Weiter <ArrowRight size={13} style={{ verticalAlign: "-2px" }} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
