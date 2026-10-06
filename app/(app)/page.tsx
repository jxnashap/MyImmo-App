import { vollmachtStatus, vertreterName } from "@/lib/vertreter";
import { bauePortalNeuigkeiten, NEUIGKEITEN_TAGE, type NeuigkeitArt } from "@/lib/portalNeuigkeiten";
import Link from "next/link";
import SchuldenUhr from "@/components/SchuldenUhr";
import { schuldenStand } from "@/lib/schuldenStand";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import LandingPage from "@/components/LandingPage";
import { euro, datum, begruessung } from "@/lib/format";
import { getRefinanzWarning, mieterFristen, kreditFristen, objektFristen, globaleFristen } from "@/lib/fristen";
import { baueHeuteAufgaben, buendleGleicheAufgaben, tageVor, type OffeneMiete, type OffenesAnliegen, type OffeneMeldung } from "@/lib/heute";
import { heuteBerlin } from "@/lib/zeitraum";
import { erwarteteMonate, zuJahrMonat } from "@/lib/mietkonto";
import { CalendarDays, Plus, TriangleAlert, Landmark, Banknote, ReceiptText, MessageSquareText, Zap, CheckCircle2, Building2, Bell, FileCheck2, FileSignature, Wrench, UserPlus, CalendarCheck, ChevronRight, Inbox } from "lucide-react";
import BetragChart from "@/components/BetragChart";
import WertVerlaufChart from "@/components/WertVerlaufChart";
import ZeitraumControl from "@/components/ZeitraumControl";
import DiagrammWechsel from "@/components/DiagrammWechsel";
import { portfolioWertReihe, wertzuwachsGgKaufpreis, type RohStand } from "@/lib/wert/verlauf";
import { einnahmeDatum, type RawPoint } from "@/lib/zeitraum";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { ORGANISATION } from "@/lib/seo/jsonLd";
import { kostenSchnittMonat, monatsCashflow, cashflowFormel, nkVorauszahlungenMonat, laufendeKosten } from "@/lib/cashflowKennzahl";
import { sollKaltmiete, laeuftAm } from "@/lib/sollMiete";

// SEO für die öffentliche Startseite (Landingpage für Ausgeloggte).
// metadataBase liegt im Root-Layout (https://www.myimmoapp.de).
const OG_TITEL = "MyImmo — Immobilienverwaltung für private Vermieter";
const OG_BESCHREIBUNG =
  "Nebenkostenabrechnung, Anlage V, Mieten, Kredite und dein Team in einer App. Für private Vermieter mit 1–24 Einheiten — Datenbank in Frankfurt, aktuell im Early Access kostenlos.";

export const metadata = {
  title: OG_TITEL,
  description: OG_BESCHREIBUNG,
  keywords: [
    "Immobilienverwaltung", "Vermieter Software", "Nebenkostenabrechnung", "Anlage V",
    "Mietverwaltung", "Hausverwaltung Software", "privater Vermieter", "Mietkonto", "ELSTER Anlage V",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: "MyImmo",
    title: OG_TITEL,
    description: OG_BESCHREIBUNG,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MyImmo — Privates Immobilien-Management" }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITEL,
    description: OG_BESCHREIBUNG,
    images: ["/og.png"],
  },
};

const NEUIGKEIT_ICON: Record<NeuigkeitArt, typeof Bell> = {
  nachricht: MessageSquareText, termin: CalendarCheck, dokument: FileCheck2, angebot: FileSignature,
  firma: Wrench, freigabe: Bell, bewerbung: UserPlus, hausmeister: Wrench, eingang: Inbox,
};

