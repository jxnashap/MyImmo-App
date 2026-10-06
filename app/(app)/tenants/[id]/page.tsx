import { vergleichsmieteFuer } from "@/lib/steuer/verbilligt";
import Link from "next/link";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mieterFolgenText } from "@/lib/loeschUmfang";
import { euro, eur2, datum } from "@/lib/format";
import { mieterFristen, nkErstellteJahre } from "@/lib/fristen";
import { staffelPlan } from "@/lib/staffel";
import { normMietart, MIETART_LABEL } from "@/lib/mietart";
import StaffelUebernehmen from "@/components/StaffelUebernehmen";
import { deleteTenant } from "@/lib/actions/tenants";
import DeleteButton from "@/components/DeleteButton";
import type { Tenant, Property, MietZeitraum } from "@/lib/types";
import MietZeitraeume from "@/components/MietZeitraeume";
import VerbilligtAmpel from "@/components/VerbilligtAmpel";
import MieterEinladung from "@/components/MieterEinladung";
import { brevoBereit } from "@/lib/mail/brevo";
import { zugangEndet, pruefeZustellung } from "@/lib/mieterZugang";
import { heuteBerlin } from "@/lib/zeitraum";
import DokumentZustellung, { type ZustellZeile } from "@/components/DokumentZustellung";
import { decryptNullable } from "@/lib/crypto/secure";
import { ReceiptText, FileText, KeyRound, Pencil, Trash2, TriangleAlert } from "lucide-react";

function Kachel({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="stat-box">
      <div className="stat-lbl">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: color ?? "var(--text)" }}>{value || "–"}</div>
    </div>
  );
}

