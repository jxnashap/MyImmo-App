"use client";

// Verlauf eines Anliegens (02.10.2026) — EINE Darstellung für Mieterportal, Vorschau
// und Vermieter-Seite. Nachrichten, Statuswechsel, Termine, Aufträge in zeitlicher
// Reihenfolge; darunter „Antworten“ (beim Mieter wie beim Vermieter).
import { useState, useTransition } from "react";
import { MessageSquare, CircleDot, CalendarClock, Wrench, Send } from "lucide-react";
import { schreibeNachricht } from "@/lib/actions/anliegen";
import { autorLabel, ereignisText, NACHRICHT_MAX, type Ereignis } from "@/lib/vorgang";
import VorschauHinweis from "@/components/VorschauHinweis";

const ICON = { nachricht: MessageSquare, status: CircleDot, termin: CalendarClock, auftrag: Wrench } as const;

const zeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function VorgangVerlauf({
  anliegenId,
  ereignisse,
  sicht,
  nurLesen = false,
  antworten = true,
}: {
  anliegenId: string;
  ereignisse: Ereignis[];
  sicht: "mieter" | "vermieter";
  /** Vorschau des Vermieters: kein Absenden im Namen des Mieters. */
  nurLesen?: boolean;
  /** Antwortfeld zeigen (der Vermieter schreibt im Bearbeiten-Formular). */
  antworten?: boolean;
}) {
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const senden = () =>
    startTransition(async () => {
      setFehler(null);
      const r = await schreibeNachricht(anliegenId, text);
      if (r?.error) setFehler(r.error);
      else setText("");
    });

  return (
    <div style={{ marginTop: 8 }}>
      {ereignisse.length > 0 && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
          {ereignisse.map((e) => {
            const Icon = ICON[e.art] ?? MessageSquare;
            const eigen = e.autor_rolle === sicht;
            const nachricht = e.art === "nachricht";
            return (
              <li key={e.id} style={{ fontSize: 12 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", color: "var(--muted)", fontSize: 11 }}>
                  <Icon size={11} style={{ verticalAlign: "-1px" }} />
                  <strong style={{ color: eigen ? "var(--text)" : "var(--gold)" }}>{autorLabel(e.autor_rolle, sicht)}</strong>
                  <span>{zeit(e.created_at)}</span>
                </div>
                <div
                  style={nachricht
                    ? { marginTop: 2, padding: "6px 10px", background: eigen ? "var(--bg3)" : "var(--gold-pale)", borderRadius: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
                    : { marginTop: 1, color: "var(--muted)" }}
                >
                  {ereignisText(e)}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {antworten && (nurLesen ? (
        <div style={{ marginTop: 8 }}><VorschauHinweis was="Antworten" /></div>
      ) : (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={NACHRICHT_MAX}
            className="input"
            aria-label="Nachricht"
            placeholder={sicht === "mieter" ? "Nachricht an deinen Vermieter …" : "Nachricht an den Mieter …"}
          />
          {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
          <div>
            <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} disabled={pending || !text.trim()} onClick={senden}>
              <Send size={12} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Senden"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
