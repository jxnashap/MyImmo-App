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
export const KEY_CLOSE = "myimmo:autologout:onclose"; // "1"|"0"
export const AUTOLOGOUT_EVENT = "myimmo-autologout-change";

const KEY_ALIVE = "myimmo:autologout:alive"; // letzter Heartbeat (ms, tab-übergreifend)
const KEY_TAB = "myimmo:autologout:tab"; // sessionStorage: Tab hat schon geladen
// Hidden-Tabs drosseln Timer auf ~1/min → Schwelle deutlich darüber ansetzen.
const CLOSE_SCHWELLE_MS = 150000;

export default function AutoLogout() {
  const last = useRef(Date.now());

  useEffect(() => {
    const min = () => Number(localStorage.getItem(KEY_MIN) || "0");
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
    const logout = async () => {
      try {
        await createClient().auth.signOut();
      } catch {
        /* Session ggf. schon weg — Redirect reicht */
      }
      window.location.href = "/login";
    };
    const check = () => {
      if (ms > 0 && Date.now() - last.current >= ms) logout();
    };

    // „Beim Schließen abmelden": frischer Tab (kein Marker) + letzter Heartbeat
    // aller Tabs liegt lange zurück → Browser war geschlossen → abmelden.
    if (onCl() && !sessionStorage.getItem(KEY_TAB)) {
      const zuletzt = Number(localStorage.getItem(KEY_ALIVE) || "0");
      if (zuletzt > 0 && Date.now() - zuletzt > CLOSE_SCHWELLE_MS) {
        sessionStorage.setItem(KEY_TAB, "1");
        logout();
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
