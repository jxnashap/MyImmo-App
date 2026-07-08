import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { mieterFristen, kreditFristen, globaleFristen, objektFristen } from "@/lib/fristen";
import { createTermin, createVorlageTermin, deleteTermin, toggleErledigt } from "@/lib/actions/termine";
import DeleteButton from "@/components/DeleteButton";
import AufklappForm from "@/components/AufklappForm";
import ExpandableList from "@/components/ExpandableList";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import { KATEGORIE_STIL, TERMIN_KATEGORIEN, WARTUNGS_VORLAGEN, WIEDERKEHRUNG_LABEL } from "@/lib/termine";
import type { Termin, Property, Tenant, Kredit } from "@/lib/types";
import { RotateCw, Pencil, X, CalendarDays, Plus } from "lucide-react";

type Eintrag = {
  datum: string;
  label: string;
  wer: string;
  wo: string;
  quelle: "mieter" | "kredit" | "eigen" | "steuer" | "objekt";
  typ: "info" | "warn" | "ok";
  kategorie: string;
  rechtsgrundlage?: string;
  erledigt?: boolean;
  wiederkehrung?: string | null;
  id?: string;
};

export default async function TerminePage({
  searchParams,
}: {
  searchParams: { quelle?: string; jahr?: string; kategorie?: string; erledigte?: string; ansicht?: string; monat?: string; tag?: string };
}) {
  const supabase = createClient();
  const [{ data: term }, { data: props }, { data: miet }, { data: kred }] = await Promise.all([
    supabase.from("termine").select("*").order("datum"),
    supabase.from("properties").select("id,bezeichnung,typ,energieausweis_datum").order("bezeichnung"),
    supabase.from("mieter").select("id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum"),
    supabase.from("kredite").select("id,prop_id,bezeichnung,zinsbindung,auszahlung_datum"),
  ]);

  const properties = (props ?? []) as (Pick<Property, "id" | "bezeichnung" | "typ"> & { energieausweis_datum: string | null })[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const termine = (term ?? []) as Termin[];
  const mieter = (miet ?? []) as Tenant[];
  const kredite = (kred ?? []) as (Kredit & { auszahlung_datum: string | null })[];
  const mieterName = new Map(mieter.map((m) => [m.id, [m.vorname, m.nachname].filter(Boolean).join(" ")]));

  const eintraege: Eintrag[] = [];

  for (const m of mieter) {
    const wo = `${(m.prop_id && nameOf.get(m.prop_id)) || "–"}${m.einheit ? " · " + m.einheit : ""}`;
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    for (const f of mieterFristen(m)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer, wo, quelle: "mieter", typ: f.typ, kategorie: f.kategorie ?? "Miete", rechtsgrundlage: f.rechtsgrundlage });
    }
  }
  for (const k of kredite) {
    const wo = (k.prop_id && nameOf.get(k.prop_id)) || "–";
    for (const f of kreditFristen(k)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer: k.bezeichnung ?? "Darlehen", wo, quelle: "kredit", typ: f.typ, kategorie: f.kategorie ?? "Finanzierung", rechtsgrundlage: f.rechtsgrundlage });
    }
  }
  for (const p of properties) {
    for (const f of objektFristen(p)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer: "", wo: p.bezeichnung, quelle: "objekt", typ: f.typ, kategorie: f.kategorie ?? "Sonstiges", rechtsgrundlage: f.rechtsgrundlage });
    }
  }
  // Globale Steuer-Fristen (Grundsteuer-Raten, ESt-Erklärung)
  for (const f of globaleFristen()) {
    if (!f.datum) continue;
    eintraege.push({ datum: f.datum, label: f.label, wer: "", wo: "Alle Objekte", quelle: "steuer", typ: f.typ, kategorie: f.kategorie ?? "Steuer", rechtsgrundlage: f.rechtsgrundlage });
  }
  for (const t of termine) {
    if (!t.datum) continue;
    eintraege.push({
      datum: t.datum,
      label: t.titel ?? "Termin",
      wer: [t.mieter_id ? mieterName.get(t.mieter_id) : null, t.notiz].filter(Boolean).join(" · "),
      wo: (t.prop_id && nameOf.get(t.prop_id)) || "",
      quelle: "eigen",
      typ: "info",
      kategorie: t.kategorie ?? "Sonstiges",
      erledigt: t.erledigt ?? false,
      wiederkehrung: t.wiederkehrung,
      id: t.id,
    });
  }

  eintraege.sort((a, b) => a.datum.localeCompare(b.datum));

  // ---- Filter ----
  const zeigeErledigte = searchParams.erledigte === "1";
  const filterQ = searchParams.quelle;
  const filterK = searchParams.kategorie;
  let sichtbar = eintraege;
  if (!zeigeErledigte) sichtbar = sichtbar.filter((e) => !e.erledigt);
  if (filterQ) sichtbar = sichtbar.filter((e) => (filterQ === "auto" ? e.quelle !== "eigen" : e.quelle === filterQ));
  if (filterK) sichtbar = sichtbar.filter((e) => e.kategorie === filterK);

  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const jahre = Array.from(
    new Set([...eintraege.map((e) => new Date(e.datum).getFullYear()), aktuellesJahr])
  ).sort((a, b) => b - a);
  if (jahr !== "alle") sichtbar = sichtbar.filter((e) => new Date(e.datum).getFullYear() === Number(jahr));

  const filters: FilterDef[] = [
    { name: "quelle", label: "Quelle", icon: "quelle", variant: "segmented", options: [{ value: "", label: "Alle" }, { value: "auto", label: "Automatisch" }, { value: "eigen", label: "Eigene" }] },
    { name: "kategorie", label: "Kategorie", icon: "kategorie", options: [{ value: "", label: "Alle Kategorien" }, ...TERMIN_KATEGORIEN.map((k) => ({ value: k, label: `${KATEGORIE_STIL[k]?.icon ?? ""} ${k}` })), { value: "Betriebskosten", label: "Betriebskosten" }] },
    { name: "jahr", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: [...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle Jahre" }] },
  ];

  const heute = new Date();
  const tageBis = (d: string) => Math.ceil((new Date(d).getTime() - heute.getTime()) / 86400000);
  const offen = eintraege.filter((e) => !e.erledigt);
  const anstehend = offen.filter((e) => tageBis(e.datum) >= 0);
  const in30 = anstehend.filter((e) => tageBis(e.datum) <= 30).length;
  const in90 = anstehend.filter((e) => tageBis(e.datum) <= 90).length;
  const ueberfaellig = offen.filter((e) => tageBis(e.datum) < 0).length;

  // ---- Monatsansicht ----
  const ansicht = searchParams.ansicht === "monat" ? "monat" : "liste";
  const monatParam = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? (searchParams.monat as string) : `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}`;
  const [mJahr, mMonat] = monatParam.split("-").map(Number);
  const ersterTag = new Date(mJahr, mMonat - 1, 1);
  const tageImMonat = new Date(mJahr, mMonat, 0).getDate();
  const startWochentag = (ersterTag.getDay() + 6) % 7; // Mo=0
  const vorMonat = `${mMonat === 1 ? mJahr - 1 : mJahr}-${String(mMonat === 1 ? 12 : mMonat - 1).padStart(2, "0")}`;
  const nachMonat = `${mMonat === 12 ? mJahr + 1 : mJahr}-${String(mMonat === 12 ? 1 : mMonat + 1).padStart(2, "0")}`;
  const proTag = new Map<string, Eintrag[]>();
  for (const e of eintraege) {
    if (!zeigeErledigte && e.erledigt) continue;
    if (e.datum.startsWith(monatParam)) {
      const arr = proTag.get(e.datum) ?? [];
      arr.push(e);
      proTag.set(e.datum, arr);
    }
  }
  const gewaehlterTag = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tag ?? "") ? searchParams.tag : null;
  const monatsName = ersterTag.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const linkMit = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) q.set(k, String(v));
    return `/termine?${q.toString()}`;
  };

  const zeile = (e: Eintrag, i: number) => {
    const tage = tageBis(e.datum);
    const stil = KATEGORIE_STIL[e.kategorie] ?? KATEGORIE_STIL.Sonstiges;
    const farbe = e.erledigt ? "var(--green)" : e.typ === "warn" || tage < 0 ? "var(--red)" : e.typ === "ok" ? "var(--green)" : "var(--muted)";
    return (
      <div key={`${e.quelle}-${e.id ?? i}-${e.datum}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", opacity: e.erledigt ? 0.6 : 1 }}>
        {e.quelle === "eigen" && e.id ? (
          <form action={toggleErledigt.bind(null, e.id)} style={{ display: "inline-flex" }}>
            <button
              type="submit"
              title={e.erledigt ? "Wieder öffnen" : "Als erledigt abhaken"}
              style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${e.erledigt ? "var(--green)" : "var(--line2)"}`, background: e.erledigt ? "var(--green-dim)" : "transparent", color: "var(--green)", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 11, lineHeight: 1, padding: 0 }}
            >
              {e.erledigt ? "✓" : ""}
            </button>
          </form>
        ) : (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: stil.punkt, flexShrink: 0, marginLeft: 5, marginRight: 5 }} title={e.kategorie} />
        )}
        <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: "var(--muted)" }}>{datum(e.datum)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, textDecoration: e.erledigt ? "line-through" : undefined }}>
            {e.label}
            {e.wiederkehrung && <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 6 }}><RotateCw size={11} style={{ verticalAlign: "-1px" }} /> {WIEDERKEHRUNG_LABEL[e.wiederkehrung] ?? e.wiederkehrung}</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }} title={e.rechtsgrundlage}>
            {[e.wer, e.wo].filter(Boolean).join(" · ")}
            {e.rechtsgrundlage && <span style={{ color: "var(--faint)" }}>{[e.wer, e.wo].some(Boolean) ? " · " : ""}{e.rechtsgrundlage}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, color: farbe, width: 84, textAlign: "right", flexShrink: 0 }}>
          {e.erledigt ? "erledigt" : tage < 0 ? `vor ${Math.abs(tage)} Tg.` : tage === 0 ? "heute" : `in ${tage} Tg.`}
        </span>
        <span className={`badge ${stil.badge}`} style={{ flexShrink: 0 }}>{stil.icon} {e.kategorie}</span>
        {e.quelle === "eigen" && e.id ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Link href={`/termine/${e.id}/edit`} className="delete-btn" title="Termin bearbeiten" style={{ color: "var(--muted)" }}><Pencil size={14} /></Link>
            <DeleteButton action={deleteTermin.bind(null, e.id)} className="delete-btn" label={<X size={14} />} confirmText="Termin löschen?" />
          </span>
        ) : (
          <span style={{ width: 22, flexShrink: 0 }} />
        )}
      </div>
    );
  };

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Termine</div>
          <div className="topbar-sub">Automatische Fristen aus Mietern, Krediten &amp; Steuer plus eigene Termine · Angaben ohne Gewähr</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={linkMit({ ansicht: ansicht === "monat" ? "" : "monat" })} className="btn btn-ghost" style={{ fontSize: 12 }}>
            {ansicht === "monat" ? "☰ Liste" : "▦ Monat"}
          </Link>
          <a href="/termine/ical" className="btn btn-ghost" style={{ fontSize: 12 }} title="Alle anstehenden Termine als iCal-Datei für deinen Kalender">
            <CalendarDays size={14} style={{ verticalAlign: "-2px" }} /> Kalender-Export (.ics)
          </a>
        </div>
      </div>

      <div className="grid-4 mb-20">
        <div className="kpi-card"><div className="kpi-label">Anstehend</div><div className="kpi-value">{anstehend.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 30 Tagen</div><div className="kpi-value" style={{ color: in30 > 0 ? "var(--amber)" : "var(--text)" }}>{in30}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 90 Tagen</div><div className="kpi-value">{in90}</div></div>
        <div className="kpi-card"><div className="kpi-label">Überfällig</div><div className="kpi-value" style={{ color: ueberfaellig > 0 ? "var(--red)" : "var(--green)" }}>{ueberfaellig}</div></div>
      </div>

      <AufklappForm label={<><Plus size={14} style={{ verticalAlign: "-2px" }} /> Neuer Termin</>}>
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><Plus size={16} style={{ verticalAlign: "-3px" }} /> Neuer Termin</h3></div>
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
              <span style={{ color: "var(--muted)" }}>Kategorie</span>
              <select name="kategorie" className="input">
                {TERMIN_KATEGORIEN.map((k) => <option key={k} value={k}>{KATEGORIE_STIL[k]?.icon} {k}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Wiederkehrung</span>
              <select name="wiederkehrung" className="input">
                <option value="">einmalig</option>
                {Object.entries(WIEDERKEHRUNG_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Immobilie</span>
              <select name="prop_id" className="input">
                <option value="">—</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Mieter</span>
              <select name="mieter_id" className="input">
                <option value="">—</option>
                {mieter.map((m) => <option key={m.id} value={m.id}>{[m.vorname, m.nachname].filter(Boolean).join(" ")}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, width: 90 }}>
              <span style={{ color: "var(--muted)" }}>Vorlauf (Tg.)</span>
              <input name="vorlauf_tage" type="number" min="0" max="365" className="input" placeholder="—" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, flex: 1, minWidth: 140 }}>
              <span style={{ color: "var(--muted)" }}>Notiz</span>
              <input name="notiz" className="input" />
            </label>
            <button className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Termin</button>
          </form>

          {/* Wartungs-Vorlagen: Ein Klick legt den Termin mit Intervall an */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Schnell anlegen (Wartung &amp; Pflichtprüfungen)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {WARTUNGS_VORLAGEN.map((v) => (
                <form key={v.titel} action={createVorlageTermin.bind(null, v.titel, v.wiederkehrung, v.kategorie, v.notiz, null)} style={{ display: "inline-flex" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11.5 }} title={`${v.notiz} · ${WIEDERKEHRUNG_LABEL[v.wiederkehrung]}`}>
                    {KATEGORIE_STIL[v.kategorie]?.icon} {v.titel} <span style={{ color: "var(--muted)" }}><RotateCw size={11} style={{ verticalAlign: "-1px" }} /> {WIEDERKEHRUNG_LABEL[v.wiederkehrung]}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
      </AufklappForm>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}><FilterBar filters={filters} /></div>
        <Link href={linkMit({ erledigte: zeigeErledigte ? "" : "1" })} className="btn btn-ghost" style={{ fontSize: 11.5, marginBottom: 16 }}>
          {zeigeErledigte ? "✓ Erledigte ausblenden" : "Erledigte anzeigen"}
        </Link>
      </div>

      {ansicht === "monat" ? (
        <div className="section">
          <div className="section-header">
            <h3>{monatsName}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href={linkMit({ monat: vorMonat, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>←</Link>
              <Link href={linkMit({ monat: `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}`, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>Heute</Link>
              <Link href={linkMit({ monat: nachMonat, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>→</Link>
            </div>
          </div>
          <div className="section-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                <div key={w} style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", padding: "2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{w}</div>
              ))}
              {Array.from({ length: startWochentag }).map((_, i) => <div key={`leer-${i}`} />)}
              {Array.from({ length: tageImMonat }).map((_, i) => {
                const tagIso = `${monatParam}-${String(i + 1).padStart(2, "0")}`;
                const tagesEintraege = proTag.get(tagIso) ?? [];
                const istHeute = tagIso === `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}-${String(heute.getDate()).padStart(2, "0")}`;
                const aktiv = gewaehlterTag === tagIso;
                return (
                  <Link
                    key={tagIso}
                    href={linkMit({ tag: aktiv ? "" : tagIso })}
                    style={{
                      minHeight: 56, borderRadius: 8, padding: "5px 7px", textDecoration: "none",
                      border: `1px solid ${aktiv ? "var(--gold)" : istHeute ? "var(--gold-dim)" : "var(--line)"}`,
                      background: aktiv ? "var(--gold-pale)" : "var(--bg3)", color: "var(--text)",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: istHeute ? "var(--gold)" : "var(--muted)", fontWeight: istHeute ? 700 : 400 }}>{i + 1}</span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {tagesEintraege.slice(0, 4).map((e, j) => (
                        <span key={j} title={e.label} style={{ width: 7, height: 7, borderRadius: "50%", background: (KATEGORIE_STIL[e.kategorie] ?? KATEGORIE_STIL.Sonstiges).punkt }} />
                      ))}
                      {tagesEintraege.length > 4 && <span style={{ fontSize: 9, color: "var(--muted)" }}>+{tagesEintraege.length - 4}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
            {gewaehlterTag && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Termine am {datum(gewaehlterTag)}</div>
                {(proTag.get(gewaehlterTag) ?? []).length === 0
                  ? <div style={{ fontSize: 12, color: "var(--muted)" }}>Keine Termine an diesem Tag.</div>
                  : (proTag.get(gewaehlterTag) ?? []).map(zeile)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="section-header">
            <h3>Anstehende Termine</h3>
          </div>
          <div className="section-body">
            {sichtbar.length === 0 ? (
              <div className="empty"><CalendarDays className="empty-icon" size={36} color="var(--faint)" /><p>Keine Termine</p></div>
            ) : (
              <ExpandableList limit={12} label="weitere Termine">
                {sichtbar.map(zeile)}
              </ExpandableList>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
