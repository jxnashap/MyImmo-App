"use client";

// Meldet den Service Worker an (oder per Notschalter ab) und merkt sich das Installations-Angebot
// des Browsers. Nur im ANGEMELDETEN App-Bereich eingebunden (app/(app)/layout.tsx) — Regeln und
// Begründung in lib/pwa.ts.
import { useEffect } from "react";
import { INSTALL_EREIGNIS, starteDienst } from "@/lib/pwa";

type MitAngebot = Window & { __myimmoInstall?: Event | null };

export default function PwaAnmeldung() {
  useEffect(() => {
    // Im Entwicklungsserver nicht: Dort ändert sich der Code ständig, ein Worker stört nur.
    if (process.env.NODE_ENV !== "production") return;
    const w = window as MitAngebot;
    // Das Angebot kommt oft, bevor die Einstellungen geöffnet sind — es wird hier aufbewahrt und
    // dort angeboten (components/AppInstallieren.tsx). `preventDefault` unterdrückt das Banner,
    // das Chrome am Handy sonst von sich aus einblendet (Vorgabe: ruhig, kein Banner).
    const angebot = (e: Event) => {
      e.preventDefault();
      w.__myimmoInstall = e;
      window.dispatchEvent(new Event(INSTALL_EREIGNIS));
    };
    const installiert = () => {
      w.__myimmoInstall = null;
      window.dispatchEvent(new Event(INSTALL_EREIGNIS));
    };
    window.addEventListener("beforeinstallprompt", angebot);
    window.addEventListener("appinstalled", installiert);
    starteDienst(
      "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
      "caches" in window ? window.caches : undefined,
    ).catch(() => {
      // Ohne Worker läuft die App genauso — nur ohne Offline-Hinweis.
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", angebot);
      window.removeEventListener("appinstalled", installiert);
    };
  }, []);
  return null;
}
