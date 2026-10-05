"use client";

// Verlauf eines Service-Auftrags (05.10.2026): Notizen und Fotos von Vermieter und Partner.
// EINE Darstellung für das Service-Portal und die Auftragsliste des Vermieters. Nur Anhängen,
// kein Ändern — es ist das Protokoll („Schaden geprüft, Foto anbei“).
import { useRef, useState, useTransition } from "react";
import { Camera, MessageSquare, Wrench } from "lucide-react";
import { fuegeAuftragNotizHinzu } from "@/lib/actions/service";
import { datum } from "@/lib/format";
import type { AuftragNotiz } from "@/lib/auftragNotizen";

export default function AuftragVerlauf({
  auftragId, notizen, ich, partnerName = "Hausmeister", offen = true, vorschau = false,
}: {
  auftragId: string;
  notizen: AuftragNotiz[];
  /** Wer schreibt hier — bestimmt nur die Beschriftung „Du“. Die Rolle prüft der Server. */
  ich: "vermieter" | "service";
  partnerName?: string;
  /** Ein abgeschlossener Auftrag bekommt keine neuen Einträge mehr. */
  offen?: boolean;
  vorschau?: boolean;
}) {
  const [text, setText] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dateiRef = useRef<HTMLInputElement>(null);

  const wer = (r: AuftragNotiz["autor_rolle"]) => (r === ich ? "Du" : r === "vermieter" ? "Vermieter" : partnerName);

  const senden = () =>
    startTransition(async () => {
      setFehler(null);
      if (vorschau) return;
      const fd = new FormData();
      fd.set("auftragId", auftragId);
      fd.set("text", text);
      if (foto) fd.set("foto", foto);
      try {
        const r = await fuegeAuftragNotizHinzu(fd);
        if ("error" in r) setFehler(r.error);
        else {
          setText("");
          setFoto(null);
          if (dateiRef.current) dateiRef.current.value = "";
        }
      } catch {
        setFehler("Konnte nicht gespeichert werden.");
      }
    });

  return (
    <div className="auftrag-verlauf">
      {notizen.length > 0 && (
        <ul>
          {notizen.map((n) => (
            <li key={n.id} className={n.art === "fachbetrieb" ? "ist-fachbetrieb" : undefined}>
              <span className="av-kopf">
                {n.art === "fachbetrieb" ? <Wrench size={12} /> : n.art === "foto" ? <Camera size={12} /> : <MessageSquare size={12} />}
                <strong>{wer(n.autor_rolle)}</strong>
                {n.art === "fachbetrieb" && <span className="badge badge-amber">Fachbetrieb nötig</span>}
                <span className="av-datum">{datum(n.created_at)}</span>
              </span>
              {n.text && <span className="av-text">{n.text}</span>}
              {n.art === "foto" && (
                <a href={`/api/auftrag-foto/${n.id}`} target="_blank" rel="noopener noreferrer" className="av-foto">
                  {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Route mit Sitzung, kein Bild-Optimierer */}
                  <img src={`/api/auftrag-foto/${n.id}`} alt={n.datei_name ?? "Foto"} loading="lazy" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {offen && (
        <div className="av-eingabe">
          <textarea className="input" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Notiz zum Auftrag (z. B. geprüft, Material bestellt)" />
          <div className="av-knoepfe">
            <label className="btn btn-ghost av-foto-knopf">
              <Camera size={13} style={{ verticalAlign: "-2px" }} /> {foto ? foto.name.slice(0, 24) : "Foto"}
              <input
                ref={dateiRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                hidden
              />
            </label>
            <button type="button" className="btn btn-outline" disabled={pending || vorschau || (!text.trim() && !foto)} onClick={senden}>
              {pending ? "…" : "Hinzufügen"}
            </button>
          </div>
          {fehler && <p role="alert" className="av-fehler">{fehler}</p>}
        </div>
      )}
    </div>
  );
}
