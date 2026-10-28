"use client";

// Mieterportal-Bereich "Dokumente": häufige Dokumente per Klick anfordern
// (läuft über das Anliegen-System, typ = dokument) + Status der Anfragen.
// Seit 21.10.2026 öffnet eine Anfrage die Detailansicht im Reiter Anliegen (dort steht der
// Verlauf) — vorher stand derselbe Verlauf hier ein zweites Mal.
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, FileCheck2, ReceiptText, FileQuestion, ClipboardCheck, Zap, BadgeEuro, ChevronRight, type LucideIcon } from "lucide-react";
import { erstelleAnliegen } from "@/lib/actions/anliegen";
import type { AnliegenRow } from "@/components/AnliegenPortal";
import VorschauHinweis from "@/components/VorschauHinweis";
import { gesendetText, mitVorgang } from "@/lib/anliegenListe";

const VORLAGEN: { titel: string; hinweis: string; icon: LucideIcon }[] = [
  { titel: "Mietbescheinigung", hinweis: "z. B. für Amt, Bank oder neuen Vermieter", icon: FileCheck2 },
  { titel: "Wohnungsgeberbestätigung", hinweis: "für die Anmeldung beim Einwohnermeldeamt", icon: ClipboardCheck },
  { titel: "Mietquittung", hinweis: "Quittung über gezahlte Miete", icon: BadgeEuro },
  { titel: "Energieausweis", hinweis: "Energieausweis der Wohnung / des Gebäudes", icon: Zap },
  { titel: "Kopie des Mietvertrags", hinweis: "aktueller Vertrag inkl. Nachträge", icon: FileText },
  { titel: "Aktuelle Nebenkostenabrechnung", hinweis: "letzte Nebenkostenabrechnung als PDF", icon: ReceiptText },
  { titel: "Sonstiges Dokument", hinweis: "im nächsten Schritt kurz beschreiben", icon: FileQuestion },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Angefragt", cls: "badge-amber" },
  in_arbeit: { label: "In Arbeit", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
};

export default function DokumenteAnfrage({
  anfragen,
  nurLesen = false,
  anliegenHref,
  mailHinweis = false,
}: {
  anfragen: AnliegenRow[];
  nurLesen?: boolean;
  /** Liste im Reiter Anliegen — eine Anfrage öffnet dort ihre Detailansicht. */
  anliegenHref: string;
  mailHinweis?: boolean;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);
  const [pending, startTransition] = useTransition();
  // Schritt 2 erscheint unter den sieben Kacheln — am Handy rund 375 px unter dem Bildschirm, ohne
  // dass man es merkte (Durchsicht 27.10.2026). Nach der Wahl dorthin rollen.
  const schritt2 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gewaehlt) return;
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    schritt2.current?.scrollIntoView({ block: "nearest", behavior: ruhig ? "auto" : "smooth" });
  }, [gewaehlt]);

  const anfordern = () =>
    startTransition(async () => {
      if (!gewaehlt) return;
      setFehler(null);
      const fd = new FormData();
      fd.set("typ", "dokument");
      fd.set("titel", gewaehlt);
      fd.set("beschreibung", notiz);
      // In `try`: Bricht die Verbindung ab, bliebe sonst nur die Fehlerseite (lib/fehlerText.ts).
      try {
        const r = await erstelleAnliegen(fd);
        if (r?.error) setFehler(r.error);
        else {
          setGewaehlt(null);
          setNotiz("");
          setGesendet(true);
        }
      } catch {
        setFehler("Senden hat nicht geklappt — bitte noch einmal versuchen.");
      }
    });

  return (
    <>
      <div className="section">
        <div className="section-header">
          <h3>Dokument anfordern</h3>
          {nurLesen && <VorschauHinweis was="Anfrage per Klick" />}
        </div>
        <div className="section-body">
          <div className="grid-2" style={{ gap: 10 }}>
            {VORLAGEN.map((v) => {
              const Icon = v.icon;
              const aktiv = gewaehlt === v.titel;
              return (
                <button
                  key={v.titel}
                  type="button"
                  disabled={nurLesen}
                  onClick={() => { setGewaehlt(aktiv ? null : v.titel); setGesendet(false); }}
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
          {gesendet && (
            <p role="status" style={{ fontSize: 12.5, color: "var(--green)", margin: "12px 0 0" }}>{gesendetText(mailHinweis)}</p>
          )}
          {gewaehlt && !nurLesen && (
            <div ref={schritt2} style={{ marginTop: 14, display: "grid", gap: 10, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)", scrollMarginBottom: 24 }}>
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
              {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button data-demo-sperre
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
            <div className="listen">
              {anfragen.map((a) => {
                const s = STATUS_META[a.status] ?? STATUS_META.offen;
                return (
                  <Link key={a.id} href={mitVorgang(anliegenHref, a.id)} className="listen-zeile">
                    <FileText size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="listen-zeile-titel">{a.titel}</span>
                      <span className="listen-zeile-sub">
                        Angefragt am {new Date(a.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                      </span>
                    </span>
                    <span className={`badge ${s.cls}`} style={{ flexShrink: 0 }}>{s.label}</span>
                    <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
