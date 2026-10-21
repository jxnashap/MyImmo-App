import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { heuteBerlin } from "@/lib/zeitraum";
import { eur2 } from "@/lib/format";
import { alleZeilen, nurKonto, vielleichtAlle } from "@/lib/db/auswertung";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { nkAmObjekt } from "@/lib/nkPositionen";
import {
  jahresPruefung, JP_ART_TITEL, JP_ARTEN,
  type JpEinnahme, type JpEingang, type JpKosten, type JpKredit, type JpMeldung, type JpMieter, type JpNk, type JpPunkt,
  type JpVerbrauch, type JpZeitraum,
} from "@/lib/jahresPruefung";
import { CircleCheck } from "lucide-react";

export const dynamic = "force-dynamic";

// Jahresprüfung je Objekt (Ablauf E, Prüfstand 11.10.2026): Was vor dem Jahresabschluss fehlt oder
// nicht zusammenpasst — mit Sprungziel. Ein Punkt verschwindet erst, wenn die Daten ihn nicht mehr
// ergeben (kein Abhaken). Darunter der Abgleich von Jahresbericht, Buchungssaldo, DATEV-Export und
// Nebenkostenabrechnung gegen die gebuchten Beträge. Anlage V gehört nicht hierher (Steuerseite).

const EINNAHME_SPALTEN = "id,prop_id,mieter_id,buchungsdatum,betrag,kategorie,soll_monat,nk_anteil,beschreibung";
const MIETER_SPALTEN = "id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kaltmiete,nk_vorauszahlung,stellplatz_miete,minderungen";

