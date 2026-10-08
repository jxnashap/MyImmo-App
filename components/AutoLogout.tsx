"use client";

// Automatische Abmeldung: (1) verlässlich per Inaktivitäts-Timer (Zeit in den
// Einstellungen wählbar, localStorage), (2) „beim Schließen des Browsers" über
// eine Heartbeat-Prüfung beim nächsten Öffnen. Beim Zurückkehren (visible)
// wird SOFORT geprüft — wer länger weg war als erlaubt, landet auf /login.
//
// WICHTIG: KEIN sendBeacon("/auth/signout") bei pagehide! pagehide feuert auch
// bei jedem Reload (F5) und jeder harten Navigation — das hat Nutzer mit
// aktivierter Option bei jedem Seiten-Reload serverseitig ausgeloggt.
// Stattdessen: jeder offene Tab schreibt alle 15 s einen Heartbeat nach
// localStorage; ein NEUER Tab (kein sessionStorage-Marker) prüft beim Start,
// ob der letzte Heartbeat alt ist → Browser war zu → abmelden. Reloads und
// interne Navigationen behalten den sessionStorage-Marker und bleiben drin.

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export const KEY_MIN = "myimmo:autologout:min"; // "0"|"5"|"10"|"30"|"60"
// Standard seit 08.09.2026: 30 Minuten (vorher aus). Bank-, Mieter- und
// Bewerberdaten auf einem offenen Rechner sind das Risiko; 30 Minuten
// Inaktivität stören keine Nebenkostenabrechnung. Wer "0" gewählt hat, behält es.
export const STANDARD_MIN = "30";
export const KEY_CLOSE = "myimmo:autologout:onclose"; // "1"|"0"
export const AUTOLOGOUT_EVENT = "myimmo-autologout-change";

const KEY_ALIVE = "myimmo:autologout:alive"; // letzter Heartbeat (ms, tab-übergreifend)
const KEY_TAB = "myimmo:autologout:tab"; // sessionStorage: Tab hat schon geladen
// Hidden-Tabs drosseln Timer auf ~1/min → Schwelle deutlich darüber ansetzen.
const CLOSE_SCHWELLE_MS = 150000;

export default function AutoLogout() {
  const last = useRef(0);

  useEffect(() => {
    // Startzeit beim Mount (nicht im Render — Date.now() ist dort unrein).
    last.current = Date.now();
    const min = () => Number(localStorage.getItem(KEY_MIN) || STANDARD_MIN);
    const onCl = () => localStorage.getItem(KEY_CLOSE) === "1";
    let ms = min() * 60000;

    const alive = () => {
      try {
        localStorage.setItem(KEY_ALIVE, String(Date.now()));
      } catch {
        /* Speicher voll/blockiert — dann greift nur der Inaktivitäts-Timer */
      }
    };
    const reset = () => {
      last.current = Date.now();
      alive();
    };
    // `grund` sagt der Login-Seite, WARUM der Nutzer dort steht (Audit B30) —
    // vorher stand er kommentarlos vor dem Formular.
    const logout = async (grund: "inaktiv" | "geschlossen") => {
      try {
        // Nur diese Sitzung (B52) — die Auto-Abmeldung eines Geräts beendet nicht alle anderen.
        await createClient().auth.signOut({ scope: "local" });
      } catch {
        /* Session ggf. schon weg — Redirect reicht */
      }
      const q = new URLSearchParams({ grund });
      if (grund === "inaktiv") q.set("min", String(min()));
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Abmelden braucht einen vollen Seitenwechsel (Sitzungs-Cookies)
      window.location.href = `/login?${q.toString()}`;
    };
    const check = () => {
      if (ms > 0 && Date.now() - last.current >= ms) logout("inaktiv");
    };

    // „Beim Schließen abmelden": frischer Tab (kein Marker) + letzter Heartbeat
    // aller Tabs liegt lange zurück → Browser war geschlossen → abmelden.
    if (onCl() && !sessionStorage.getItem(KEY_TAB)) {
      const zuletzt = Number(localStorage.getItem(KEY_ALIVE) || "0");
      if (zuletzt > 0 && Date.now() - zuletzt > CLOSE_SCHWELLE_MS) {
        sessionStorage.setItem(KEY_TAB, "1");
        logout("geschlossen");
        return;
      }
    }
    sessionStorage.setItem(KEY_TAB, "1");

    const acts = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    const onAct = () => reset();
    acts.forEach((e) => window.addEventListener(e, onAct, { passive: true }));

    // Rückkehr aus Hintergrund/geschlossenem Tab: erst prüfen, DANN zurücksetzen.
    const onVis = () => {
      if (document.visibilityState === "visible") {
        check();
        reset();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Einstellungs-Änderungen sofort übernehmen (gleicher Tab + tab-übergreifend).
    const onPrefs = () => {
      ms = min() * 60000;
      reset();
    };
    window.addEventListener(AUTOLOGOUT_EVENT, onPrefs);
    window.addEventListener("storage", onPrefs);

    const iv = setInterval(() => {
      check();
      alive();
    }, 15000);
    reset();

    return () => {
      acts.forEach((e) => window.removeEventListener(e, onAct));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(AUTOLOGOUT_EVENT, onPrefs);
      window.removeEventListener("storage", onPrefs);
      clearInterval(iv);
    };
  }, []);

  return null;
}
