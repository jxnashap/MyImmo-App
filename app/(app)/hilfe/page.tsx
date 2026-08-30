import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import HilfeInhalt from "@/components/HilfeInhalt";

// Direktlink auf den Support (z. B. aus einer E-Mail). In der App selbst
// erreicht man denselben Inhalt ueber Einstellungen -> Hilfe & Support; der
// Text lebt deshalb in components/HilfeInhalt.tsx und nicht hier.
export const metadata: Metadata = {
  title: "Hilfe & Support — MyImmo",
  description: "So erreichst du uns, wenn etwas nicht funktioniert.",
};

export default function HilfePage() {
  return (
    <div className="fade-up">
      <div className="topbar-kicker" style={{ marginBottom: 6 }}>Konto · Hilfe</div>
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <LifeBuoy size={22} /> Hilfe &amp; Support
      </h1>
      <HilfeInhalt />
    </div>
  );
}
