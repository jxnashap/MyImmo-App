"use client";

// Rückkanal auf der ÖFFENTLICHEN Auftragsseite (/auftrag/<token>).
//
// Bisher war die Seite eine Einbahnstraße: Die Handwerksfirma sah Auftrag und
// Mieter-Kontakt, konnte aber nichts zurückmelden. Weder eine Zusage mit Termin
// noch eine Absage — der Vermieter erfuhr nichts und musste hinterhertelefonieren.
// Genau die Reibung, die der Link abschaffen sollte.
//
// Kein Login: geschrieben wird über die SECURITY-DEFINER-Funktion
// `auftrag_public_rueckmeldung`, die den Token prüft (gültig, nicht abgelaufen)
// und eine Mengenbremse je Auftrag hat.
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, SendHorizonal } from "lucide-react";

type Art = "zusage" | "absage" | "rueckfrage";

const ARTEN: { wert: Art; label: string; hinweis: string }[] = [
  { wert: "zusage", label: "Auftrag annehmen", hinweis: "Sie übernehmen den Auftrag. Ein angegebener Termin wird beim Auftrag hinterlegt." },
  { wert: "rueckfrage", label: "Rückfrage", hinweis: "Sie brauchen noch eine Information, bevor Sie zusagen können." },
  { wert: "absage", label: "Absagen", hinweis: "Sie können den Auftrag nicht übernehmen." },
];

export default function AuftragRueckmeldung({ token }: { token: string }) {
  const [art, setArt] = useState<Art>("zusage");
  const [firma, setFirma] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [termin, setTermin] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (!firma.trim()) {
      setFehler("Bitte geben Sie an, für welchen Betrieb Sie antworten.");
      return;
    }
    setLaeuft(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data, error } = await supabase.rpc("auftrag_public_rueckmeldung", {
        p_token: token,
        p_art: art,
        p_firma: firma.trim(),
        p_kontakt: kontakt.trim() || null,
        p_termin: art === "zusage" && termin ? termin : null,
        p_nachricht: nachricht.trim() || null,
      });
      const erg = data as { ok?: boolean; error?: string } | null;
      if (error || erg?.error) {
        setFehler(erg?.error ?? "Die Rückmeldung konnte nicht gespeichert werden.");
      } else {
        setFertig(true);
      }
    } catch {
      setFehler("Die Rückmeldung konnte nicht gesendet werden. Bitte später erneut versuchen.");
    } finally {
      setLaeuft(false);
    }
  }

  if (fertig) {
    return (
      <div className="section">
        <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--green)" }}>
          <CheckCircle2 size={18} />
          <span>Danke — Ihre Rückmeldung ist beim Auftraggeber eingegangen.</span>
        </div>
      </div>
    );
  }

  const gewaehlt = ARTEN.find((a) => a.wert === art)!;

  return (
    <div className="section">
      <div className="section-header"><h3><SendHorizonal size={15} style={{ verticalAlign: "-2px" }} /> Rückmeldung an den Auftraggeber</h3></div>
      <form className="section-body" onSubmit={senden} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ARTEN.map((a) => (
            <button
              key={a.wert}
              type="button"
              /* Aktiver Segment-Zustand als tonal (gold-pale) statt vollflächig
                 gold — sonst konkurrieren zwei Gold-Flächen mit dem eigentlichen
                 Primärknopf „Rückmeldung senden". */
              className={`btn ${art === a.wert ? "btn-tonal" : "btn-ghost"}`}
              style={{ fontSize: 12.5 }}
              onClick={() => setArt(a.wert)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)" }}>{gewaehlt.hinweis}</p>

        <div className="form-group">
          <label>Betrieb *</label>
          <input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Firmenname" required />
        </div>
        <div className="form-group">
          <label>Rückruf-Nummer oder E-Mail</label>
          <input value={kontakt} onChange={(e) => setKontakt(e.target.value)} placeholder="optional" />
        </div>
        {art === "zusage" && (
          <div className="form-group">
            <label>Termin</label>
            <input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Wird beim Auftrag hinterlegt. Bitte vorher mit der Mieterin / dem Mieter abstimmen.
            </span>
          </div>
        )}
        <div className="form-group">
          <label>Nachricht</label>
          <textarea rows={3} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder="optional" />
        </div>

        {fehler && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--red)" }}>{fehler}</p>}

        <button type="submit" className="btn btn-gold" disabled={laeuft} style={{ justifySelf: "start" }}>
          {laeuft ? "Wird gesendet…" : "Rückmeldung senden"}
        </button>
        <p style={{ margin: 0, fontSize: 10.5, color: "var(--faint)" }}>
          Ihre Angaben gehen ausschließlich an den Auftraggeber und dienen der Abwicklung
          dieses Auftrags.
        </p>
      </form>
    </div>
  );
}
