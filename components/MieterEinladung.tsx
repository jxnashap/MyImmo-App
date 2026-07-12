"use client";

// Karte "Mieter-Zugang" auf der Mieter-Detailseite: Einladungscode erzeugen,
// kopieren, widerrufen — bzw. Status anzeigen, wenn das Mieter-Konto schon
// verbunden ist (Businessplan Kap. 14, Schlüssel-Prinzip).
import { useState, useTransition } from "react";
import { Copy, KeyRound, CheckCircle2, RotateCw, X } from "lucide-react";
import { erzeugeEinladungscode, widerrufeEinladung } from "@/lib/actions/einladung";

type Props = {
  mieterId: string;
  verbunden: boolean;
  aktiverCode: { code: string; gueltig_bis: string } | null;
};

export default function MieterEinladung({ mieterId, verbunden, aktiverCode }: Props) {
  const [pending, startTransition] = useTransition();
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const erzeugen = () =>
    startTransition(async () => {
      setFehler(null);
      const r = await erzeugeEinladungscode(mieterId);
      if ("error" in r && r.error) setFehler(r.error);
    });

  const widerrufen = () =>
    startTransition(async () => {
      setFehler(null);
      await widerrufeEinladung(mieterId);
    });

  const kopieren = async () => {
    if (!aktiverCode) return;
    try {
      await navigator.clipboard.writeText(aktiverCode.code);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
    } catch {
      /* Clipboard nicht verfügbar — Code steht sichtbar daneben */
    }
  };

  if (verbunden) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--green)" }}>
        <CheckCircle2 size={15} /> Mieter-Konto verbunden — der Mieter sieht seine Wohnung im Mieterportal.
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Mit einem Einladungscode legt sich dein Mieter ein eigenes Konto an und wird
        automatisch mit dieser Wohnung verknüpft (Registrierung als „Mieter&ldquo; auf der
        Anmeldeseite). Der Code gilt 14 Tage und nur einmal.
      </p>
      {aktiverCode ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <code
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.06em",
              background: "var(--gold-pale)",
              color: "var(--gold)",
              border: "1px solid var(--gold-dim)",
              borderRadius: 8,
              padding: "8px 14px",
            }}
          >
            {aktiverCode.code}
          </code>
          <button type="button" className="btn btn-ghost" onClick={kopieren} style={{ fontSize: 12 }}>
            <Copy size={13} style={{ verticalAlign: "-2px" }} /> {kopiert ? "Kopiert!" : "Kopieren"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={erzeugen} disabled={pending} style={{ fontSize: 12 }}>
            <RotateCw size={13} style={{ verticalAlign: "-2px" }} /> Neuer Code
          </button>
          <button type="button" className="btn btn-ghost" onClick={widerrufen} disabled={pending} style={{ fontSize: 12, color: "var(--red)" }}>
            <X size={13} style={{ verticalAlign: "-2px" }} /> Widerrufen
          </button>
          <span style={{ fontSize: 11, color: "var(--faint)" }}>
            gültig bis {new Date(aktiverCode.gueltig_bis).toLocaleDateString("de-DE")}
          </span>
        </div>
      ) : (
        <button type="button" className="btn btn-gold" onClick={erzeugen} disabled={pending}>
          <KeyRound size={14} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Einladungscode erstellen"}
        </button>
      )}
      {fehler && (
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{fehler}</p>
      )}
    </div>
  );
}
