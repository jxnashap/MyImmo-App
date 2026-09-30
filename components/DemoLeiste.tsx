"use client";

import { useState } from "react";
import { START_CTA } from "@/lib/preise";
import { DEMO_CTA_ZIEL, demoVerlassen } from "@/components/DemoSperre";

/**
 * Hinweisleiste im Demo-Modus — mit Ausgang.
 *
 * VORHER stand hier: „Du siehst Beispieldaten und kannst alle Funktionen
 * erkunden." Bei neun gesperrten Bereichen war das schlicht falsch, und der
 * Satz war schon im externen Feedback vom 08.09. angemerkt; korrigiert wurde
 * damals nur der Teil über das Speichern.
 *
 * Und es gab keinen Weg zurück: `/` zeigt einem angemeldeten Konto das
 * Dashboard, nicht die Startseite. Wer die Demo gesehen hatte und sich
 * anmelden wollte, musste die Cookies löschen. Beide Knöpfe melden deshalb
 * zuerst ab (`demoVerlassen`).
 */
export default function DemoLeiste() {
  const [unterwegs, setUnterwegs] = useState(false);
  const geh = (ziel: string) => {
    setUnterwegs(true);
    void demoVerlassen(ziel);
  };

  return (
    // data-demo-erlaubt: sonst sperrt `DemoNurLesen` die Knöpfe.
    <div role="status" className="demo-leiste" data-demo-erlaubt>
      <span>
        <strong>Demo mit Beispieldaten.</strong> Ansehen ja, speichern nein. Bereiche mit
        Schloss zeigen, was mit eigenem Zugang dazukommt.
      </span>
      <span className="demo-leiste-knoepfe">
        <button type="button" className="btn btn-gold btn-sm" disabled={unterwegs} onClick={() => geh(DEMO_CTA_ZIEL)}>
          {START_CTA}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={unterwegs} onClick={() => geh("/")}>
          Demo beenden
        </button>
      </span>
    </div>
  );
}
