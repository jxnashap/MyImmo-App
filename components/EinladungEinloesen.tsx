"use client";

// Einladungscode mit einem bestehenden Mieter-Konto einlösen (21.10.2026,
// lib/actions/freischaltung.ts → loeseEinladungEin). Steht im Kasten „Noch keine Wohnung“.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loeseEinladungEin } from "@/lib/actions/freischaltung";

export default function EinladungEinloesen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const einloesen = () =>
    startTransition(async () => {
      setFehler(null);
      try {
        const r = await loeseEinladungEin(code);
        if (!r.ok) setFehler(r.fehler ?? "Das hat nicht geklappt — bitte erneut versuchen.");
        else router.refresh();
      } catch {
        setFehler("Das hat nicht geklappt — bitte erneut versuchen.");
      }
    });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); einloesen(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}
    >
      <label htmlFor="einladung-code" style={{ position: "absolute", left: -9999 }}>Einladungscode</label>
      <input
        id="einladung-code"
        className="input"
        value={code}
        onChange={(e) => { setCode(e.target.value); if (fehler) setFehler(null); }}
        placeholder="MI-XXXX-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        style={{ maxWidth: 200 }}
      />
      <button data-demo-sperre type="submit" className="btn btn-gold" disabled={pending || code.trim().length < 6}>
        {pending ? "…" : "Code einlösen"}
      </button>
      {fehler && <p role="alert" style={{ flexBasis: "100%", fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
    </form>
  );
}
