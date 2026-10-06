"use client";

// Rücklauf auf der öffentlichen Bank- bzw. Makler-Seite (06.10.2026): Datei an den Eigentümer
// zurückschicken, z. B. Darlehensvertrag-Entwurf, Exposé, Reservierungsvereinbarung. Die Datei
// landet in seinem EINGANG, nicht direkt in seinen Unterlagen — er entscheidet. Darunter steht,
// was über diesen Link schon geschickt wurde (nur Name, Zeitpunkt, Stand — nie die Datei).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Paperclip, TriangleAlert } from "lucide-react";
import { schickeDateiZurueck } from "@/lib/actions/freigabeEingangPublic";
import { EINGANG_ACCEPT, EINGANG_MAX_BYTES, EINGANG_STATUS_TEXT, type EingangStatus } from "@/lib/freigabeEingang";
import type { FreigabeArt } from "@/lib/freigabeCode";

export type GesendeteDatei = { datei_name: string; datei_size: number; created_at: string; status: EingangStatus };

const groesse = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function DateiZurueckSchicken({
  art,
  token,
  gesendet,
}: {
  art: FreigabeArt;
  token: string;
  gesendet: GesendeteDatei[];
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function senden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    const f = fd.get("datei");
    if (f instanceof File && f.size > EINGANG_MAX_BYTES) return setFehler("Datei zu groß (höchstens 8 MB).");
    setBusy(true);
    try {
      const r = await schickeDateiZurueck(art, token, fd);
      if ("error" in r) return setFehler(r.error);
      setOk(f instanceof File ? f.name : "Datei");
      form.current?.reset();
      router.refresh();
    } catch {
      setFehler("Senden fehlgeschlagen — bitte später erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
        Schicken Sie {art === "bank" ? "z. B. einen Vertragsentwurf oder eine Unterlagenanforderung" : "z. B. ein Exposé oder eine Reservierungsvereinbarung"} zurück.
        Die Datei geht nur an den Eigentümer; er entscheidet, ob er sie in seine Unterlagen übernimmt.
        PDF, JPG, PNG oder WebP, höchstens 8 MB.
      </p>
      <form ref={form} onSubmit={senden} style={{ display: "grid", gap: 10 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Datei *</label>
          <input type="file" name="datei" accept={EINGANG_ACCEPT} required />
        </div>
        <div className="field-row">
          <div className="field" style={{ margin: 0 }}><label>Ihr Name</label><input name="absender" maxLength={200} /></div>
          <div className="field" style={{ margin: 0 }}><label>Kurze Notiz</label><input name="nachricht" maxLength={2000} placeholder="z. B. Bitte bis Freitag unterschreiben" /></div>
        </div>
        {fehler && (
          <div role="alert" style={{ background: "var(--red-dim)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
            <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
          </div>
        )}
        {ok && (
          <div role="status" style={{ color: "var(--green)", fontSize: 13 }}>
            <CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> „{ok}“ wurde übermittelt.
          </div>
        )}
        <div>
          <button className="btn btn-gold" disabled={busy}>
            <Paperclip size={14} /> {busy ? "Wird gesendet…" : "Datei senden"}
          </button>
        </div>
      </form>

      {gesendet.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Über diesen Link gesendet</div>
          {gesendet.map((g, i) => (
            <div key={`${g.created_at}-${i}`} className="listen-zeile" style={{ cursor: "default" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{g.datei_name}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {new Date(g.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} · {groesse(g.datei_size)}
                </div>
              </div>
              <span className={`badge ${g.status === "uebernommen" ? "badge-green" : ""}`}>{EINGANG_STATUS_TEXT[g.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
