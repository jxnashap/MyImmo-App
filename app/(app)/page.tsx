import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/LandingPage";
import { euro, datum, zahl, begruessung } from "@/lib/format";
import { getRefinanzWarning, mieterFristen, kreditFristen, objektFristen, globaleFristen } from "@/lib/fristen";
import { CalendarDays, Plus, TriangleAlert, BarChart3, Landmark, Banknote } from "lucide-react";
import BetragChart from "@/components/BetragChart";
import WertVerlaufChart from "@/components/WertVerlaufChart";
import PortfolioKarte, { type KartenObjekt } from "@/components/PortfolioKarte";
import ZeitraumControl from "@/components/ZeitraumControl";
import { portfolioWertReihe, veraenderungProzent, type RohStand } from "@/lib/wert/verlauf";
import type { RawPoint } from "@/lib/zeitraum";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { ORGANISATION } from "@/lib/seo/jsonLd";

// SEO für die öffentliche Startseite (Landingpage für Ausgeloggte).
// metadataBase liegt im Root-Layout (https://www.myimmoapp.de).
const OG_TITEL = "MyImmo — Immobilienverwaltung für private Vermieter";
const OG_BESCHREIBUNG =
  "Nebenkostenabrechnung, Anlage V, Mieten, Kredite und dein Team in einer App. Für private Vermieter mit 1–24 Einheiten — Daten in der EU, aktuell im Early Access kostenlos.";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <LandingPage />
      </>
    );
  }

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }, { data: miet }, { data: bewHist }, { data: profil }, { data: term }] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select(KOSTEN_SPALTEN),
    supabase.from("kredite").select("*"),
    supabase.from("mieter").select("id,prop_id,kaltmiete,stellplatz_miete,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum"),
    supabase.from("bewertung_historie").select("immobilie_id,datum,marktwert"),
    supabase.from("vermieter_profil").select("name").limit(1).maybeSingle(),
    supabase.from("termine").select("id,titel,datum,kategorie,erledigt").order("datum"),
  ]);

  const properties = (props ?? []) as Property[];
  // Kleine Portfolio-Karte: nur Objekte, die bereits Koordinaten haben —
  // das Dashboard geocodiert bewusst NICHT (kein externer Aufruf beim Laden).
  const kartenObjekte: KartenObjekt[] = properties
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, name: p.bezeichnung, adresse: p.adresse ?? "", typ: p.typ, wert: p.wert, lat: p.lat as number, lng: p.lng as number }));
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];
  type MieterRow = {
    id: string; prop_id: string | null; kaltmiete: number | null; stellplatz_miete: number | null;
    vorname: string | null; nachname: string | null; einheit: string | null;
    mietbeginn: string | null; mietende: string | null; kuendigung: number | null;
    letzte_erhoehung: string | null; mietart: string | null; staffel_datum: string | null;
  };
  const mieterRows = (miet ?? []) as MieterRow[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  const refinanz = kredite.map((k) => ({ k, w: getRefinanzWarning(k.zinsbindung) })).filter((x) => x.w);

  // Fristen & Aufgaben (Design-Handoff): nächste Termine aus denselben Quellen
  // wie /termine — abgeleitete Fristen + eigene, unerledigte Termine.
  const heuteISO0 = new Date().toISOString().slice(0, 10);
  // Untergrenze fuer die Liste. Fruehet wurde ab HEUTE gefiltert — genau das
  // Ueberfaellige, das man sehen muss, verschwand dadurch vom Dashboard,
  // waehrend /termine es als „Ueberfaellig" zaehlte. Jetzt sind auch die
  // letzten 90 Tage dabei (aelteres ist keine Frist mehr, sondern Altlast).
  const abISO0 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
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
  const naechsteFristen = fristListe.slice(0, 4);

  // Begrüßung nach Tageszeit (Europe/Berlin) + Vorname aus dem Vermieterprofil.
  // Die Stundenermittlung steckt in lib/format (getestet) — die frühere
  // Inline-Variante parste „11 Uhr" mit Number() und ergab immer NaN.
  const gruss = begruessung();
  const vorname = ((profil as { name: string | null } | null)?.name ?? "").trim().split(/\s+/)[0] || null;
  const monatJahr = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date());

  const now = new Date();

  const totalWert = properties.reduce((s, p) => s + (p.wert ?? 0), 0);

  // Portfolio-Wertentwicklung: je Objekt Kaufpreis → erfasste Stände →
  // aktueller Wert, an jedem Änderungsdatum aufsummiert.
  const histNachObjekt = new Map<string, RohStand[]>();
  for (const h of (bewHist ?? []) as { immobilie_id: string; datum: string; marktwert: number | null }[]) {
    const arr = histNachObjekt.get(h.immobilie_id) ?? [];
    arr.push({ datum: h.datum, marktwert: h.marktwert });
    histNachObjekt.set(h.immobilie_id, arr);
  }
  const heuteISO = now.toISOString().slice(0, 10);
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
  const portfolioWertProzent = veraenderungProzent(portfolioWert);
  // Soll-Kaltmiete/Mo.: Garagen-Objekte führen ihre Mieten auf den einzelnen
  // Mietern (je Einheit), nicht auf property.miete — wie auf der Objektseite.
  const GARAGEN_TYPEN = ["Garage / Stellplatz", "Garagenkomplex"];
  const mieteVonMietern = (propId: string) =>
    mieterRows.filter((m) => m.prop_id === propId).reduce((s, m) => s + (m.kaltmiete ?? 0) + (m.stellplatz_miete ?? 0), 0);
  const totalMiete = properties.reduce(
    (s, p) => s + (GARAGEN_TYPEN.includes(p.typ ?? "") ? mieteVonMietern(p.id) : (p.miete ?? 0)),
    0,
  );
  const kreditRates = kredite.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  // Laufende Kosten: Ø der letzten 12 Monate aus echten Buchungen — statt nur
  // des aktuellen Kalendermonats (der zu Monatsbeginn fast immer 0 € zeigte).
  const vor12M = new Date(now); vor12M.setFullYear(vor12M.getFullYear() - 1);
  const koLetzte12M = kosten
    .filter((k) => { const d = k.buchungsdatum ? new Date(k.buchungsdatum) : null; return d && d >= vor12M && d <= now; })
    .reduce((s, k) => s + (k.betrag ?? 0), 0);
  const monatKosten = Math.round(koLetzte12M / 12);
  const totalKosten = kreditRates + monatKosten;
  const cashflow = totalMiete - totalKosten;
  const bruttoRendite = totalWert > 0 ? ((totalMiete * 12) / totalWert) * 100 : 0;
  // Leerstandsquote: nur vermietbare Objekte (Status "Vermietet"/"Leer");
  // Benchmark: 2–5 % gesund, >10 % kritisch.
  const status = (p: { obj_status: string | null }) => (p.obj_status ?? "").trim().toLowerCase();
  const vermietbar = properties.filter((p) => status(p) === "vermietet" || status(p) === "leer");
  const leerCount = properties.filter((p) => status(p) === "leer").length;
  const leerstand = vermietbar.length > 0 ? (leerCount / vermietbar.length) * 100 : 0;
  const leerFarbe = leerstand <= 5 ? "var(--green)" : leerstand <= 10 ? "var(--amber)" : "var(--red)";

  // Cashflow-Entwicklung: kumulierter Cashflow (Einnahmen − Ausgaben) aus echten
  // Buchungen; Zeitraum wird clientseitig per Segmented-Control gefiltert.
  const portfolioPoints: RawPoint[] = [
    ...einnahmen.filter((e) => e.buchungsdatum).map((e) => ({ date: e.buchungsdatum as string, value: e.betrag ?? 0 })),
    ...kosten.filter((k) => k.buchungsdatum).map((k) => ({ date: k.buchungsdatum as string, value: -(k.betrag ?? 0) })),
  ];

  // Einnahmen vs. Ausgaben
  const balkenMax = Math.max(totalMiete, totalKosten, 1);
  const balken = [
    { lbl: "Einnahmen", val: totalMiete, col: "var(--green)" },
    { lbl: "Kredite", val: kreditRates, col: "var(--red)" },
    { lbl: "Kosten Ø/Mo.", val: monatKosten, col: "var(--red)" },
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
      { nr: 3, titel: "Ein- & Ausgaben buchen", text: "Mieteingänge und Kosten festhalten — per Hand, CSV oder Kontoanbindung.", href: "/cashflow", cta: "Zu den Buchungen", erledigt: einnahmen.length + kosten.length > 0 },
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
            Tipp: Die Einführungs-Tour zeigt dir alle Stationen — jederzeit über Einstellungen → „Daten &amp; Recht" startbar.
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


      {/* KPIs sind Deep-Links in den passenden Kontext (spart 1–2 Klicks je Absprung) */}
      <div className="staffel grid-5 mb-20">
        <Link href="/properties" className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi-label">Portfolio-Wert</div>
          <div className="kpi-value">{euro(totalWert)}</div>
          <div className="kpi-sub"><span className="badge badge-teal">{properties.length} Objekt{properties.length === 1 ? "" : "e"}</span></div>
        </Link>
        <Link href="/cashflow" className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi-label">Einnahmen / Mo.</div>
          <div className="kpi-value">{euro(totalMiete)}</div>
          <div className="kpi-sub">{bruttoRendite > 0 ? <span className="badge badge-gold">{bruttoRendite.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Brutto-Rendite</span> : "Kaltmiete gesamt"}</div>
        </Link>
        <Link href="/cashflow" className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi-label">Kosten / Mo.</div>
          <div className="kpi-value">{euro(totalKosten)}</div>
          <div className="kpi-sub">Kredit + laufend (Ø 12 Mon.)</div>
        </Link>
        <Link href="/cashflow" className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi-label">Cashflow / Mo.</div>
          <div className="kpi-value" style={{ color: cashflow >= 0 ? "var(--green)" : "var(--red)" }}>{cashflow >= 0 ? "+ " : "− "}{euro(Math.abs(cashflow))}</div>
          <div className="kpi-sub"><span className={`badge ${cashflow >= 0 ? "badge-green" : "badge-red"}`}>{cashflow >= 0 ? "Positiver Cashflow" : "Negativer Cashflow"}</span></div>
        </Link>
        <Link href="/properties" className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi-label">Leerstandsquote</div>
          <div className="kpi-value" style={{ color: vermietbar.length ? leerFarbe : "var(--muted)" }}>
            {vermietbar.length ? leerstand.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " %" : "–"}
          </div>
          <div className="kpi-sub">
            {vermietbar.length
              ? <span className="badge badge-neutral">{leerCount} von {vermietbar.length} leer</span>
              : <span style={{ color: "var(--muted)" }}>Status je Objekt hinterlegen</span>}
          </div>
        </Link>
      </div>

      {portfolioWert.length >= 2 && (
        <div className="section mb-20">
          <div className="section-header">
            <h3>Portfolio-Wertentwicklung</h3>
            {portfolioWertProzent != null && (
              <span className={`badge ${portfolioWertProzent >= 0 ? "badge-green" : "badge-red"}`}>
                {portfolioWertProzent >= 0 ? "+" : ""}{portfolioWertProzent.toLocaleString("de-DE")} % seit Anschaffung
              </span>
            )}
          </div>
          <div className="section-body">
            <WertVerlaufChart
              punkte={portfolioWert}
              caption="Summe aus Kaufpreisen (Anschaffung) und den erfassten Wert-Aktualisierungen aller Objekte."
            />
          </div>
        </div>
      )}

      <div className="section mb-20">
        <div className="section-header">
          <h3>Cashflow-Entwicklung</h3>
          <ZeitraumControl />
        </div>
        <div className="section-body">
          <BetragChart points={portfolioPoints} mode="area" cumulative color="var(--gold)" caption="Kumulierter Cashflow (Einnahmen − Ausgaben)" />
        </div>
      </div>

      {/* Koordinaten schreibt ausschließlich /karte beim Aufruf (das Dashboard
          geocodiert bewusst nicht). Wer die Seite nie öffnet, hat nie
          Koordinaten — und sah hier dauerhaft nichts, ohne zu ahnen, dass es
          eine Karte gibt. Deshalb der Platzhalter mit dem Weg dorthin. */}
      {kartenObjekte.length > 0 ? (
        <div className="section mb-20">
          <div className="section-header">
            <div>
              <h3>Standorte</h3>
              <div className="section-sub">{kartenObjekte.length} von {properties.length} Objekt{properties.length === 1 ? "" : "en"} auf der Karte</div>
            </div>
            <Link href="/properties" className="btn btn-ghost btn-sm">Alle Objekte →</Link>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <PortfolioKarte objekte={kartenObjekte} hoehe="300px" />
          </div>
        </div>
      ) : properties.some((p) => p.adresse) ? (
        <div className="section mb-20">
          <div className="section-header">
            <div>
              <h3>Standorte</h3>
              <div className="section-sub">Karte noch nicht aktiviert</div>
            </div>
            <Link href="/karte" className="btn btn-ghost btn-sm">Karte aktivieren →</Link>
          </div>
          <div className="section-body">
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Deine Objekte haben noch keine Koordinaten. Beim ersten Aufruf der Kartenseite
              werden die Adressen einmalig aufgelöst und gespeichert — danach erscheint die Karte
              auch hier.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid-2 mb-20">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Einnahmen vs. Ausgaben</h3></div>
          <div className="section-body">
            {properties.length === 0 ? (
              <div className="empty"><BarChart3 className="empty-icon" size={36} color="var(--faint)" /><p>Noch keine Daten</p></div>
            ) : (
              balken.map((b) => (
                <div key={b.lbl} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", width: 80, textAlign: "right" }}>{b.lbl}</div>
                  <div style={{ flex: 1, height: 20, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${((b.val / balkenMax) * 100).toFixed(0)}%`, height: "100%", background: b.col, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: b.col, width: 70, textAlign: "right" }}>{euro(b.val)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <h3>Aktuelle Kredite</h3>
            {kredite.length > 3 && <Link href="/kredite" className="btn btn-ghost" style={{ fontSize: 11 }}>Alle {kredite.length} →</Link>}
          </div>
          <div className="section-body">
            {kredite.length === 0 ? (
              <div className="empty">
                <Landmark className="empty-icon" size={36} color="var(--faint)" /><p>Noch keine Kredite</p>
                <Link href="/kredite/new" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Kredit anlegen</Link>
              </div>
            ) : (
              kredite.slice(0, 3).map((k) => {
                const pct = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, Math.round(((k.restschuld ?? k.betrag) / k.betrag) * 100))) : 100;
                return (
                  <Link key={k.id} href="/kredite" style={{ display: "block", textDecoration: "none", color: "inherit", borderLeft: "3px solid var(--gold)", padding: "10px 14px", background: "var(--gold-pale)", borderRadius: "0 8px 8px 0", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{k.bezeichnung || k.bank || "Darlehen"}</strong>
                      {k.zinssatz != null && <span className="badge badge-gold">{zahl(k.zinssatz, 1)} %</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                      <span>Restschuld: <strong style={{ color: "var(--text)" }}>{euro(k.restschuld)}</strong></span>
                      <span>Rate: <strong style={{ color: "var(--text)" }}>{euro(k.monatsrate)}/Mo</strong></span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${100 - pct}%`, background: "var(--teal)" }} /></div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Design-Handoff: Buchungen + Fristen nebeneinander (Prototyp-Dashboard) */}
      <div className="grid-2">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div><h3>Letzte Buchungen</h3><div className="section-sub">Einnahmen und Ausgaben, zuletzt erfasst</div></div>
            <Link href="/cashflow" className="btn btn-ghost btn-sm">Alle →</Link>
          </div>
          <div className="section-body">
            {trans.length === 0 ? (
              <div className="empty">
                <Banknote className="empty-icon" size={36} color="var(--faint)" /><p>Noch keine Buchungen</p>
                <Link href="/cashflow/neu" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Erste Buchung erfassen</Link>
              </div>
            ) : (
              <div className="table-scroll"><table>
                <thead><tr><th>Datum</th><th>Beschreibung</th><th style={{ textAlign: "right" }}>Betrag</th></tr></thead>
                <tbody>
                  {trans.map((t) => {
                    const isEin = t._typ === "einnahme";
                    const objName = t.prop_id ? nameOf.get(t.prop_id) : null;
                    return (
                      <tr key={`${t._typ}-${t.id}`}>
                        <td style={{ whiteSpace: "nowrap" }}>{datum(t.buchungsdatum)}</td>
                        <td style={{ color: "var(--muted)" }}>
                          <Link href={`/${isEin ? "einnahmen" : "kosten"}/${t.id}/edit`} style={{ color: "inherit", textDecoration: "none" }}>
                            {[t.beschreibung || t.kategorie || "Buchung", objName].filter(Boolean).join(" — ")}
                          </Link>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", color: isEin ? "var(--green)" : "var(--red)" }}>{isEin ? "+ " : "− "}{euro(t.betrag)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div><h3>Fristen &amp; Aufgaben</h3><div className="section-sub">Automatisch aus deinen Daten erzeugt</div></div>
            <Link href="/termine" className="btn btn-ghost btn-sm">Alle →</Link>
          </div>
          <div className="section-body">
            {naechsteFristen.length === 0 ? (
              <div className="empty"><CalendarDays className="empty-icon" size={36} color="var(--faint)" /><p>Keine anstehenden Fristen</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {naechsteFristen.map((f) => (
                  <div key={`${f.datum}-${f.label}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10 }}>
                    <CalendarDays size={15} style={{ color: ueberfaellig(f.datum) ? "var(--red)" : "var(--gold)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{f.sub}</div>
                    </div>
                    <span
                      className={`badge ${ueberfaellig(f.datum) ? "badge-red" : f.warn ? "badge-amber" : "badge-teal"}`}
                      title={ueberfaellig(f.datum) ? "Überfällig" : undefined}
                    >
                      {ueberfaellig(f.datum) ? "überfällig · " : ""}{datum(f.datum)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
