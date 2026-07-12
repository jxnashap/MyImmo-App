"use client";

// Mieterportal-Bereich "Dokumente": häufige Dokumente per Klick anfordern
// (läuft über das Anliegen-System, typ = dokument) + Status der Anfragen.
import { useState, useTransition } from "react";
import { FileText, FileCheck2, ReceiptText, FileQuestion, ClipboardCheck, Zap, type LucideIcon } from "lucide-react";
import { erstelleAnliegen } from "@/lib/actions/anliegen";
import type { AnliegenRow } from "@/components/AnliegenPortal";

const VORLAGEN: { titel: string; hinweis: string; icon: LucideIcon }[] = [
  { titel: "Mietbescheinigung", hinweis: "z. B. für Amt, Bank oder neuen Vermieter", icon: FileCheck2 },
  { titel: "Wohnungsgeberbestätigung", hinweis: "für die Anmeldung beim Einwohnermeldeamt (§ 19 BMG)", icon: ClipboardCheck },
  { titel: "Energieausweis", hinweis: "Energieausweis der Wohnung / des Gebäudes", icon: Zap },
  { titel: "Kopie des Mietvertrags", hinweis: "aktueller Vertrag inkl. Nachträge", icon: FileText },
  { titel: "Aktuelle Nebenkostenabrechnung", hinweis: "letzte NK-Abrechnung als PDF", icon: ReceiptText },
  { titel: "Sonstiges Dokument", hinweis: "im nächsten Schritt kurz beschreiben", icon: FileQuestion },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Angefragt", cls: "badge-amber" },
  in_arbeit: { label: "In Arbeit", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
};

export default function DokumenteAnfrage({ anfragen }: { anfragen: AnliegenRow[] }) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const anfordern = () =>
    startTransition(async () => {
      if (!gewaehlt) return;
      setFehler(null);
      const fd = new FormData();
      fd.set("typ", "dokument");
      fd.set("titel", gewaehlt);
      fd.set("beschreibung", notiz);
      const r = await erstelleAnliegen(fd);
      if (r?.error) setFehler(r.error);
      else {
        setGewaehlt(null);
        setNotiz("");
      }
    });

  return (
    <>
      <div className="section">
        <div className="section-header"><h3>Dokument anfordern</h3></div>
        <div className="section-body">
          <div className="grid-2" style={{ gap: 10 }}>
            {VORLAGEN.map((v) => {
              const Icon = v.icon;
              const aktiv = gewaehlt === v.titel;
              return (
                <button
                  key={v.titel}
                  type="button"
                  onClick={() => setGewaehlt(aktiv ? null : v.titel)}
                  className="role-tile"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    padding: "12px 14px", borderRadius: 12, border: `1px solid ${aktiv ? "var(--gold)" : "var(--line)"}`,
                    background: "var(--bg3)",
                  }}
                >
                  <span style={{ display: "flex", width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "var(--gold-pale)", color: "var(--gold)", flexShrink: 0 }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{v.titel}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{v.hinweis}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {gewaehlt && (
            <div style={{ marginTop: 14, display: "grid", gap: 10, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 13 }}>
                Anfrage: <strong>{gewaehlt}</strong>
              </div>
              <textarea
                rows={2}
                maxLength={1000}
                className="input"
                placeholder={gewaehlt === "Sonstiges Dokument" ? "Welches Dokument brauchst du? *" : "Anmerkung (optional, z. B. Zeitraum oder Zweck)"}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
              />
              {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={pending || (gewaehlt === "Sonstiges Dokument" && !notiz.trim())}
                  onClick={anfordern}
                >
                  {pending ? "…" : "Anfrage senden"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setGewaehlt(null)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Meine Dokument-Anfragen</h3></div>
        <div className="section-body">
          {anfragen.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>Noch keine Anfragen.</p>
          ) : (
            anfragen.map((a) => {
              const s = STATUS_META[a.status] ?? STATUS_META.offen;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <FileText size={14} color="var(--gold)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.titel}</span>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
                    {new Date(a.created_at).toLocaleDateString("de-DE")}
                  </span>
                  {a.antwort && (
                    <p style={{ flexBasis: "100%", fontSize: 12, margin: 0, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                      {a.antwort}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
