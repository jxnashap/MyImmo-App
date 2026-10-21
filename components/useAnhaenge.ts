"use client";

// Anhänge im Mieterportal auswählen (21.10.2026, lib/anhaenge.ts): Fotos werden sofort im
// Browser verkleinert und die Summe geprüft — der Mieter erfährt es bei der AUSWAHL, nicht
// erst nach dem Absenden (vorher endete eine zu große Anfrage auf der Fehlerseite).
import { useState } from "react";
import { pruefeAnhaenge } from "@/lib/anhaenge";
import { verkleinereAlle } from "@/lib/bildVerkleinern";

export function useAnhaenge(opts: { maxAnzahl: number; erlaubt: readonly string[] }) {
  const [dateien, setDateien] = useState<File[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bereitet, setBereitet] = useState(false);

  async function waehle(liste: FileList | null, eingabe?: HTMLInputElement | null) {
    setFehler(null);
    const roh = Array.from(liste ?? []);
    if (roh.length === 0) {
      setDateien([]);
      return;
    }
    setBereitet(true);
    const klein = await verkleinereAlle(roh);
    setBereitet(false);
    const problem = pruefeAnhaenge(klein, opts);
    if (problem) {
      setFehler(problem);
      setDateien([]);
      if (eingabe) eingabe.value = "";
      return;
    }
    setDateien(klein);
  }

  function leeren() {
    setDateien([]);
    setFehler(null);
  }

  return { dateien, fehler, bereitet, waehle, leeren };
}
