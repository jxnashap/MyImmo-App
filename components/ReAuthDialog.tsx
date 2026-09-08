"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sitzungIstFrisch } from "@/lib/actions/mfa";

// Erneute Anmeldung vor sensiblen Aktionen (Vollexport, Kontolöschung,
// Bank-Freigabe). Der Server prüft die Frische selbst (lib/auth/frisch.ts);
// dieser Dialog sorgt nur dafür, dass der Nutzer die Hürde nehmen KANN, statt
// nur eine Fehlermeldung zu sehen.
//
// Passwort-Konten: Passwort erneut eingeben → signInWithPassword erneuert die
// Sitzung (neuer `amr`-Zeitstempel). Konten mit 2FA: TOTP-Code → aal2 + frisch.
// Google-Konten ohne Passwort: 2FA-Code, falls eingerichtet — sonst können sie
// die Frische nur über eine neue Anmeldung herstellen (Hinweis im Dialog).

export type ReAuthGrund = "reauth" | "mfa";

/**
 * Prüft die Frische; liefert `true`, wenn die Aktion sofort laufen darf, sonst
 * den Grund für den Dialog.
 */
export async function frischePruefen(): Promise<true | ReAuthGrund> {
  const r = await sitzungIstFrisch();
  return r.frisch ? true : (r.grund ?? "reauth");
}

export default function ReAuthDialog({
  offen,
  grund,
  email,
  istGoogle = false,
  onErfolg,
  onAbbruch,
}: {
  offen: boolean;
  grund: ReAuthGrund;
  email?: string | null;
  istGoogle?: boolean;
  onErfolg: () => void;
  onAbbruch: () => void;
}) {
  const supabase = createClient();
  const [modus, setModus] = useState<"passwort" | "totp">("passwort");
  const [hatTotp, setHatTotp] = useState(false);
  const [eingabe, setEingabe] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!offen) return;
    setEingabe("");
    setFehler(null);
    void (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = (data?.totp ?? []).some((f) => f.status === "verified");
      setHatTotp(totp);
      // 2FA-Konten bestätigen mit dem Code — der ist frischer als ein Passwort
      // und stellt zugleich aal2 her. Ohne 2FA bleibt das Passwort.
      setModus(totp || grund === "mfa" || istGoogle ? "totp" : "passwort");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, grund]);

  if (!offen || typeof document === "undefined") return null;

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    if (modus === "passwort") {
      if (!email) {
        setBusy(false);
        return setFehler("Keine E-Mail-Adresse bekannt.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: eingabe });
      setBusy(false);
      if (error) return setFehler("Das Passwort stimmt nicht.");
    } else {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!totp) {
        setBusy(false);
        return setFehler("Kein zweiter Faktor eingerichtet — bitte einmal ab- und wieder anmelden.");
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: eingabe.trim() });
      setBusy(false);
      if (error) return setFehler("Der Code stimmt nicht.");
    }
    onErfolg();
  }

  const keinWeg = modus === "totp" && !hatTotp && istGoogle;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="reauth-titel" className="modal-backdrop" onClick={onAbbruch}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <form onSubmit={absenden} onClick={(e) => e.stopPropagation()} className="modal-sheet"
        style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 18, padding: 22, width: "min(420px, 100%)", display: "grid", gap: 12 }}>
        <h2 id="reauth-titel" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          {modus === "totp" ? <ShieldCheck size={16} /> : <Lock size={16} />} Anmeldung bestätigen
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          {grund === "mfa"
            ? "Für diese Aktion muss der zweite Faktor in dieser Sitzung bestätigt sein."
            : "Diese Aktion verlangt eine frische Anmeldung — damit niemand über einen offenen Rechner an deine Daten kommt."}
        </p>
        {keinWeg ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            Du meldest dich mit Google an und hast keine Zwei-Faktor-Anmeldung. Bitte melde dich
            einmal ab und neu an — danach ist die Anmeldung frisch.
          </p>
        ) : (
          <>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span>{modus === "totp" ? "Code aus der Authenticator-App" : `Passwort${email ? ` für ${email}` : ""}`}</span>
              <input
                className="set-input"
                type={modus === "totp" ? "text" : "password"}
                inputMode={modus === "totp" ? "numeric" : undefined}
                autoComplete={modus === "totp" ? "one-time-code" : "current-password"}
                value={eingabe}
                onChange={(e) => { setEingabe(e.target.value); fehler && setFehler(null); }}
                autoFocus
                required
              />
            </label>
            {fehler && (
              <div role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
              </div>
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          {hatTotp && !istGoogle ? (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModus(modus === "totp" ? "passwort" : "totp"); setEingabe(""); setFehler(null); }}>
              {modus === "totp" ? "Lieber Passwort" : "Lieber App-Code"}
            </button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onAbbruch}>Abbrechen</button>
            {!keinWeg && <button className="btn btn-gold" disabled={busy || !eingabe}>{busy ? "Prüfe…" : "Bestätigen"}</button>}
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/**
 * Hook: `absichern(fn)` prüft die Frische, öffnet bei Bedarf den Dialog und
 * führt `fn` erst danach aus. `dialog` muss einmal gerendert werden.
 */
export function useReAuth(email?: string | null, istGoogle = false) {
  const [offen, setOffen] = useState(false);
  const [grund, setGrund] = useState<ReAuthGrund>("reauth");
  const [warten, setWarten] = useState<(() => void | Promise<void>) | null>(null);

  const absichern = useCallback(async (fn: () => void | Promise<void>) => {
    const p = await frischePruefen();
    if (p === true) return fn();
    setGrund(p);
    setWarten(() => fn);
    setOffen(true);
  }, []);

  const dialog = (
    <ReAuthDialog
      offen={offen}
      grund={grund}
      email={email}
      istGoogle={istGoogle}
      onAbbruch={() => { setOffen(false); setWarten(null); }}
      onErfolg={() => {
        setOffen(false);
        const fn = warten;
        setWarten(null);
        void fn?.();
      }}
    />
  );
  return { absichern, dialog };
}
