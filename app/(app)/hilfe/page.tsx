import type { Metadata } from "next";
import HilfeInhalt from "@/components/HilfeInhalt";

// Direktlink auf den Support (z. B. aus einer E-Mail). In der App selbst
// erreicht man denselben Inhalt ueber Einstellungen -> Support; der Text lebt
// deshalb in components/HilfeInhalt.tsx und nicht hier.
//
// Der Pfad bleibt /hilfe, obwohl der Bereich jetzt „Support" heisst: Er steht
// in verschickten E-Mails und ist verlinkt. `/support` leitet dauerhaft hierher
// (next.config.mjs), damit auch der neue Name funktioniert.
export const metadata: Metadata = {
  title: "Support — MyImmo",
  description: "So erreichst du uns, wenn etwas nicht funktioniert.",
};

export default function HilfePage() {
  return (
    <div className="fade-up">
      {/* Kopfzeile wie auf jeder anderen Seite der App (topbar/-kicker/-title/
          -sub + Trennstrich). Vorher stand hier eine eigene h1 mit Icon und
          Inline-Styles — dieselbe Seite sah dadurch anders aus als der Rest. */}
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Konto · Support</div>
          <div className="topbar-title">Support</div>
          <div className="topbar-sub">
            Wenn etwas nicht funktioniert, unklar ist oder fehlt — hier steht, wie du uns
            erreichst und was uns hilft, schnell zu antworten.
          </div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <HilfeInhalt />
    </div>
  );
}
