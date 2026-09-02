"use client";

// Karte "Mieter-Zugang" auf der Mieter-Detailseite: Einladungscode erzeugen,
// kopieren, widerrufen — bzw. Status anzeigen, wenn das Mieter-Konto schon
// verbunden ist (Businessplan Kap. 14, Schlüssel-Prinzip).
import { useState, useTransition } from "react";
import { Copy, KeyRound, CheckCircle2, RotateCw, X, Mail } from "lucide-react";
import { erzeugeEinladungscode, widerrufeEinladung } from "@/lib/actions/einladung";
import { teilbarerLink } from "@/lib/appUrl";

type Props = {
  mieterId: string;
  verbunden: boolean;
  aktiverCode: { code: string; gueltig_bis: string } | null;
  /** Fuer die fertige Einladung: Anrede und Empfaenger. */
  mieterName?: string | null;
  mieterEmail?: string | null;
  objekt?: string | null;
};

export default function MieterEinladung({
  mieterId, verbunden, aktiverCode, mieterName, mieterEmail, objekt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [kopiert, setKopiert] = useState(false);
  const [textKopiert, setTextKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Der Code allein hilft dem Mieter nicht: Er weiss weder, WO er ihn eingibt,
  // noch dass er sich als „Mieter" registrieren muss. Die Einladung enthaelt
  // deshalb den fertigen Link mit vorausgewaehlter Rolle und die Schritte.
  const einladungsLink = teilbarerLink("/login?rolle=mieter");
  const einladungsText = aktiverCode
    ? [
        `Hallo${mieterName ? " " + mieterName : ""},`,
        "",
        `für die Wohnung${objekt ? ` (${objekt})` : ""} gibt es ein Mieterportal: Dort siehst du deine`,
        "Mietdaten, kannst Zählerstände melden, Anliegen einreichen und Dokumente abrufen.",
        "",
        "So kommst du hinein:",
        `1. Diesen Link öffnen: ${einladungsLink}`,
        "2. Auf Registrieren wechseln — die Rolle Mieter ist schon vorausgewählt",
        `3. Diesen Zugangscode eingeben: ${aktiverCode.code}`,
        "4. E-Mail-Adresse und ein Passwort festlegen und die Bestätigungsmail öffnen",
        "",
        `Der Code gilt bis zum ${new Date(aktiverCode.gueltig_bis).toLocaleDateString("de-DE")} und kann nur einmal verwendet werden.`,
        "",
        "Viele Grüße",
      ].join("\n")
    : "";

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

  const textKopieren = async () => {
    if (!einladungsText) return;
    try {
      await navigator.clipboard.writeText(einladungsText);
      setTextKopiert(true);
      setTimeout(() => setTextKopiert(false), 1800);
    } catch {
      /* Clipboard nicht verfügbar */
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
        automatisch mit dieser Wohnung verknüpft. Der Code gilt 14 Tage und nur einmal.
        Verschick am besten den fertigen Text unten — er enthält den Link und die
        Schritte; mit dem Code allein weiß der Mieter nicht, wo er ihn eingeben soll.
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
      ) : null}
      {aktiverCode ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="btn btn-gold" onClick={textKopieren} style={{ fontSize: 12 }}>
              <Copy size={13} style={{ verticalAlign: "-2px" }} /> {textKopiert ? "Einladung kopiert!" : "Fertige Einladung kopieren"}
            </button>
            {mieterEmail && (
              <a
                href={`mailto:${encodeURIComponent(mieterEmail)}?subject=${encodeURIComponent("Dein Zugang zum Mieterportal")}&body=${encodeURIComponent(einladungsText)}`}
                className="btn btn-ghost"
                style={{ fontSize: 12, textDecoration: "none" }}
              >
                <Mail size={13} style={{ verticalAlign: "-2px" }} /> Per E-Mail senden
              </a>
            )}
          </div>
          <details style={{ fontSize: 11.5, color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer" }}>Text ansehen</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 8, padding: "10px 12px", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--line)" }}>
              {einladungsText}
            </pre>
          </details>
        </div>
      ) : (
        <button type="button" className="btn btn-gold" onClick={erzeugen} disabled={pending}>
          <KeyRound size={14} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Einladungscode erstellen"}
        </button>
      )}
      {fehler && (
        <p role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{fehler}</p>
      )}
    </div>
  );
}
