// Start-Checkliste (21.10.2026) — die EINE Führung für neue Vermieter (lib/startCheckliste.ts).
// Leeres Konto: als ganze Seite. Objekt da, Mieter fehlt: als kompakte Karte über dem Dashboard,
// nur mit den offenen Schritten. Server-Komponente, kein Zustand.
import Link from "next/link";
import type { StartSchritt } from "@/lib/startCheckliste";

export default function StartCheckliste({ schritte, kompakt = false }: { schritte: StartSchritt[]; kompakt?: boolean }) {
  if (kompakt) {
    const offen = schritte.filter((s) => !s.erledigt);
    return (
      <div className="section mb-20">
        <div className="section-header">
          <h3>Für den Start noch offen</h3>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{schritte.length - offen.length} von {schritte.length} erledigt</span>
        </div>
        <div className="section-body listen" style={{ paddingTop: 0 }}>
          {offen.map((s) => (
            <Link key={s.key} href={s.href} className="listen-zeile">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="listen-zeile-titel">{s.titel}</span>
                <span className="listen-zeile-sub">{s.freiwillig ? "freiwillig" : "nötig, damit die App rechnet"}</span>
              </span>
              <span className={`badge ${s.freiwillig ? "badge-neutral" : "badge-gold"}`} style={{ flexShrink: 0 }}>{s.cta}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {schritte.map((s, i) => (
        <div key={s.key} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            {/* --gold ist die TEXT-Stufe (hell oliv) — als Fläche mit dunkler
                Schrift darauf war der Kreis kontrastschwach. --gold-fill ist
                die Flächenstufe. */}
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: s.erledigt ? "var(--green)" : s.freiwillig ? "var(--bg3)" : "var(--gold-fill)", border: s.freiwillig && !s.erledigt ? "1px solid var(--line2)" : "none", color: s.erledigt ? "#fff" : s.freiwillig ? "var(--muted)" : "var(--btn-gold-text)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>
              {s.erledigt ? "✓" : i + 1}
            </div>
            {i < schritte.length - 1 && <div style={{ flex: 1, width: 2, background: "var(--line2)", marginTop: 4 }} />}
          </div>
          <div className="section" style={{ flex: 1, marginBottom: i < schritte.length - 1 ? 14 : 0 }}>
            <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {s.titel}
                  {s.freiwillig && <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--muted)" }}> · freiwillig</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.text}</div>
              </div>
              <Link href={s.href} className={`btn ${i === 0 && !s.erledigt ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12.5, flexShrink: 0 }}>{s.cta}</Link>
            </div>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 16 }}>
        Einen Überblick über alle Bereiche gibt die Einführungs-Tour — Einstellungen → „Daten &amp; Recht“.
      </p>
    </div>
  );
}
