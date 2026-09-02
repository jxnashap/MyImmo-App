// Vermieter-Seite "Mieterportal": alles, was mit Personen außerhalb
// des eigenen Kontos läuft — Anliegen der Mieter und eigene Anfragen an sie,
// der Bewerbungs-Eingang mit Selbstauskunft-Links, und die Service-Partner
// (Handwerker/Hausmeister) samt Aufträgen.
// NICHT "Mieterportal" nennen: So heißt die Mieter-Oberfläche unter /portal.
import Link from "next/link";
import { MessageSquareText, UserRoundSearch, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnliegenManager, { type AnliegenVermieterRow } from "@/components/AnliegenManager";
import VermieterAnfragen, { type VermieterAnfrageRow } from "@/components/VermieterAnfragen";
import BewerbungenManager, { type BewerberLinkRow, type BewerbungRow } from "@/components/BewerbungenManager";
import ServiceManager, { type ServicePartnerRow, type ServiceCodeRow, type AuftragRow, type FirmaRow, type FirmenRueckmeldung } from "@/components/ServiceManager";

type FirmenRueckmeldungRow = FirmenRueckmeldung & { auftrag_id: string };
import { wartetAufVermieter } from "@/lib/zaehler";

export default async function AnliegenPage(
  props0: {
    searchParams: Promise<{ tab?: string; titel?: string; text?: string }>;
  }
) {
  const searchParams = await props0.searchParams;
  const tab = ["bewerbungen", "service"].includes(searchParams.tab ?? "") ? (searchParams.tab as string) : "anliegen";

  const supabase = await createClient();
  const [
    { data: rows }, { data: mieter }, { data: props }, { data: anfrageRows }, { data: zugaenge },
    { data: linkRows }, { data: bewerbungRows },
    { data: partnerRows }, { data: codeRows }, { data: auftragRows }, { data: firmenRows },
  ] = await Promise.all([
    supabase.from("anliegen").select("*").order("created_at", { ascending: false }),
    supabase.from("mieter").select("id,vorname,nachname"),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("vermieter_anfragen").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("mieter_zugaenge").select("mieter_id"),
    supabase.from("bewerber_links").select("*").order("created_at", { ascending: false }),
    supabase.from("bewerbungen").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("service_zugaenge").select("user_id,firma,email,created_at").order("created_at", { ascending: false }),
    supabase.from("einladungscodes").select("code,gueltig_bis").eq("rolle", "service").is("eingeloest_am", null).gt("gueltig_bis", new Date().toISOString()).order("created_at", { ascending: false }),
    // rechnung_data (Base64) bewusst NICHT laden — nur Metadaten für die Liste.
    supabase.from("auftraege").select("id,titel,beschreibung,termin,status,antwort,created_at,objekt_name,service_user_id,erstellt_von,firma_id,mieter_id,public_token,betrag,lohnanteil,rechnung_name,kosten_id").order("created_at", { ascending: false }).limit(100),
    supabase.from("firmen").select("id,name,gewerk,telefon,email,website,notiz").order("name"),
  ]);

  // Bewerbungs-Dokumente: nur Metadaten (ohne Base64-data) für die Liste —
  // der Download lädt die Datei einzeln über eine Server-Action.
  const { data: bewerbungDateiRows } = (bewerbungRows ?? []).length
    ? await supabase
        .from("bewerbung_dateien")
        .select("id,name,groesse,slot,bewerbung_id")
        .in("bewerbung_id", (bewerbungRows ?? []).map((b: any) => b.id))
    : { data: [] as { id: string; name: string; groesse: number; slot: string | null; bewerbung_id: string }[] };

  const { data: dateiRows } = (rows ?? []).length
    ? await supabase
        .from("anliegen_dateien")
        .select("id,name,anliegen_id")
        .in("anliegen_id", (rows ?? []).map((a) => a.id))
    : { data: [] as { id: string; name: string; anliegen_id: string }[] };

  const mieterName = (id: string) => {
    const m = (mieter ?? []).find((x) => x.id === id);
    return m ? [m.vorname, m.nachname].filter(Boolean).join(" ") : "Mieter";
  };
  const objektName = (id: string | null) =>
    (props ?? []).find((p) => p.id === id)?.bezeichnung ?? "–";

  const liste: AnliegenVermieterRow[] = (rows ?? []).map((a) => ({
    id: a.id,
    typ: a.typ,
    titel: a.titel,
    beschreibung: a.beschreibung,
    status: a.status,
    antwort: a.antwort,
    created_at: a.created_at,
    mieterName: mieterName(a.mieter_id),
    objektName: objektName(a.prop_id),
    dateien: (dateiRows ?? []).filter((d) => d.anliegen_id === a.id).map((d) => ({ id: d.id, name: d.name })),
    terminVorschlaege: Array.isArray(a.termin_vorschlaege) ? (a.termin_vorschlaege as string[]) : [],
    terminBestaetigt: a.termin_bestaetigt ?? null,
  }));

  const offen = liste.filter((a) => a.status !== "erledigt").length;

  const anfragen: VermieterAnfrageRow[] = ((anfrageRows ?? []) as any[]).map((a) => ({
    id: a.id,
    typ: a.typ,
    titel: a.titel,
    beschreibung: a.beschreibung,
    termin: a.termin,
    faellig_bis: a.faellig_bis,
    status: a.status,
    antwort: a.antwort,
    created_at: a.created_at,
    mieterName: mieterName(a.mieter_id),
    objektName: objektName(a.prop_id),
  }));
  const verbundeneIds = new Set((zugaenge ?? []).map((z) => z.mieter_id));
  const verbundeneMieter = (mieter ?? [])
    .filter((m) => verbundeneIds.has(m.id))
    .map((m) => ({ id: m.id, name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter" }));

  const links: BewerberLinkRow[] = ((linkRows ?? []) as any[]).map((l) => ({
    id: l.id, token: l.token, titel: l.titel, aktiv: l.aktiv, created_at: l.created_at,
    objektName: objektName(l.prop_id),
    anzeige: l.anzeige ?? null,
    dokumenteGewuenscht: Array.isArray(l.dokumente_gewuenscht) ? l.dokumente_gewuenscht : [],
  }));
  const bewerbungen: BewerbungRow[] = ((bewerbungRows ?? []) as any[]).map((b) => ({
    id: b.id, name: b.name, email: b.email, telefon: b.telefon, einzug_ab: b.einzug_ab,
    personen: b.personen, beruf: b.beruf, arbeitgeber: b.arbeitgeber,
    netto_einkommen: b.netto_einkommen == null ? null : Number(b.netto_einkommen),
    raucher: b.raucher, haustiere: b.haustiere, schufa: b.schufa, nachricht: b.nachricht,
    unterschrift_data: b.unterschrift_data, status: b.status, created_at: b.created_at,
    objektName: objektName(b.prop_id),
    dateien: (bewerbungDateiRows ?? [])
      .filter((d) => d.bewerbung_id === b.id)
      .map((d) => ({ id: d.id, name: d.name, groesse: d.groesse, slot: d.slot ?? null })),
  }));
  const neueBewerbungen = bewerbungen.filter((b) => b.status === "neu").length;

  const partner: ServicePartnerRow[] = ((partnerRows ?? []) as any[]).map((p) => ({
    user_id: p.user_id, firma: p.firma, email: p.email, created_at: p.created_at,
  }));
  const partnerName = (id: string) => {
    const p = partner.find((x) => x.user_id === id);
    return p?.firma || p?.email || "Partner";
  };
  const codes: ServiceCodeRow[] = ((codeRows ?? []) as any[]).map((c) => ({ code: c.code, gueltig_bis: c.gueltig_bis }));
  const firmen: FirmaRow[] = ((firmenRows ?? []) as any[]).map((f) => ({
    id: f.id, name: f.name, gewerk: f.gewerk, telefon: f.telefon,
    email: f.email, website: f.website, notiz: f.notiz,
  }));
  // Rueckmeldungen der Handwerksfirmen ueber den oeffentlichen Auftrags-Link.
  // Gezielt nachgeladen statt per Join: die Auftragsliste ist ohnehin auf 100
  // begrenzt, und ohne Auftraege gibt es nichts abzufragen.
  const auftragIds = ((auftragRows ?? []) as { id: string }[]).map((a) => a.id);
  const { data: rueckRows } = auftragIds.length
    ? await supabase
        .from("auftrag_rueckmeldungen")
        .select("id,auftrag_id,art,firma,kontakt,termin,nachricht,created_at")
        .in("auftrag_id", auftragIds)
        .order("created_at", { ascending: false })
    : { data: [] as FirmenRueckmeldungRow[] };
  const rueckProAuftrag = new Map<string, FirmenRueckmeldung[]>();
  for (const r of (rueckRows ?? []) as FirmenRueckmeldungRow[]) {
    const liste = rueckProAuftrag.get(r.auftrag_id) ?? [];
    liste.push({
      id: r.id, art: r.art, firma: r.firma, kontakt: r.kontakt,
      termin: r.termin, nachricht: r.nachricht, created_at: r.created_at,
    });
    rueckProAuftrag.set(r.auftrag_id, liste);
  }

  const auftraege: AuftragRow[] = ((auftragRows ?? []) as any[]).map((a) => ({
    id: a.id, titel: a.titel, beschreibung: a.beschreibung, termin: a.termin,
    status: a.status, antwort: a.antwort, created_at: a.created_at,
    objekt_name: a.objekt_name, partnerName: partnerName(a.service_user_id),
    erstellt_von: a.erstellt_von ?? "vermieter",
    firmaName: firmen.find((f) => f.id === a.firma_id)?.name ?? null,
    mieterName: a.mieter_id ? mieterName(a.mieter_id) : null,
    public_token: a.public_token,
    betrag: a.betrag == null ? null : Number(a.betrag),
    lohnanteil: a.lohnanteil == null ? null : Number(a.lohnanteil),
    rechnung_name: a.rechnung_name ?? null,
    kosten_id: a.kosten_id ?? null,
    rueckmeldungen: rueckProAuftrag.get(a.id) ?? [],
  }));
  // Badge: nur was auf DICH wartet — dieselbe Definition wie in der
  // Seitenleiste (lib/neuigkeiten.ts). Aufträge im Status „offen" liegen beim
  // Service-Partner und zählen deshalb nicht mit.
  const offeneAuftraege = auftraege.filter((a) => a.status === "offen" || a.status === "freigabe").length;
  const freigabeAnfragen = wartetAufVermieter(auftraege);

  const TABS = [
    { key: "anliegen", label: "Mieter-Anliegen", icon: MessageSquareText, badge: offen },
    { key: "bewerbungen", label: "Bewerbungen", icon: UserRoundSearch, badge: neueBewerbungen },
    { key: "service", label: "Service-Partner", icon: Wrench, badge: freigabeAnfragen },
  ] as const;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          {/* Vom Nutzer gewünschter Name. Hinweis: Die Mieter-Oberfläche unter
              /portal trägt denselben Namen — hier ist die Vermieter-Sicht
              (Mieter-Anliegen, Bewerbungen, Service-Partner). */}
          <div className="topbar-kicker">Verwaltung</div>
          <div className="topbar-title">Mieterportal</div>
          <div className="topbar-sub">
            {tab === "bewerbungen"
              ? `Selbstauskunft-Links & Bewerbungs-Eingang${bewerbungen.length > 0 ? ` · ${neueBewerbungen} neu von ${bewerbungen.length}` : ""}`
              : tab === "service"
                ? `Handwerker & Hausmeister verknüpfen, Aufträge vergeben${freigabeAnfragen > 0 ? ` · ${freigabeAnfragen} Freigabe-Anfrage${freigabeAnfragen > 1 ? "n" : ""} wartet` : auftraege.length > 0 ? ` · ${offeneAuftraege} offen von ${auftraege.length}` : ""}`
                : `Meldungen deiner Mieter & deine Anfragen an sie${liste.length > 0 ? ` · ${offen} offen von ${liste.length}` : ""}`}
          </div>
        </div>
      </div>

      {/* Bereichs-Umschalter im Glass-Stil (wie im Mieter-Portal) */}
      <nav className="glass-bar" aria-label="Bereiche" style={{ marginBottom: 20 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.key} href={`/anliegen?tab=${t.key}`} className={`glass-item ${tab === t.key ? "active" : ""}`}>
              <Icon size={14} /> {t.label}
              {/* Zähler bleibt auch im AKTIVEN Reiter stehen, nur farblich
                  zurückgenommen. Ihn dort auszublenden las sich wie
                  „abgearbeitet", obwohl nichts erledigt war. */}
              {t.badge > 0 && (
                <span
                  className={tab === t.key ? "badge" : "badge badge-amber"}
                  style={{
                    fontSize: 10,
                    padding: "1px 7px",
                    ...(tab === t.key ? { background: "rgba(0,0,0,.14)", color: "inherit" } : {}),
                  }}
                >
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "anliegen" && (
        <>
          <VermieterAnfragen anfragen={anfragen} mieter={verbundeneMieter} />
          <div className="section">
            <div className="section-header"><h3>Meldungen deiner Mieter</h3></div>
            <div className="section-body">
              <AnliegenManager rows={liste} />
            </div>
          </div>
        </>
      )}

      {tab === "bewerbungen" && (
        <BewerbungenManager links={links} bewerbungen={bewerbungen} properties={props ?? []} />
      )}

      {tab === "service" && (
        <ServiceManager
          partner={partner}
          codes={codes}
          auftraege={auftraege}
          properties={props ?? []}
          firmen={firmen}
          mieterListe={(mieter ?? []).map((m) => ({ id: m.id, name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter" }))}
          initialTitel={searchParams.titel}
          initialText={searchParams.text}
        />
      )}
    </div>
  );
}
