"use client";

// Automatische Abmeldung: (1) verlässlich per Inaktivitäts-Timer (Zeit in den
// Einstellungen wählbar, localStorage), (2) best-effort beim Schließen/
// Backgrounding via sendBeacon. Beim Zurückkehren (visible) wird SOFORT
// geprüft — wer länger weg war als erlaubt, landet direkt auf /login.

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export const KEY_MIN = "myimmo:autologout:min"; // "0"|"5"|"10"|"30"|"60"
export const KEY_CLOSE = "myimmo:autologout:onclose"; // "1"|"0"
export const AUTOLOGOUT_EVENT = "myimmo-autologout-change";

export default function AutoLogout() {
  const last = useRef(Date.now());

  useEffect(() => {
    const min = () => Number(localStorage.getItem(KEY_MIN) || "0");
    const onCl = () => localStorage.getItem(KEY_CLOSE) === "1";
    let ms = min() * 60000;

    const reset = () => {
      last.current = Date.now();
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

    // Best-effort beim Schließen/Verlassen (v. a. Desktop; iOS nicht garantiert).
    const onHide = () => {
      if (onCl()) navigator.sendBeacon?.("/auth/signout");
    };
    window.addEventListener("pagehide", onHide);

    // Einstellungs-Änderungen sofort übernehmen (gleicher Tab + tab-übergreifend).
    const onPrefs = () => {
      ms = min() * 60000;
      reset();
    };
    window.addEventListener(AUTOLOGOUT_EVENT, onPrefs);
    window.addEventListener("storage", onPrefs);

    const iv = setInterval(check, 15000);
    reset();

    return () => {
      acts.forEach((e) => window.removeEventListener(e, onAct));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener(AUTOLOGOUT_EVENT, onPrefs);
      window.removeEventListener("storage", onPrefs);
      clearInterval(iv);
    };
  }, []);

  return null;
}
