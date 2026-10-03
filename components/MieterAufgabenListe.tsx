// Mieter-Startseite „Was muss ich erledigen?“ (02.10.2026). Server-Komponente; die
// Entscheidung, was hier steht, liegt in lib/mieterAufgaben.ts.
import Link from "next/link";
import { mitVorgang } from "@/lib/anliegenListe";
import { CheckCircle2, CircleAlert, ChevronRight } from "lucide-react";
import type { MieterAufgabe } from "@/lib/mieterAufgaben";

export default function MieterAufgabenListe({
  aufgaben,
  hrefFuer,
}: {
  aufgaben: MieterAufgabe[];
  hrefFuer: (tab: MieterAufgabe["tab"]) => string;
}) {
  return (
    <div className="section">
      <div className="section-header">
        <h3>Zu erledigen</h3>
        {aufgaben.length > 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>{aufgaben.length}</span>}
      </div>
      <div className="section-body">
        {aufgaben.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            <CheckCircle2 size={14} color="var(--green)" style={{ verticalAlign: "-2px" }} /> Gerade ist nichts zu tun.
            Neue Dokumente, Terminvorschläge und Anfragen deines Vermieters erscheinen hier.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {aufgaben.map((a) => (
              <li key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <Link href={a.vorgang ? mitVorgang(hrefFuer(a.tab), a.vorgang) : hrefFuer(a.tab)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", textDecoration: "none", color: "inherit" }}>
                  {a.dringend
                    ? <CircleAlert size={15} color="var(--gold)" style={{ flexShrink: 0 }} />
                    : <ChevronRight size={15} color="var(--muted)" style={{ flexShrink: 0 }} />}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{a.titel}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{a.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
