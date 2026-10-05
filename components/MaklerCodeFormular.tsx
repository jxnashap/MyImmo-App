"use client";

// Code-Eingabe des Maklers auf /makler-link/<token> (05.10.2026). Der Code steht in der Mail des
// Kaufinteressenten; nach richtiger Eingabe lädt die Seite neu und zeigt die Dokumente.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { meldeMaklerAn } from "@/lib/actions/maklerLinkPublic";

export default function MaklerCodeFormular({ token, gesperrt }: { token: string; gesperrt: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(
    gesperrt ? "Zu viele falsche Versuche. Bitte einen neuen Link anfordern." : null,
  );
  const [laeuft, start] = useTransition();

  function absenden(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await meldeMaklerAn(token, code);
      if ("error" in r) { setFehler(r.error); return; }
      router.refresh();
    });
  }

  return (
    <form onSubmit={absenden} className="section" style={{ padding: 24, display: "grid", gap: 12, maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <KeyRound size={20} color="var(--gold)" />
        <h1 style={{ fontSize: 18, margin: 0 }}>Zugangscode eingeben</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        Der Code steht in der E-Mail, mit der Sie diesen Link bekommen haben (8 Zeichen, z. B. ABCD-EF23).
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        placeholder="XXXX-XXXX"
        aria-label="Zugangscode"
        disabled={gesperrt}
        style={{ fontSize: 20, letterSpacing: "0.15em", textAlign: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--feld-rand)", background: "var(--bg3)", color: "var(--text)" }}
      />
      {fehler && <div role="alert" style={{ fontSize: 12.5, color: "var(--red)" }}>{fehler}</div>}
      <button type="submit" className="btn btn-gold" disabled={laeuft || gesperrt || code.trim().length < 8}>
        {laeuft ? "Prüfe…" : "Unterlagen öffnen"}
      </button>
    </form>
  );
}
