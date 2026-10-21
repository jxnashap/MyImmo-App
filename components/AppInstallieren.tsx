"use client";

// „Als App installieren“ (10.10.2026, Stufe 1 — docs/zukunft/WEBAPP-INSTALLIERBAR.md). Ruhig:
// ein Abschnitt in Support (/hilfe und Einstellungen → Support) und im Mieter-/Service-Konto,
// kein Banner. Welcher Weg gilt, entscheidet `installWeg()` (lib/pwa.ts); das Angebot des Browsers
// fängt PwaAnmeldung im Layout ab, weil es oft kommt, bevor diese Seite offen ist.
import { useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { INSTALL_EREIGNIS, installWeg, type InstallWeg } from "@/lib/pwa";

type Angebot = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
type MitAngebot = Window & { __myimmoInstall?: Angebot | null };

const ALLEIN = "(display-mode: standalone)";

function abonnieren(neu: () => void) {
  const mq = window.matchMedia(ALLEIN);
  mq.addEventListener("change", neu);
  window.addEventListener(INSTALL_EREIGNIS, neu);
  return () => {
    mq.removeEventListener("change", neu);
    window.removeEventListener(INSTALL_EREIGNIS, neu);
  };
}

function lesen(): InstallWeg {
  const nav = navigator as Navigator & { standalone?: boolean };
  return installWeg({
    ua: navigator.userAgent,
    standalone: window.matchMedia(ALLEIN).matches || nav.standalone === true,
    hatAngebot: !!(window as MitAngebot).__myimmoInstall,
    touchPunkte: navigator.maxTouchPoints ?? 0,
  });
}

// Auf dem Server gibt es keinen Browser — dort steht nur der allgemeine Satz.
const aufDemServer = (): InstallWeg | null => null;

const ANLEITUNG: Record<Exclude<InstallWeg, "knopf">, string> = {
  installiert: "MyImmo läuft auf diesem Gerät bereits als App.",
  ios: "Tippe in Safari auf das Teilen-Symbol (Quadrat mit Pfeil nach oben) und dann auf „Zum Home-Bildschirm“. In der App meldest du dich einmal neu an — sie hat einen eigenen Speicher, getrennt von Safari.",
  "mac-safari": "In Safari: Menü „Ablage“ → „Zum Dock hinzufügen“.",
  menue: "Im Menü des Browsers „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen. Am Computer zeigen Chrome und Edge dafür ein Symbol rechts in der Adressleiste.",
  nicht: "Dieser Browser kann Web-Apps nicht installieren. Mit Chrome, Edge oder Safari geht es.",
};

/**
 * `ruhig` (21.10.2026, Mieter-Startseite): nur wenn sich die App hier installieren lässt — nicht
 * installiert, Browser kann es — und ohne Erklärabsatz. Auf dem Server nichts (kein Sprung, weil
 * die Karte am Ende der Seite steht). Entscheidung des Betreibers: dezent, kein Banner.
 */
export default function AppInstallieren({ ruhig = false }: { ruhig?: boolean } = {}) {
  const weg = useSyncExternalStore(abonnieren, lesen, aufDemServer);
  if (ruhig && (weg === null || weg === "installiert" || weg === "nicht")) return null;

  async function installieren() {
    const w = window as MitAngebot;
    const angebot = w.__myimmoInstall;
    if (!angebot) return;
    try {
      await angebot.prompt();
      await angebot.userChoice;
    } catch {
      // Abgebrochen oder vom Browser verweigert — es bleibt beim Hinweis im Menü.
    }
    // Ein Angebot gilt nur einmal.
    w.__myimmoInstall = null;
    window.dispatchEvent(new Event(INSTALL_EREIGNIS));
  }

  return (
    <div className="section" id={ruhig ? undefined : "app"}>
      <div className="section-header">
        <h3>
          <Smartphone size={14} /> Als App installieren
        </h3>
      </div>
      <div className="section-body">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--muted)" }}>
          {ruhig
            ? "Leg MyImmo als App auf den Startbildschirm — mit eigenem Symbol, ohne App Store."
            : "MyImmo lässt sich wie eine App auf den Startbildschirm oder ins Dock legen — mit eigenem Symbol und Fenster, ohne App Store. Dafür speichert MyImmo auf dem Gerät nur eine Hinweisseite für den Fall ohne Internet, keine Daten aus deinem Konto."}
        </p>
        {weg === "knopf" ? (
          <button type="button" className="btn btn-gold" style={{ marginTop: 14 }} onClick={installieren}>
            <Smartphone size={14} style={{ verticalAlign: "-2px" }} /> Als App installieren
          </button>
        ) : weg ? (
          <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.7 }}>{ANLEITUNG[weg]}</p>
        ) : null}
      </div>
    </div>
  );
}