export default async function DashboardPage(seite: { searchParams: Promise<{ nl?: string }> }) {
  const supabase = await createClient();
  const user = await aktuellerNutzer();

  if (!user) {
    // Structured Data (JSON-LD) für Google — als SoftwareApplication + Anbieter.
    // Bewusst OHNE aggregateRating/Reviews (keine echten → wäre Richtlinienverstoß).
    // nonce aus der Middleware, sonst würde die strenge CSP das Script blocken.
    const nonce = (await headers()).get("x-nonce") ?? undefined;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        ORGANISATION,
        {
          "@type": "SoftwareApplication",
          name: "MyImmo",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://www.myimmoapp.de",
          description: OG_BESCHREIBUNG,
          inLanguage: "de",
          publisher: { "@id": ORGANISATION["@id"] },
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        },
      ],
    };
    return (
      <>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LandingPage nl={(await seite.searchParams).nl} />
      </>
    );
  }

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }, { data: miet }, { data: bewHist }, { data: profil }, { data: term }, { data: anlRows }, { data: zaehlerRows }, { data: mzRows }, { data: vertreterRows }] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select(KOSTEN_SPALTEN),
    supabase.from("kredite").select("*"),
    supabase.from("mieter").select("id,prop_id,kaltmiete,nk_vorauszahlung,stellplatz_miete,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum,staffel_intervall,staffel_betrag,staffel_prozent,staffel_stufen"),
    supabase.from("bewertung_historie").select("immobilie_id,datum,marktwert"),
    supabase.from("vermieter_profil").select("name").limit(1).maybeSingle(),
    supabase.from("termine").select("id,titel,datum,kategorie,erledigt").order("datum"),
    // „Heute wichtig": offene Mieter-Anliegen und noch nicht übernommene
    // Zählerstände. Beides sind Handlungen, die auf den Vermieter warten.
    supabase.from("anliegen").select("id,titel,status,created_at,mieter_name").eq("status", "offen").order("created_at"),
    supabase.from("zaehlerstand_meldungen").select("id,art,ablesedatum,mieter_id").is("uebernommen_am", null).order("ablesedatum"),
    supabase.from("miet_zeitraeume").select("*"),
    // Vollmachten der Vertreter (Einstellungen → Vertreter) — nur was zum Ablauf nötig ist.
    supabase.from("vertreter").select("id,vorname,nachname,gueltig_bis,widerrufen_am").not("gueltig_bis", "is", null),
  ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];
  type MieterRow = {
    id: string; prop_id: string | null; kaltmiete: number | null; nk_vorauszahlung: number | null; stellplatz_miete: number | null;
    vorname: string | null; nachname: string | null; einheit: string | null;
    mietbeginn: string | null; mietende: string | null; kuendigung: number | null;
    letzte_erhoehung: string | null; mietart: string | null; staffel_datum: string | null;
    // Staffelplan (Audit C30): ohne diese Felder lief die Staffel-Logik in
    // mieterFristen nie — „nächste Stufe" war immer das gespeicherte Datum.
    staffel_intervall: string | null; staffel_betrag: number | null; staffel_prozent: number | null; staffel_stufen: number | null;
  };
  const mieterRows = (miet ?? []) as MieterRow[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  const refinanz = kredite.map((k) => ({ k, w: getRefinanzWarning(k.zinsbindung) })).filter((x) => x.w);

  // Fristen & Aufgaben (Design-Handoff): nächste Termine aus denselben Quellen
  // wie /termine — abgeleitete Fristen + eigene, unerledigte Termine.
  // Stichtag in Europe/Berlin — nicht UTC (Audit A10): Bis 02:00 Uhr am
  // Monatsersten zeigte das Dashboard sonst noch den Vormonat.
  const heuteISO0 = heuteBerlin();
  // Untergrenze fuer die Liste. Fruehet wurde ab HEUTE gefiltert — genau das
  // Ueberfaellige, das man sehen muss, verschwand dadurch vom Dashboard,
  // waehrend /termine es als „Ueberfaellig" zaehlte. Jetzt sind auch die
  // letzten 90 Tage dabei (aelteres ist keine Frist mehr, sondern Altlast).
  const abISO0 = tageVor(heuteISO0, 90);
  const imFenster = (d: string) => d >= abISO0;
  type DashFrist = { datum: string; label: string; sub: string; warn: boolean };
  const ueberfaellig = (d: string) => d < heuteISO0;
  const fristListe: DashFrist[] = [];
  for (const m of mieterRows) {
    const wo = `${(m.prop_id && nameOf.get(m.prop_id)) || "–"}${m.einheit ? " · " + m.einheit : ""}`;
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    for (const f of mieterFristen(m)) if (f.datum && imFenster(f.datum))
      fristListe.push({ datum: f.datum, label: f.label, sub: [wer, wo].filter(Boolean).join(" · "), warn: f.typ === "warn" });
  }
  for (const k of kredite) for (const f of kreditFristen(k as Parameters<typeof kreditFristen>[0])) if (f.datum && imFenster(f.datum))
    fristListe.push({ datum: f.datum, label: f.label, sub: [k.bezeichnung ?? "Darlehen", k.prop_id ? nameOf.get(k.prop_id) : null].filter(Boolean).join(" · "), warn: f.typ === "warn" });
  for (const p of properties) for (const f of objektFristen(p)) if (f.datum && imFenster(f.datum))
    fristListe.push({ datum: f.datum, label: f.label, sub: p.bezeichnung, warn: f.typ === "warn" });
  for (const f of globaleFristen()) if (f.datum && imFenster(f.datum))
    fristListe.push({ datum: f.datum, label: f.label, sub: "Alle Objekte", warn: f.typ === "warn" });
  for (const t of (term ?? []) as { id: string; titel: string | null; datum: string | null; kategorie: string | null; erledigt: boolean | null }[])
    if (t.datum && imFenster(t.datum) && !t.erledigt)
      fristListe.push({ datum: t.datum, label: t.titel ?? "Termin", sub: t.kategorie ?? "Eigener Termin", warn: false });
  fristListe.sort((a, b) => a.datum.localeCompare(b.datum));

  // ----- „Heute wichtig" -----------------------------------------------------
  // Zusammenführung der Quellen, die eine HANDLUNG verlangen. Die Daten liegen
  // ohnehin auf der Seite; gefehlt hat die eine Liste mit je einem Ziel.
  const laufenderMonat = heuteISO0.slice(0, 7);
  const mieterNameOf = new Map(
    mieterRows.map((m) => [m.id as string, [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter"]),
  );
  // Schon gebuchte Mieten des laufenden Monats (Miet-Kategorie, mit Mieter).
  const gebuchtDiesenMonat = new Set(
    ((einn ?? []) as Einnahme[])
      // `soll_monat` steht im Typ noch nicht (Altbestand hat es nicht) — der
      // Fallback auf das Buchungsdatum ist derselbe wie im Mietkonto.
      .filter((e) => {
        const soll = (e as { soll_monat?: string | null }).soll_monat ?? zuJahrMonat(e.buchungsdatum);
        return e.kategorie === "Miete" && e.mieter_id && soll === laufenderMonat;
      })
      .map((e) => String(e.mieter_id)),
  );
  const zeitraeumeVon = (id: string) =>
    ((mzRows ?? []) as { mieter_id: string }[]).filter((z) => z.mieter_id === id) as never[];
  const offeneMieten: OffeneMiete[] = mieterRows
    .filter((m) => !gebuchtDiesenMonat.has(m.id as string))
    // Nur Mieter, für die dieser Monat überhaupt eine Soll-Miete hat
    // (Einzug/Auszug, Miet-Zeiträume) — sonst stünde jeder Altmieter hier.
    .map((m) => ({ m, soll: erwarteteMonate(m as never, zeitraeumeVon(m.id as string), laufenderMonat, laufenderMonat)[0] }))
    .filter(({ soll }) => !!soll)
    .map(({ m, soll }) => ({
      mieterId: m.id as string,
      name: mieterNameOf.get(m.id as string) ?? "Mieter",
      objekt: (m.prop_id && nameOf.get(m.prop_id)) || "",
      monat: laufenderMonat,
      betrag: soll.gesamt,
    }));

  const offeneAnliegen: OffenesAnliegen[] = ((anlRows ?? []) as { id: string; titel: string | null; created_at: string; mieter_name: string | null }[])
    .map((a) => ({ id: a.id, titel: a.titel, mieter: a.mieter_name ?? "Mieter", erstellt: a.created_at }));

  const offeneMeldungen: OffeneMeldung[] = ((zaehlerRows ?? []) as { id: string; art: string | null; ablesedatum: string; mieter_id: string | null }[])
    .map((z) => ({ id: z.id, art: z.art, mieter: (z.mieter_id && mieterNameOf.get(z.mieter_id)) || "Mieter", datum: z.ablesedatum }));

  const alleHeuteAufgaben = baueHeuteAufgaben(
    {
      offeneMieten, anliegen: offeneAnliegen, meldungen: offeneMeldungen, fristen: fristListe,
      ohneKaufdatum: properties.filter((p) => !p.kaufdatum).map((p) => ({ id: p.id, name: p.bezeichnung })),
      mieterOhneBeginn: mieterRows
        .filter((m) => !m.mietbeginn && laeuftAm(m, heuteISO0))
        .map((m) => ({ id: m.id, name: mieterNameOf.get(m.id) ?? "Mieter" })),
      mieterOhneObjekt: mieterRows
        .filter((m) => !m.prop_id && laeuftAm(m, heuteISO0))
        .map((m) => ({ id: m.id, name: mieterNameOf.get(m.id) ?? "Mieter" })),
      krediteOhneAuszahlung: kredite
        .filter((k) => !k.auszahlung_datum)
        .map((k) => ({ id: k.id, name: k.bezeichnung || k.bank || "Kredit" })),
      vollmachten: ((vertreterRows ?? []) as { id: string; vorname: string | null; nachname: string; gueltig_bis: string; widerrufen_am: string | null }[])
        .map((v) => ({ v, status: vollmachtStatus(v, heuteISO0) }))
        .filter(({ status }) => status === "laeuft_ab" || status === "abgelaufen")
        .map(({ v, status }) => ({ id: v.id, name: vertreterName(v), gueltigBis: v.gueltig_bis, abgelaufen: status === "abgelaufen" })),
    },
    heuteISO0,
    Infinity, // alle zählen — gekürzt wird unten, die Überschrift nennt die echte Zahl
  );
  // Audit A8: „5 Sachen warten auf dich“ war die Länge des slice, nicht die
  // Zahl der Aufgaben (≈ 25). Jetzt: echte Zahl in der Überschrift, die
  // wichtigsten Zeilen in der Karte, der Rest unter „Alle“.
  const HEUTE_ZEILEN = 6;
  // Gleiche Aufgaben (Titel + Datum) als EINE Zeile — lib/heute.ts, `buendleGleicheAufgaben`.
  const heuteAufgaben = buendleGleicheAufgaben(alleHeuteAufgaben).slice(0, HEUTE_ZEILEN);

  // Neuigkeiten aus dem Mieterportal (02.10.2026, Idee des Betreibers): was in den letzten
  // NEUIGKEITEN_TAGE Tagen PASSIERT ist. Was eine Handlung verlangt, steht in den Aufgaben.
  const seit = `${tageVor(heuteISO0, NEUIGKEITEN_TAGE)}T00:00:00Z`;
  const [{ data: ereignisRows }, { data: zustellRows }, { data: angebotRows }, { data: rueckRows }, { data: auftragRows }, { data: bewerbungRows }, { data: hmNotizRows }, { data: eingangRows }] = await Promise.all([
    supabase.from("anliegen_ereignisse").select("anliegen_id,autor_rolle,art,text,created_at").eq("autor_rolle", "mieter").gte("created_at", seit).order("created_at", { ascending: false }).limit(50),
    supabase.from("zustellungen").select("titel,art,mieter_id,bestaetigt_am").eq("vermieter_id", user.id).gte("bestaetigt_am", seit).limit(50),
    supabase.from("angebote").select("firma,betrag,created_at").gte("created_at", seit).limit(50),
    supabase.from("auftrag_rueckmeldungen").select("art,firma,auftrag_id,created_at").gte("created_at", seit).limit(50),
    supabase.from("auftraege").select("id,titel,status,created_at,vorgeschlagene_firma_id").eq("vermieter_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("bewerbungen").select("name,created_at,status").eq("user_id", user.id).eq("status", "neu").gte("created_at", seit).limit(50),
    // Notizen und Fotos des Hausmeisters am Auftrag (05.10.2026) — ohne Bilddaten.
    supabase.from("auftrag_notizen").select("auftrag_id,art,created_at").eq("vermieter_id", user.id).eq("autor_rolle", "service").gte("created_at", seit).order("created_at", { ascending: false }).limit(50),
    // Rücklauf über Bank-/Makler-Link (06.10.2026) — nur Unentschiedenes, ohne Dateiinhalt.
    supabase.from("freigabe_eingang").select("art,token,absender,datei_name,created_at").eq("user_id", user.id).eq("status", "neu").order("created_at", { ascending: false }).limit(20),
  ]);
  const eingangListe = (eingangRows ?? []) as { art: "bank" | "makler"; token: string; absender: string | null; datei_name: string; created_at: string }[];
  const bankTokens = [...new Set(eingangListe.filter((e) => e.art === "bank").map((e) => e.token))];
  const { data: bankLinks } = bankTokens.length
    ? await supabase.from("beleihung_freigaben").select("token,prop_id").eq("user_id", user.id).in("token", bankTokens)
    : { data: [] };
  const propVonToken = new Map(((bankLinks ?? []) as { token: string; prop_id: string }[]).map((b) => [b.token, b.prop_id]));
  const ereignisListe = (ereignisRows ?? []) as { anliegen_id: string; autor_rolle: string; art: string; text: string | null; created_at: string }[];
  const anliegenIds = [...new Set(ereignisListe.map((e) => e.anliegen_id))];
  const { data: anliegenTitel } = anliegenIds.length
    ? await supabase.from("anliegen").select("id,titel,mieter_name").in("id", anliegenIds)
    : { data: [] };
  const auftragListe = (auftragRows ?? []) as { id: string; titel: string; status: string; created_at: string; vorgeschlagene_firma_id: string | null }[];
  const portalNeu = bauePortalNeuigkeiten({
    ereignisse: ereignisListe,
    anliegen: new Map(((anliegenTitel ?? []) as { id: string; titel: string | null; mieter_name: string | null }[])
      .map((a) => [a.id, { titel: a.titel ?? "Anliegen", mieter: a.mieter_name ?? "Mieter" }])),
    zustellungen: ((zustellRows ?? []) as { titel: string | null; art: string; mieter_id: string | null; bestaetigt_am: string | null }[])
      .map((z) => ({ titel: z.titel, art: z.art, mieter: (z.mieter_id && mieterNameOf.get(z.mieter_id)) || "Mieter", bestaetigt_am: z.bestaetigt_am })),
    angebote: ((angebotRows ?? []) as { firma: string; betrag: number; created_at: string }[]).map((g) => ({ ...g, betrag: Number(g.betrag) })),
    rueckmeldungen: ((rueckRows ?? []) as { art: string; firma: string | null; auftrag_id: string; created_at: string }[])
      .map((r) => ({ art: r.art, firma: r.firma, auftrag: auftragListe.find((a) => a.id === r.auftrag_id)?.titel ?? "Auftrag", created_at: r.created_at })),
    freigaben: auftragListe.filter((a) => a.status === "freigabe").map((a) => ({ titel: a.titel, created_at: a.created_at, fachbetrieb: !!a.vorgeschlagene_firma_id })),
    hausmeister: ((hmNotizRows ?? []) as { auftrag_id: string; art: string; created_at: string }[])
      .filter((n) => n.art !== "fachbetrieb") // steht schon als Freigabe-Bitte da
      .map((n) => ({ art: n.art, auftrag: auftragListe.find((a) => a.id === n.auftrag_id)?.titel ?? "Auftrag", created_at: n.created_at })),
    bewerbungen: ((bewerbungRows ?? []) as { name: string | null; created_at: string }[]),
    eingang: eingangListe.map((e) => ({ art: e.art, propId: propVonToken.get(e.token) ?? null, absender: e.absender, datei_name: e.datei_name, created_at: e.created_at })),
  }, heuteISO0);
  const AUFGABEN_ICON = { miete: ReceiptText, anliegen: MessageSquareText, zaehler: Zap, frist: CalendarDays, termin: CalendarDays, stammdaten: Building2 } as const;

  // Begrüßung nach Tageszeit (Europe/Berlin) + Vorname aus dem Vermieterprofil.
  // Die Stundenermittlung steckt in lib/format (getestet) — die frühere
  // Inline-Variante parste „11 Uhr" mit Number() und ergab immer NaN.
  const gruss = begruessung();
  const vorname = ((profil as { name: string | null } | null)?.name ?? "").trim().split(/\s+/)[0] || null;
  const monatJahr = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date());

  const totalWert = properties.reduce((s, p) => s + (p.wert ?? 0), 0);

  // Portfolio-Wertentwicklung: je Objekt Kaufpreis → erfasste Stände →
  // aktueller Wert, an jedem Änderungsdatum aufsummiert.
  const histNachObjekt = new Map<string, RohStand[]>();
  for (const h of (bewHist ?? []) as { immobilie_id: string; datum: string; marktwert: number | null }[]) {
    const arr = histNachObjekt.get(h.immobilie_id) ?? [];
    arr.push({ datum: h.datum, marktwert: h.marktwert });
    histNachObjekt.set(h.immobilie_id, arr);
  }
  const heuteISO = heuteISO0;
  const portfolioWert = portfolioWertReihe(
    properties.map((p) => ({
      kaufpreis: p.kaufpreis,
      kaufdatum: p.kaufdatum ?? null,
      aktuellerWert: p.wert,
      standDatum: p.marktwert_stand ?? null,
      historie: histNachObjekt.get(p.id) ?? [],
      heute: heuteISO,
    })),
  );
  // „seit Anschaffung" = heutiger Wert gegen Kaufpreise, NICHT erster gegen
  // letzten Punkt der Reihe (der zählte jeden Zukauf als Wertsteigerung —
  // Demo +754,9 % statt +11,9 %). Begründung in lib/wert/verlauf.ts.
  const wertzuwachs = wertzuwachsGgKaufpreis(properties.map((p) => ({ kaufpreis: p.kaufpreis, aktuellerWert: p.wert })));
  const portfolioWertProzent = wertzuwachs?.prozent ?? null;
  // Soll-Kaltmiete/Mo.: aus den laufenden Mietern, sonst aus dem Objektfeld —
  // dieselbe Regel wie Objektseite und Objektliste (lib/sollMiete.ts).
  const totalMiete = properties.reduce((s, p) => s + sollKaltmiete(p, mieterRows, heuteISO).betrag, 0);
  const kreditRates = kredite.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  // Laufende Kosten: Ø der letzten 12 Monate MIT BUCHUNGEN, geteilt durch die
  // Monate, die das Fenster wirklich umfasst — Begründung in
  // lib/cashflowKennzahl.ts (vorher / 12 fest: Neue Nutzer sahen einen Bruchteil
  // ihrer Kosten). Dieselbe Rechnung steht auf der Objektseite.
  // Schuldzinsen-Buchungen zählen hier NICHT — sie stecken schon in der
  // Kreditrate (lib/cashflowKennzahl.ts, `laufendeKosten`).
  const kostenSchnitt = kostenSchnittMonat(laufendeKosten(kosten), [...einnahmen, ...kosten], heuteISO);
  const monatKosten = Math.round(kostenSchnitt.betrag);
  const totalKosten = kreditRates + monatKosten;
  // Warmmiete = Soll-Kaltmiete + NK-Vorauszahlungen laufender Verträge —
  // Begründung in lib/cashflowKennzahl.ts. Die Rendite bleibt kalt.
  // NK nur von Mietern, die zu einem Objekt gehören — deren Kaltmiete zählt
  // in totalMiete; ein Mieter ohne Objekt stünde sonst nur halb im Cashflow.
  const objektIds = new Set(properties.map((p) => p.id));
  const warmmiete = totalMiete + nkVorauszahlungenMonat(mieterRows.filter((m) => m.prop_id && objektIds.has(m.prop_id)), heuteISO);
  const cashflow = monatsCashflow({ warmmiete, kreditraten: kreditRates, kostenSchnitt: monatKosten });
  const bruttoRendite = totalWert > 0 ? ((totalMiete * 12) / totalWert) * 100 : 0;
  // Leerstandsquote: nur vermietbare Objekte (Status "Vermietet"/"Leer");
  // Benchmark: 2–5 % gesund, >10 % kritisch.
  const status = (p: { obj_status: string | null }) => (p.obj_status ?? "").trim().toLowerCase();
  const vermietbar = properties.filter((p) => status(p) === "vermietet" || status(p) === "leer");
  const leerCount = properties.filter((p) => status(p) === "leer").length;
  const leerstand = vermietbar.length > 0 ? (leerCount / vermietbar.length) * 100 : 0;
  const leerFarbe = leerstand <= 5 ? "var(--green)" : leerstand <= 10 ? "var(--amber)" : "var(--red)";

  // Buchungssaldo: aufsummierte gebuchte Einnahmen − Ausgaben aus echten
  // Buchungen; Zeitraum wird clientseitig per Segmented-Control gefiltert.
  const portfolioPoints: RawPoint[] = [
    // Mieten im Mietmonat (`soll_monat`), nicht im Monat des Zahlungseingangs.
    ...einnahmen.flatMap((e) => {
      const date = einnahmeDatum(e as { buchungsdatum?: string | null; soll_monat?: string | null });
      return date ? [{ date, value: e.betrag ?? 0 }] : [];
    }),
    ...kosten.filter((k) => k.buchungsdatum).map((k) => ({ date: k.buchungsdatum as string, value: -(k.betrag ?? 0) })),
  ];


  // Letzte Transaktionen
  const trans = [
    ...einnahmen.map((e) => ({ ...e, _typ: "einnahme" as const })),
    ...kosten.map((k) => ({ ...k, _typ: "kosten" as const })),
  ]
    .sort((a, b) => new Date(b.buchungsdatum ?? 0).getTime() - new Date(a.buchungsdatum ?? 0).getTime())
    .slice(0, 6);

  // Leeres Konto: statt Null-KPIs eine Start-Checkliste, die sagt, was zu tun ist.
  if (properties.length === 0) {
    const schritte = [
      { nr: 1, titel: "Erstes Objekt anlegen", text: "Name, Adresse, Kaufpreis, Miete — mehr braucht es für den Start nicht.", href: "/properties/new", cta: "Objekt anlegen", erledigt: false },
      { nr: 2, titel: "Mieter erfassen", text: "Mit Kaltmiete und Mietbeginn — daraus entstehen Mietkonto und Abrechnungen.", href: "/tenants/new", cta: "Mieter anlegen", erledigt: mieterRows.length > 0 },
      { nr: 3, titel: "Ein- & Ausgaben buchen", text: "Mieteingänge und Kosten festhalten — per Hand, per CSV-Import oder als wiederkehrende Buchung.", href: "/cashflow", cta: "Zu den Buchungen", erledigt: einnahmen.length + kosten.length > 0 },
    ];
    return (
      <div className="fade-up">
        <div className="topbar">
          <div>
            <div className="topbar-title">Willkommen bei MyImmo</div>
            <div className="topbar-sub">Drei Schritte, dann rechnet die App für dich</div>
          </div>
        </div>
        <div style={{ maxWidth: 560 }}>
          {schritte.map((s, i) => (
            <div key={s.nr} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                {/* --gold ist die TEXT-Stufe (hell oliv) — als Fläche mit dunkler
                    Schrift darauf war der Kreis kontrastschwach. --gold-fill ist
                    die Flächenstufe. */}
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: s.erledigt ? "var(--green)" : "var(--gold-fill)", color: s.erledigt ? "#fff" : "var(--btn-gold-text)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>
                  {s.erledigt ? "✓" : s.nr}
                </div>
                {i < schritte.length - 1 && <div style={{ flex: 1, width: 2, background: "var(--line2)", marginTop: 4 }} />}
              </div>
              <div className="section" style={{ flex: 1, marginBottom: i < schritte.length - 1 ? 14 : 0 }}>
                <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.titel}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.text}</div>
                  </div>
                  <Link href={s.href} className={`btn ${s.nr === 1 ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12.5, flexShrink: 0 }}>{s.cta}</Link>
                </div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 16 }}>
            Tipp: Die Einführungs-Tour zeigt dir alle Stationen — jederzeit über Einstellungen → „Daten &amp; Recht&quot; startbar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Portfolio · {monatJahr}</div>
          <div className="topbar-title">{gruss}{vorname ? `, ${vorname}` : ""}</div>
          <div className="topbar-sub">
            {properties.length} Objekt{properties.length === 1 ? "" : "e"}, {mieterRows.length} Mietverhältnis{mieterRows.length === 1 ? "" : "se"} — Stand heute
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/termine" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CalendarDays size={15} /> Terminkalender</Link>
          <Link href="/cashflow/neu" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Banknote size={15} /> Buchen</Link>
          <Link href="/properties/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Immobilie</Link>
        </div>
      </div>
      <hr className="topbar-rule" />

      {refinanz.length > 0 && (
        <div style={{ marginBottom: 16, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <TriangleAlert size={20} color="var(--red)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--red)", fontSize: 13 }}>{refinanz.length} Zinsbindung{refinanz.length > 1 ? "en" : ""} läuft bald ab</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{refinanz.map(({ k }) => `${k.bezeichnung || "Darlehen"} (${datum(k.zinsbindung)})`).join(" · ")}</div>
          </div>
          <Link href="/kredite" className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 11 }}>Ansehen</Link>
        </div>
      )}


      {/* KENNZAHLEN ALS EINE LEISTE (03.10.2026, Betreiber nach den Verlaufslinien: „wenig
          Veränderung und wieder viel Neues, unübersichtlich“). Vorher fünf Karten mit Badges,
          Linien und Trendzeilen; jetzt EINE Karte, fünf Felder mit Trennlinie — je Feld Name,
          Zahl, eine kurze Zeile. Warmmiete − Kosten = Cashflow bleibt nachrechenbar
          (Review 30.09.2026). Jedes Feld ist weiterhin ein Link in den passenden Bereich. */}
      <div className="kpi-leiste staffel mb-20">
        <Link href="/properties" className="kpi-feld">
          <span className="kpi-label">Portfolio-Wert</span>
          <span className="kpi-value">{euro(totalWert)}</span>
          {/* „% ggü. Kaufpreis“ steht an der Wertkurve darunter — hier nicht doppelt. */}
          <span className="kpi-sub">{properties.length} Objekt{properties.length === 1 ? "" : "e"}</span>
        </Link>
        {/* WARMmiete, weil der Cashflow daneben mit ihr rechnet (Review 30.09.2026). */}
        <Link href="/cashflow" className="kpi-feld">
          <span className="kpi-label">Warmmiete / Mo.</span>
          <span className="kpi-value">{euro(warmmiete)}</span>
          <span className="kpi-sub">Kalt {euro(totalMiete)}{bruttoRendite > 0 ? ` · ${bruttoRendite.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Rendite` : ""}</span>
        </Link>
        <Link href="/cashflow" className="kpi-feld">
          <span className="kpi-label">Kosten / Mo.</span>
          <span className="kpi-value">{euro(totalKosten)}</span>
          <span className="kpi-sub">Raten {euro(kreditRates)} · Ø Kosten {euro(monatKosten)}</span>
        </Link>
        <Link href="/cashflow" className="kpi-feld">
          <span className="kpi-label">Cashflow / Mo.</span>
          <span className="kpi-value" style={{ color: cashflow >= 0 ? "var(--green)" : "var(--red)" }}>{cashflow >= 0 ? "+ " : "− "}{euro(Math.abs(cashflow))}</span>
          {/* Die Formel steht an der Zahl (Review 30.09.2026). */}
          <span className="kpi-sub">{cashflowFormel(kostenSchnitt)}</span>
        </Link>
        <Link href="/properties" className="kpi-feld">
          <span className="kpi-label">Leerstand</span>
          <span className="kpi-value" style={{ color: vermietbar.length ? leerFarbe : "var(--muted)" }}>
            {vermietbar.length ? leerstand.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " %" : "–"}
          </span>
          <span className="kpi-sub">{vermietbar.length ? `${leerCount} von ${vermietbar.length} leer` : "Status je Objekt hinterlegen"}</span>
        </Link>
      </div>

      {/* Hauptblock (03.10.2026, Betreiber: „Grafik viel zu klein, alles soll zusammenpassen“):
          links, in der BREITEREN Spalte, beide Verläufe übereinander (Wert, darunter
          Buchungssaldo) — gleiche Breite, gleiche Höhe, Schrift in echten Pixeln; rechts die
          Neuigkeiten aus dem Mieterportal, darunter Termine & Aufgaben (Idee vom 02.10.2026).
          So sind beide Spalten etwa gleich hoch statt einer Lücke unter einer kleinen Grafik.
          Unter 860 px untereinander, Grafiken zuerst. */}
      <div className="dash-haupt mb-20">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
        {/* EINE Grafik-Karte mit Umschalter oben links (04.10.2026, Wunsch des Betreibers) statt
            zwei Karten untereinander. „Buchungssaldo“, nicht „Cashflow“: Die Kurve summiert
            GEBUCHTE Einnahmen und Ausgaben (Review 30.09.2026). Die Wertkurve gibt es erst ab zwei
            Punkten — sonst ist der Saldo die einzige Ansicht. */}
        <DiagrammWechsel
          speicherSchluessel="myimmo:dashboard-grafik"
          ansichten={[
            ...(portfolioWert.length >= 2 ? [{
              schluessel: "wert",
              titel: "Portfolio-Wert",
              rechts: portfolioWertProzent != null ? (
                <span className={`badge ${portfolioWertProzent >= 0 ? "badge-green" : "badge-red"}`}>
                  {portfolioWertProzent >= 0 ? "+" : ""}{portfolioWertProzent.toLocaleString("de-DE")} % ggü. Kaufpreis
                </span>
              ) : undefined,
              inhalt: (
                <WertVerlaufChart
                  punkte={portfolioWert}
                  hoehe={320}
                  erklaerung="Summe aus Kaufpreisen (Anschaffung) und den erfassten Wert-Aktualisierungen aller Objekte. Die Kurve springt bei jedem Kauf — ein Zukauf ist kein Wertzuwachs. Der Prozentwert vergleicht den heutigen Wert mit den Kaufpreisen."
                />
              ),
            }] : []),
            {
              schluessel: "saldo",
              titel: "Buchungssaldo",
              rechts: <ZeitraumControl />,
              inhalt: (
                <BetragChart points={portfolioPoints} mode="area" cumulative color="var(--gold)" heute={heuteISO0} hoehe={320} erklaerung="Gebuchte Einnahmen minus gebuchte Ausgaben im gewählten Zeitraum, ab 0 aufsummiert. Ohne Tilgung; Zinsen nur, soweit als „Schuldzinsen“ gebucht — der Monats-Cashflow oben zieht dagegen die volle Kreditrate ab." />
              ),
            },
          ]}
        />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <div className="section" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <div>
                <h3>Neuigkeiten aus dem Mieterportal</h3>
                <div className="section-sub">
                  {portalNeu.gesamt === 0 ? `Nichts Neues in den letzten ${NEUIGKEITEN_TAGE} Tagen` : `Letzte ${NEUIGKEITEN_TAGE} Tage${portalNeu.gesamt > portalNeu.liste.length ? ` · die ${portalNeu.liste.length} neuesten von ${portalNeu.gesamt}` : ""}`}
                </div>
              </div>
              <Link href="/anliegen" className="btn btn-ghost btn-sm">Alle →</Link>
            </div>
            <div className="section-body">
              {portalNeu.liste.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                  Hier erscheint, was Mieter, Firmen und Hausmeister im Portal tun — Nachrichten, bestätigte Termine und Dokumente, Angebote, Rückmeldungen.
                </p>
              ) : (
                // EINE Zeile je Neuigkeit (03.10.2026): Was passiert ist · worum es geht, Datum rechts.
                // Klick führt direkt zum Vorgang (Nachricht/Termin → Detailansicht des Anliegens).
                <div className="listen">
                  {portalNeu.liste.map((n) => {
                    const Icon = NEUIGKEIT_ICON[n.art];
                    return (
                      <Link key={`${n.art}-${n.zeit}-${n.text}`} href={n.href} className="listen-zeile" title={`${n.text} · ${n.sub}`}>
                        <Icon size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
                        <span className="listen-zeile-titel" style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
                          {n.text}<span style={{ color: "var(--muted)", fontWeight: 400 }}> · {n.sub}</span>
                        </span>
                        <span className="listen-zeile-datum">{datum(n.zeit)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        <div className="section" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <div>
                <h3>Termine &amp; Aufgaben</h3>
                <div className="section-sub">
                  {alleHeuteAufgaben.length === 0
                    ? "Nichts Offenes"
                    : `${alleHeuteAufgaben.length} ${alleHeuteAufgaben.length === 1 ? "Sache wartet" : "Sachen warten"} auf dich${alleHeuteAufgaben.length > heuteAufgaben.length ? ` · die ${heuteAufgaben.length} wichtigsten hier` : ""}`}
                </div>
              </div>
              <Link href="/termine" className="btn btn-ghost btn-sm">Alle →</Link>
            </div>
            <div className="section-body">
              {heuteAufgaben.length === 0 ? (
                <div className="empty">
                  <CheckCircle2 className="empty-icon" size={36} color="var(--green)" />
                  <p>Alles erledigt. Keine offenen Mieten, Anliegen oder Fristen.</p>
                </div>
              ) : (
                <div className="listen">
                  {heuteAufgaben.map((a) => {
                    // EIN Eintrag je Aufgabe (03.10.2026, im Stil der Neuigkeiten): was, darunter wo; rechts das
                    // Datum (nur bei echten Fristen — bei einer offenen Miete wäre der Monatserste
                    // eine Zahl ohne Aussage). Dringendes erkennt man am roten Symbol und Datum.
                    const Icon = AUFGABEN_ICON[a.art];
                    const farbe = a.dringend ? "var(--red)" : "var(--gold)";
                    const zeile = (
                      <Link
                        key={`${a.art}-${a.href}-${a.label}-${a.sub}`}
                        href={a.href}
                        className="listen-zeile"
                        style={a.neben ? { flex: 1, minWidth: 0 } : undefined}
                        title={`${a.label}${a.sub ? ` · ${a.sub}` : ""} — ${a.aktion}`}
                      >
                        <Icon size={15} style={{ color: farbe, flexShrink: 0 }} />
                        {/* Zwei kurze Zeilen statt einer: Viele Aufgaben heißen gleich („NK-Abrechnung
                            2025 zustellen“) — erst Mieter/Objekt unterscheidet sie, und das darf nicht
                            hinter „…“ verschwinden. */}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="listen-zeile-titel" style={{ fontWeight: 500 }}>{a.label}</span>
                          {a.sub && <span className="listen-zeile-sub">{a.sub}</span>}
                        </span>
                        {a.art === "frist" && (
                          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: a.dringend ? "var(--red)" : "var(--muted)" }}>
                            {ueberfaellig(a.datum) ? "überfällig · " : ""}{datum(a.datum)}
                          </span>
                        )}
                        <ChevronRight size={15} color="var(--faint)" style={{ flexShrink: 0 }} />
                      </Link>
                    );
                    // Überfällige Miete: die Erinnerung als eigener Knopf NEBEN der Zeile — ein Link
                    // im Link wäre ungültiges HTML (lib/mahnung.ts baut Ziel, Betrag und Frist).
                    if (!a.neben) return zeile;
                    return (
                      <div key={`${a.art}-${a.href}-${a.label}-${a.sub}`} className="aufgabe-mit-aktion">
                        {zeile}
                        <Link href={a.neben.href} className="btn btn-ghost aufgabe-aktion">{a.neben.label}</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keine Karte (01.10.2026, Entscheidung des Betreibers): erst vom
          Dashboard genommen, am selben Tag auch die Kartenseite /karte — sie
          zeigte nur einen Teil der Objekte und passte optisch nicht. */}

      {/* „Einnahmen vs. Ausgaben“ ist ENTFALLEN (03.10.2026): Es wiederholte die Kennzahlen-Leiste
          Zahl für Zahl. Die Kredite bleiben (Wunsch des Betreibers 04.10.2026) — mit der
          Schulden-Uhr als Kopfzeile und den Darlehen als kompakte Zeilen. */}
      {kredite.length > 0 && (
        <div className="section mb-20">
          <div className="section-header">
            <h3>Kredite</h3>
            <Link href="/kredite" className="btn btn-ghost btn-sm">{kredite.length > 3 ? `Alle ${kredite.length} →` : "Öffnen →"}</Link>
          </div>
          <div className="section-body">
            <SchuldenUhr stand={schuldenStand(kredite)} />
            <div className="listen">
              {kredite.slice(0, 3).map((k) => (
                <Link key={k.id} href="/kredite" className="listen-zeile">
                  <span className="listen-icon"><Landmark size={16} /></span>
                  <span className="listen-zeile-text">
                    <span className="listen-zeile-titel">
                      {k.bezeichnung || k.bank || "Darlehen"}
                      {k.zinssatz != null && <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {k.zinssatz.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %</span>}
                    </span>
                    <span className="listen-zeile-sub">{[(k.prop_id && nameOf.get(k.prop_id)) || null, k.bank].filter(Boolean).join(" · ") || "ohne Objekt"}</span>
                  </span>
                  <span className="listen-zeile-zahl"><b>{euro(k.restschuld)}</b><small>{euro(k.monatsrate)} / Mo.</small></span>
                  <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* REIHENFOLGE: Kennzahlen und Verläufe oben (08.09.2026). Termine & Aufgaben stehen seit
          02.10.2026 rechts neben dem Buchungssaldo unter den Portal-Neuigkeiten (Idee des
          Betreibers) — nicht mehr hier am Ende. „Heute wichtig“ und „Fristen & Aufgaben“
          bleiben EIN Block. */}
      <div>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div><h3>Letzte Buchungen</h3><div className="section-sub">Einnahmen und Ausgaben, zuletzt erfasst</div></div>
            <Link href="/cashflow" className="btn btn-ghost btn-sm">Alle →</Link>
          </div>
          <div className="section-body">
            {trans.length === 0 ? (
              <div className="empty">
                <Banknote className="empty-icon" size={36} color="var(--faint)" /><p>Mieteingänge und Kosten. Sie speisen Cashflow, Nebenkosten und die Anlage V.</p>
                <Link href="/cashflow/neu" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Erste Buchung erfassen</Link>
              </div>
            ) : (
              <div className="listen">
                {trans.map((t) => {
                  const isEin = t._typ === "einnahme";
                  const objName = t.prop_id ? nameOf.get(t.prop_id) : null;
                  return (
                    <Link key={`${t._typ}-${t.id}`} href={`/${isEin ? "einnahmen" : "kosten"}/${t.id}/edit`} className="listen-zeile">
                      <span className="listen-zeile-text">
                        <span className="listen-zeile-titel" style={{ fontWeight: 500 }}>{t.beschreibung || t.kategorie || "Buchung"}</span>
                        <span className="listen-zeile-sub">{[datum(t.buchungsdatum), objName].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="listen-zeile-zahl"><b style={{ color: isEin ? "var(--green)" : "var(--red)" }}>{isEin ? "+ " : "− "}{euro(t.betrag)}</b></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
