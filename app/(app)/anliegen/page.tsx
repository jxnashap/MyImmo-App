// Vermieter-Seite "Mieterportal": alles, was mit Personen außerhalb
// des eigenen Kontos läuft — Anliegen der Mieter und eigene Anfragen an sie,
// der Bewerbungs-Eingang mit Selbstauskunft-Links, und die Service-Partner
// (Handwerker/Hausmeister) samt Aufträgen.
// NICHT "Mieterportal" nennen: So heißt die Mieter-Oberfläche unter /portal.
import { heuteBerlin } from "@/lib/zeitraum";
import { ladeEreignisse } from "@/lib/vorgang";
import Link from "next/link";
import { MessageSquareText, UserRoundSearch, Wrench, Eye, Megaphone } from "lucide-react";
import HausManager, { type GesendeteMitteilung, type HausInfo } from "@/components/HausManager";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladePortalDaten, vorschauUrl, type VorschauMieter } from "@/lib/portalDaten";
import PortalAnsicht, { portalTab } from "@/components/PortalAnsicht";
import PortalVorschauWahl from "@/components/PortalVorschauWahl";
import ServicePortalAnsicht from "@/components/ServicePortalAnsicht";
import ServiceVorschauWahl from "@/components/ServiceVorschauWahl";
import { ladeServicePortalDaten, type VorschauPartner } from "@/lib/servicePortalDaten";
import { ansichtenSichtbar, istDemoKonto } from "@/lib/demo";
import Leer from "@/components/Leer";
import WischReiter from "@/components/WischReiter";
import GlassLeiste from "@/components/GlassLeiste";
import AnliegenManager, { AnliegenDetail, type AnliegenVermieterRow, type AngebotKontext } from "@/components/AnliegenManager";
import type { Angebot, Angebotsanfrage } from "@/lib/angebote";
import VermieterAnfragen, { type VermieterAnfrageRow } from "@/components/VermieterAnfragen";
import BewerbungenManager, { type BewerberLinkRow, type BewerbungRow } from "@/components/BewerbungenManager";
import { AUFTRAG_NOTIZ_SPALTEN, notizenJeAuftrag, type AuftragNotiz } from "@/lib/auftragNotizen";
import ServiceManager, { type ServicePartnerRow, type ServiceCodeRow, type AuftragRow, type FirmaRow, type FirmenRueckmeldung } from "@/components/ServiceManager";

type FirmenRueckmeldungRow = FirmenRueckmeldung & { auftrag_id: string };
import { wartetAufVermieter } from "@/lib/zaehler";

