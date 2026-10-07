import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { eur2 } from "@/lib/format";
import { berechneNk, type NkCo2Input } from "@/lib/nk";
import { ladeVorauszahlung } from "@/lib/nkDaten";
import { ladeNkObjekt, basisMitStammdaten, nkCo2Argumente } from "@/lib/nkPositionen";
import { verteileObjektKosten, positionenFuerMieter, co2FuerMieter } from "@/lib/nkObjekt";
import { zeigeVerteiler } from "@/lib/umlage";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";
import NkObjektEditor from "@/components/nk/NkObjektEditor";

export const dynamic = "force-dynamic";

// Nebenkosten je Objekt und Jahr (Stufe 1, 07.10.2026, docs/zukunft/NK-NEU.md). Eine Seite für das
// ganze Haus: Grundlagen, Kostenarten (je einmal mit Gesamtbetrag), Verteilung Position × Mieter
// und das Ergebnis je Mieter mit Vorauszahlung — dieselbe Rechnung wie Abrechnung und PDF.

export default async function NebenkostenObjektPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jahr?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const aktuell = new Date().getFullYear();
  const jahrRoh = Number(sp.jahr);
  const jahr = Number.isInteger(jahrRoh) && jahrRoh >= 2000 && jahrRoh <= aktuell + 1 ? jahrRoh : aktuell - 1;
  const supabase = await createClient();
  const user = await aktuellerNutzer();

  const { data: prop } = await supabase
    .from("properties").select("id,bezeichnung,flaeche,einheiten_anzahl,typ").eq("id", id).eq("user_id", user?.id ?? "").maybeSingle();
  if (!prop) notFound();

  const daten = await ladeNkObjekt(supabase, id, jahr);
  const kopf = (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Link href={`/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
        <div style={{ minWidth: 0 }}>
          <div className="topbar-title">Nebenkosten {jahr}</div>
          <div className="topbar-sub">{prop.bezeichnung}</div>
        </div>
      </div>
      <form style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select name="jahr" defaultValue={jahr} className="input" style={{ width: "auto" }}>
          {[aktuell, aktuell - 1, aktuell - 2, aktuell - 3, aktuell - 4].map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}>Anzeigen</button>
      </form>
    </div>
  );

  if (!daten.bereit) {
    return (
      <div className="fade-up">
        {kopf}
        <div className="section"><div className="section-body">
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Die Nebenkosten am Objekt kommen in Kürze. Bis dahin erstellst du die Abrechnung wie bisher beim
            jeweiligen Mieter.
          </p>
        </div></div>
      </div>
    );
  }

  const ids = daten.mieter.map((m) => m.id);
  const [{ count: vorjahrAnzahl }, { data: buchungen }, { count: altAnzahl }, { data: co2Rows }, { data: vzRows }] = await Promise.all([
    supabase.from("nk_objekt_kosten").select("id", { count: "exact", head: true }).eq("prop_id", id).eq("jahr", jahr - 1),
    supabase.from("kosten").select("prop_id,buchungsdatum,kategorie,betrag").eq("prop_id", id)
      .gte("buchungsdatum", `${jahr}-01-01`).lt("buchungsdatum", `${jahr + 1}-01-01`),
    ids.length
      ? supabase.from("mieter_positionen").select("id", { count: "exact", head: true }).in("mieter_id", ids).or(`jahr.eq.${jahr},jahr.is.null`)
      : Promise.resolve({ count: 0 }),
    ids.length
      ? supabase.from("nk_co2").select("mieter_id,co2_kg,co2_kosten,flaeche,gewerbe").in("mieter_id", ids).eq("jahr", jahr)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("mieter").select("id,nk_vorauszahlung").in("id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const basis = basisMitStammdaten(daten.basis, prop);
  const e = verteileObjektKosten(jahr, basis, daten.kosten, daten.mieter);
  const vorhanden = new Set(daten.kosten.map((k) => k.bezeichnung.trim().toLowerCase()));
  const ausBuchungen = nkAusBuchungen(buchungen ?? [], id, jahr).vorschlaege.filter((v) => !vorhanden.has(v.bezeichnung.toLowerCase()));

  // Ergebnis je Mieter — dieselbe Rechnung wie die Abrechnung (berechneNk), inkl. CO₂ und Vorauszahlung.
  const mfh = zeigeVerteiler({ typ: prop.typ as string | null, einheiten_anzahl: prop.einheiten_anzahl as number | null, mieterAnzahl: daten.mieter.length });
  const co2Je = new Map(((co2Rows ?? []) as (NkCo2Input & { mieter_id: string })[]).map((r) => [r.mieter_id, r]));
  const ergebnisse = daten.kosten.length === 0 ? [] : await Promise.all(
    e.mieter.map(async (m) => {
      const vz = ((vzRows ?? []) as { id: string; nk_vorauszahlung: number | null }[]).find((r) => r.id === m.id)?.nk_vorauszahlung ?? null;
      const t = { vorname: m.name, nachname: null, mieter_adresse: null, einheit: null, flaeche: m.flaeche, mietbeginn: m.mietbeginn, mietende: m.mietende, nk_vorauszahlung: vz };
      // Dieselbe CO₂-Regel wie NK-Seite und PDF (nkCo2Argumente).
      const c = nkCo2Argumente({ co2AmObjekt: mfh, co2: co2FuerMieter(e, m.id), hinweise: mfh ? e.warnungen : [] }, co2Je.get(m.id) ?? null);
      const a = berechneNk(jahr, t, null, positionenFuerMieter(e, m.id), c.co2Input, await ladeVorauszahlung(m.id, jahr), c.opts);
      return { m, a };
    }),
  );
  const warnungen = [...new Set([...e.positionen.map((p) => p.warnung), ...(mfh ? e.warnungen : [])].filter((w): w is string => !!w))];
  const umlage = e.positionen.filter((p) => p.kosten.umlagefaehig);
  const fehltGrund = !basis.flaeche_gesamt && daten.kosten.some((k) => k.schluessel === "flaeche");

  return (
    <div className="fade-up">
      {kopf}

      {(altAnzahl ?? 0) > 0 && (
        <div className="vorbelegt-hinweis">
          {daten.kosten.length === 0
            ? `Für ${jahr} stehen noch ${altAnzahl} Positionen bei einzelnen Mietern. Sie gelten, bis du hier Kosten einträgst — danach rechnen alle Abrechnungen dieses Hauses nur noch mit den Kosten hier.`
            : `${altAnzahl} ältere Positionen bei einzelnen Mietern zählen für ${jahr} nicht mehr — es gelten nur die Kosten hier.`}
        </div>
      )}
      {fehltGrund && <div className="vorbelegt-hinweis">Trag zuerst die Gesamtwohnfläche des Hauses ein — ohne sie lässt sich nach Fläche nicht verteilen.</div>}

      <NkObjektEditor
        propId={id}
        jahr={jahr}
        jahresTage={e.jahresTage}
        mieter={e.mieter.map((m) => ({ id: m.id, name: m.name, flaeche: m.flaeche, tage: m.tage }))}
        grundlagen={{
          flaecheGesamt: basis.flaeche_gesamt, einheiten: basis.einheiten, meaGesamt: basis.mea_gesamt, mieter: basis.mieter ?? {},
          co2Kg: basis.co2_kg ?? null, co2Kosten: basis.co2_kosten ?? null, co2Gewerbe: !!basis.co2_gewerbe,
        }}
        kosten={daten.kosten.map((k) => ({
          id: k.id, bezeichnung: k.bezeichnung, betrag: k.betrag, schluessel: k.schluessel, umlagefaehig: k.umlagefaehig,
          lohnanteil: k.lohnanteil ?? null, art_35a: k.art_35a ?? null, nenner: k.nenner ?? null, werte: k.werte ?? {}, quelle: k.quelle,
        }))}
        vorschlaege={{ buchungen: ausBuchungen.length, vorjahr: vorjahrAnzahl ?? 0 }}
      />

      {umlage.length > 0 && e.mieter.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div>
              <h3>Verteilung {jahr}</h3>
              <div className="section-sub">Je Kostenart der Anteil jeder Mietpartei — was niemandem zufällt (Leerstand), trägst du.</div>
            </div>
          </div>
          <div className="section-body">
            {warnungen.length > 0 && (
              <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12.5, color: "var(--red)", display: "grid", gap: 4 }}>
                {warnungen.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <div style={{ overflowX: "auto" }} data-kein-wischen>
              <table className="nk-tabelle">
                <thead>
                  <tr>
                    <th>Kostenart</th>
                    <th>Gesamt</th>
                    {e.mieter.map((m) => <th key={m.id}>{m.name}</th>)}
                    <th>Vermieter</th>
                  </tr>
                </thead>
                <tbody>
                  {umlage.map((p) => (
                    <tr key={p.kosten.id}>
                      <td>{p.kosten.bezeichnung}</td>
                      <td>{eur2(p.kosten.betrag)}</td>
                      {e.mieter.map((m) => <td key={m.id} title={p.anteile[m.id]?.faktorText}>{eur2(p.anteile[m.id]?.betrag ?? 0)}</td>)}
                      <td>{eur2(p.vermieter)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {mfh && e.co2 && (
                    <tr>
                      <td>
                        CO₂-Gutschrift
                        <span className="nk-klein">
                          Vermieteranteil {e.co2.gebaeude.vermieterProzent} % · {e.co2.grundlage === "heizkosten" ? "nach Heizkostenanteil" : "nach Wohnfläche"}
                          {e.co2.leerstand > 0 ? ` · Leerstand ${eur2(e.co2.leerstand)}` : ""}
                        </span>
                      </td>
                      <td>−{eur2(e.co2.gebaeude.vermieterAnteil)}</td>
                      {e.mieter.map((m) => <td key={m.id}>−{eur2(e.co2!.gutschrift[m.id] ?? 0)}</td>)}
                      <td>—</td>
                    </tr>
                  )}
                  <tr>
                    <td>Summe</td>
                    <td>{eur2(e.summeGesamt)}</td>
                    {e.mieter.map((m) => <td key={m.id}>{eur2(e.summeMieter[m.id] ?? 0)}</td>)}
                    <td>{eur2(e.summeVermieter)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {ergebnisse.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div>
              <h3>Abrechnungen {jahr}</h3>
              <div className="section-sub">Kosten abzüglich geleisteter Vorauszahlungen — öffnen, prüfen, zustellen.</div>
            </div>
            <a href={`/properties/${id}/nebenkosten/pdf?jahr=${jahr}`} className="btn btn-ghost" style={{ fontSize: 12 }}>Alle als ein PDF</a>
          </div>
          <div className="section-body">
            {ergebnisse.map(({ m, a }) => (
              <Link key={m.id} href={`/tenants/${m.id}/nk?jahr=${jahr}`} className="listen-zeile">
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">{m.name}</span>
                  <span className="listen-zeile-sub" style={{ whiteSpace: "normal" }}>
                    Kosten {eur2(a.kostenNachCo2)} · Vorauszahlung {eur2(a.vorauszahlungGeleistet)}{a.vorauszahlung.geschaetzt ? " (Soll)" : ""}
                    {a.warnungen.length > 0 ? ` · ${a.warnungen.length} Hinweis${a.warnungen.length === 1 ? "" : "e"}` : ""}
                  </span>
                </span>
                <span className="listen-zeile-zahl">
                  <b style={{ color: a.saldo >= 0 ? "var(--green)" : "var(--red)" }}>{eur2(Math.abs(a.saldo))}</b>
                  <small>{a.saldo >= 0 ? "Guthaben" : "Nachzahlung"}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
