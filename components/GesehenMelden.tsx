"use client";

// Meldet dem Server „Service-Portal angesehen“ (05.10.2026) — erst nach kurzer Zeit auf der Seite,
// damit ein Vorab-Laden oder ein sofortiges Wegklicken die Markierungen „neu“ nicht verbraucht.
// Die Markierungen auf DIESER Seite bleiben stehen; beim nächsten Besuch sind sie weg.
import { useEffect } from "react";
import { markiereServiceGesehen } from "@/lib/actions/service";

export default function GesehenMelden() {
  useEffect(() => {
    const t = setTimeout(() => {
      markiereServiceGesehen().catch(() => { /* beste Mühe */ });
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
