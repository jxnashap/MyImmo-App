"use client";
import { CheckCircle2 } from "lucide-react";

// Rückmeldeformular der Bank auf der öffentlichen Freigabe-Seite.
import { useState } from "react";
import { sendeBankRueckmeldung } from "@/lib/actions/beleihungPublic";

export default function BankRueckmeldungForm({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "fehler">("idle");
  const [fehler, setFehler] = useState("");

  if (status === "ok") {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ marginBottom: 8 }}><CheckCircle2 size={28} color="var(--green)" /></div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Rückmeldung übermittelt</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Der Eigentümer sieht Ihre Nachricht direkt in seiner Unterlagen-Übersicht.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("busy");
        setFehler("");
        const res = await sendeBankRueckmeldung(token, new FormData(e.currentTarget));
        if (res.ok) setStatus("ok");
        else {
          setStatus("fehler");
          setFehler(res.fehler ?? "Senden fehlgeschlagen.");
        }
      }}
      style={{ padding: 16 }}
    >
      <div className="field-row">
        <div className="field"><label>Ansprechpartner *</label><input name="name" required maxLength={200} /></div>
        <div className="field"><label>Bank / Institut</label><input name="bank" maxLength={200} /></div>
      </div>
      <div className="field">
        <label>Kontakt (E-Mail / Telefon)</label>
        <input name="kontakt" maxLength={300} />
      </div>
      <div className="field">
        <label>Nachricht *</label>
        <textarea name="nachricht" required maxLength={4000} rows={4}
          style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--line2)", borderRadius: 7, padding: "9px 11px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", resize: "vertical" }} />
      </div>
      <div className="field">
        <label>Fehlende Unterlagen anfordern (eine je Zeile, optional)</label>
        <textarea name="fehlend" rows={3} placeholder={"z. B. Aktueller Grundbuchauszug\nSCHUFA-Selbstauskunft"}
          style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--line2)", borderRadius: 7, padding: "9px 11px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", resize: "vertical" }} />
      </div>
      {status === "fehler" && (
        <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 10, fontWeight: 600 }}>{fehler}</div>
      )}
      <button type="submit" className="btn btn-gold" disabled={status === "busy"} style={{ fontSize: 13 }}>
        {status === "busy" ? "Wird gesendet…" : "Rückmeldung senden"}
      </button>
    </form>
  );
}