export default async function AnliegenPage(
  props0: {
    searchParams: Promise<{ tab?: string; titel?: string; text?: string; mieter?: string; portal?: string; partner?: string; vorgang?: string }>;
  }
) {
  const searchParams = await props0.searchParams;
  const user = await aktuellerNutzer();
  // „Ansicht Mieter" / „Ansicht Service" gibt es nur in der Demo
  // (ANSICHTEN_NUR_DEMO in lib/demo.ts). Ein echter Vermieter, der die
  // Adresse von Hand eingibt, landet bei den Anliegen.
  const ansichten = ansichtenSichtbar(user?.email);
  const erlaubteTabs = ["bewerbungen", "service", "haus", ...(ansichten ? ["vorschau", "vorschau-service"] : [])];
  const tab = erlaubteTabs.includes(searchParams.tab ?? "") ? (searchParams.tab as string) : "anliegen";
  const demo = istDemoKonto(user?.email);

  const supabase = await createClient();
  const [
    { data: rows }, { data: mieter }, { data: props }, { data: anfrageRows }, { data: zugaenge },
    { data: linkRows }, { data: bewerbungRows },
    { data: partnerRows }, { data: codeRows }, { data: auftragRows }, { data: firmenRows }, { data: zuordnungRows },
  ] = await Promise.all([
    supabase.from("anliegen").select("*").order("created_at", { ascending: false }),
    supabase.from("mieter").select("id,vorname,nachname,prop_id,mietende"),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("vermieter_anfragen").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("mieter_zugaenge").select("mieter_id,user_id,prop_id"),
    supabase.from("bewerber_links").select("*").order("created_at", { ascending: false }),
    supabase.from("bewerbungen").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("service_zugaenge").select("user_id,firma,email,created_at,rolle").order("created_at", { ascending: false }),
    supabase.from("einladungscodes").select("code,gueltig_bis").eq("rolle", "service").is("eingeloest_am", null).gt("gueltig_bis", new Date().toISOString()).order("created_at", { ascending: false }),
    // rechnung_data (Base64) bewusst NICHT laden — nur Metadaten für die Liste.
    supabase.from("auftraege").select("id,titel,beschreibung,termin,status,antwort,created_at,objekt_name,service_user_id,erstellt_von,firma_id,mieter_id,public_token,betrag,lohnanteil,rechnung_name,kosten_id,kosten_schaetzung,auto_freigegeben,vorgeschlagene_firma_id,taetigkeit").order("created_at", { ascending: false }).limit(100),
    supabase.from("firmen").select("id,name,gewerk,telefon,email,website,notiz").order("name"),
    // Welcher Partner betreut welche Objekte (Migration 20261005100000).
    supabase.from("service_objekte").select("service_user_id,prop_id"),
  ]);

  // Bewerbungs-Dokumente: nur Metadaten (ohne Base64-data) für die Liste —
  // der Download lädt die Datei einzeln über eine Server-Action.
  const { data: bewerbungDateiRows } = (bewerbungRows ?? []).length
    ? await supabase
        .from("bewerbung_dateien")
        .select("id,name,groesse,slot,bewerbung_id")
        .in("bewerbung_id", (bewerbungRows ?? []).map((b) => b.id))
    : { data: [] as { id: string; name: string; groesse: number; slot: string | null; bewerbung_id: string }[] };

  const { data: dateiRows } = (rows ?? []).length
    ? await supabase
        .from("anliegen_dateien")
        .select("id,name,anliegen_id")
        .in("anliegen_id", (rows ?? []).map((a) => a.id))
    : { data: [] as { id: string; name: string; anliegen_id: string }[] };

  // Verlauf je Anliegen (Nachrichten, Status, Termine, Aufträge) — lib/vorgang.ts.
  const verlauf = await ladeEreignisse(supabase, (rows ?? []).map((a) => a.id));

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
    verlauf: verlauf.get(a.id) ?? [],
    created_at: a.created_at,
    mieterName: mieterName(a.mieter_id),
    objektName: objektName(a.prop_id),
    dateien: (dateiRows ?? []).filter((d) => d.anliegen_id === a.id).map((d) => ({ id: d.id, name: d.name })),
    terminVorschlaege: Array.isArray(a.termin_vorschlaege) ? (a.termin_vorschlaege as string[]) : [],
    terminBestaetigt: a.termin_bestaetigt ?? null,
    mieterId: a.mieter_id ?? null,
  }));
  // `?vorgang=<id>` öffnet die Detailansicht — nur ein eigenes Anliegen aus der geladenen Liste.
  const vorgang = searchParams.vorgang ? liste.find((a) => a.id === searchParams.vorgang) ?? null : null;

  const offen = liste.filter((a) => a.status !== "erledigt").length;

  const anfragen: VermieterAnfrageRow[] = (anfrageRows ?? []).map((a) => ({
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

  const links: BewerberLinkRow[] = (linkRows ?? []).map((l) => ({
    id: l.id, token: l.token, titel: l.titel, aktiv: l.aktiv, created_at: l.created_at,
    objektName: objektName(l.prop_id),
    anzeige: l.anzeige ?? null,
    dokumenteGewuenscht: Array.isArray(l.dokumente_gewuenscht) ? l.dokumente_gewuenscht : [],
  }));
  const bewerbungen: BewerbungRow[] = (bewerbungRows ?? []).map((b) => ({
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

  const zuordnung = (zuordnungRows ?? []) as { service_user_id: string; prop_id: string }[];
  const partner: ServicePartnerRow[] = (partnerRows ?? []).map((p) => ({
    user_id: p.user_id, firma: p.firma, email: p.email, created_at: p.created_at,
    rolle: p.rolle === "dienstleister" ? "dienstleister" : "hausmeister",
    objekte: zuordnung.filter((z) => z.service_user_id === p.user_id).map((z) => z.prop_id),
  }));
  const partnerName = (id: string) => {
    const p = partner.find((x) => x.user_id === id);
    return p?.firma || p?.email || "Partner";
  };
  const codes: ServiceCodeRow[] = (codeRows ?? []).map((c) => ({ code: c.code, gueltig_bis: c.gueltig_bis }));
  const firmen: FirmaRow[] = (firmenRows ?? []).map((f) => ({
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

  // Verlauf der Aufträge (Notizen, Fotos des Hausmeisters) — ohne Bilddaten.
  const { data: notizRows } = auftragIds.length
    ? await supabase.from("auftrag_notizen").select(AUFTRAG_NOTIZ_SPALTEN).in("auftrag_id", auftragIds).order("created_at")
    : { data: [] };
  const notizenJe = notizenJeAuftrag((notizRows ?? []) as AuftragNotiz[]);
  const auftraege: AuftragRow[] = (auftragRows ?? []).map((a) => ({
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
    kosten_schaetzung: a.kosten_schaetzung == null ? null : Number(a.kosten_schaetzung),
    auto_freigegeben: a.auto_freigegeben === true,
    rueckmeldungen: rueckProAuftrag.get(a.id) ?? [],
    vorgeschlageneFirma: firmen.find((f) => f.id === a.vorgeschlagene_firma_id)?.name ?? null,
    notizen: notizenJe.get(a.id) ?? [],
    taetigkeit: a.taetigkeit ?? null,
  }));
  // Badge: nur was auf DICH wartet — dieselbe Definition wie in der
  // Seitenleiste (lib/neuigkeiten.ts). Aufträge im Status „offen" liegen beim
  // Service-Partner und zählen deshalb nicht mit.
  const offeneAuftraege = auftraege.filter((a) => a.status === "offen" || a.status === "freigabe").length;
  const freigabeAnfragen = wartetAufVermieter(auftraege);

  // Mieterportal-Vorschau (01.10.2026, Wunsch des Betreibers): „So sieht dein
  // Mieter das Portal" — mit den eigenen Daten, ohne zweites Konto. Gleicher
  // Lader und gleiche Darstellung wie /portal (lib/portalDaten.ts,
  // components/PortalAnsicht.tsx), Formulare nur zur Ansicht.
  // Reihenfolge: verknüpfte Mieter zuerst (dort ist die Vorschau am
  // aussagekräftigsten), dann laufende Verträge.
  const vorschauListe: VorschauMieter[] = (mieter ?? [])
    .map((m) => ({
      id: m.id,
      name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
      objekt: objektName(m.prop_id),
      verknuepft: verbundeneIds.has(m.id),
      beendet: !!m.mietende && m.mietende < heuteBerlin(),
    }))
    .sort((a, b) => Number(b.verknuepft) - Number(a.verknuepft) || Number(a.beendet) - Number(b.beendet) || a.name.localeCompare(b.name, "de"))
    .map(({ id, name, objekt, verknuepft }) => ({ id, name, objekt, verknuepft }));
  // Nur ein Mieter aus der EIGENEN Liste — eine fremde ID im Link zeigt nichts.
  const vorschauMieter = vorschauListe.find((m) => m.id === searchParams.mieter) ?? vorschauListe[0] ?? null;
  const portalReiter = portalTab(searchParams.portal);
  const vorschauDaten = tab === "vorschau" && vorschauMieter
    ? await ladePortalDaten(supabase, { art: "vermieter", vermieterId: user!.id, mieterId: vorschauMieter.id })
    : null;

  // Ansicht Service (01.10.2026, nur Demo): das Service-Portal mit den Augen
  // eines verknüpften Partners. Partner mit offenen Aufträgen zuerst.
  const partnerListe: VorschauPartner[] = partner
    .map((p) => ({
      id: p.user_id,
      name: p.firma || p.email || "Service-Partner",
      offen: auftraege.filter((a) => a.partnerName === (p.firma || p.email || "Partner") && ["offen", "angenommen", "freigabe"].includes(a.status)).length,
    }))
    .sort((a, b) => b.offen - a.offen || a.name.localeCompare(b.name, "de"));
  // Nur ein Partner aus der EIGENEN Liste.
  const vorschauPartner = partnerListe.find((p) => p.id === searchParams.partner) ?? partnerListe[0] ?? null;
  const serviceDaten = tab === "vorschau-service" && vorschauPartner
    ? await ladeServicePortalDaten(supabase, { art: "vermieter", vermieterId: user!.id, serviceUserId: vorschauPartner.id })
    : null;

  // Kostengrenze für Hausmeister-Anträge (02.10.2026) — nur im Service-Reiter gebraucht.
  let kostengrenze: number | null = null;
  let absenderName: string | null = null;
  if ((tab === "service" || tab === "anliegen") && user) {
    const { data: profil } = await supabase.from("vermieter_profil").select("kostengrenze,name").eq("user_id", user.id).maybeSingle();
    kostengrenze = profil?.kostengrenze == null ? null : Number(profil.kostengrenze);
    absenderName = profil?.name ?? null;
  }

  // „Angebote einholen“ (02.10.2026): Anfragen + Angebote nur im Anliegen-Reiter laden.
  let angebotKontext: AngebotKontext | undefined;
  if (tab === "anliegen" && user) {
    const [{ data: qRows }, { data: gRows }] = await Promise.all([
      supabase.from("angebotsanfragen")
        .select("id,anliegen_id,firma_id,status,public_token,token_ablauf,auftrag_id,created_at")
        .eq("vermieter_id", user.id).order("created_at", { ascending: true }).limit(500),
      supabase.from("angebote").select("id,anfrage_id,firma,kontakt,betrag,termin,nachricht,created_at").limit(1500),
    ]);
    const anfragenJe: Record<string, Angebotsanfrage[]> = {};
    for (const q of (qRows ?? []) as Omit<Angebotsanfrage, "angebote">[]) {
      const angebote = ((gRows ?? []) as Angebot[])
        .filter((g) => g.anfrage_id === q.id)
        .map((g) => ({ ...g, betrag: Number(g.betrag) }));
      (anfragenJe[q.anliegen_id] ??= []).push({ ...q, angebote });
    }
    angebotKontext = {
      firmen: firmen.map((f) => ({ id: f.id, name: f.name, gewerk: f.gewerk, email: f.email })),
      anfragen: anfragenJe,
      kostengrenze,
      auftragTokens: Object.fromEntries(((auftragRows ?? []) as { id: string; public_token: string }[]).map((a) => [a.id, a.public_token])),
      absender: absenderName,
    };
  }

  // Mitteilungen & Haus (02.10.2026): nur laden, wenn der Reiter offen ist.
  let hausDaten: { gesendet: GesendeteMitteilung[]; infos: HausInfo[]; objekte: { id: string; bezeichnung: string; verbunden: number }[] } | null = null;
  if (tab === "haus" && user) {
    const [{ data: zRows }, { data: iRows }] = await Promise.all([
      supabase.from("zustellungen")
        .select("gruppe,titel,nachricht,zugestellt_am,bestaetigung_noetig,bestaetigt_am,zurueckgezogen_am")
        .eq("vermieter_id", user.id).eq("art", "mitteilung")
        .order("zugestellt_am", { ascending: false }).limit(500),
      supabase.from("gebaeude_infos").select("prop_id,hausmeister,notdienst,muell,hausordnung,sonstiges").eq("vermieter_id", user.id),
    ]);
    const gruppen = new Map<string, GesendeteMitteilung>();
    for (const z of (zRows ?? []) as { gruppe: string | null; titel: string; nachricht: string; zugestellt_am: string; bestaetigung_noetig: boolean; bestaetigt_am: string | null; zurueckgezogen_am: string | null }[]) {
      if (!z.gruppe) continue;
      const g = gruppen.get(z.gruppe) ?? { gruppe: z.gruppe, titel: z.titel, nachricht: z.nachricht, zugestellt_am: z.zugestellt_am, empfaenger: 0, bestaetigt: 0, bestaetigung_noetig: z.bestaetigung_noetig, zurueckgezogen: true };
      g.empfaenger += 1;
      if (z.bestaetigt_am) g.bestaetigt += 1;
      if (!z.zurueckgezogen_am) g.zurueckgezogen = false;
      gruppen.set(z.gruppe, g);
    }
    const verbundenJe = new Map<string, number>();
    for (const z of (zugaenge ?? []) as { prop_id: string | null }[]) if (z.prop_id) verbundenJe.set(z.prop_id, (verbundenJe.get(z.prop_id) ?? 0) + 1);
    hausDaten = {
      gesendet: Array.from(gruppen.values()).slice(0, 30),
      infos: (iRows ?? []) as HausInfo[],
      objekte: (props ?? []).map((p) => ({ id: p.id, bezeichnung: p.bezeichnung ?? "Objekt", verbunden: verbundenJe.get(p.id) ?? 0 })),
    };
  }

  const TABS = [
    { key: "anliegen", label: "Mieter-Anliegen", icon: MessageSquareText, badge: offen },
    { key: "bewerbungen", label: "Bewerbungen", icon: UserRoundSearch, badge: neueBewerbungen },
    { key: "service", label: "Service-Partner", icon: Wrench, badge: freigabeAnfragen },
    { key: "haus", label: "Mitteilungen & Haus", icon: Megaphone, badge: 0 },
    ...(ansichten
      ? ([
          { key: "vorschau", label: "Ansicht Mieter", icon: Eye, badge: 0 },
          { key: "vorschau-service", label: "Ansicht Service", icon: Eye, badge: 0 },
        ] as const)
      : []),
  ];

  const inhalt = (
    <>
        {tab === "anliegen" && (vorgang ? (
          // Detailansicht eines Anliegens (03.10.2026): eigene Seite statt Aufklappen in der Liste.
          <AnliegenDetail a={vorgang} angebote={angebotKontext} />
        ) : (
          <>
            <div className="section">
              <div className="section-header">
                <div>
                  <h3>Meldungen deiner Mieter</h3>
                  <div className="section-sub">Antippen öffnet Verlauf, Antwort und Termin</div>
                </div>
              </div>
              <div className="section-body">
                <AnliegenManager rows={liste} />
              </div>
            </div>
            <VermieterAnfragen anfragen={anfragen} mieter={verbundeneMieter} />
          </>
        ))}

        {tab === "vorschau" && (
          vorschauMieter === null ? (
            <Leer
              icon={Eye}
              art="nichts"
              titel="Noch keine Mieter"
              text="Die Vorschau zeigt das Mieterportal aus der Sicht eines deiner Mieter — lege zuerst einen Mieter an."
              aktion={{ href: "/tenants/new", label: "Mieter anlegen" }}
            />
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <PortalVorschauWahl mieter={vorschauListe} aktuell={vorschauMieter.id} portal={portalReiter} />
                {vorschauDaten?.zugangBeendet && (
                  <span role="status" style={{ fontSize: 12, color: "var(--amber)" }}>
                    Der Portal-Zugang von {vorschauMieter.name} endete am{" "}
                    {vorschauDaten.zugangBeendet.split("-").reverse().join(".")} (Auszug + Nachlauf) — der Mieter
                    sieht seine Wohnung, Zahlungen und Dokumente nicht mehr.
                  </span>
                )}
                {!vorschauDaten?.mieterKontoVerknuepft && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {vorschauMieter.name} hat noch kein Konto — Anliegen und Zählerstände erscheinen erst nach
                    der Einladung. <Link href={`/tenants/${vorschauMieter.id}`} style={{ color: "var(--gold)" }}>Einladen</Link>
                  </span>
                )}
              </div>
              <div
                className="portal-vorschau"
                aria-label={`Vorschau: Mieterportal von ${vorschauMieter.name}`}
                style={{ border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
              >
                {vorschauDaten && (
                  <PortalAnsicht
                    daten={vorschauDaten}
                    tab={portalReiter}
                    hrefFuer={(t) => vorschauUrl(vorschauMieter.id, t)}
                    kopfzeile={`${vorschauMieter.name} · Ansicht des Mieters`}
                    vorgang={searchParams.vorgang ?? null}
                    vorschau
                  />
                )}
              </div>
            </>
          )
        )}

        {tab === "vorschau-service" && (
          vorschauPartner === null ? (
            <Leer
              icon={Eye}
              art="nichts"
              titel="Noch kein Service-Partner"
              text="Die Ansicht zeigt das Service-Portal aus der Sicht eines verknüpften Hausmeisters oder Handwerkers — verknüpfe zuerst einen Partner."
              aktion={{ href: "/anliegen?tab=service", label: "Service-Partner" }}
            />
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <ServiceVorschauWahl partner={partnerListe} aktuell={vorschauPartner.id} />
              </div>
              <div
                className="portal-vorschau"
                aria-label={`Ansicht: Service-Portal von ${vorschauPartner.name}`}
                style={{ border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
              >
                {serviceDaten && (
                  <ServicePortalAnsicht
                    daten={serviceDaten}
                    kopfzeile={`${vorschauPartner.name} · Ansicht des Service-Partners`}
                    vorschau
                    ansichtImVermieterKonto
                  />
                )}
              </div>
            </>
          )
        )}

        {tab === "haus" && hausDaten && (
          <HausManager objekte={hausDaten.objekte} gesendet={hausDaten.gesendet} infos={hausDaten.infos} />
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
            demo={demo}
            kostengrenze={kostengrenze}
            initialTitel={searchParams.titel}
            initialText={searchParams.text}
          />
        )}
    </>
  );

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
              : tab === "vorschau"
                ? "So sieht dein Mieter das Portal — mit deinen Daten, nur zur Ansicht"
              : tab === "vorschau-service"
                ? "So sieht dein Hausmeister oder Handwerker das Service-Portal — Formulare zum Ausprobieren, gesendet wird nichts"
              : tab === "haus"
                ? "Mitteilungen an deine Mieter und Infos zum Haus — sichtbar im Mieterportal"
              : tab === "service"
                ? `Handwerker & Hausmeister verknüpfen, Aufträge vergeben${freigabeAnfragen > 0 ? ` · ${freigabeAnfragen} Freigabe-Anfrage${freigabeAnfragen > 1 ? "n warten" : " wartet"}` : auftraege.length > 0 ? ` · ${offeneAuftraege}\u00a0von ${auftraege.length}\u00a0offen` : ""}`
                : `Meldungen deiner Mieter & deine Anfragen an sie${liste.length > 0 ? ` · ${offen}\u00a0von ${liste.length}\u00a0offen` : ""}`}
          </div>
        </div>
      </div>

      {/* Bereichs-Umschalter im Glass-Stil (wie im Mieter-Portal) */}
      <GlassLeiste aktiv={tab} label="Bereiche" style={{ marginBottom: 20 }}>
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
                    fontSize: 11,
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
      </GlassLeiste>

      {/* Wischen über den Inhalt wechselt den Reiter (01.10.2026). Nur der
          aktive Reiter ist geladen — die Nachbarn gleiten als Platzhalter
          herein, bis der Server die Seite liefert. In der Ansicht Mieter
          wischt man die Reiter des Mieterportals; der innere Bereich hält
          die Geste an. */}
      <WischReiter
        aktuell={TABS.findIndex((t) => t.key === tab)}
        reiter={TABS.map((t) => ({ href: `/anliegen?tab=${t.key}`, label: t.label, inhalt: t.key === tab ? inhalt : undefined }))}
      />
    </div>
  );
}
