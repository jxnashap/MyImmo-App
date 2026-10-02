"use client";

// Karte "Mieterportal-Zugang" auf der Mieter-Detailseite.
//
// Seit 02.10.2026 an eine E-MAIL-ADRESSE gebunden (Vorgabe des Betreibers): Der
// Vermieter trägt die Adresse zweimal ein, MyImmo schickt die Einladung genau dorthin,
// und nur ein Konto mit dieser Adresse wird verknüpft. Danach zeigt die Karte, WER
// verbunden ist — vorher stand dort nur „verbunden“. Ändert der Mieter seine Adresse,
// trennt der Vermieter den Zugang und lädt die neue Adresse ein.
// Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md (F2, F3).
import { useState, useTransition } from "react";
import { Copy, CheckCircle2, RotateCw, X, Send, Unlink, Mail } from "lucide-react";
import { erzeugeEinladungscode, widerrufeEinladung, trenneMieterZugang } from "@/lib/actions/einladung";
import { teilbarerLink } from "@/lib/appUrl";

type Props = {
  mieterId: string;
  /** Verknüpftes Portal-Konto, falls vorhanden. `email` ist null bei Verknüpfungen vor dem 02.10.2026. */
  zugang: { email: string | null; seit: string } | null;
  aktiverCode: { code: string; gueltig_bis: string; email: string | null } | null;
  /** Vorschlag für das Adressfeld (aus den Mieterdaten). */
  mieterEmail?: string | null;
  mieterName?: string | null;
  /** Ist der Mailversand eingerichtet? Sonst gibt es einen fertigen Text zum Selbstverschicken. */
  mailVersand: boolean;
  /** Ende des Portal-Zugangs (31.12. des Jahres nach dem Auszug), sonst null. */
  zugangBis?: string | null;
  /** Ist dieses Ende schon erreicht? (Vom Server berechnet, deutsche Zeit.) */
  zugangAbgelaufen?: boolean;
};

const datumDe = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

