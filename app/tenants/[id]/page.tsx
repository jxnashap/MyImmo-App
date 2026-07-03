import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { mieterFristen } from "@/lib/fristen";
import { staffelPlan } from "@/lib/staffel";
import { deleteTenant } from "@/lib/actions/tenants";
import DeleteButton from "@/components/DeleteButton";
import type { Tenant, Property } from "@/lib/types";
import { decryptNullable } from "@/lib/crypto/secure";

function Kachel({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="stat-box">
      <div className="stat-lbl">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: color ?? "var(--text)" }}>{value || "–"}</div>
    </div>
  );
}

export default async function MieterDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("mieter").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const m = data as Tenant;

  // Gespeicherte Dokumente (Archiv-Einträge dieses Mieters)
  const { data: doks } = await supabase
    .from("notizen")
    .select("id,titel,kategorie,datei_name,created_at")
    .eq("mieter_id", params.id)
    .order("created_at", { ascending: false });
  const dokumente = doks ?? [];

  let propName = "–";
  if (m.prop_id) {
    const { data: p } = await supabase.from("properties").select("bezeichnung").eq("id", m.prop_id).single();
    propName = (p as Pick<Property, "bezeichnung"> | null)?.bezeichnung ?? "–";
  }

  const fristen = mieterFristen(m);
  // Staffelplan: nur bei Staffelmiete mit Startdatum + Betrag ODER Prozent
  const staffelTyp = m.staffel_typ === "prozent" ? ("prozent" as const) : ("betrag" as const);
  const plan =
    (m.mietart ?? "").toLowerCase() === "staffel" &&
    m.staffel_datum &&
    ((m.staffel_betrag ?? 0) > 0 || (m.staffel_prozent ?? 0) > 0)
      ? staffelPlan({
          startMiete: m.kaltmiete ?? 0,
          startDatum: m.staffel_datum,
          intervallMonate: Number(m.staffel_intervall) || 12,
          typ: staffelTyp,
          betrag: m.staffel_betrag,
          prozent: m.staffel_prozent,
          stufen: m.staffel_stufen ?? 0,
        })
      : [];
  const heuteIso = new Date().toISOString().split("T")[0];
  const naechsteStufe = plan.find((st) => st.datum >= heuteIso)?.datum;
  const mieterIban = decryptNullable(m.iban);
  const fmtIban = (x: string) => x.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
  const mietart = m.mietart === "staffel" ? "Staffelmiete" : m.mietart === "index" ? "Indexmiete" : "Standard";
  const kautionTxt = m.kaution_status === "ja" ? "✓ Vollständig" : m.kaution_status === "teilweise" ? "Teilweise" : "⚠️ Ausstehend";
  const kautionCol = m.kaution_status === "ja" ? "var(--green)" : "var(--amber)";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/tenants" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div>
            <div className="topbar-title">{[m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter"}</div>
            <div className="topbar-sub">{propName}{m.einheit ? ` · ${m.einheit}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/tenants/${m.id}/nk`} className="btn btn-ghost" style={{ fontSize: 12 }}>🧾 NK-Abrechnung</Link>
          <Link href={`/tenants/${m.id}/dokument`} className="btn btn-ghost" style={{ fontSize: 12 }}>📄 Dokument</Link>
          <Link href={`/tenants/${m.id}/protokoll`} className="btn btn-ghost" style={{ fontSize: 12 }}>🔑 Protokoll</Link>
          <Link href={`/tenants/${m.id}/edit`} className="btn btn-ghost" style={{ fontSize: 12 }}>✏️ Bearbeiten</Link>
          <DeleteButton action={deleteTenant.bind(null, m.id)} className="btn btn-ghost" label="🗑 Löschen" confirmText={`„${[m.vorname, m.nachname].filter(Boolean).join(" ")}" wirklich löschen?`} />
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Mietvertrag &amp; Stammdaten</h3></div>
        <div className="section-body">
          <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Kachel label="Kaltmiete / Mo." value={euro(m.kaltmiete)} color="var(--green)" />
            <Kachel label="NK-Vorauszahlung" value={m.nk_vorauszahlung ? euro(m.nk_vorauszahlung) : "–"} />
            <Kachel label="Warmmiete / Mo." value={euro((m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0))} />
            {(m.stellplatz || m.stellplatz_miete) && (
              <Kachel label="Stellplatz / Garage" value={`${m.stellplatz_miete ? euro(m.stellplatz_miete) : "–"}${m.stellplatz ? " · " + m.stellplatz : ""}`} />
            )}
            {(m.stellplatz_miete ?? 0) > 0 && (
              <Kachel label="Gesamt / Mo." color="var(--green)" value={euro((m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) + (m.stellplatz_miete ?? 0))} />
            )}
            <Kachel label="Mietbeginn" value={m.mietbeginn ? datum(m.mietbeginn) : "–"} />
            <Kachel label="Mietende" value={m.mietende ? datum(m.mietende) : "unbefristet"} />
            <Kachel label="Kündigungsfrist" value={m.kuendigung ? `${m.kuendigung} Monate` : "–"} />
            <Kachel label="Mietart" value={mietart} />
            <Kachel label="Letzte Mieterhöhung" value={m.letzte_erhoehung ? datum(m.letzte_erhoehung) : "–"} />
            {m.staffel_datum && <Kachel label="Nächste Erhöhung" value={datum(m.staffel_datum)} color="var(--amber)" />}
            <Kachel label="Kaution" value={m.kaution ? euro(m.kaution) : "–"} />
            <Kachel label="Kaution Status" value={kautionTxt} color={kautionCol} />
            <Kachel label="Wohnfläche" value={m.flaeche ? `${m.flaeche} m²` : "–"} />
            <Kachel label="Telefon" value={m.telefon} />
            <Kachel label="E-Mail" value={m.email} />
            <Kachel label="Adresse" value={m.mieter_adresse} />
            {mieterIban && <Kachel label="Bankverbindung" value={fmtIban(mieterIban)} />}
          </div>
          {m.notiz && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--bg3)", borderRadius: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.notiz}</div>
          )}
        </div>
      </div>

      {plan.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>Staffelplan</h3>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {staffelTyp === "prozent" ? `+${(m.staffel_prozent ?? 0).toLocaleString("de-DE")} % je Stufe` : `+${euro(m.staffel_betrag)} je Stufe`}
              {" · "}alle {Number(m.staffel_intervall) || 12} Monate
            </span>
          </div>
          <div className="section-body">
            <table>
              <thead><tr><th>Ab Datum</th><th>Neue Kaltmiete</th><th>Erhöhung</th></tr></thead>
              <tbody>
                {plan.map((st) => {
                  const kommend = st.datum === naechsteStufe;
                  return (
                    <tr key={st.datum} style={kommend ? { background: "var(--gold-pale)" } : undefined}>
                      <td style={{ fontWeight: kommend ? 600 : 400 }}>{datum(st.datum)}{kommend && <span className="badge badge-gold" style={{ marginLeft: 8 }}>nächste Stufe</span>}</td>
                      <td style={{ fontWeight: 600 }}>{euro(st.miete)}</td>
                      <td style={{ color: "var(--green)" }}>+ {euro(st.delta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
              Basis: aktuelle Kaltmiete {euro(m.kaltmiete)}. Vertraglich gelten die im Mietvertrag
              vereinbarten Euro-Beträge (§ 557a BGB) — der Plan ist eine Rechenhilfe.
            </p>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header"><h3>Dokumente</h3><Link href="/archiv" className="btn btn-ghost" style={{ fontSize: 11 }}>→ Archiv</Link></div>
        <div className="section-body">
          {dokumente.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>Noch keine Dokumente gespeichert.</div>
          ) : (
            dokumente.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{n.titel || n.datei_name || "Dokument"}</span>
                {n.kategorie && <span className="badge badge-teal">{n.kategorie}</span>}
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{n.created_at ? datum(n.created_at) : ""}</span>
                <a href={`/archiv/${n.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Ansehen</a>
                <a href={`/archiv/${n.id}/datei?download=1`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Herunterladen</a>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Fristen &amp; Termine</h3><Link href="/termine" className="btn btn-ghost" style={{ fontSize: 11 }}>→ Kalender</Link></div>
        <div className="section-body">
          {fristen.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>Keine Fristen.</div>
          ) : (
            fristen.map((f, i) => {
              const farbe = f.typ === "warn" ? "var(--red)" : f.typ === "ok" ? "var(--green)" : "var(--muted)";
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: farbe }}>{f.typ === "warn" ? "⚠️ " : f.typ === "ok" ? "✓ " : ""}{f.label}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{f.datum ? datum(f.datum) : "jetzt"}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
