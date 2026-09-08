"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, KeyRound, Copy, Check, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import {
  erzeugeWiederherstellungscodes,
  loescheWiederherstellungscodes,
  zaehleWiederherstellungscodes,
} from "@/lib/actions/mfa";

// Zwei-Faktor-Anmeldung per Authenticator-App (TOTP) — Einstellungen → Sicherheit.
//
// Ablauf Einrichten: enroll() liefert QR-Code (SVG) + Geheimnis → Nutzer scannt →
// gibt einen Code ein → challengeAndVerify() → Faktor gilt. Direkt danach werden
// Wiederherstellungscodes erzeugt und EINMAL gezeigt.
//
// Warum das Demo-Konto ausgeschlossen ist: Alle Besucher teilen es. Ein zweiter
// Faktor würde jeden anderen aussperren. (Server: /api/demo räumt Faktoren beim
// Start ab, falls jemand die API direkt benutzt.)

type Faktor = { id: string; status: string; friendly_name?: string | null };

export default function ZweiFaktor({ demo = false, istGoogle = false }: { demo?: boolean; istGoogle?: boolean }) {
  const supabase = createClient();
  const toast = useToast();
  const [faktor, setFaktor] = useState<Faktor | null | undefined>(undefined); // undefined = lädt
  const [codesUebrig, setCodesUebrig] = useState<number | null>(null);

  // Einrichtung
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neueCodes, setNeueCodes] = useState<string[] | null>(null);
  const [kopiert, setKopiert] = useState(false);

  // Abschalten
  const [ausCode, setAusCode] = useState("");

  async function laden() {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = (data?.totp ?? []).find((f) => f.status === "verified") ?? null;
    setFaktor(totp ? { id: totp.id, status: totp.status, friendly_name: totp.friendly_name } : null);
    // Unverifizierte Reste einer abgebrochenen Einrichtung aufräumen — sonst
    // meldet Supabase beim nächsten enroll() „already exists".
    for (const f of data?.totp ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    setCodesUebrig(await zaehleWiederherstellungscodes());
  }
  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function starten() {
    setFehler(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "MyImmo" });
    setBusy(false);
    if (error || !data) return setFehler(error?.message ?? "Einrichtung konnte nicht gestartet werden.");
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function bestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setFehler(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) {
      setBusy(false);
      return setFehler("Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.");
    }
    // Ab hier ist die Sitzung aal2 und frisch — die Codes dürfen erzeugt werden.
    const r = await erzeugeWiederherstellungscodes();
    setBusy(false);
    setEnroll(null);
    setCode("");
    if (r.ok) setNeueCodes(r.codes);
    else toast("2FA ist aktiv, aber die Wiederherstellungscodes fehlen — bitte unten neu erzeugen.", "error");
    await laden();
    toast("Zwei-Faktor-Anmeldung ist aktiv ✓");
  }

  async function abschalten(e: React.FormEvent) {
    e.preventDefault();
    if (!faktor) return;
    setFehler(null);
    setBusy(true);
    // Erst den Code prüfen — sonst könnte eine offene Sitzung 2FA abschalten.
    const { error: pruefFehler } = await supabase.auth.mfa.challengeAndVerify({ factorId: faktor.id, code: ausCode.trim() });
    if (pruefFehler) {
      setBusy(false);
      return setFehler("Der Code stimmt nicht.");
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: faktor.id });
    if (error) {
      setBusy(false);
      return setFehler("Abschalten fehlgeschlagen.");
    }
    await loescheWiederherstellungscodes();
    setAusCode("");
    setBusy(false);
    setNeueCodes(null);
    await laden();
    toast("Zwei-Faktor-Anmeldung ist aus.");
  }

  async function codesNeu() {
    setBusy(true);
    const r = await erzeugeWiederherstellungscodes();
    setBusy(false);
    if (!r.ok) return toast(r.reauth ? "Bitte melde dich neu an und versuche es dann erneut." : r.error, "error");
    setNeueCodes(r.codes);
    setCodesUebrig(r.codes.length);
  }

  async function kopieren() {
    if (!neueCodes) return;
    try {
      await navigator.clipboard.writeText(neueCodes.join("\n"));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
    } catch {
      /* Zwischenablage nicht verfügbar — die Codes stehen sichtbar da */
    }
  }

  const gesperrt = demo;

  return (
    <div className="glass-card reveal" style={{ marginTop: 18 }}>
      <h2><ShieldCheck size={16} /> Zwei-Faktor-Anmeldung</h2>
      <p className="sub">
        Zusätzlich zum Passwort ein Code aus einer Authenticator-App (z. B. Aegis, Google
        Authenticator, 1Password). Empfohlen für Konten mit Bankdaten oder Bewerber-Unterlagen.
        {istGoogle && " Gilt auch für die Anmeldung mit Google."}
      </p>
      {gesperrt && (
        <div role="status" className="rounded-sm px-3 py-2 text-[13px]" style={{ background: "var(--blue-dim)", color: "var(--blue)", marginBottom: 14 }}>
          <strong>In der Demo nicht verfügbar.</strong> Das Demo-Konto teilen sich alle Besucher.
        </div>
      )}

      {faktor === undefined ? (
        <p className="sub">Lade…</p>
      ) : faktor ? (
        <fieldset disabled={gesperrt || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <p style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="badge badge-green"><Check size={11} /> aktiv</span>
            <span style={{ color: "var(--muted)" }}>
              {codesUebrig == null ? "" : `${codesUebrig} Wiederherstellungscode${codesUebrig === 1 ? "" : "s"} übrig`}
            </span>
          </p>
          {codesUebrig != null && codesUebrig <= 2 && (
            <div role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 10 }}>
              <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Wenige Wiederherstellungscodes übrig — bitte neue erzeugen und sicher aufbewahren.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button type="button" className="btn btn-ghost" onClick={codesNeu}><KeyRound size={14} /> Neue Wiederherstellungscodes</button>
          </div>
          <form onSubmit={abschalten} className="set-grid">
            <label className="set-field">
              <span>Zum Abschalten: aktueller Code aus der App</span>
              <input className="set-input" inputMode="numeric" autoComplete="one-time-code" value={ausCode} onChange={(e) => { setAusCode(e.target.value); fehler && setFehler(null); }} placeholder="123456" />
            </label>
            <div className="set-field" style={{ justifyContent: "flex-end" }}>
              <span>&nbsp;</span>
              <button className="btn btn-ghost" disabled={ausCode.trim().length < 6}><ShieldOff size={14} /> Zwei-Faktor abschalten</button>
            </div>
          </form>
        </fieldset>
      ) : enroll ? (
        <form onSubmit={bestaetigen} className="set-grid">
          <div className="span2" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR-Code für die Authenticator-App" width={168} height={168} style={{ background: "#fff", borderRadius: 10, padding: 6, border: "1px solid var(--line)" }} />
            <div style={{ fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 220 }}>
              <p style={{ margin: "0 0 8px" }}><strong>1.</strong> QR-Code mit der Authenticator-App scannen.</p>
              <p style={{ margin: "0 0 8px" }}>Geht das nicht, Geheimnis von Hand eingeben:</p>
              <code style={{ display: "block", wordBreak: "break-all", fontSize: 12, background: "var(--bg3)", padding: "6px 8px", borderRadius: 8 }}>{enroll.secret}</code>
              <p style={{ margin: "8px 0 0" }}><strong>2.</strong> Den angezeigten Code hier eingeben.</p>
            </div>
          </div>
          <label className="set-field">
            <span>Code aus der App</span>
            <input className="set-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => { setCode(e.target.value); fehler && setFehler(null); }} placeholder="123456" autoFocus />
          </label>
          <div className="set-field" style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => { await supabase.auth.mfa.unenroll({ factorId: enroll.id }); setEnroll(null); setCode(""); }}>Abbrechen</button>
              <button className="btn btn-gold" disabled={busy || code.trim().length < 6}>{busy ? "Prüfe…" : "Aktivieren"}</button>
            </div>
          </div>
        </form>
      ) : (
        <fieldset disabled={gesperrt || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <button type="button" className="btn btn-gold" onClick={starten}><ShieldCheck size={14} /> Zwei-Faktor einrichten</button>
        </fieldset>
      )}

      {fehler && (
        <div role="alert" style={{ marginTop: 10, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
          <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
        </div>
      )}

      {neueCodes && (
        <div role="region" aria-label="Wiederherstellungscodes" style={{ marginTop: 16, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            <strong>Wiederherstellungscodes — jetzt sichern.</strong> Sie werden nur dieses eine Mal
            angezeigt. Jeder Code gilt einmal und ersetzt die App, wenn das Handy fehlt.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 16px", fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
            {neueCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={kopieren}>{kopiert ? <><Check size={14} /> Kopiert</> : <><Copy size={14} /> Kopieren</>}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setNeueCodes(null)}>Ich habe sie gesichert</button>
          </div>
        </div>
      )}
    </div>
  );
}
