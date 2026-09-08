"use client";

import { useState } from "react";
import { ShieldCheck, KeyRound, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loeseWiederherstellungscodeEin } from "@/lib/actions/mfa";

// Zweiter Schritt der Anmeldung, wenn das Konto 2FA hat: Code aus der App —
// oder ein Wiederherstellungscode, wenn das Handy fehlt. Wird von der
// Login-Seite gezeigt, sobald Supabase `nextLevel: "aal2"` meldet.
//
// Wiederherstellung entfernt den Faktor (lib/actions/mfa.ts) — der Nutzer ist
// danach wieder „nur Passwort" und wird gebeten, 2FA neu einzurichten.

export default function MfaAbfrage({ onErfolg, onAbbruch }: { onErfolg: (wiederhergestellt: boolean) => void; onAbbruch: () => void }) {
  const supabase = createClient();
  const [modus, setModus] = useState<"code" | "wiederherstellung">("code");
  const [eingabe, setEingabe] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    if (modus === "code") {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!totp) {
        setBusy(false);
        return setFehler("Kein zweiter Faktor gefunden.");
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: eingabe.trim() });
      setBusy(false);
      if (error) return setFehler("Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.");
      onErfolg(false);
    } else {
      const r = await loeseWiederherstellungscodeEin(eingabe);
      setBusy(false);
      if (!r.ok) return setFehler(r.error);
      // Der Faktor ist weg; die Sitzung braucht jetzt keinen zweiten Schritt mehr.
      await supabase.auth.refreshSession();
      onErfolg(true);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-3.5" aria-labelledby="mfa-titel">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }} id="mfa-titel">
        <ShieldCheck size={16} style={{ color: "var(--gold)" }} />
        <strong>{modus === "code" ? "Zweiter Schritt: Code aus der App" : "Wiederherstellungscode"}</strong>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        {modus === "code"
          ? "Gib den sechsstelligen Code aus deiner Authenticator-App ein."
          : "Einer deiner acht Wiederherstellungscodes. Danach ist die Zwei-Faktor-Anmeldung aus — richte sie in den Einstellungen neu ein."}
      </p>
      <input
        className="input w-full text-[15px]"
        style={{ padding: "12px 14px", letterSpacing: modus === "code" ? "0.2em" : undefined }}
        inputMode={modus === "code" ? "numeric" : "text"}
        autoComplete="one-time-code"
        placeholder={modus === "code" ? "123456" : "ABCD-EFGH"}
        value={eingabe}
        onChange={(e) => { setEingabe(e.target.value); fehler && setFehler(null); }}
        autoFocus
        required
      />
      {fehler && (
        <div role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
          <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
        </div>
      )}
      <button className="btn btn-gold w-full" disabled={busy || eingabe.trim().length < 6}>
        {busy ? "Prüfe…" : "Anmelden"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModus(modus === "code" ? "wiederherstellung" : "code"); setEingabe(""); setFehler(null); }}>
          <KeyRound size={12} /> {modus === "code" ? "Handy nicht zur Hand?" : "Zurück zum App-Code"}
        </button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onAbbruch}>Abbrechen</button>
      </div>
    </form>
  );
}
