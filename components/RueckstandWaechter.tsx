// Rückstands-Wächter (Server-Komponente): zeigt offene Miet-Monate der
// letzten 12 Monate mit Ein-Klick-Sprung zur vorausgefüllten
// Zahlungserinnerung bzw. Mahnung. Rendert nichts, wenn alles bezahlt ist.
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import AufklappSection from "@/components/AufklappSection";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
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
  const summe = offene.reduce((s, o) => s + o.gesamt, 0);

  return (
    <AufklappSection
      titel={<span style={{ color: "var(--red)" }}><TriangleAlert size={15} style={{ verticalAlign: "-2px" }} /> Offene Mieten</span>}
      untertitel={`${offene.length} Monat${offene.length === 1 ? "" : "e"} überfällig · ${euro(summe)}`}
    >
      <div>
        {offene.map((o) => {
          const grund = `Es handelt sich um die Miete für ${monatLabel(o.jahrMonat)} (fällig am 3. des Monats, § 556b BGB).`;
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
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
          Basis: bestätigte Miet-Eingänge im Mietkonto. Zahlung schon erhalten? Dann unten im Monat bestätigen.
        </p>
      </div>
    </AufklappSection>
  );
}