export default function MieterEinladung({ mieterId, zugang, aktiverCode, mieterEmail, mieterName, mailVersand, zugangBis, zugangAbgelaufen }: Props) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [email, setEmail] = useState(mieterEmail ?? "");
  const [wdh, setWdh] = useState("");
  const [frage, setFrage] = useState<null | "trennen" | "aendern">(null);
  const [formOffen, setFormOffen] = useState(false);
  const [textKopiert, setTextKopiert] = useState(false);

  const einladungsLink = aktiverCode ? teilbarerLink(`/login?rolle=mieter&einladung=${aktiverCode.code}`) : "";
  const einladungsText = aktiverCode
    ? [
        `Hallo${mieterName ? " " + mieterName : ""},`,
        "",
        "für deine Wohnung gibt es ein Mieterportal: Dort siehst du deine Mietdaten,",
        "meldest Anliegen und Zählerstände und bekommst Dokumente wie die Nebenkostenabrechnung.",
        "",
        `1. Diesen Link öffnen: ${einladungsLink}`,
        `2. Mit genau dieser E-Mail-Adresse registrieren: ${aktiverCode.email ?? ""}`,
        `3. Der Code ist schon eingetragen; falls nicht: ${aktiverCode.code}`,
        "",
        `Die Einladung gilt bis zum ${datumDe(aktiverCode.gueltig_bis)} und nur einmal.`,
        "",
        "Viele Grüße",
      ].join("\n")
    : "";

  const einladen = (adresse: string, wiederholung: string) =>
    startTransition(async () => {
      setFehler(null);
      setMeldung(null);
      const r = await erzeugeEinladungscode(mieterId, adresse, wiederholung);
      if ("error" in r) {
        setFehler(r.error);
        return;
      }
      setFormOffen(false);
      setWdh("");
      setMeldung(
        r.gesendet
          ? `Einladung an ${r.email} verschickt.`
          : mailVersand
            ? `Die E-Mail an ${r.email} konnte nicht verschickt werden. Bitte den Text unten selbst senden — der Code gilt nur für diese Adresse.`
            : `Einladung für ${r.email} erstellt. Der E-Mail-Versand ist noch nicht eingerichtet — bitte den Text unten selbst senden.`,
      );
    });

  const widerrufen = () =>
    startTransition(async () => {
      setFehler(null);
      setMeldung(null);
      const r = await widerrufeEinladung(mieterId);
      if (r && "error" in r && r.error) setFehler(r.error);
    });

  const trennen = (danachNeu: boolean) =>
    startTransition(async () => {
      setFehler(null);
      setMeldung(null);
      const r = await trenneMieterZugang(mieterId);
      setFrage(null);
      if (r && "error" in r && r.error) {
        setFehler(r.error);
        return;
      }
      setMeldung(danachNeu ? "Zugang getrennt. Jetzt die neue Adresse einladen." : "Zugang getrennt — das Konto sieht nichts mehr von diesem Mietverhältnis.");
      if (danachNeu) {
        setEmail("");
        setFormOffen(true);
      }
    });

  const textKopieren = async () => {
    try {
      await navigator.clipboard.writeText(einladungsText);
      setTextKopiert(true);
      setTimeout(() => setTextKopiert(false), 1800);
    } catch {
      /* Zwischenablage nicht verfügbar — der Text steht darunter */
    }
  };

  const meldungen = (
    <>
      {meldung && <p role="status" style={{ marginTop: 8, fontSize: 12, color: "var(--green)" }}>{meldung}</p>}
      {fehler && <p role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
    </>
  );

  // 1) Verbunden: WER, seit wann — und die Hebel.
  if (zugang && !formOffen) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: zugangAbgelaufen ? "var(--muted)" : "var(--green)" }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {zugangAbgelaufen ? "War verbunden mit" : "Verbunden mit"}{" "}
            <strong style={{ color: "var(--text)" }}>{zugang.email ?? "unbekannter Adresse"}</strong>
            {" "}seit {datumDe(zugang.seit)}.{" "}
            {zugangAbgelaufen
              ? `Der Zugang ist am ${datumDe(zugangBis!)} abgelaufen — das Konto sieht nichts mehr.`
              : "Nur dieses Konto sieht freigegebene Dokumente."}
          </span>
        </div>
        {zugangBis && !zugangAbgelaufen && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0 23px" }}>
            Nach dem Auszug endet der Zugang automatisch am {datumDe(zugangBis)} — bis dahin muss
            die Nebenkostenabrechnung für das Auszugsjahr zugegangen sein.
          </p>
        )}
        {!zugang.email && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0 23px" }}>
            Diese Verknüpfung stammt von vor der Adress-Bindung. Wenn du nicht sicher bist, wer
            dahintersteht: trennen und neu einladen.
          </p>
        )}
        {frage === null ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={() => setFrage("aendern")}>
              <Mail size={13} style={{ verticalAlign: "-2px" }} /> E-Mail-Adresse ändern
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: "var(--red)" }} disabled={pending} onClick={() => setFrage("trennen")}>
              <Unlink size={13} style={{ verticalAlign: "-2px" }} /> Zugang trennen
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg2)" }}>
            <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>
              {frage === "trennen"
                ? "Zugang wirklich trennen? Das Konto sieht danach nichts mehr von diesem Mietverhältnis — auch keine früheren Dokumente."
                : "Eine neue Adresse heißt: Der bisherige Zugang wird getrennt, danach lädst du die neue Adresse ein. Erst wenn der Mieter sich damit registriert hat, sieht er wieder etwas."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-outline" style={{ fontSize: 12, color: "var(--red)" }} disabled={pending} onClick={() => trennen(frage === "aendern")}>
                {pending ? "…" : frage === "trennen" ? "Ja, trennen" : "Trennen und neu einladen"}
              </button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={() => setFrage(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {meldungen}
      </div>
    );
  }

  // 2) Einladung läuft: an wen, bis wann — erneut senden oder zurückziehen.
  if (aktiverCode?.email && !formOffen) {
    return (
      <div>
        <p style={{ fontSize: 13, margin: "0 0 4px" }}>
          Einladung an <strong>{aktiverCode.email}</strong> — gültig bis {datumDe(aktiverCode.gueltig_bis)}.
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
          Nur ein Konto mit genau dieser Adresse wird mit der Wohnung verknüpft.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending}
            onClick={() => einladen(aktiverCode.email!, aktiverCode.email!)}>
            <RotateCw size={13} style={{ verticalAlign: "-2px" }} /> {mailVersand ? "Erneut senden" : "Neuer Code"}
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={() => { setEmail(aktiverCode.email ?? ""); setFormOffen(true); }}>
            <Mail size={13} style={{ verticalAlign: "-2px" }} /> Andere Adresse
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: "var(--red)" }} disabled={pending} onClick={widerrufen}>
            <X size={13} style={{ verticalAlign: "-2px" }} /> Zurückziehen
          </button>
        </div>
        <details style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
          <summary style={{ cursor: "pointer" }}>{mailVersand ? "Text selbst verschicken" : "Text zum Verschicken"}</summary>
          <button type="button" className="btn btn-ghost" onClick={textKopieren} style={{ fontSize: 12, marginTop: 8 }}>
            <Copy size={13} style={{ verticalAlign: "-2px" }} /> {textKopiert ? "Kopiert!" : "Text kopieren"}
          </button>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 8, padding: "10px 12px", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--line)" }}>
            {einladungsText}
          </pre>
        </details>
        {meldungen}
      </div>
    );
  }

  // 3) Noch niemand eingeladen (oder neue Adresse): Formular mit Doppeleingabe.
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); einladen(email, wdh); }}
      style={{ display: "grid", gap: 8, maxWidth: 420 }}
    >
      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        {aktiverCode && !aktiverCode.email
          ? "Die bisherige Einladung ist veraltet (ohne Adresse) und gilt nicht mehr. "
          : ""}
        Trag die E-Mail-Adresse deines Mieters ein. {mailVersand ? "MyImmo schickt die Einladung genau dorthin" : "Du bekommst einen fertigen Einladungstext"},
        und nur ein Konto mit dieser Adresse wird mit der Wohnung verknüpft.
      </p>
      <label className="form-group" style={{ margin: 0 }}>
        <span style={{ fontSize: 12 }}>E-Mail des Mieters</span>
        <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mieter@beispiel.de" />
      </label>
      <label className="form-group" style={{ margin: 0 }}>
        <span style={{ fontSize: 12 }}>E-Mail wiederholen</span>
        <input type="email" required autoComplete="off" value={wdh} onChange={(e) => setWdh(e.target.value)} onPaste={(e) => e.preventDefault()} placeholder="zur Sicherheit noch einmal tippen" />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-gold" disabled={pending}>
          <Send size={14} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : mailVersand ? "Einladung senden" : "Einladung erstellen"}
        </button>
        {formOffen && (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setFormOffen(false); setFehler(null); }}>
            Abbrechen
          </button>
        )}
      </div>
      {meldungen}
    </form>
  );
}
