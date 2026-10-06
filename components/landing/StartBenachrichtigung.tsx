"use client";

import { useState } from "react";
import Link from "next/link";
import { herkunftDieserSeite } from "@/lib/herkunft";
import { EINWILLIGUNGSTEXT_START, QUELLE_START } from "@/lib/newsletter";

// „Beim Start benachrichtigen“ (01.10.2026, Vorgabe des Betreibers: „dezent“).
//
// Solange die Registrierung geschlossen ist, gibt es keinen Anfrageweg — wer
// trotzdem Bescheid bekommen will, trägt sich hier ein. Bewusst KEIN Knopf
// neben „Coming soon“ und der Demo: eine Textzeile, die erst auf Klick das
// Formular aufklappt. Läuft über denselben Double-Opt-in wie der
// Vorlagen-Verteiler, aber mit eigenem Wortlaut (`EINWILLIGUNGSTEXT_START`).
//
// Steht auf dunklem Grund (`.qlx .lp-final`), daher die Nacht-Tokens.

/** Rückmeldungen nach dem Klick in der Bestätigungsmail (`/?nl=…#bald`). */
export const START_MELDUNG: Record<string, { text: string; gut: boolean }> = {
  ok: { text: "Danke — bestätigt. Wir sagen dir Bescheid, sobald MyImmo für alle startet.", gut: true },
  abgelaufen: { text: "Der Bestätigungslink ist abgelaufen. Bitte trag dich erneut ein.", gut: false },
  fehler: { text: "Der Link ist ungültig. Bitte trag dich erneut ein.", gut: false },
};

const leise = { fontSize: 13, lineHeight: 1.6, color: "var(--l-night-muted)" } as const;

export default function StartBenachrichtigung({ nl }: { nl?: string }) {
  const rueck = nl ? START_MELDUNG[nl] : undefined;
  const [offen, setOffen] = useState(Boolean(rueck && !rueck.gut));
  const [email, setEmail] = useState("");
  const [zustimmung, setZustimmung] = useState(false);
  const [status, setStatus] = useState<"leer" | "laeuft" | "ok" | "fehler">("leer");
  const [meldung, setMeldung] = useState("");

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (!zustimmung || status === "laeuft") return;
    setStatus("laeuft");
    setMeldung("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, quelle: QUELLE_START, herkunft: herkunftDieserSeite() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("fehler");
        setMeldung(json.fehler || "Das hat nicht geklappt. Bitte später erneut versuchen.");
        return;
      }
      setStatus("ok");
      setMeldung(
        json.schon
          ? "Diese Adresse ist schon eingetragen — es wurde keine neue E-Mail verschickt."
          : "Fast geschafft: Bitte bestätige den Link in der E-Mail, die wir gerade verschickt haben.",
      );
    } catch {
      setStatus("fehler");
      setMeldung("Keine Verbindung. Bitte später erneut versuchen.");
    }
  }

  return (
    <div id="bald" className="start-info" style={{ position: "relative", marginTop: 22, maxWidth: 520, marginInline: "auto", paddingInline: 12 }}>
      {rueck && status !== "ok" && (
        <p role="status" style={{ ...leise, color: rueck.gut ? "var(--l-night-text)" : "var(--l-gold-hell)", margin: "0 0 10px" }}>
          {rueck.text}
        </p>
      )}

      {/* Nach bestätigter Anmeldung gibt es nichts mehr anzubieten. */}
      {rueck?.gut && status !== "ok" ? null : status === "ok" ? (
        <p role="status" style={{ ...leise, color: "var(--l-night-text)", margin: 0 }}>{meldung}</p>
      ) : !offen ? (
        <button
          type="button"
          onClick={() => setOffen(true)}
          aria-expanded={false}
          aria-controls="start-info-form"
          style={{ ...leise, background: "none", border: 0, padding: 4, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Beim Start per E-Mail benachrichtigen
        </button>
      ) : (
        <form id="start-info-form" onSubmit={absenden} style={{ textAlign: "left" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <label htmlFor="start-info-email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              E-Mail-Adresse
            </label>
            <input
              id="start-info-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@adresse.de"
              autoComplete="email"
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                padding: "9px 12px",
                fontSize: 15,
                borderRadius: 18,
                border: "1px solid rgba(244,241,232,.25)",
                background: "rgba(244,241,232,.06)",
                color: "var(--l-night-text)",
              }}
            />
            <button type="submit" className="qlx-btn-linie" disabled={!zustimmung || status === "laeuft"} style={{ padding: "9px 18px", fontSize: 14 }}>
              {status === "laeuft" ? "Sendet…" : "Eintragen"}
            </button>
          </div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
            <span style={{ ...leise, fontSize: 12 }}>
              {EINWILLIGUNGSTEXT_START}{" "}
              <Link href="/datenschutz" style={{ color: "var(--l-gold-hell)" }}>Datenschutzerklärung</Link>.
            </span>
          </label>
          {status === "fehler" && (
            <p role="alert" style={{ ...leise, color: "var(--l-gold-hell)", margin: "10px 0 0" }}>{meldung}</p>
          )}
        </form>
      )}
    </div>
  );
}