export default async function JahrespruefungPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jahr?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const heute = heuteBerlin();
  const aktuell = Number(heute.slice(0, 4));
  const jahrRoh = Number(sp.jahr);
  const jahr = Number.isInteger(jahrRoh) && jahrRoh >= 2000 && jahrRoh <= aktuell ? jahrRoh : aktuell - 1;
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  if (!user) notFound();

  const { data: prop } = await supabase
    .from("properties").select("id,bezeichnung,einheiten_anzahl,kaufdatum,typ").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!prop) notFound();

  const eigen = nurKonto(user.id);
  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  // Grundlagen vollständig (alleZeilen wirft → Fehlerkarte, nie eine Prüfliste aus einem Teilbestand).
  const [mieter, zeitraeume, einnahmenObjekt, kosten, kredite] = await Promise.all([
    alleZeilen<JpMieter>(supabase, "mieter", MIETER_SPALTEN, eigen),
    alleZeilen<JpZeitraum>(supabase, "miet_zeitraeume", "id,mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete", eigen),
    alleZeilen<JpEinnahme>(supabase, "einnahmen", EINNAHME_SPALTEN, (q) => eigen(q).eq("prop_id", id).gte("buchungsdatum", von).lte("buchungsdatum", bis)),
    alleZeilen<JpKosten>(supabase, "kosten", KOSTEN_SPALTEN, (q) => eigen(q).eq("prop_id", id).gte("buchungsdatum", von).lte("buchungsdatum", bis)),
    alleZeilen<JpKredit & { id: string }>(supabase, "kredite", "*", (q) => eigen(q).eq("prop_id", id)),
  ]);
  const mieterHier = mieter.filter((m) => m.prop_id === id);
  const idsHier = mieterHier.map((m) => m.id);
  // Zahlungen der Mieter dieses Objekts an beliebigem Tag (die Dezember-Miete kommt oft im Januar) und
  // bei beliebigem Objekt (eine Zahlung beim falschen Objekt fällt nur so auf).
  const einnahmenMieter = idsHier.length
    ? await alleZeilen<JpEinnahme>(supabase, "einnahmen", EINNAHME_SPALTEN, (q) => eigen(q).in("mieter_id", idsHier))
    : [];
  const einnahmen = [...new Map([...einnahmenObjekt, ...einnahmenMieter].map((x) => [x.id, x])).values()];

  // Weitere Quellen dürfen einzeln fehlen — dann sagt die Seite, welche.
  const mfh = await nkAmObjekt(supabase, id);
  const [meldungen, verbrauch, eingang, nkObjekt, nkMieter] = await Promise.all([
    vielleichtAlle<JpMeldung>(supabase, "zaehlerstand_meldungen", "id,mieter_id,prop_id,ablesedatum,uebernommen_am,art", (q) => nurKonto(user.id, "vermieter_id")(q).gte("ablesedatum", von).lte("ablesedatum", bis)),
    vielleichtAlle<JpVerbrauch & { id: string }>(supabase, "verbrauch", "id,prop_id,buchungsdatum", (q) => eigen(q).eq("prop_id", id).gte("buchungsdatum", `${jahr - 1}-12-01`).lte("buchungsdatum", `${jahr + 1}-01-31`)),
    vielleichtAlle<{ id: string; status: string; vorschlag: { prop_id?: string | null } | null }>(supabase, "beleg_eingang", "id,status,vorschlag", (q) => eigen(q).neq("status", "gebucht")),
    mfh ? vielleichtAlle<{ id: string; bezeichnung: string; betrag: number; umlagefaehig: boolean | null }>(supabase, "nk_objekt_kosten", "id,bezeichnung,betrag,umlagefaehig", (q) => q.eq("prop_id", id).eq("jahr", jahr)) : Promise.resolve([]),
    idsHier.length
      ? vielleichtAlle<{ id: string; bezeichnung: string | null; betrag: number | null; umlagefaehig: boolean | null; jahr: number | null }>(supabase, "mieter_positionen", "id,bezeichnung,betrag,umlagefaehig,jahr", (q) => q.in("mieter_id", idsHier).eq("jahr", jahr))
      : Promise.resolve([]),
  ]);
  const fehlend = ([[meldungen, "Zählerstand-Meldungen"], [verbrauch, "Verbrauch"], [eingang, "Belegeingang"], [nkObjekt, "NK am Objekt"], [nkMieter, "NK beim Mieter"]] as const)
    .filter(([r]) => r === null).map(([, n]) => n);
  const nkObj = (nkObjekt ?? []).filter((k) => k.umlagefaehig !== false);
  const nkMie = (nkMieter ?? []).filter((p) => p.umlagefaehig !== false && p.bezeichnung);
  const nk: JpNk = nkObj.length > 0
    ? { quelle: "objekt", positionen: nkObj.map((k) => ({ bezeichnung: k.bezeichnung, betrag: Number(k.betrag) || 0 })) }
    : nkMie.length > 0
      ? { quelle: "mieter", positionen: nkMie.map((p) => ({ bezeichnung: p.bezeichnung!, betrag: Number(p.betrag) || 0 })) }
      : { quelle: "keine", positionen: [] };

  const ergebnis = jahresPruefung({
    jahr, heute,
    objekt: { id, bezeichnung: prop.bezeichnung, einheiten_anzahl: prop.einheiten_anzahl, kaufdatum: prop.kaufdatum },
    mieter, zeitraeume, einnahmen, kosten, kredite,
    meldungen: meldungen ?? [],
    verbrauch: verbrauch ?? [],
    belegEingang: (eingang ?? []).map((b): JpEingang => ({ id: b.id, status: b.status, prop_id: b.vorschlag?.prop_id ?? null })),
    nk,
  });

  const jahre = [aktuell - 2, aktuell - 1, aktuell];
  const schwereStil: Record<JpPunkt["schwere"], string> = { hoch: "badge badge-red", mittel: "badge badge-amber", hinweis: "badge" };
  const schwereText: Record<JpPunkt["schwere"], string> = { hoch: "wichtig", mittel: "prüfen", hinweis: "Hinweis" };

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link href={`/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">Jahresprüfung {jahr}</div>
            <div className="topbar-sub">{prop.bezeichnung} · ohne Anlage V (die steht unter Steuer)</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {jahre.map((j) => (
            <Link key={j} href={`/properties/${id}/jahrespruefung?jahr=${j}`} className={j === jahr ? "btn btn-gold" : "btn btn-ghost"} style={{ fontSize: 12, padding: "5px 12px" }} aria-current={j === jahr ? "page" : undefined}>{j}</Link>
          ))}
        </div>
      </div>
      <hr className="topbar-rule" />

      {fehlend.length > 0 && (
        <div className="rueckfrage-hinweis" role="note" style={{ marginBottom: 16 }}>
          Nicht geladen: {fehlend.join(", ")} — die Prüfliste ist dort unvollständig. Bitte später erneut öffnen.
        </div>
      )}
      {jahr === aktuell && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>Laufendes Jahr: geprüft bis heute ({heute.split("-").reverse().join(".")}).</p>
      )}

      <div className="section">
        <div className="section-header"><h3>Prüfliste</h3><span style={{ fontSize: 12, color: "var(--muted)" }}>{ergebnis.punkte.length === 0 ? "nichts offen" : `${ergebnis.punkte.length} ${ergebnis.punkte.length === 1 ? "Punkt" : "Punkte"}`}</span></div>
        <div className="section-body">
          {ergebnis.punkte.length === 0 ? (
            <p style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><CircleCheck size={16} style={{ color: "var(--green)" }} /> Für {jahr} ist nichts offen. Ein Punkt verschwindet erst, wenn die Daten ihn nicht mehr ergeben.</p>
          ) : (
            JP_ARTEN.filter((a) => ergebnis.anzahl[a] > 0).map((art) => (
              <div key={art} className="jp-gruppe">
                <div className="tz-gruppe" data-kopf>{JP_ART_TITEL[art]} ({ergebnis.anzahl[art]})</div>
                {ergebnis.punkte.filter((p) => p.art === art).map((p) => (
                  <Link key={p.schluessel} href={p.href} className="listen-zeile jp-zeile">
                    <span className={schwereStil[p.schwere]}>{schwereText[p.schwere]}</span>
                    <span className="jp-text">{p.text}</span>
                    <span aria-hidden="true" className="jp-pfeil">›</span>
                  </Link>
                ))}
              </div>
            ))
          )}
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 0" }}>
            Nichts wird hier abgehakt: Ein Punkt schließt sich, sobald die Ursache in den Daten behoben ist —
            Beleg angehängt, Zahlung zugeordnet, Vertrag korrigiert. Zwei echte gleiche Buchungen unterscheidest
            du über die Beschreibung (z. B. Rechnungsnummer).
          </p>
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Abgleich mit den gebuchten Beträgen</h3></div>
        <div className="section-body">
          <div className="table-scroll">
            <table className="jp-abgleich">
              <thead><tr><th>Prüfung</th><th>Grundlage</th><th style={{ textAlign: "right" }}>Wert</th><th>Vergleich</th><th style={{ textAlign: "right" }}>Wert</th><th style={{ textAlign: "right" }}>Differenz</th></tr></thead>
              <tbody>
                {ergebnis.abgleich.map((a) => {
                  const zahl = a.bezeichnung.includes("Anzahl") ? (n: number) => n.toLocaleString("de-DE") : eur2;
                  return (
                    <tr key={a.bezeichnung} title={a.erklaerung}>
                      <td>{a.bezeichnung}</td>
                      <td style={{ color: "var(--muted)" }}>{a.aLabel}</td>
                      <td style={{ textAlign: "right" }}>{zahl(a.a)}</td>
                      <td style={{ color: "var(--muted)" }}>{a.bLabel}</td>
                      <td style={{ textAlign: "right" }}>{zahl(a.b)}</td>
                      <td style={{ textAlign: "right", color: a.stimmt ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{a.stimmt ? "✓ stimmt" : zahl(a.differenz)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0" }}>
            Jahresbericht, Buchungssaldo, DATEV-Export und Nebenkosten werden hier mit denselben Rechnungen
            erzeugt wie auf ihren eigenen Seiten. Die Vorauszahlungs- und NK-Zeilen zeigen erwartete
            Abweichungen (Rückstände, noch nicht übernommene Kosten) — sie stehen dann oben als Prüfpunkt.
          </p>
        </div>
      </div>
    </div>
  );
}
