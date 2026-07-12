"use client";

// Öffentliches Selbstauskunft-Formular für Mietinteressenten (kein Login).
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { reicheBewerbungEin } from "@/lib/actions/bewerbenPublic";
import SignaturPad from "@/components/SignaturPad";

export default function BewerbungForm({ token }: { token: string }) {
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [unterschrift, setUnterschrift] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (gesendet) {
    return (
      <div className="section">
        <div className="section-body" style={{ textAlign: "center", padding: "40px 20px" }}>
          <CheckCircle2 size={40} color="var(--green)" />
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>Bewerbung gesendet</p>
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            Vielen Dank — der Vermieter meldet sich bei dir, wenn deine Bewerbung in die engere Auswahl kommt.
          </p>
        </div>
      </div>
    );
  }

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      if (unterschrift) fd.set("unterschrift", unterschrift);
      const r = await reicheBewerbungEin(token, fd);
      if (!r.ok) setFehler(r.fehler ?? "Senden fehlgeschlagen.");
      else setGesendet(true);
    });

  return (
    <form action={senden} className="section">
      <div className="section-header"><h3>Selbstauskunft</h3></div>
      <div className="section-body" style={{ display: "grid", gap: 12 }}>
        <div className="form-row">
          <div className="form-group"><label>Vor- und Nachname *</label><input name="name" required maxLength={200} /></div>
          <div className="form-group"><label>E-Mail</label><input type="email" name="email" maxLength={200} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Telefon</label><input name="telefon" maxLength={50} /></div>
          <div className="form-group"><label>Gewünschter Einzug</label><input type="date" name="einzug_ab" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Personen im Haushalt</label><input type="number" name="personen" min={1} max={20} /></div>
          <div className="form-group"><label>Monatliches Netto-Einkommen (€)</label><input type="number" name="netto_einkommen" min={0} step="1" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Beruf / Tätigkeit</label><input name="beruf" maxLength={200} /></div>
          <div className="form-group"><label>Arbeitgeber</label><input name="arbeitgeber" maxLength={200} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Raucher?</label>
            <select name="raucher" defaultValue=""><option value="">– keine Angabe –</option><option value="false">Nein</option><option value="true">Ja</option></select>
          </div>
          <div className="form-group"><label>SCHUFA-Auskunft vorhanden?</label>
            <select name="schufa" defaultValue=""><option value="">– keine Angabe –</option><option value="true">Ja</option><option value="false">Nein</option></select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Haustiere</label><input name="haustiere" maxLength={200} placeholder="z. B. keine / 1 Katze" /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Nachricht an den Vermieter</label>
            <textarea name="nachricht" rows={3} maxLength={2000} placeholder="Kurz zu dir, deiner Situation und warum die Wohnung passt." />
          </div>
        </div>
        <div className="form-group">
          <label>Unterschrift (optional) — bestätigt die Richtigkeit deiner Angaben</label>
          <SignaturPad onChange={setUnterschrift} />
        </div>
        <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
          Alle Angaben sind freiwillig und gehen ausschließlich an den Vermieter dieser Wohnung.
          Mit dem Absenden willigst du ein, dass deine Angaben zur Mieterauswahl gespeichert und
          verarbeitet werden (Art. 6 Abs. 1 lit. a/b DSGVO). Du kannst die Löschung jederzeit verlangen.
        </p>
        {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
        <div>
          <button type="submit" className="btn btn-gold" disabled={pending}>
            {pending ? "Wird gesendet …" : "Bewerbung absenden"}
          </button>
        </div>
      </div>
    </form>
  );
}
