import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteProperty } from "@/lib/actions/properties";
import { deleteEinnahme, deleteKosten, deleteKredit, deleteVerbrauch, deleteNotiz } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import Co2Rechner from "@/components/Co2Rechner";
import type { Property, Tenant } from "@/lib/types";

type Kredit = {
  id: string; bezeichnung: string | null; bank: string | null; betrag: number | null;
  restschuld: number | null; monatsrate: number | null; zinssatz: number | null;
  tilgungssatz: number | null; laufzeit: number | null; zinsbindung: string | null;
};
type Buchung = { id: string; betrag: number | null; buchungsdatum: string | null; kategorie: string | null };
type Verbrauch = { id: string; buchungsdatum: string | null; art: string | null; menge: number | null; einheit: string | null; verbrauchkosten: number | null };
type Notiz = { id: string; titel: string | null; kategorie: string | null; inhalt: string | null };

const ART_ICONS: Record<string, string> = { Strom: "⚡", Gas: "🔥", Wasser: "💧", Heizöl: "🛢", Fernwärme: "♨", Sonstiges: "📦" };

function mkBadge(val: number, gut: number, ok: number) {
  return val >= gut ? "badge-green" : val >= ok ? "badge-gold" : "badge-red";
}

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;

  const [{ data: prop }, { data: mieter }, { data: einn }, { data: kost }, { data: kredite }, { data: verb }, { data: notiz }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase.from("mieter").select("*").eq("prop_id", id).order("mietbeginn"),
      supabase.from("einnahmen").select("id,betrag,buchungsdatum,kategorie").eq("prop_id", id).order("buchungsdatum", { ascending: false }),
      supabase.from("kosten").select("id,betrag,buchungsdatum,kategorie").eq("prop_id", id).order("buchungsdatum", { ascending: false }),
      supabase.from("kredite").select("id,bezeichnung,bank,betrag,restschuld,monatsrate,zinssatz,tilgungssatz,laufzeit,zinsbindung").eq("prop_id", id),
      supabase.from("verbrauch").select("id,buchungsdatum,art,menge,einheit,verbrauchkosten").eq("prop_id", id).order("buchungsdatum", { ascending: false }),
      supabase.from("notizen").select("id,titel,kategorie,inhalt").eq("prop_id", id),
    ]);

  if (!prop) notFound();
  const p = prop as Property;
  const tenants = (mieter ?? []) as Tenant[];
  const kred = (kredite ?? []) as Kredit[];
  const einnahmen = (einn ?? []) as Buchung[];
  const kosten = (kost ?? []) as Buchung[];
  const verbrauch = (verb ?? []) as Verbrauch[];
  const notizen = (notiz ?? []) as Notiz[];

  const wert = p.wert ?? 0;
  const totalRestschuld = kred.reduce((s, k) => s + (k.restschuld ?? 0), 0);
  const totalKreditRate = kred.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const jahresEinnahmen = einnahmen.reduce((s, e) => s + (e.betrag ?? 0), 0);
  const jahresKosten = kosten.reduce((s, k) => s + (k.betrag ?? 0), 0);
  // Garagen-Objekte: Mieten liegen auf den einzelnen Mietern (je Einheit),
  // nicht auf p.miete — sonst zeigten KPIs/Cashflow/Rendite 0.
  const istGaragen = ["Garage / Stellplatz", "Garagenkomplex"].includes(p.typ ?? "");
  const mieteAusMietern = tenants.reduce((s, t) => s + (t.kaltmiete ?? 0), 0);
  const miete = istGaragen ? mieteAusMietern : (p.miete ?? 0);
  const rendite = miete && wert ? (miete * 12 / wert) * 100 : 0;
  const faktor = miete && p.kaufpreis ? p.kaufpreis / (miete * 12) : 0;
  // Empfohlene Instandhaltungsrücklage (Peterssche Formel): 1,5× Herstellungs-
  // kosten über 80 Jahre. Faustformel ohne Gewähr; als Herstellungskosten dient
  // der Gebäudeanteil (angenommen 70 %) von Kaufpreis bzw. Wert. Bei ETW ent-
  // fallen ~65–70 % aufs Gemeinschaftseigentum (läuft über die Hausgeld-Rücklage).
  const GEBAEUDEANTEIL = 0.70;
  const petersBasis = (p.kaufpreis ?? wert ?? 0) * GEBAEUDEANTEIL;
  const petersJahr = petersBasis * 1.5 / 80;
  const petersM2 = p.flaeche && p.flaeche > 0 ? petersJahr / p.flaeche : 0;
  const cashflowMo = miete - totalKreditRate;
  const cfStr = (cashflowMo >= 0 ? "+ " : "– ") + euro(Math.abs(cashflowMo));

  const kpis = [
    { lbl: "Aktueller Wert", val: euro(wert) },
    { lbl: "Kaltmiete / Mo.", val: miete ? euro(miete) : "–" },
    { lbl: "Restschuld gesamt", val: totalRestschuld > 0 ? euro(totalRestschuld) : "–" },
    { lbl: "Cashflow / Mo.", val: cfStr, sub: cashflowMo >= 0 ? "positiv" : "negativ", col: cashflowMo >= 0 ? "var(--green)" : "var(--red)" },
  ];

  const stammRows: [string, React.ReactNode][] = [
    ["Typ", p.typ || "–"],
    ["Adresse", p.adresse || "–"],
    ["Wohnfläche", p.flaeche ? `${p.flaeche} m²` : "–"],
    ...(p.grundstuecksflaeche ? [["Grundstücksfläche", `${p.grundstuecksflaeche} m²`]] as [string, React.ReactNode][] : []),
    ["Zimmer", p.zimmer ?? "–"],
    ["Baujahr", p.baujahr ?? "–"],
    ["Kaufpreis", p.kaufpreis ? euro(p.kaufpreis) : "–"],
    ["Aktueller Wert", euro(wert)],
    ["Energieklasse", p.energieklasse || "–"],
    ["Hausgeld / Mo.", p.hausgeld ? `${euro(p.hausgeld)}/Mo` : "–"],
    ["Status", p.obj_status || "–"],
    ["Notiz", p.notiz_import || "–"],
  ];

  const kennzahlen = [
    { lbl: "Bruttomietrendite", val: rendite > 0 ? rendite.toFixed(2) + "%" : "–", badge: rendite > 0 ? mkBadge(rendite, 5, 4) : "badge-teal", note: "Jahreskaltmiete / Kaufpreis" },
    { lbl: "Kaufpreisfaktor", val: faktor > 0 ? faktor.toFixed(1) + "x" : "–", badge: faktor > 0 ? (faktor < 25 ? "badge-green" : faktor < 30 ? "badge-gold" : "badge-red") : "badge-teal", note: "Kaufpreis / Jahreskaltmiete" },
    { lbl: "Instandhaltungsrücklage (empf.)", val: petersJahr > 0 ? euro(petersJahr) + "/Jahr" : "–", badge: "badge-teal", note: petersM2 > 0 ? `Peterssche Formel · ${euro(petersM2)}/m²·Jahr` : "Peterssche Formel (Faustformel)" },
    { lbl: "Kreditrate / Mo.", val: totalKreditRate > 0 ? euro(totalKreditRate) : "–", badge: "badge-teal", note: "Summe aller Darlehensraten" },
    { lbl: "Restschuld gesamt", val: totalRestschuld > 0 ? euro(totalRestschuld) : "–", badge: "badge-teal", note: "Summe aller Darlehen" },
    { lbl: "Cashflow / Mo.", val: cfStr, badge: cashflowMo >= 0 ? "badge-green" : "badge-red", note: "Miete minus Kreditrate" },
    { lbl: "Einnahmen gesamt", val: jahresEinnahmen > 0 ? euro(jahresEinnahmen) : "–", badge: "badge-green", note: "Alle erfassten Einnahmen" },
    { lbl: "Kosten gesamt", val: jahresKosten > 0 ? euro(jahresKosten) : "–", badge: "badge-red", note: "Alle erfassten Ausgaben" },
  ];

  // Cashflow-Übersicht
  const cfItems = [
    { lbl: "Kaltmiete", val: miete, col: "var(--green)" },
    { lbl: "Kreditraten", val: totalKreditRate, col: "var(--red)" },
    { lbl: "Laufende Kosten", val: jahresKosten / 12, col: "var(--red)" },
  ].filter((i) => i.val > 0);
  const cfMax = Math.max(1, ...cfItems.map((i) => i.val));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/properties" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div>
            <div className="topbar-title">{p.bezeichnung}</div>
            <div className="topbar-sub">{(p.adresse || p.typ || "")}{p.obj_status ? ` · ${p.obj_status}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/properties/${id}/beleihung`} className="btn btn-ghost" style={{ fontSize: 12 }}>🏦 Beleihungsordner</Link>
          <Link href={`/properties/${id}/edit`} className="btn btn-ghost" style={{ fontSize: 12 }}>✏️ Bearbeiten</Link>
          <DeleteButton
            action={deleteProperty.bind(null, id)}
            confirmText={`„${p.bezeichnung}" wirklich löschen?`}
            label="🗑 Löschen"
            className="btn btn-ghost"
          />
        </div>
      </div>

      {/* KPI-Leiste */}
      <div className="grid-4 mb-20">
        {kpis.map((k) => (
          <div key={k.lbl} className="kpi-card">
            <div className="kpi-label">{k.lbl}</div>
            <div className="kpi-value" style={k.col ? { color: k.col } : undefined}>{k.val}</div>
            {k.sub && <div className="kpi-sub" style={{ color: k.col }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Stammdaten + Kennzahlen */}
      <div className="grid-2 mb-20">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Stammdaten</h3></div>
          <div className="section-body">
            <table style={{ fontSize: 13 }}>
              <tbody>
                {stammRows.map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ color: "var(--muted)", padding: "7px 12px 7px 0", width: 140, whiteSpace: "nowrap" }}>{l}</td>
                    <td style={{ padding: "7px 0", fontWeight: 500 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Kennzahlen &amp; Rendite</h3></div>
          <div className="section-body">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {kennzahlen.map((k) => (
                <div key={k.lbl} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{k.lbl}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{k.note}</div>
                  </div>
                  <span className={`badge ${k.badge}`} style={{ fontSize: 12 }}>{k.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mieter dieser Immobilie */}
      <div className="section mb-20">
        <div className="section-header">
          <h3>{istGaragen ? "Einheiten & Mieter" : "Mieter dieser Immobilie"}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {istGaragen && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {tenants.length}{p.einheiten_anzahl ? ` von ${p.einheiten_anzahl}` : ""} vermietet · Mieten gesamt {euro(mieteAusMietern)}
              </span>
            )}
            <Link href="/tenants/new" className="btn btn-ghost" style={{ fontSize: 11 }}>＋ Mieter</Link>
          </div>
        </div>
        <div className="section-body">
          {istGaragen && (
            <p style={{ fontSize: 11, color: "var(--faint)", margin: "0 0 10px", lineHeight: 1.6 }}>
              Hinweis: Vermietung von Garagen/Stellplätzen ist grundsätzlich umsatzsteuerpflichtig
              (§ 4 Nr. 12 S. 2 UStG), außer als Nebenleistung zur Wohnungsvermietung an denselben
              Mieter; oft über die Kleinunternehmerregelung (§ 19 UStG) entschärft. Keine Steuerberatung.
            </p>
          )}
          {tenants.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0" }}>Noch keine Mieter zugeordnet.</div>
          ) : (
            tenants.map((m) => (
              <Link key={m.id} href={`/tenants/${m.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--gold-pale)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {[m.vorname, m.nachname].filter(Boolean).join(" ") || "—"}
                    {m.einheit && <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}> · {m.einheit}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.mietbeginn ? "seit " + datum(m.mietbeginn) : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--green)" }}>{euro(m.kaltmiete)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>Kaltmiete / Mo.</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Nebenkosten-Verteiler */}
      <div className="section mb-20">
        <div className="section-header">
          <h3>Nebenkosten verteilen</h3>
          <Link href={`/properties/${id}/umlage`} className="btn btn-gold" style={{ fontSize: 11 }}>Verteiler öffnen</Link>
        </div>
        <div className="section-body">
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            Für Mehrfamilienhäuser: Gesamtkosten (Strom, Wasser, Grundsteuer …) <strong>einmal</strong> eingeben — der
            Assistent teilt sie automatisch nach <strong>m²-Anteil</strong> auf alle Mieter auf und übernimmt die
            Beträge direkt in deren einzelne NK-Abrechnung.
          </div>
        </div>
      </div>

      {/* Kredite & Finanzierung */}
      <div className="section mb-20">
        <div className="section-header">
          <h3>Kredite &amp; Finanzierung</h3>
          <Link href={`/kredite/new?prop=${id}&back=/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 11 }}>＋ Darlehen</Link>
        </div>
        <div className="section-body">
          {kred.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}><div className="empty-icon">🏦</div><p>Noch keine Darlehen</p></div>
          ) : (
            kred.map((k) => {
              const tilgtPct = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, Math.round((1 - (k.restschuld ?? 0) / k.betrag) * 100))) : 0;
              return (
                <div key={k.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{k.bezeichnung || "Darlehen"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{k.bank || "–"} · {k.zinssatz ?? 0}% Zins · {k.tilgungssatz ?? 0}% Tilgung</div>
                    </div>
                    <DeleteButton action={deleteKredit.bind(null, k.id)} className="delete-btn" label="✕" confirmText={`„${k.bezeichnung || "Darlehen"}" löschen?`} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
                    <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Restschuld</div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--red)" }}>{euro(k.restschuld)}</div></div>
                    <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Rate/Mo.</div><div style={{ fontWeight: 600, fontSize: 13 }}>{euro(k.monatsrate)}</div></div>
                    <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Volltilgung</div><div style={{ fontWeight: 600, fontSize: 13 }}>{k.laufzeit ?? "–"}</div></div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Getilgt: {tilgtPct}%</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${tilgtPct}%`, background: "var(--teal)" }} /></div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Einnahmen + Kosten */}
      <div className="grid-2 mb-20">
        <BuchungSection title="💰 Einnahmen" rows={einnahmen} gesamtColor="var(--green)" badge="badge-green" addHref={`/einnahmen/new?prop=${id}&back=/properties/${id}`} kind="einnahme" />
        <BuchungSection title="📋 Kosten & Ausgaben" rows={kosten} gesamtColor="var(--red)" badge="badge-red" addHref={`/kosten/new?prop=${id}&back=/properties/${id}`} kind="kosten" />
      </div>

      {/* Verbrauch + Notizen */}
      <div className="grid-2 mb-20">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Verbrauch &amp; Nebenkosten</h3><Link href={`/verbrauch/new?prop=${id}&back=/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 11 }}>＋ Hinzufügen</Link></div>
          <div className="section-body">
            {verbrauch.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}><div className="empty-icon">⚡</div><p>Noch kein Verbrauch</p></div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", marginBottom: 10 }}>
                  Gesamt: {euro(verbrauch.reduce((s, v) => s + (v.verbrauchkosten ?? 0), 0))}
                </div>
                <table style={{ fontSize: 12 }}>
                  <thead><tr><th>Datum</th><th>Art</th><th>Menge</th><th>Kosten</th><th></th></tr></thead>
                  <tbody>
                    {verbrauch.slice(0, 8).map((v) => (
                      <tr key={v.id}>
                        <td>{datum(v.buchungsdatum)}</td>
                        <td>{(v.art && ART_ICONS[v.art]) || ""} {v.art}</td>
                        <td>{v.menge ?? "–"} {v.einheit}</td>
                        <td style={{ fontWeight: 600 }}>{euro(v.verbrauchkosten)}</td>
                        <td style={{ textAlign: "right" }}><DeleteButton action={deleteVerbrauch.bind(null, v.id)} className="delete-btn" label="✕" confirmText="Eintrag löschen?" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Archiv</h3><Link href="/archiv" className="btn btn-ghost" style={{ fontSize: 11 }}>＋ Hinzufügen</Link></div>
          <div className="section-body">
            {notizen.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}><div className="empty-icon">🗄</div><p>Noch keine Dokumente</p></div>
            ) : (
              notizen.map((n) => (
                <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.titel}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {n.kategorie && <span className="badge badge-teal">{n.kategorie}</span>}
                      <DeleteButton action={deleteNotiz.bind(null, n.id)} className="delete-btn" label="✕" confirmText="Notiz löschen?" />
                    </div>
                  </div>
                  {n.inhalt && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{n.inhalt}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CO₂-Kostenaufteilung (CO2KostAufG) */}
      <div className="section mb-20">
        <div className="section-header">
          <h3>CO₂-Kostenaufteilung</h3>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Stufenmodell nach CO2KostAufG — Werte von der Brennstoffrechnung
          </span>
        </div>
        <div className="section-body">
          <Co2Rechner defaultFlaeche={p.flaeche} />
        </div>
      </div>

      {/* Cashflow-Übersicht */}
      <div className="section mb-20">
        <div className="section-header"><h3>Cashflow-Übersicht (Monat)</h3></div>
        <div className="section-body">
          {cfItems.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>Noch keine Daten.</div>
          ) : (
            cfItems.map((i) => (
              <div key={i.lbl} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", width: 130, textAlign: "right", flexShrink: 0 }}>{i.lbl}</div>
                <div style={{ flex: 1, height: 22, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(i.val / cfMax) * 100}%`, height: "100%", background: i.col, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, width: 90, textAlign: "right", flexShrink: 0 }}>{euro(i.val)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BuchungSection({
  title, rows, gesamtColor, badge, addHref, kind,
}: {
  title: string; rows: Buchung[]; gesamtColor: string; badge: string; addHref: string; kind: "einnahme" | "kosten";
}) {
  const total = rows.reduce((s, r) => s + (r.betrag ?? 0), 0);
  const isEinnahme = kind === "einnahme";
  const del = isEinnahme ? deleteEinnahme : deleteKosten;
  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="section-header">
        <h3>{title}</h3>
        <Link href={addHref} className="btn btn-ghost" style={{ fontSize: 11 }}>＋ Hinzufügen</Link>
      </div>
      <div className="section-body">
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}><div className="empty-icon">{isEinnahme ? "💰" : "📋"}</div><p>Noch keine {isEinnahme ? "Einnahmen" : "Ausgaben"}</p></div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: gesamtColor, marginBottom: 10 }}>Gesamt: {euro(total)}</div>
            <table style={{ fontSize: 12 }}>
              <thead><tr><th>Datum</th><th>Kategorie</th><th>Betrag</th><th></th></tr></thead>
              <tbody>
                {rows.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td>{datum(r.buchungsdatum)}</td>
                    <td>{r.kategorie && <span className={`badge ${badge}`}>{r.kategorie}</span>}</td>
                    <td style={{ fontWeight: 600, color: gesamtColor }}>{euro(r.betrag)}</td>
                    <td style={{ textAlign: "right" }}><DeleteButton action={del.bind(null, r.id)} className="delete-btn" label="✕" confirmText="Eintrag löschen?" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>+ {rows.length - 10} weitere</div>}
          </>
        )}
      </div>
    </div>
  );
}
