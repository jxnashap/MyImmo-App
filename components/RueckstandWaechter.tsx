// Rückstands-Wächter (Server-Komponente): zeigt offene Miet-Monate der
// letzten 12 Monate mit Ein-Klick-Sprung zur vorausgefüllten
// Zahlungserinnerung bzw. Mahnung. Rendert nichts, wenn alles bezahlt ist.
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import AufklappSection from "@/components/AufklappSection";
import { createClient } from "@/lib/supabase/server";
import { eur2 } from "@/lib/format";
import { zahlungsBriefUrl, mahnungMoeglich, ERINNERUNG_TITEL_PRAEFIX } from "@/lib/mahnung";
import { heuteBerlin } from "@/lib/zeitraum";
import { offeneMieten, monatLabel, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";

type MieterRow = MietkontoMieter & { id: string; vorname: string | null; nachname: string | null; prop_id: string | null };

export default async function RueckstandWaechter() {
  const supabase = await createClient();
  const [{ data: mieterRows }, { data: zrRows }, { data: einnRows }, { data: erinnRows }] = await Promise.all([
    supabase
      .from("mieter")
      .select("id,vorname,nachname,prop_id,mietbeginn,mietende,kaltmiete,nk_vorauszahlung,stellplatz_miete,minderungen"),
    supabase.from("miet_zeitraeume").select("mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete"),
    supabase.from("einnahmen").select("mieter_id,buchungsdatum,kategorie,soll_monat,betrag").eq("kategorie", "Miete"),
    // Archivierte Zahlungserinnerungen — erst danach wird die Mahnung angeboten (B10).
    supabase.from("notizen").select("mieter_id,created_at").ilike("titel", `${ERINNERUNG_TITEL_PRAEFIX}%`),
  ]);
  const erinnerungen = (erinnRows ?? []) as { mieter_id: string | null; created_at: string }[];

  const offene = ((mieterRows ?? []) as MieterRow[]).flatMap((m) => {
    const zeitraeume = ((zrRows ?? []) as (MietkontoZeitraum & { mieter_id: string })[]).filter(
      (z) => z.mieter_id === m.id,
    );
    const einnahmen = (einnRows ?? []).filter((e) => e.mieter_id === m.id);
    return offeneMieten(m, zeitraeume, einnahmen, heuteBerlin()).map((o) => ({
      ...o,
      mieterId: m.id,
      mieterName: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    }));
  });

  if (offene.length === 0) return null;
  const heuteISO = heuteBerlin();
  offene.sort((a, b) => b.tageOffen - a.tageOffen);

  // Ein neu angelegter Mieter mit Mietbeginn in der Vergangenheit erzeugt
  // sofort bis zu 12 „überfällige" Monate — der Erstnutzer sieht dann eine
  // fünfstellige Rotmeldung, obwohl schlicht noch nichts bestätigt wurde.
  // MyImmo weiß nicht, ob alte Monate bezahlt sind; es weiß nur, dass sie
  // nicht bestätigt sind. Deshalb trennen: Was gerade fällig ist, bleibt der
  // Alarm; alles Ältere ist Nacherfassung und wird sachlich benannt.
  const ALT_AB_TAGEN = 62; // rund zwei Monate
  const aktuell = offene.filter((o) => o.tageOffen <= ALT_AB_TAGEN);
  const alt = offene.filter((o) => o.tageOffen > ALT_AB_TAGEN);
  const summeAktuell = aktuell.reduce((s, o) => s + o.rest, 0);
  const summeAlt = alt.reduce((s, o) => s + o.rest, 0);
  const alarm = aktuell.length > 0;
  // Am Fälligkeitstag selbst ist nichts überfällig (Audit P7, B13): getrennt zählen.
  const ueberfaellig = aktuell.filter((o) => o.tageOffen > 0).length;
  const heuteFaellig = aktuell.length - ueberfaellig;
  const kopf = [
    ueberfaellig > 0 ? `${ueberfaellig} Monat${ueberfaellig === 1 ? "" : "e"} überfällig` : null,
    heuteFaellig > 0 ? `${heuteFaellig} heute fällig` : null,
  ].filter(Boolean).join(" · ");

  const untertitel = alarm
    ? `${kopf} · ${eur2(summeAktuell)}` +
      (alt.length > 0 ? ` · dazu ${alt.length} ältere ohne Bestätigung` : "")
    : `${alt.length} ältere${alt.length === 1 ? "r" : ""} Monat${alt.length === 1 ? "" : "e"} nie bestätigt · ${eur2(summeAlt)}`;

  return (
    <AufklappSection
      titel={
        alarm ? (
          <span style={{ color: "var(--red)" }}><TriangleAlert size={15} style={{ verticalAlign: "-2px" }} /> Offene Mieten</span>
        ) : (
          <span><TriangleAlert size={15} style={{ verticalAlign: "-2px", color: "var(--amber)" }} /> Mieten ohne Bestätigung</span>
        )
      }
      untertitel={untertitel}
    >
      <div>
        {!alarm && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.55 }}>
            Diese Monate sind im Mietkonto nie bestätigt worden — typischerweise, weil das
            Mietverhältnis mit Beginn in der Vergangenheit angelegt wurde.{" "}
            <strong>Das heißt nicht, dass die Miete offen ist.</strong> Bestätige die Monate im
            Mietkonto, dann verschwindet der Hinweis.
          </p>
        )}
        {aktuell.map((o) => {
          // Fällig ist der DRITTE WERKTAG (§ 556b BGB) — Text und Frist baut lib/mahnung.ts,
          // dieselbe Stelle wie die Aufgabe „Mieteingang offen“ auf dem Dashboard.
          const q = (art: "zahlungserinnerung" | "mahnung") =>
            zahlungsBriefUrl({ mieterId: o.mieterId, jahrMonat: o.jahrMonat, betrag: o.rest, heuteISO, art });
          return (
            <div
              key={`${o.mieterId}-${o.jahrMonat}`}
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}
            >
              <Link href={`/tenants/${o.mieterId}`} style={{ fontWeight: 600, color: "var(--text)" }}>{o.mieterName}</Link>
              <span style={{ color: "var(--muted)" }}>{monatLabel(o.jahrMonat)}</span>
              <span style={{ color: "var(--red)", fontWeight: 600 }}>{eur2(o.rest)}</span>
              {o.gezahlt > 0 && <span style={{ color: "var(--muted)", fontSize: 12 }}>Teilzahlung: {eur2(o.gezahlt)} von {eur2(o.gesamt)}</span>}
              <span className={`badge ${o.tageOffen > 14 ? "badge-red" : "badge-amber"}`}>
                {o.tageOffen === 0 ? "heute fällig" : `${o.tageOffen} Tag${o.tageOffen === 1 ? "" : "e"} überfällig`}
              </span>
              {/* Am Fälligkeitstag selbst ist noch nichts versäumt (Verzug ab dem Folgetag) —
                  dieselbe Grenze wie „Erinnerung schreiben“ auf dem Dashboard (mieteUeberfaellig). */}
              {o.tageOffen > 0 && <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Link href={q("zahlungserinnerung")} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Zahlungserinnerung</Link>
                {/* Mahnung erst nach einer archivierten Erinnerung (B10). */}
                {mahnungMoeglich(erinnerungen, o.mieterId, o.faelligSeit) && (
                  <Link href={q("mahnung")} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)" }}>Mahnung</Link>
                )}
              </span>}
            </div>
          );
        })}

        {alt.length > 0 && (
          <div style={{ marginTop: alarm ? 14 : 0, paddingTop: alarm ? 12 : 0, borderTop: alarm ? "1px solid var(--line)" : undefined }}>
            {alarm && (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.55 }}>
                <strong>Ältere Monate ohne Bestätigung</strong> ({eur2(summeAlt)}) — meist aus einem
                rückwirkend angelegten Mietverhältnis. Ob sie bezahlt wurden, weiß MyImmo nicht;
                bestätige sie im Mietkonto, dann verschwinden sie hier.
              </p>
            )}
            {alt.map((o) => (
              <div
                key={`${o.mieterId}-${o.jahrMonat}`}
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}
              >
                <Link href={`/tenants/${o.mieterId}`} style={{ fontWeight: 600, color: "var(--text)" }}>{o.mieterName}</Link>
                <span style={{ color: "var(--muted)" }}>{monatLabel(o.jahrMonat)}</span>
                <span style={{ fontWeight: 600 }}>{eur2(o.rest)}</span>
                <span className="badge">{o.gezahlt > 0 ? `teilweise (${eur2(o.gezahlt)} von ${eur2(o.gesamt)})` : "nicht bestätigt"}</span>
                <span style={{ marginLeft: "auto" }}>
                  <Link href={`/mietkonto?monat=${o.jahrMonat}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                    Im Mietkonto bestätigen
                  </Link>
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
          Basis: bestätigte Miet-Eingänge im Mietkonto. Zahlung schon erhalten? Dann im jeweiligen Monat bestätigen.
        </p>
      </div>
    </AufklappSection>
  );
}
