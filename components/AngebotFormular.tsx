"use client";

// Antwortformular auf der öffentlichen Angebotsseite (/angebot/<token>). Kein Login;
// die Server-Action prüft den Link in der Datenbank und bremst Wiederholungen.
import { useState, useTransition } from "react";
import { CheckCircle2, SendHorizonal } from "lucide-react";
import { gibAngebotAb } from "@/lib/actions/angebote";
import { actionFehler } from "@/lib/actionErgebnis";

export default function AngebotFormular({ token, schonAbgegeben }: { token: string; schonAbgegeben: boolean }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const [pending, startTransition] = useTransition();

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      try {
        const f = actionFehler(await gibAngebotAb(fd));
        if (f) setFehler(f);
        else setFertig(true);
      } catch {
        setFehler("Das Angebot konnte nicht übermittelt werden.");
      }
    });

  if (fertig) {
    return (
      <div className="section">
        <div className="section-body" style={{ textAlign: "center", padding: "28px 20px" }}>
          <CheckCircle2 size={32} color="var(--green)" />
          <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>Vielen Dank — Ihr Angebot ist beim Auftraggeber.</p>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>Wird es angenommen, erhalten Sie den Auftrag mit allen Einzelheiten.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-header"><h3><SendHorizonal size={15} style={{ verticalAlign: "-2px" }} /> Ihr Angebot</h3></div>
      <div className="section-body">
        {schonAbgegeben && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0 }}>
            Zu dieser Anfrage liegt bereits ein Angebot vor. Ein neues ersetzt es beim Auftraggeber
            (höchstens drei je Anfrage).
          </p>
        )}
        <form action={senden} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="token" value={token} />
          <div className="form-row">
            <div className="form-group"><label>Betrieb *</label><input name="firma" required maxLength={200} /></div>
            <div className="form-group"><label>Ansprechpartner / Telefon</label><input name="kontakt" maxLength={300} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Preis brutto (€) *</label><input name="betrag" required inputMode="decimal" maxLength={20} placeholder="z. B. 480,00" /></div>
            <div className="form-group"><label>Frühester Termin</label><input type="date" name="termin" /></div>
          </div>
          <div className="form-row single">
            <div className="form-group"><label>Leistungen, Bedingungen, Gültigkeit</label><textarea name="nachricht" rows={4} maxLength={4000} /></div>
          </div>
          {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
          <div><button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Angebot senden"}</button></div>
        </form>
      </div>
    </div>
  );
}
