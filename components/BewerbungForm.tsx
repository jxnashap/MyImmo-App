"use client";

// Öffentliches Selbstauskunft-Formular für Mietinteressenten (kein Login).
// Dokumente (z. B. die letzten 3 Gehaltsabrechnungen) werden NACH dem
// Einreichen einzeln hochgeladen — je Datei ein kleiner Request statt eines
// Riesen-Payloads; die Bewerbung selbst geht nie wegen eines Anhangs verloren.
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileText, Paperclip, X } from "lucide-react";
import { haengeBewerbungDateiAn, reicheBewerbungEin } from "@/lib/actions/bewerbenPublic";
import SignaturPad from "@/components/SignaturPad";

const MAX_DATEIEN = 5;
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — gleiche Grenze wie Server/RPC
const TYPEN = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function groesseText(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} kB`;
}

export default function BewerbungForm({ token }: { token: string }) {
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [unterschrift, setUnterschrift] = useState<string | null>(null);
  const [dateien, setDateien] = useState<File[]>([]);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [uploadStand, setUploadStand] = useState<string | null>(null);
  const [uploadWarnung, setUploadWarnung] = useState<string[]>([]);
  const dateiInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const dateienWaehlen = (liste: FileList | null) => {
    if (!liste) return;
    setDateiFehler(null);
    const neu: File[] = [...dateien];
    const probleme: string[] = [];
    for (const f of Array.from(liste)) {
      if (neu.length >= MAX_DATEIEN) { probleme.push(`Maximal ${MAX_DATEIEN} Dokumente.`); break; }
      if (!TYPEN.has(f.type)) { probleme.push(`„${f.name}": nur PDF, JPG, PNG oder WebP.`); continue; }
      if (f.size > MAX_BYTES) { probleme.push(`„${f.name}" ist größer als 6 MB.`); continue; }
      if (neu.some((d) => d.name === f.name && d.size === f.size)) continue; // Doppelauswahl
      neu.push(f);
    }
    setDateien(neu);
    if (probleme.length) setDateiFehler(probleme.join(" "));
    // Input zurücksetzen, damit dieselbe Datei nach Entfernen erneut wählbar ist
    if (dateiInput.current) dateiInput.current.value = "";
  };

  if (gesendet) {
    return (
      <div className="section">
        <div className="section-body" style={{ textAlign: "center", padding: "40px 20px" }}>
          <CheckCircle2 size={40} color="var(--green)" />
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>Bewerbung gesendet</p>
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            Vielen Dank — der Vermieter meldet sich bei dir, wenn deine Bewerbung in die engere Auswahl kommt.
          </p>
          {uploadWarnung.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--amber)" }}>
              Hinweis: {uploadWarnung.join(" ")} Deine Bewerbung ist trotzdem angekommen — fehlende
              Unterlagen kannst du dem Vermieter per E-Mail nachreichen.
            </p>
          )}
        </div>
      </div>
    );
  }

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      if (unterschrift) fd.set("unterschrift", unterschrift);
      const r = await reicheBewerbungEin(token, fd);
      if (!r.ok) {
        setFehler(r.fehler ?? "Senden fehlgeschlagen.");
        return;
      }
      // Dokumente einzeln anhängen — Fehler einzelner Dateien kippen die
      // Bewerbung nicht, sie werden nur als Hinweis gesammelt.
      const warnungen: string[] = [];
      if (r.bewerbungId && dateien.length > 0) {
        for (let i = 0; i < dateien.length; i++) {
          setUploadStand(`Lade Dokument ${i + 1}/${dateien.length} — ${dateien[i].name} …`);
          const dfd = new FormData();
          dfd.set("datei", dateien[i]);
          try {
            const u = await haengeBewerbungDateiAn(token, r.bewerbungId, dfd);
            if (!u.ok) warnungen.push(`„${dateien[i].name}" konnte nicht hochgeladen werden (${u.fehler ?? "Fehler"}).`);
          } catch {
            warnungen.push(`„${dateien[i].name}" konnte nicht hochgeladen werden.`);
          }
        }
      }
      setUploadStand(null);
      setUploadWarnung(warnungen);
      setGesendet(true);
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
          <label>Dokumente (optional) — z. B. die letzten 3 Gehaltsabrechnungen, SCHUFA-Auskunft, Mietschuldenfreiheitsbescheinigung</label>
          <input
            ref={dateiInput}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(e) => dateienWaehlen(e.target.files)}
          />
          <div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => dateiInput.current?.click()}
              disabled={pending || dateien.length >= MAX_DATEIEN}
            >
              <Paperclip size={14} /> Dokumente auswählen
            </button>
            <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 10 }}>
              PDF, JPG, PNG oder WebP · max. {MAX_DATEIEN} Dateien · je max. 6 MB
            </span>
          </div>
          {dateien.length > 0 && (
            <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0, display: "grid", gap: 6 }}>
              {dateien.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "7px 12px", background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}
                >
                  <FileText size={14} color="var(--gold)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ color: "var(--faint)", flexShrink: 0 }}>{groesseText(f.size)}</span>
                  <button
                    type="button"
                    aria-label={`${f.name} entfernen`}
                    onClick={() => setDateien(dateien.filter((_, j) => j !== i))}
                    disabled={pending}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "inline-grid", placeItems: "center", padding: 2 }}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dateiFehler && <p style={{ fontSize: 12, color: "var(--red)", margin: "4px 0 0" }}>{dateiFehler}</p>}
        </div>

        <div className="form-group">
          <label>Unterschrift (optional) — bestätigt die Richtigkeit deiner Angaben</label>
          <SignaturPad onChange={setUnterschrift} />
        </div>
        <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
          Alle Angaben und Dokumente sind freiwillig und gehen ausschließlich an den Vermieter dieser
          Wohnung. Mit dem Absenden willigst du ein, dass deine Angaben zur Mieterauswahl gespeichert
          und verarbeitet werden (Art. 6 Abs. 1 lit. a/b DSGVO). Du kannst die Löschung jederzeit verlangen.
        </p>
        {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
        <div>
          <button type="submit" className="btn btn-gold" disabled={pending}>
            {pending ? (uploadStand ?? "Wird gesendet …") : "Bewerbung absenden"}
          </button>
        </div>
      </div>
    </form>
  );
}
