"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Zeitraum } from "@/lib/zeitraum";

// Gemeinsamer Zeitraum-State über alle Ansichten hinweg. In localStorage
// gespeichert, damit die Auswahl beim Wechsel zwischen Seiten erhalten bleibt.
const KEY = "myimmo-zeitraum";

const Ctx = createContext<{ zeitraum: Zeitraum; setZeitraum: (z: Zeitraum) => void }>({
  zeitraum: "1J",
  setZeitraum: () => {},
});

function gueltig(s: string | null): s is Zeitraum {
  return s === "1M" || s === "1J" || s === "5J" || s === "Max";
}

export function ZeitraumProvider({ children }: { children: React.ReactNode }) {
  // Default "1J" — passt zu Server-Render, vermeidet Hydration-Mismatch.
  const [zeitraum, setZ] = useState<Zeitraum>("1J");

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (gueltig(s)) setZ(s);
    } catch {
      /* localStorage nicht verfügbar */
    }
  }, []);

  function setZeitraum(z: Zeitraum) {
    setZ(z);
    try {
      localStorage.setItem(KEY, z);
    } catch {
      /* ignore */
    }
  }

  return <Ctx.Provider value={{ zeitraum, setZeitraum }}>{children}</Ctx.Provider>;
}

export const useZeitraum = () => useContext(Ctx);
