// Prüfpflichten-Check je Objekt (Server-Komponente): gleicht den
// Prüfpflichten-Katalog (lib/termine.ts) mit den aktiven wiederkehrenden
// Terminen dieses Objekts ab. Fehlende Pflichten lassen sich per Klick als
// wiederkehrender Termin anlegen; aktive zeigen die nächste Fälligkeit und
// eine Brücke „Auftrag" ins Service-Portal (Handwerker/Hausmeister).
import Link from "next/link";
import { Plus, Wrench, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PRUEF_KATALOG, WIEDERKEHRUNG_LABEL } from "@/lib/termine";
import { createVorlageTermin } from "@/lib/actions/termine";
import { datum as deDatum } from "@/lib/format";
import AufklappSection from "@/components/AufklappSection";

export default async function PruefpflichtenKarte({ propId, objektName }: { propId: string; objektName: string }) {
  const supabase = createClient();
  const { data: termine } = await supabase
    .from("termine")
    .select("id,titel,datum,erledigt")
    .eq("prop_id", propId)
    .or("erledigt.is.null,erledigt.eq.false");

  const aktive = new Map<string, string>(); // titel -> nächstes datum
  for (const t of termine ?? []) {
    const alt = aktive.get(t.titel);
    if (!alt || (t.datum && t.datum < alt)) aktive.set(t.titel, t.datum);
  }

  const kernOffen = PRUEF_KATALOG.filter((v) => v.kern && !aktive.has(v.titel)).length;

  return (
    <AufklappSection
      titel={<><ShieldCheck size={15} style={{ verticalAlign: "-2px" }} /> Prüfpflichten &amp; Wartung</>}
      untertitel={kernOffen > 0
        ? `${kernOffen} übliche Prüfpflicht${kernOffen > 1 ? "en" : ""} ohne Termin — aufklappen zum Anlegen`
        : "Wiederkehrende Prüf-/Wartungstermine dieses Objekts (Angaben ohne Gewähr)"}
      standardOffen={false}
    >
      <div style={{ fontSize: 12 }}>
        {PRUEF_KATALOG.map((v) => {
          const naechstes = aktive.get(v.titel);
          return (
            <div key={v.titel} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: naechstes ? "var(--green)" : v.kern ? "var(--amber)" : "var(--line2)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>
                  {v.titel}
                  <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>{WIEDERKEHRUNG_LABEL[v.wiederkehrung]}</span>
                </div>
                <div style={{ color: "var(--faint)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.notiz}>
                  {v.relevanz ? `Nur relevant: ${v.relevanz}` : v.notiz}
                </div>
              </div>
              {naechstes ? (
                <>
                  <span className="badge badge-green" style={{ flexShrink: 0 }}>nächste: {deDatum(naechstes)}</span>
                  <Link
                    href={`/anliegen?tab=service&titel=${encodeURIComponent(v.titel)}&text=${encodeURIComponent(`${objektName}: ${v.notiz}`)}`}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "3px 9px", flexShrink: 0 }}
                    title="Auftrag an Handwerker/Hausmeister erstellen"
                  >
                    <Wrench size={12} style={{ verticalAlign: "-2px" }} /> Auftrag
                  </Link>
                </>
              ) : (
                <form action={createVorlageTermin.bind(null, v.titel, v.wiederkehrung, v.kategorie, v.notiz, propId)} style={{ flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 9px" }} title={`${v.notiz} · ${WIEDERKEHRUNG_LABEL[v.wiederkehrung]}`}>
                    <Plus size={12} style={{ verticalAlign: "-2px" }} /> Termin anlegen
                  </button>
                </form>
              )}
            </div>
          );
        })}
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10, marginBottom: 0 }}>
          Neuer Termin startet in 30 Tagen und wiederholt sich automatisch (beim Abhaken wird die
          nächste Fälligkeit angelegt). Datum danach im <Link href="/termine" style={{ color: "var(--gold)" }}>Kalender</Link> anpassen.
          Welche Pflichten zutreffen, hängt von Ausstattung und Landesrecht ab — keine Rechtsberatung.
        </p>
      </div>
    </AufklappSection>
  );
}
