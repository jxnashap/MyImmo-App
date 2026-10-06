"use client";

// Paket E (06.10.2026): Der Finanzierungswunsch aus dem Kauf-Assistenten liegt nur in diesem Browser
// (localStorage, components/kauf/DarlehenWizard.tsx). Liegt einer vor, führt dieser Knopf aufs
// Darlehen-Formular — vorbelegt mit Betrag, Zins und Tilgung, die Rate kommt aus dem Vertrag.

import { useEffect, useState } from "react";
import Link from "next/link";
import { KAUF_DARLEHEN_KEY } from "@/lib/kauf/darlehen";
import { darlehenAusWunschUrl } from "@/lib/kauf/darlehenUebergabe";

export default function DarlehenAusWunsch() {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    try {
      const roh = localStorage.getItem(KAUF_DARLEHEN_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesbar
      if (roh) setHref(darlehenAusWunschUrl(JSON.parse(roh)));
    } catch {
      /* kein Speicher oder kaputter Eintrag: Knopf bleibt weg */
    }
  }, []);
  if (!href) return null;
  return (
    <Link href={href} className="btn btn-ghost btn-sm">
      Darlehen aus dem Finanzierungswunsch eintragen
    </Link>
  );
}
