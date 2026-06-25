import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { mieterFristen } from "@/lib/fristen";
import { createTermin, deleteTermin } from "@/lib/actions/termine";
import DeleteButton from "@/components/DeleteButton";
import YearSelect from "@/components/YearSelect";
import ExpandableList from "@/components/ExpandableList";
import type { Termin, Property, Tenant, Kredit } from "@/lib/types";

type Eintrag = {
  datum: string;
  label: string;
  wer: string;
  wo: string;
  quelle: "mieter" | "kredit" | "eigen";
  typ: "info" | "warn" | "ok";
  id?: string;
};

const QUELLE_BADGE: Record<Eintrag["quelle"], string> = {
  mieter: "badge-teal",
  kredit: "badge-gold",
  eigen: "badge-green",
};
const QUELLE_LABEL: Record<Eintrag["quelle"], string> = {
  mieter: "Mieter",
  kredit: "Finanzierung",
  eigen: "Eigen",
};

export default async function TerminePage({ searchParams }: { searchParams: { quelle?: string; jahr?: string } }) {
  const supabase = createClient();
  const [{ data: term }, { data: props }, { data: miet }, { data: kred }] = await Promise.all([
    supabase.from("termine").select("*").order("datum"),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung"),
    supabase.from("kredite").select("id,prop_id,bezeichnung,zinsbindung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const termine = (term ?? []) as Termin[];
  const mieter = (miet ?? []) as Tenant[];
  const kredite = (kred ?? []) as Kredit[];

  const eintraege: Eintrag[] = [];

  for (const m of mieter) {
    const wo = `${(m.prop_id && nameOf.get(m.prop_id)) || "–"}${m.einheit ? " · " + m.einheit : ""}`;
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    for (const f of mieterFristen(m)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer, wo, quelle: "mieter", typ: f.typ });
    }
  }
  for (const k of kredite) {
    if (!k.zinsbindung) continue;
    eintraege.push({ datum: k.zinsbindung, label: "Zinsbindung endet", wer: k.bezeichnung ?? "Darlehen", wo: (k.prop_id && nameOf.get(k.prop_id)) || "–", quelle: "kredit", typ: "warn" });
  }
  for (const t of termine) {
    if (!t.datum) continue;
    eintraege.push({ datum: t.datum, label: t.titel ?? "Termin", wer: t.notiz ?? "", wo: (t.prop_id && nameOf.get(t.prop_id)) || "", quelle: "eigen", typ: "info", id: t.id });
  }

  eintraege.sort((a, b) => a.datum.localeCompare(b.datum));

  const filterQ = searchParams.quelle;
  let sichtbar = filterQ ? eintraege.filter((e) => e.quelle === filterQ) : eintraege;

  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const jahre = Array.from(
    new Set([...eintraege.map((e) => new Date(e.datum).getFullYear()), aktuellesJahr])
  ).sort((a, b) => b - a);
  if (jahr !== "alle") sichtbar = sichtbar.filter((e) => new Date(e.datum).getFullYear() === Number(jahr));

  const heute = new Date();
  const tageBis = (d: string) => Math.ceil((new Date(d).getTime() - heute.getTime()) / 86400000);
  const anstehend = eintraege.filter((e) => tageBis(e.datum) >= 0);
  const in30 = anstehend.filter((e) => tageBis(e.datum) <= 30).length;
  const in90 = anstehend.filter((e) => tageBis(e.datum) <= 90).length;
  const ueberfaellig = eintraege.filter((e) => tageBis(e.datum) < 0).length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">📅 Termine</div>
          <div className="topbar-sub">Fristen aus Mietern &amp; Krediten plus eigene Termine</div>
        </div>
      </div>

      <div className="grid-4 mb-20">
        <div className="kpi-card"><div className="kpi-label">Anstehend</div><div className="kpi-value">{anstehend.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 30 Tagen</div><div className="kpi-value" style={{ color: in30 > 0 ? "var(--amber)" : "var(--text)" }}>{in30}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 90 Tagen</div><div className="kpi-value">{in90}</div></div>
        <div className="kpi-card"><div className="kpi-label">Überfällig</div><div className="kpi-value" style={{ color: ueberfaellig > 0 ? "var(--red)" : "var(--green)" }}>{ueberfaellig}</div></div>
      </div>

      <div className="section">
        <div className="section-header"><h3>＋ Neuer Termin</h3></div>
        <div className="section-body">
          <form action={createTermin} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Titel</span>
              <input name="titel" required className="input" placeholder="z.B. Heizungswartung" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Datum</span>
              <input name="datum" type="date" required className="input" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Immobilie</span>
              <select name="prop_id" className="input">
                <option value="">—</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, flex: 1, minWidth: 160 }}>
              <span style={{ color: "var(--muted)" }}>Notiz</span>
              <input name="notiz" className="input" />
            </label>
            <button className="btn btn-gold">＋ Termin</button>
          </form>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3>Anstehende Termine</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {([["", "Alle"], ["mieter", "Mieter"], ["kredit", "Finanzierung"], ["eigen", "Eigene"]] as const).map(([q, label]) => {
                const active = (filterQ ?? "") === q;
                return (
                  <Link key={q} href={q ? `/termine?quelle=${q}${jahr !== "alle" ? `&jahr=${jahr}` : ""}` : `/termine${jahr !== "alle" ? `?jahr=${jahr}` : ""}`} className={`badge ${active ? "badge-gold" : ""}`} style={{ textDecoration: "none", ...(active ? {} : { color: "var(--muted)", border: "1px solid var(--line)" }) }}>{label}</Link>
                );
              })}
            </div>
            <YearSelect years={jahre} current={jahr} params={searchParams} />
          </div>
        </div>
        <div className="section-body">
          {sichtbar.length === 0 ? (
            <div className="empty"><div className="empty-icon">📅</div><p>Keine Termine</p></div>
          ) : (
            <ExpandableList limit={10} label="weitere Termine">
            {sichtbar.map((e, i) => {
              const tage = tageBis(e.datum);
              const farbe = e.typ === "warn" || tage < 0 ? "var(--red)" : e.typ === "ok" ? "var(--green)" : "var(--muted)";
              return (
                <div key={`${e.quelle}-${e.id ?? i}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: farbe, flexShrink: 0 }} />
                  <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: "var(--muted)" }}>{datum(e.datum)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{e.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{[e.wer, e.wo].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span style={{ fontSize: 11, color: farbe, width: 90, textAlign: "right", flexShrink: 0 }}>{tage < 0 ? `vor ${Math.abs(tage)} Tg.` : tage === 0 ? "heute" : `in ${tage} Tg.`}</span>
                  <span className={`badge ${QUELLE_BADGE[e.quelle]}`}>{QUELLE_LABEL[e.quelle]}</span>
                  {e.quelle === "eigen" && e.id ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Link href={`/termine/${e.id}/edit`} className="delete-btn" title="Termin bearbeiten" style={{ color: "var(--muted)" }}>✎</Link>
                      <DeleteButton action={deleteTermin.bind(null, e.id)} className="delete-btn" label="✕" confirmText="Termin löschen?" />
                    </span>
                  ) : (
                    <span style={{ width: 22 }} />
                  )}
                </div>
              );
            })}
            </ExpandableList>
          )}
        </div>
      </div>
    </div>
  );
}
