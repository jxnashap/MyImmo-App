"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { EINWILLIGUNGSTEXT } from "@/lib/newsletter";

// Anmeldung zum Vorlagen-Verteiler.
//
// Bewusst KEIN Gate vor den Vorlagen: Die Seite bleibt vollständig lesbar, das
// Formular ist ein Angebot. Ein hartes Gate lässt sich später setzen, wenn die
// Vorlagen als Dateien ausgeliefert werden — vorher würde es nur Besucher
// vertreiben, die ohnehin noch nichts herunterladen können.
export default function VerteilerForm({ quelle = "vorlagen" }: { quelle?: string }) {
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
        body: JSON.stringify({ email, quelle }),
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
          ? "Diese Adresse ist bereits im Verteiler — es wurde keine neue E-Mail verschickt."
          : "Fast geschafft: Bitte bestätige den Link in der E-Mail, die wir gerade verschickt haben.",
      );
    } catch {
      setStatus("fehler");
      setMeldung("Keine Verbindung. Bitte später erneut versuchen.");
    }
  }

  if (status === "ok") {
    return (
      <div
        style={{
          background: "var(--l-bg3)",
          borderLeft: "3px solid var(--l-gold)",
          borderRadius: 8,
          padding: "18px 20px",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Check size={18} style={{ color: "var(--l-green)", flexShrink: 0, marginTop: 2 }} aria-hidden />
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--l-ink)", margin: 0 }} role="status">
            {meldung}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={absenden}
      style={{
        background: "var(--l-bg3)",
        borderLeft: "3px solid var(--l-gold)",
        borderRadius: 8,
        padding: "18px 20px",
      }}
    >
      <div className="lp-vorher" style={{ color: "var(--l-gold-ink)", marginBottom: 8 }}>
        Vorlagen per E-Mail
      </div>
      <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--l-ink)", margin: "0 0 14px" }}>
        Neue Vorlagen und Ratgeber-Beiträge, wenn es etwas gibt — kein fester Rhythmus, keine Werbung
        von Dritten, jederzeit abbestellbar.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <label htmlFor="verteiler-email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          E-Mail-Adresse
        </label>
        <input
          id="verteiler-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deine@adresse.de"
          autoComplete="email"
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            padding: "10px 12px",
            fontSize: 15,
            borderRadius: 8,
            border: "1px solid var(--l-line)",
            background: "var(--l-bg2)",
            color: "var(--l-ink)",
          }}
        />
        <button type="submit" className="btn btn-gold" disabled={!zustimmung || status === "laeuft"}>
          {status === "laeuft" ? "Sendet…" : "Eintragen"}{" "}
          <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </button>
      </div>

      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={zustimmung}
          onChange={(e) => setZustimmung(e.target.checked)}
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--l-muted)" }}>
          {EINWILLIGUNGSTEXT}{" "}
          <Link href="/datenschutz" style={{ color: "var(--l-gold-ink)" }}>
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>

      {status === "fehler" && (
        <p role="alert" style={{ fontSize: 13, color: "var(--l-red)", margin: "10px 0 0" }}>
          {meldung}
        </p>
      )}
    </form>
  );
}
