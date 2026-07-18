"use client";

import { useEffect, useState } from "react";
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
    text: "Miete rein, Handwerker raus: Unter „Ein- & Ausgaben“ hältst du alle Zahlungen fest — per Hand, CSV-Import oder Kontoanbindung. Rechnungen kannst du direkt an die Buchung hängen.",
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
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_FORCE_KEY) === "1") {
        localStorage.removeItem(TOUR_FORCE_KEY);
        setI(0);
        setOffen(true);
        return;
      }
      if (neuerNutzer && !localStorage.getItem(DONE_KEY)) setOffen(true);
    } catch { /* ignore */ }
  }, [neuerNutzer]);

  // „Tour erneut starten" aus den Einstellungen: Event öffnet die Tour sofort.
  useEffect(() => {
    const starte = () => { setI(0); setOffen(true); };
    window.addEventListener(TOUR_EVENT, starte);
    return () => window.removeEventListener(TOUR_EVENT, starte);
  }, []);

  function beenden() {
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
    setOffen(false);
  }

  if (!offen || typeof document === "undefined") return null;

  const s = SCHRITTE[i];
  const letzter = i === SCHRITTE.length - 1;
  const Icon = s.icon;

  return createPortal(
    <div className="modal-overlay" onClick={beenden}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
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
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--gold-pale, rgba(212,175,90,0.12))", border: "1px solid var(--gold)", display: "grid", placeItems: "center" }}>
            <Icon size={24} color="var(--gold)" />
          </div>
          <h3 style={{ margin: 0, fontSize: 18 }}>{s.titel}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{s.text}</p>
          {s.href && (
            <Link href={s.href} className="btn btn-outline" style={{ fontSize: 12.5 }} onClick={beenden}>
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
