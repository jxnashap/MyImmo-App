"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORT_MIN, PASSWORT_REGEL, pruefePasswort } from "@/lib/passwort";

// Neues Passwort nach „Passwort vergessen".
//
// Hier wird das ALTE Passwort bewusst NICHT verlangt — der Nutzer kennt es ja
// nicht mehr, das ist der ganze Anlass. Dass der Aufrufer berechtigt ist, hat
// die Seite davor geprüft (Reset-Nachweis, siehe lib/auth/resetNachweis.ts).
//
// NACH DEM WECHSEL WIRD ÜBERALL ABGEMELDET (`scope: "global"`).
// Ein Passwort setzt man oft genau dann zurück, wenn man einen fremden Zugriff
// vermutet. Bliebe die Sitzung des Angreifers gültig, hätte das Zurücksetzen
// nichts bewirkt — Supabase beendet Sitzungen bei einer Passwortänderung nicht
// von sich aus.
export default function PasswortNeu() {
  const supabase = createClient();
  const router = useRouter();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);

    const regel = pruefePasswort(pw1);
    if (regel) return setFehler(regel);
    if (pw1 !== pw2) return setFehler("Die beiden Passwörter stimmen nicht überein.");

    setLaeuft(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      setLaeuft(false);
      // Die Meldung von Supabase durchreichen, wo sie etwas erklärt: Bei
      // aktivem Leak-Schutz steht dort, dass das Passwort in einem bekannten
      // Datenleck vorkommt. Eine eigene Pauschalmeldung würde den Nutzer im
      // Dunkeln lassen, warum ausgerechnet dieses Passwort abgelehnt wird.
      setFehler(
        /pwned|leaked|compromis/i.test(error.message)
          ? "Dieses Passwort steht in einem bekannten Datenleck. Bitte wähle ein anderes."
          : "Das Passwort konnte nicht gesetzt werden. Bitte fordere einen neuen Link an.",
      );
      return;
    }

    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login?info=passwort-neu");
  }

  return (
    <form onSubmit={absenden} className="section">
      <div className="section-body">
        <h3 style={{ marginBottom: 6 }}>Neues Passwort wählen</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
          {PASSWORT_REGEL}. Nach dem Speichern wirst du auf allen Geräten abgemeldet und
          meldest dich einmal neu an.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            required
            autoFocus
            minLength={PASSWORT_MIN}
            autoComplete="new-password"
            placeholder={`Neues Passwort (${PASSWORT_REGEL})`}
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Neues Passwort wiederholen"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            aria-invalid={pw2.length > 0 && pw2 !== pw1}
            className="input w-full text-[15px]"
            style={{ padding: "12px 14px" }}
          />
        </div>

        {fehler && (
          <p role="alert" style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>
            {fehler}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 18 }} disabled={laeuft}>
          {laeuft ? "Wird gespeichert …" : "Passwort speichern"}
        </button>
      </div>
    </form>
  );
}
