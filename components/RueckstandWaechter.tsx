// Rückstands-Wächter (Server-Komponente): zeigt offene Miet-Monate der
// letzten 12 Monate; „Dokument“ öffnet die Auswahl Zahlungserinnerung oder
// Mahnung (components/BriefWahl.tsx). Rendert nichts, wenn alles bezahlt ist.
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import AufklappSection from "@/components/AufklappSection";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { alleZeilen, nurKonto, vielleichtAlle } from "@/lib/db/auswertung";
import { DatenUnvollstaendig } from "@/lib/db/ladeAlle";
import { eur2 } from "@/lib/format";
import { zahlungsBriefWahl, erinnerungArchiviert, ERINNERUNG_TITEL_PRAEFIX } from "@/lib/mahnung";
import BriefWahl from "@/components/BriefWahl";
import { heuteBerlin } from "@/lib/zeitraum";
import { offeneMieten, monatLabel, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";

type MieterRow = MietkontoMieter & { id: string; vorname: string | null; nachname: string | null; prop_id: string | null };

export default async function RueckstandWaechter() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  if (!user) return null;
  // B08 (11.10.2026): vollständig oder ein Hinweis. Vorher kamen höchstens 1.000 Mietbuchungen (ohne
  // Sortierung — welche, war Zufall): bezahlte Monate erschienen als „überfällig“, und ein Abfragefehler
  // machte JEDEN Monat zum Rückstand.
  const eigen = nurKonto(user.id);
  let mieterRows: MieterRow[], zrRows: (MietkontoZeitraum & { mieter_id: string })[];
  type Miete = { mieter_id: string | null; buchungsdatum: string; kategorie: string; soll_monat: string | null; betrag: number | null };
  let einnRows: Miete[];
  let erinnRows: { mieter_id: string | null; created_at: string }[] | null;
  try {
    [mieterRows, zrRows, einnRows, erinnRows] = await Promise.all([
      alleZeilen<MieterRow>(supabase, "mieter", "id,vorname,nachname,prop_id,mietbeginn,mietende,kaltmiete,nk_vorauszahlung,stellplatz_miete,minderungen", eigen),
      alleZeilen<MietkontoZeitraum & { mieter_id: string }>(supabase, "miet_zeitraeume", "id,mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete", eigen),
      alleZeilen<Miete>(supabase, "einnahmen", "id,mieter_id,buchungsdatum,kategorie,soll_monat,betrag", (q) => eigen(q).eq("kategorie", "Miete")),
      // Archivierte Zahlungserinnerungen — nur für den Hinweis unter „Mahnung“ in der Auswahl.
      vielleichtAlle<{ mieter_id: string | null; created_at: string }>(supabase, "notizen", "id,mieter_id,created_at", (q) => eigen(q).ilike("titel", `${ERINNERUNG_TITEL_PRAEFIX}%`)),
    ]);
  } catch (e) {
    if (!(e instanceof DatenUnvollstaendig)) throw e;
    return (
      <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 14, fontSize: 13 }}>
        <TriangleAlert size={15} style={{ verticalAlign: "-2px", color: "var(--amber)" }} /> Offene Mieten konnten gerade
        nicht vollständig geprüft werden — bitte die Seite neu laden. Ohne vollständige Buchungen zeigen wir keinen
        Rückstand an.
      </div>
    );
  }
  const erinnerungen = erinnRows ?? [];

  const offene = mieterRows.flatMap((m) => {
    const zeitraeume = zrRows.filter((z) => z.mieter_id === m.id);
    const einnahmen = einnRows.filter((e) => e.mieter_id === m.id);
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
          // dieselbe Stelle wie die Aufgabe auf dem Dashboard.
          const wahl = zahlungsBriefWahl({
            mieterId: o.mieterId,
            mieterName: o.mieterName,
            jahrMonat: o.jahrMonat,
            betrag: o.rest,
            heuteISO,
            erinnerungArchiviert: erinnerungArchiviert(erinnerungen, o.mieterId, o.faelligSeit),
          });
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
                  dieselbe Grenze wie „Dokument“ auf dem Dashboard (mieteUeberfaellig). */}
              {o.tageOffen > 0 && <span style={{ marginLeft: "auto" }}>
                <BriefWahl wahl={wahl} />
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
