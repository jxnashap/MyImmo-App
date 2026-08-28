// Rückstands-Wächter (Server-Komponente): zeigt offene Miet-Monate der
// letzten 12 Monate mit Ein-Klick-Sprung zur vorausgefüllten
// Zahlungserinnerung bzw. Mahnung. Rendert nichts, wenn alles bezahlt ist.
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import AufklappSection from "@/components/AufklappSection";
import { createClient } from "@/lib/supabase/server";
import { euro, datum as deDatum } from "@/lib/format";
import { offeneMieten, monatLabel, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";

type MieterRow = MietkontoMieter & { id: string; vorname: string | null; nachname: string | null; prop_id: string | null };

export default async function RueckstandWaechter() {
  const supabase = createClient();
  const [{ data: mieterRows }, { data: zrRows }, { data: einnRows }] = await Promise.all([
    supabase
      .from("mieter")
      .select("id,vorname,nachname,prop_id,mietbeginn,mietende,kaltmiete,nk_vorauszahlung,stellplatz_miete"),
    supabase.from("miet_zeitraeume").select("mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete"),
    supabase.from("einnahmen").select("mieter_id,buchungsdatum,kategorie,soll_monat").eq("kategorie", "Miete"),
  ]);

  const offene = ((mieterRows ?? []) as MieterRow[]).flatMap((m) => {
    const zeitraeume = ((zrRows ?? []) as (MietkontoZeitraum & { mieter_id: string })[]).filter(
      (z) => z.mieter_id === m.id,
    );
    const einnahmen = (einnRows ?? []).filter((e) => e.mieter_id === m.id);
    return offeneMieten(m, zeitraeume, einnahmen).map((o) => ({
      ...o,
      mieterId: m.id,
      mieterName: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    }));
  });

  if (offene.length === 0) return null;
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
  const summeAktuell = aktuell.reduce((s, o) => s + o.gesamt, 0);
  const summeAlt = alt.reduce((s, o) => s + o.gesamt, 0);
  const alarm = aktuell.length > 0;

  const untertitel = alarm
    ? `${aktuell.length} Monat${aktuell.length === 1 ? "" : "e"} überfällig · ${euro(summeAktuell)}` +
      (alt.length > 0 ? ` · dazu ${alt.length} ältere ohne Bestätigung` : "")
    : `${alt.length} ältere${alt.length === 1 ? "r" : ""} Monat${alt.length === 1 ? "" : "e"} nie bestätigt · ${euro(summeAlt)}`;

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
          // Faellig ist der DRITTE WERKTAG (§ 556b BGB) — genau danach rechnet
          // auch `offeneMieten()`. Der pauschale „3. des Monats" im Mahntext
          // wich davon ab und nannte dem Mieter ein falsches Datum.
          const grund = `Es handelt sich um die Miete für ${monatLabel(o.jahrMonat)} (fällig am ${deDatum(o.faelligSeit)}, drittem Werktag des Monats, § 556b BGB).`;
          const zahlbarBis = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          const q = (art: string) =>
            `/tenants/${o.mieterId}/dokument?art=${art}&betrag=${o.gesamt}&datum=${zahlbarBis}&grund=${encodeURIComponent(grund)}`;
          return (
            <div
              key={`${o.mieterId}-${o.jahrMonat}`}
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}
            >
              <Link href={`/tenants/${o.mieterId}`} style={{ fontWeight: 600, color: "var(--text)" }}>{o.mieterName}</Link>
              <span style={{ color: "var(--muted)" }}>{monatLabel(o.jahrMonat)}</span>
              <span style={{ color: "var(--red)", fontWeight: 600 }}>{euro(o.gesamt)}</span>
              <span className={`badge ${o.tageOffen > 14 ? "badge-red" : "badge-amber"}`}>
                {o.tageOffen === 0 ? "heute fällig" : `${o.tageOffen} Tag${o.tageOffen === 1 ? "" : "e"} überfällig`}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Link href={q("zahlungserinnerung")} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Zahlungserinnerung</Link>
                <Link href={q("mahnung")} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)" }}>Mahnung</Link>
              </span>
            </div>
          );
        })}

        {alt.length > 0 && (
          <div style={{ marginTop: alarm ? 14 : 0, paddingTop: alarm ? 12 : 0, borderTop: alarm ? "1px solid var(--line)" : undefined }}>
            {alarm && (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.55 }}>
                <strong>Ältere Monate ohne Bestätigung</strong> ({euro(summeAlt)}) — meist aus einem
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
                <span style={{ fontWeight: 600 }}>{euro(o.gesamt)}</span>
                <span className="badge">nicht bestätigt</span>
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
