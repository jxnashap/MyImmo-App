// Die Service-Portal-Oberfläche — EINE Darstellung für /service und die
// Ansicht des Vermieters (01.10.2026, Muster: PortalAnsicht.tsx).
//
// `vorschau`: Formulare lassen sich ausfüllen und Auswahllisten durchsehen,
// abgeschickt wird nichts (AuftraegePortal mit `vorschau`). Gilt für die
// Ansicht beim Vermieter UND für das Demo-Hausmeisterkonto — der Besucher
// soll sehen, was es gibt, ohne dass die Schreibsperre ihn mit Fehlern
// empfängt.
import Link from "next/link";
import { Wrench } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AuftraegePortal from "@/components/AuftraegePortal";
import GesehenMelden from "@/components/GesehenMelden";
import { datum } from "@/lib/format";
import type { ServicePortalDaten } from "@/lib/servicePortalDaten";

export default function ServicePortalAnsicht({
  daten,
  kopfzeile,
  vorschau = false,
  ansichtImVermieterKonto = false,
}: {
  daten: ServicePortalDaten;
  kopfzeile: string | null | undefined;
  vorschau?: boolean;
  /** Konto/Abmelden nur andeuten — dort wäre es das Konto des VERMIETERS. */
  ansichtImVermieterKonto?: boolean;
}) {
  const { zugaenge, auftraege, firmen, auftraggeber, objekte, seitJe } = daten;
  return (
    <div
      style={{ minHeight: ansichtImVermieterKonto ? undefined : "100vh", background: "var(--bg)", color: "var(--text)" }}
      {...(vorschau ? { "data-demo-erlaubt": "" } : {})}
    >
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          padding: "12px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg2)",
        }}
      >
        <div className="sidebar-logo" style={{ padding: 0, borderBottom: "none" }}>
          <h1>My<span>Immo</span></h1>
          <p>Service-Portal</p>
        </div>
        {ansichtImVermieterKonto ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} aria-hidden="true">
            <span className="btn btn-ghost" style={{ fontSize: 12, opacity: .6, pointerEvents: "none" }}>Konto</span>
            <span className="btn btn-ghost" style={{ fontSize: 12, opacity: .6, pointerEvents: "none" }}>Abmelden</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle variant="icon" />
            <Link href="/konto" className="btn btn-ghost" style={{ fontSize: 12 }} title="Passwort, Datenexport, Konto löschen">
              Konto
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }} data-demo-erlaubt="">Abmelden</button>
            </form>
          </div>
        )}
      </div>

      <main className={ansichtImVermieterKonto ? undefined : "fade-up"} style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 40px" }}>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Aufträge</div>
            <div className="topbar-sub" style={{ overflowWrap: "anywhere" }}>{kopfzeile}</div>
          </div>
        </div>

        {zugaenge.length === 0 ? (
          <div className="section">
            <div className="section-body" style={{ textAlign: "center", padding: "36px 20px" }}>
              <Wrench size={36} color="var(--faint)" />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Noch kein Vermieter verknüpft</p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                Bitte frage den Vermieter nach einem Service-Einladungscode — die Verknüpfung
                passiert automatisch bei der Registrierung mit dem Code.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
              Verknüpft mit {zugaenge.length === 1
                ? `1 Auftraggeber (seit ${datum(zugaenge[0].created_at)})`
                : `${zugaenge.length} Auftraggebern`} — neue Aufträge erscheinen automatisch.
            </p>
            <AuftraegePortal auftraege={auftraege} firmen={firmen} auftraggeber={auftraggeber} objekte={objekte} seitJe={seitJe} vorschau={vorschau} />
            {!vorschau && !ansichtImVermieterKonto && <GesehenMelden />}
          </>
        )}
      </main>
    </div>
  );
}
