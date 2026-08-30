"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Download, Trash2, Check, X, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/actions/account";
import { wechslePasswort } from "@/lib/passwortWechsel";
import { createPortal } from "react-dom";
import { useModalFokus } from "@/lib/modalFokus";

// Konto-Verwaltung für MIETER- und SERVICE-Konten.
//
// Diese Rollen hatten bisher überhaupt keine Einstellungen: Die Portal-Shells
// boten nur Theme-Umschalter und „Abmelden", und /einstellungen ist für sie per
// Redirect gesperrt. Damit konnte ein Mieter weder sein Passwort ändern noch
// seine Daten exportieren noch sein Konto löschen — und der Vermieter konnte es
// auch nicht für ihn tun. Die DSGVO-Rechte aus Art. 15, 17 und 20 waren für
// diese Nutzergruppe schlicht nicht ausübbar.

export default function KontoVerwaltung({
  email, rolle, provider,
}: { email: string; rolle: "mieter" | "service"; provider?: string | null }) {
  const supabase = createClient();

  const istGoogle = !!provider && provider !== "email";
  const [pw0, setPw0] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwStatus, setPwStatus] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);
  const [pwLaeuft, setPwLaeuft] = useState(false);

  const [offen, setOffen] = useState(false);
  const loeschRef = useModalFokus<HTMLDivElement>(() => setOffen(false), offen);
  const [bestaetigung, setBestaetigung] = useState("");
  const [loeschFehler, setLoeschFehler] = useState<string | null>(null);
  const darfLoeschen = bestaetigung.trim().toUpperCase() === "LÖSCHEN";

  async function passwortAendern(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    setPwLaeuft(true);
    // Regeln, Bestaetigung des aktuellen Passworts und die Aenderung selbst
    // liegen in lib/passwortWechsel.ts — dieselbe Logik wie in den
    // Vermieter-Einstellungen.
    const erg = await wechslePasswort(supabase, {
      email, aktuell: pw0, neu: pw1, wiederholung: pw2, istGoogle,
    });
    setPwLaeuft(false);
    if (!erg.ok) {
      setPwStatus({ art: "fehler", text: erg.fehler });
      return;
    }
    setPw0("");
    setPw1("");
    setPw2("");
    setPwStatus({ art: "ok", text: "Passwort geändert." });
  }

  const feld: React.CSSProperties = {
    width: "100%", padding: "9px 11px", borderRadius: 8,
    border: "1px solid var(--line2)", background: "var(--bg3)", color: "var(--text)", fontSize: 13.5,
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="section" style={{ margin: 0 }}>
        <div className="section-header">
          <h3><ShieldCheck size={15} style={{ verticalAlign: "-2px" }} /> Mein Zugang</h3>
        </div>
        <div className="section-body" style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Angemeldet als <strong style={{ color: "var(--text)" }}>{email}</strong> ·{" "}
          {rolle === "mieter" ? "Mieter-Konto" : "Service-Konto"}
        </div>
      </div>

      {/* Passwort */}
      <div className="section" style={{ margin: 0 }}>
        <div className="section-header">
          <h3><KeyRound size={15} style={{ verticalAlign: "-2px" }} /> Passwort ändern</h3>
        </div>
        <div className="section-body">
          <form onSubmit={passwortAendern} style={{ display: "grid", gap: 12, maxWidth: 380 }}>
            {!istGoogle && (
              <label style={{ display: "grid", gap: 5, fontSize: 12.5 }}>
                <span>Aktuelles Passwort</span>
                <input type="password" style={feld} value={pw0} onChange={(e) => setPw0(e.target.value)} autoComplete="current-password" />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Zur Bestätigung — damit niemand über eine offene Sitzung dein Passwort ändern kann.
                </span>
              </label>
            )}
            <label style={{ display: "grid", gap: 5, fontSize: 12.5 }}>
              <span>Neues Passwort</span>
              <input type="password" style={feld} value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 12.5 }}>
              <span>Passwort wiederholen</span>
              <input type="password" style={feld} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </label>
            {pwStatus && (
              <p style={{ margin: 0, fontSize: 12.5, color: pwStatus.art === "ok" ? "var(--green)" : "var(--red)" }}>
                {pwStatus.text}
              </p>
            )}
            <div>
              <button type="submit" className="btn btn-gold" disabled={pwLaeuft} style={{ fontSize: 13 }}>
                {pwLaeuft ? "Wird geändert …" : "Passwort ändern"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Datenexport — Art. 15 + 20 DSGVO */}
      <div className="section" style={{ margin: 0 }}>
        <div className="section-header">
          <h3><Download size={15} style={{ verticalAlign: "-2px" }} /> Meine Daten exportieren</h3>
        </div>
        <div className="section-body">
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, lineHeight: 1.6 }}>
            Alle Daten, die zu deinem Konto gehören, als ZIP mit CSV-Dateien — Auskunft und
            Datenübertragbarkeit nach Art. 15 und 20 DSGVO.
          </p>
          <a href="/api/export/alles" className="btn btn-gold" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> Daten herunterladen
          </a>
        </div>
      </div>

      {/* Rechtliches */}
      <div className="section" style={{ margin: 0 }}>
        <div className="section-header"><h3>Rechtliches</h3></div>
        <div className="section-body" style={{ fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutz</Link>
          <Link href="/agb" style={{ color: "var(--gold)" }}>AGB</Link>
          <Link href="/impressum" style={{ color: "var(--gold)" }}>Impressum</Link>
        </div>
      </div>

      {/* Konto löschen — Art. 17 DSGVO */}
      <div className="section" style={{ margin: 0, borderColor: "var(--line2)" }}>
        <div className="section-header">
          <h3 style={{ color: "var(--red)" }}><Trash2 size={15} style={{ verticalAlign: "-2px" }} /> Konto löschen</h3>
        </div>
        <div className="section-body">
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, lineHeight: 1.6 }}>
            Löscht deinen Zugang unwiderruflich. {rolle === "mieter"
              ? "Dein Mietverhältnis bleibt davon unberührt — die Daten dazu führt dein Vermieter, er ist dafür verantwortlich. Deine Anliegen und gemeldeten Zählerstände bleiben in seiner Verwaltung stehen, verlieren aber die Verknüpfung zu deinem Zugang."
              : "Deine Aufträge bleiben beim jeweiligen Auftraggeber — er braucht sie als Nachweis zu seinen Kostenbuchungen. Sie verlieren die Verknüpfung zu deinem Zugang und tragen danach nur noch deinen Firmennamen."}
          </p>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: "var(--red)" }} onClick={() => setOffen(true)}>
            Konto löschen
          </button>
        </div>
      </div>

      {/* Per Portal an <body>: nur so kann useModalFokus den Rest der Seite
          fuer Screenreader stummschalten — ein Dialog INNERHALB des Inhalts
          laesst sich nicht von ihm trennen. */}
      {offen && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setOffen(false)}>
          <div
            ref={loeschRef}
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Konto löschen"
            tabIndex={-1}
            style={{ textAlign: "left" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 8, color: "var(--red)" }}>
                <Trash2 size={18} /> Konto löschen
              </h2>
              <button type="button" className="icon-btn" onClick={() => setOffen(false)} title="Schließen" aria-label="Dialog schließen">
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
              Das lässt sich nicht rückgängig machen. Exportiere vorher bei Bedarf deine Daten.
            </p>
            <form
              action={async () => {
                setLoeschFehler(null);
                const res = await deleteAccount();
                if (res && res.ok === false) setLoeschFehler(res.fehler);
              }}
            >
              <label style={{ display: "grid", gap: 5, fontSize: 12.5, marginBottom: 14 }}>
                <span>Zum Bestätigen <strong>LÖSCHEN</strong> eingeben</span>
                <input style={feld} value={bestaetigung} onChange={(e) => setBestaetigung(e.target.value)} placeholder="LÖSCHEN" autoFocus />
              </label>
              {loeschFehler && (
                <p role="alert" style={{ fontSize: 13, color: "var(--red)", lineHeight: 1.6, marginBottom: 14 }}>{loeschFehler}</p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setOffen(false)}>Abbrechen</button>
                <button
                  type="submit"
                  disabled={!darfLoeschen}
                  className="btn"
                  style={{ background: "var(--red)", color: "#fff", opacity: darfLoeschen ? 1 : 0.4, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Check size={15} /> Endgültig löschen
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