export default async function MieterDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("mieter").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const m = data as Tenant;

  // Miet-Zeiträume (unterschiedliche Miete je Periode)
  const { data: zr } = await supabase
    .from("miet_zeitraeume")
    .select("*")
    .eq("mieter_id", params.id)
    .order("von", { ascending: true });
  const zeitraeume = (zr ?? []) as MietZeitraum[];

  // Gespeicherte Dokumente (Archiv-Einträge dieses Mieters)
  const { data: doks } = await supabase
    .from("notizen")
    .select("id,titel,kategorie,datei_name,created_at")
    .eq("mieter_id", params.id)
    .order("created_at", { ascending: false });
  const dokumente = doks ?? [];

  // Zustellungen ins Mieterportal (an wen, wann, abgerufen?) — je Dokument.
  const { data: zustRows } = await supabase
    .from("zustellungen")
    .select("id,notiz_id,empfaenger_email,zugestellt_am,gelesen_am,bestaetigung_noetig,bestaetigt_am,zurueckgezogen_am")
    .eq("mieter_id", params.id)
    .order("zugestellt_am", { ascending: false });
  const zustellungenJe = new Map<string, ZustellZeile[]>();
  for (const z of (zustRows ?? []) as (ZustellZeile & { notiz_id: string | null })[]) {
    if (!z.notiz_id) continue;
    zustellungenJe.set(z.notiz_id, [...(zustellungenJe.get(z.notiz_id) ?? []), z]);
  }

  // Mieterportal-Zugang: aktiver Einladungscode + bereits verbundenes Konto
  const { data: aktiverCode } = await supabase
    .from("einladungscodes")
    .select("code,gueltig_bis,email")
    .eq("mieter_id", params.id)
    .is("eingeloest_am", null)
    .gt("gueltig_bis", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: zugang } = await supabase
    .from("mieter_zugaenge")
    .select("email,created_at")
    .eq("mieter_id", params.id)
    .limit(1)
    .maybeSingle();

  // Anzeige der Zustell-Karte; dieselbe Prüfung wiederholt `stelleDokumentZu` serverseitig.
  const mieterAnzeige = [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter";
  const zustellPruefung = {
    ...pruefeZustellung({
      verbunden: !!zugang,
      email: (zugang?.email as string | null) ?? null,
      mietbeginn: m.mietbeginn ?? null,
      mietende: m.mietende ?? null,
      jahr: null,
      schonZugestellt: false,
      heute: heuteBerlin(),
    }),
    email: (zugang?.email as string | null) ?? null,
  };

  // Loeschumfang fuer die Rueckfrage: NK-Positionen und Miet-Zeitraeume gehen
  // per Cascade mit, gebuchte Mieten verlieren ihre Zuordnung.
  const [{ count: posAnzahl }, { count: mietAnzahl }] = await Promise.all([
    supabase.from("mieter_positionen").select("id", { count: "exact", head: true }).eq("mieter_id", params.id),
    supabase.from("einnahmen").select("id", { count: "exact", head: true }).eq("mieter_id", params.id).eq("kategorie", "Miete"),
  ]);
  const loeschUmfang = {
    zeitraeume: zeitraeume.length,
    positionen: posAnzahl ?? 0,
    einnahmen: mietAnzahl ?? 0,
  };

  let propName = "–";
  let objektVergleich: number | null = null;
  if (m.prop_id) {
    const { data: p } = await supabase.from("properties").select("bezeichnung,vergleichsmiete_m2").eq("id", m.prop_id).single();
    propName = (p as Pick<Property, "bezeichnung"> | null)?.bezeichnung ?? "–";
    objektVergleich = (p as Pick<Property, "vergleichsmiete_m2"> | null)?.vergleichsmiete_m2 ?? null;
  }
  // Mietspiegel am Mieter, sonst Vergleichsmiete am Objekt (lib/steuer/verbilligt.ts).
  const vergleich = vergleichsmieteFuer(m.mietspiegel, objektVergleich);

  const fristen = mieterFristen(m, { nkErstellt: nkErstellteJahre(Array.from(dokumente, (d) => ({ mieter_id: params.id, titel: d.titel as string | null }))).get(params.id) });
  // Staffelplan: nur bei Staffelmiete mit Startdatum + Betrag ODER Prozent
  const staffelTyp = m.staffel_typ === "prozent" ? ("prozent" as const) : ("betrag" as const);
  const plan =
    normMietart(m.mietart) === "staffel" &&
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
  // Stufe schon als Miet-Zeitraum hinterlegt? (gleicher Monat, gleiche Kaltmiete — wie uebernehmeStaffel)
  const imMietkonto = new Set(zeitraeume.map((z) => `${z.von.slice(0, 7)}|${Number(z.kaltmiete)}`));
  const stufeImMietkonto = (st: { datum: string; miete: number }) => imMietkonto.has(`${st.datum.slice(0, 7)}|${st.miete}`);
  const mieterIban = decryptNullable(m.iban);
  const fmtIban = (x: string) => x.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
  const mietart = MIETART_LABEL[normMietart(m.mietart)];
  const kautionTxt = m.kaution_status === "ja" ? "✓ Vollständig" : m.kaution_status === "teilweise" ? "Teilweise" : <><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Ausstehend</>;
  const kautionCol = m.kaution_status === "ja" ? "var(--green)" : "var(--amber)";

  return (
    <div className="fade-up">
      <Breadcrumbs items={[{ label: "Mieter", href: "/tenants" }, { label: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter" }]} />
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/tenants" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">{[m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter"}</div>
            <div className="topbar-sub">{propName}{m.einheit ? ` · ${m.einheit}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/tenants/${m.id}/nk`} className="btn btn-ghost" style={{ fontSize: 12 }}><ReceiptText size={14} style={{ verticalAlign: "-2px" }} /> NK-Abrechnung</Link>
          <Link href={`/tenants/${m.id}/dokument`} className="btn btn-ghost" style={{ fontSize: 12 }}><FileText size={14} style={{ verticalAlign: "-2px" }} /> Dokument</Link>
          <Link href={`/tenants/${m.id}/protokoll`} className="btn btn-ghost" style={{ fontSize: 12 }}><KeyRound size={14} style={{ verticalAlign: "-2px" }} /> Protokoll</Link>
          <Link href={`/tenants/${m.id}/edit`} className="btn btn-ghost" style={{ fontSize: 12 }}><Pencil size={14} style={{ verticalAlign: "-2px" }} /> Bearbeiten</Link>
          {/* An einem Mieter haengen Miet-Zeitraeume und NK-Positionen — die
              Grundlage jeder Abrechnung. Das gehoert in die Rueckfrage. */}
          <DeleteButton action={deleteTenant.bind(null, m.id)} className="btn btn-ghost" label={<><Trash2 size={14} style={{ verticalAlign: "-2px" }} /> Löschen</>} confirmText={`„${[m.vorname, m.nachname].filter(Boolean).join(" ")}“ wirklich löschen? ${mieterFolgenText(loeschUmfang)}`.trim()} />
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Mietvertrag &amp; Stammdaten</h3></div>
        <div className="section-body">
          {/* Klasse statt Inline-Style: Ein Inline-`gridTemplateColumns`
              überschreibt die Mobile-Regel in globals.css (Inline gewinnt), die
              Seite blieb auf dem Telefon dreispaltig und Beträge wie „€ 1.250“
              brachen um oder erzwangen Seiten-Scroll. */}
          <div className="grid-kacheln">
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
            <Kachel label="Kautionsstatus" value={kautionTxt} color={kautionCol} />
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

      {vergleich && (
        <VerbilligtAmpel
          input={{
            kaltmiete: m.kaltmiete,
            nkVorauszahlung: m.nk_vorauszahlung,
            stellplatzMiete: m.stellplatz_miete ?? null,
            vergleichKaltProM2: vergleich.wert,
            flaeche: m.flaeche,
          }}
          quelle={vergleich.quelle}
        />
      )}

      <MietZeitraeume mieterId={params.id} zeitraeume={zeitraeume} />

      {plan.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>Staffelplan</h3>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {staffelTyp === "prozent" ? `+${(m.staffel_prozent ?? 0).toLocaleString("de-DE")} % je Stufe` : `+${euro(m.staffel_betrag)} je Stufe`}
              {" · "}alle {Number(m.staffel_intervall) || 12} Monate
            </span>
            <StaffelUebernehmen mieterId={params.id} offen={plan.filter((st) => !stufeImMietkonto(st)).length} />
          </div>
          <div className="section-body">
            <div className="table-scroll"><table>
              <thead><tr><th>Ab Datum</th><th>Neue Kaltmiete</th><th>Erhöhung</th></tr></thead>
              <tbody>
                {plan.map((st) => {
                  const kommend = st.datum === naechsteStufe;
                  return (
                    <tr key={st.datum} style={kommend ? { background: "var(--gold-pale)" } : undefined}>
                      <td style={{ fontWeight: kommend ? 600 : 400 }}>{datum(st.datum)}{kommend && <span className="badge badge-gold" style={{ marginLeft: 8 }}>nächste Stufe</span>}{stufeImMietkonto(st) && <span className="badge" style={{ marginLeft: 8 }}>im Mietkonto</span>}</td>
                      <td style={{ fontWeight: 600 }}>{eur2(st.miete)}</td>
                      <td style={{ color: "var(--green)" }}>+ {eur2(st.delta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
              Basis: aktuelle Kaltmiete {euro(m.kaltmiete)}. Vertraglich gelten die im Mietvertrag
              vereinbarten Euro-Beträge (§ 557a BGB) — der Plan ist eine Rechenhilfe.
            </p>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header"><h3>Mieterportal-Zugang</h3></div>
        <div className="section-body">
          <MieterEinladung
            mieterId={params.id}
            zugang={zugang ? { email: (zugang.email as string | null) ?? null, seit: zugang.created_at as string } : null}
            aktiverCode={aktiverCode ? { code: aktiverCode.code, gueltig_bis: aktiverCode.gueltig_bis, email: (aktiverCode.email as string | null) ?? null } : null}
            mieterName={[m.vorname, m.nachname].filter(Boolean).join(" ") || null}
            mieterEmail={m.email ?? null}
            mailVersand={brevoBereit()}
            zugangBis={zugangEndet(m.mietende)}
            zugangAbgelaufen={!!zugangEndet(m.mietende) && heuteBerlin() > zugangEndet(m.mietende)!}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Dokumente</h3><Link href="/archiv" className="btn btn-ghost" style={{ fontSize: 11 }}>→ Archiv</Link></div>
        <div className="section-body">
          {dokumente.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>Noch keine Dokumente gespeichert.</div>
          ) : (
            dokumente.map((n) => (
              <div key={n.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{n.titel || n.datei_name || "Dokument"}</span>
                {n.kategorie && <span className="badge badge-teal">{n.kategorie}</span>}
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{n.created_at ? datum(n.created_at) : ""}</span>
                {n.datei_name ? (
                  <>
                    <a href={`/archiv/${n.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Ansehen</a>
                    <a href={`/archiv/${n.id}/datei?download=1`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Herunterladen</a>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>ohne Datei</span>
                )}
                <DokumentZustellung
                  notizId={n.id}
                  mieterId={m.id}
                  titel={n.titel || n.datei_name || "Dokument"}
                  hatDatei={!!n.datei_name}
                  mieterName={mieterAnzeige}
                  pruefung={zustellPruefung}
                  zustellungen={zustellungenJe.get(n.id) ?? []}
                />
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
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: farbe, display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>{f.typ === "warn" ? <TriangleAlert size={12} style={{ flexShrink: 0 }} /> : f.typ === "ok" ? "✓" : null}<span>{f.label}</span></span>
                  <span style={{ color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>{f.datum ? datum(f.datum) : "jetzt"}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
