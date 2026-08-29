# SEO — Stand der Technik 2026 & Prüfung von MyImmo

> **Stand: 29.08.2026.** Recherche mit Primärquellen (Google-Doku, Google-Status-Dashboard,
> Pew Research, Ahrefs-Studie, Next.js-Doku) plus **eigene Live-Messung** gegen
> https://www.myimmoapp.de. Klar getrennt: **belegt** vs. **Einschätzung**.
>
> Quellenlage-Warnung: Ein Großteil der „SEO 2026"-Treffer sind KI-generierte Agentur-Blogs,
> die sich gegenseitig zitieren. Zahlen ohne Primärquelle stehen hier nicht als Fakt.

Verwandt: [[MARKETING]] · [[APP-STORE-RECHT]] · [[PROJEKT-STATUS]]

---

## 1. Was 2026 technisch zählt

### Core Web Vitals (belegt)
Gemessen am **75. Perzentil echter Nutzerdaten** (CrUX), nicht im Labor.

| Metrik | gut | mittel | schlecht |
|---|---|---|---|
| **LCP** (Ladezeit größtes Element) | ≤ 2,5 s | 2,5–4,0 s | > 4,0 s |
| **INP** (Reaktion auf Eingaben) | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Layout-Sprünge) | ≤ 0,1 | 0,1–0,25 | > 0,25 |

INP hat FID im **März 2024** abgelöst; Grenzwerte seitdem unverändert.
Quelle: <https://web.dev/articles/vitals>

*Einordnung:* CWV sind ein schwaches Tiebreaker-Signal, kein Ranking-Hebel. Für MyImmo zählt
eher die Zielgruppe 50+ auf dem Handy — dort schlägt langsame Auslieferung direkt auf Absprünge.

### Strukturierte Daten — der wichtigste Bruch (belegt)
- **FAQPage-Rich-Results sind abgeschaltet.** Ankündigung 08.05.2025, **seit 07.05.2026 keine
  FAQ-Rich-Results mehr in Google Search**; im Juni 2026 fielen Search-Console-Report und
  Rich-Results-Test-Unterstützung weg. Schon seit August 2023 waren sie auf Behörden- und
  Gesundheitsseiten beschränkt — für SaaS also längst wirkungslos.
  Quelle: <https://developers.google.com/search/docs/appearance/structured-data/faqpage>
- **HowTo-Rich-Results**: seit 2023 vollständig weg.
- **Was 2026 noch Rich Results bringt** und für MyImmo passt:
  **Article** (Ratgeber) · **BreadcrumbList** (SERP-Pfade) · **Organization** (Entity-Signal) ·
  **ProfilePage** (Autorenseiten, E-E-A-T) · *SoftwareApplication* (eher Entity- als Rich-Result-Signal).
  Quelle: <https://developers.google.com/search/docs/appearance/structured-data/search-gallery>

➡️ **Konsequenz:** Keine Arbeit mehr in FAQ-/HowTo-Markup stecken. FAQ-Blöcke nur noch bauen,
wenn sie **Nutzern** helfen (oder für LLM-Extraktion) — nicht für Snippets.

### hreflang: für MyImmo nicht nötig (belegt)
hreflang gilt nur für mehrsprachige/mehrregionale Varianten. Eine rein deutsche Seite braucht
nur `<html lang="de">`.
Quelle: <https://developers.google.com/search/docs/specialty/international/localized-versions>

### Next.js-Besonderheiten
- `metadata` / `generateMetadata` nur in Server Components.
- **SSG schlägt SSR für SEO-Seiten**: statisch prerendert = Auslieferung am CDN-Edge
  (zweistellige ms) statt Server-Render pro Aufruf.
- `next/image` liefert `width`/`height` (→ CLS 0), moderne Formate, Lazy-Loading.
- Streaming Metadata (ab Next 15.2) für Bots deaktiviert — **für uns irrelevant, wir sind auf 14.2**.
Quelle: <https://nextjs.org/docs/app/getting-started/metadata-and-og-images>

---

## 2. Ranking-Faktoren 2026

### Core Updates (belegt, Google-Status-Dashboard)
März 2025 · Juni 2025 · Dez 2025 · **März 2026** · **Mai 2026** Core-Updates;
Spam-Updates Aug 2025, März/Juni/**Aug 2026**.
Quelle: <https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history>

**Was abgestraft wird:** „**Scaled content abuse**" — Massen von Seiten primär für Rankings.
Google bewertet **das Ergebnis, nicht die Produktionsmethode**: KI-Text ist erlaubt, wenn er
redigiert, korrekt und nützlich ist.
Quelle: <https://developers.google.com/search/docs/essentials/spam-policies>

➡️ **Für MyImmo:** 19 redaktionelle Ratgeber sind unauffällig. Riskant würde erst, das Muster
auf 200+ generierte Longtail-Seiten zu skalieren, die sich nur in Keywords unterscheiden.
**20 substanzielle Artikel schlagen 200 generierte.**

### YMYL & E-E-A-T (belegt + Einschätzung)
Steuer- und Mietrecht sind **eindeutig YMYL** — die Quality Rater Guidelines nennen „financial"
und „legal" ausdrücklich und fordern dort das höchste E-E-A-T-Niveau.
Quelle (Primärdokument): <https://services.google.com/fh/files/misc/hsw-sqrg.pdf>

*Unbequeme Einschätzung:* Eine Ein-Personen-SaaS startet bei YMYL-Steuerthemen mit
strukturellem Nachteil gegenüber ImmoScout24, fachanwalt.de und Steuersoftware-Anbietern.
Was wirkt, in absteigender Stärke:
1. **Namentliche Autorenschaft** mit verlinkter Autorenseite (`ProfilePage`) und ehrlicher
   Qualifikation — auch „Vermieter mit X Jahren Praxis, kein Steuerberater" ist ein Signal.
   Ein anonymer `Organization`-Autor ist das **schwächste mögliche** Signal.
2. **Erfahrung („Experience")** — der eine Bereich, in dem wir die Portale schlagen können:
   echte Fälle, eigene Zahlen, Screenshots aus der Software. Die Portale liefern generische
   Rechtsreferate.
3. **Transparenz**: Impressum, Über-uns mit Gesicht, sichtbarer Rechtsstand je Artikel,
   expliziter „keine Steuer-/Rechtsberatung"-Hinweis.
4. **Aktualität**: `dateModified` im Markup — bei Steuerinhalten ein Kernsignal.

### AI Overviews / GEO — die belastbaren Zahlen
**Belegt (Pew Research, Juli 2025, Verhaltensdaten von 900 Erwachsenen):**
- Klickrate **8 %** mit AI-Summary vs. **15 %** ohne → **rund halbiert**
- Nur **1 %** klicken die im AI-Overview zitierten Quellen
- Sitzungsabbruch **26 %** vs. **16 %**
Quelle: <https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/>

**Belegt (KDD-2024-Paper, Princeton/Georgia Tech/AI2/IIT Delhi):** Gezielte Optimierung steigert
die Sichtbarkeit in generativen Antworten **um bis zu 40 %**. Wirksam waren **Statistiken,
Zitate und Quellenangaben** im Text — *nicht* Keyword-Dichte.
Quelle: <https://arxiv.org/abs/2311.09735>

**Nicht zitierfähig:** Kursierende Werte wie „CTR −34…−61 %" oder „80 % Zero-Click" stammen aus
Agentur-Blogs mit unklarer Methodik. Richtung plausibel, Zahlen nicht belastbar.

### ⛔ llms.txt ist ein Irrweg (belegt)
Ahrefs analysierte 137.210 Domains: **97 % aller llms.txt-Dateien bekamen null Anfragen**; von
den wenigen Zugriffen entfielen nur 1,1 % auf KI-Retrieval-Bots (96 % waren SEO-Tools).
Google bestätigt: kein Suchsystem liest die Datei (Mueller vergleicht sie mit dem
Keywords-Meta-Tag).
Quellen: <https://ahrefs.com/blog/llmstxt-study/> ·
<https://www.searchenginejournal.com/97-of-llms-txt-files-got-no-requests-ahrefs-data-shows/579478/>
➡️ **Kein llms.txt bauen.** Steuerung läuft über robots.txt (GPTBot, ClaudeBot, Google-Extended,
PerplexityBot respektieren sie).

---

## 3. Die deutsche SERP in unserer Nische (eigene Recherche)

### Transaktions-Keywords sind faktisch nicht gewinnbar
Bei „Vermieter Software", „Nebenkostenabrechnung Software", „Hausverwaltung Software" rankt
**kein einziger Hersteller auf Position 1–7**. Die Ergebnisse gehören Vergleichs- und
Affiliate-Portalen: trusted.de · softwareabc24.de · hausverwaltungschecker.de ·
ohnehausverwaltung.de. Dort werden immocloud, Win-CASA, hellohousing, objego, vermietet.de
mit Punktnoten gelistet.

➡️ **Konsequenz:** Nicht gegen diese Portale anrennen — **in ihnen gelistet werden**.
Eintrag/Profil beantragen ist billiger und schneller als ein 12-Monats-Ranking-Versuch.

### Longtail funktioniert — und ist belegt
Bei „nebenkostenabrechnung frist vermieter" rankt **objego.de/blog auf Position 2** — ein
Wettbewerber derselben Größenklasse. Direkter Beleg, dass der Content-Weg trägt.

Zweites Muster: Fast alle rankenden Titel tragen eine **Jahreszahl** („… 2026"). Unsere nicht.
Bei jahresabhängigen Steuer-/Rechtsthemen ein billiger CTR- und Aktualitätsgewinn — **erfordert
aber die Disziplin, jährlich zu aktualisieren**, sonst schlägt es ins Gegenteil um.

### Rechner sind der stärkste verbleibende Hebel (Einschätzung)
Gerade *weil* AI Overviews Textantworten kannibalisieren: Ein AI Overview beantwortet „Was ist
die Frist?" — aber nicht „Rechne meine 4 Wohnungen nach Fläche um". Interaktive Werkzeuge
erzeugen einen Klickgrund, den eine generierte Antwort nicht ersetzt.
Die Logik liegt bereits in der App (`lib/steuer/*`, `lib/umlage.ts`, `lib/nk.ts`) und müsste nur
als öffentliche Seite ausgespielt werden.

⚠️ **Zielkonflikt beachten:** Unsere `/vorlagen` hängt am Brevo-Double-Opt-in. Was der Crawler
nicht sieht, zählt nicht — Inhalt hinter dem E-Mail-Gate verliert SEO-Wert.

---

## 4. Messbarkeit — Minimalsetup

1. **Google Search Console** — nicht ersetzbar (Queries, Positionen, CrUX-Felddaten,
   Indexierungsfehler). Verifikation per DNS-TXT.
2. **Bing Webmaster Tools + IndexNow** — **belegt relevant**: ChatGPT Search und Copilot nutzen
   den Bing-Index. Was Bing nicht kennt, kann ChatGPT nicht zitieren. ~1 h, 0 €.
   Quelle: <https://www.bing.com/indexnow>
3. **`@vercel/speed-insights`** — echte INP/LCP/CLS-Felddaten, cookielos/DSGVO-freundlich.
4. **Bewusst nicht**: llms.txt (s. o.), Google Analytics (Consent-Aufwand > Nutzen).

---

## 5. Prüfung: Wie steht MyImmo da? (live gemessen, 29.08.2026)

### ✅ Was gut ist
`app/robots.ts` und `app/sitemap.ts` sauber · `metadata`-Export auf **allen** öffentlichen Seiten ·
Organization- + SoftwareApplication-JSON-LD auf der Startseite · Article-JSON-LD auf Ratgebern ·
`generateStaticParams` vorhanden · 19 redaktionelle Ratgeber-Artikel als Fundament.
**Das ist deutlich über Durchschnitt.**

### 🔴 Zwei echte Defekte — selbst nachgemessen

**D1 — Alle öffentlichen Seiten sind uncacheable und rendern pro Aufruf neu.**
```
GET /            cache-control: private, no-cache, no-store  x-vercel-cache: MISS  TTFB 0,43 s
GET /ratgeber    cache-control: private, no-cache, no-store  x-vercel-cache: MISS  TTFB 0,59 s
GET /funktionen  cache-control: private, no-cache, no-store  x-vercel-cache: MISS  TTFB 0,40 s
```
Trotz `generateStaticParams` greift **kein** Prerendering. Ursache: Das Root-Layout ruft für
*jede* Route `supabase.auth.getUser()` auf und liest `headers()` — beides erzwingt Dynamic
Rendering und `no-store` für den ganzen Baum, Marketing- und Ratgeberseiten eingeschlossen.
Die Middleware läuft zusätzlich auf allem außer `_next/static`.
➡️ **Größter technischer Hebel.** Fix: öffentliche Seiten in eine eigene Route-Group mit
auth-freiem Layout (`app/(public)/…`), Middleware-Matcher entsprechend ausnehmen.

**D2 — Soft 404.** Nicht existierende Seiten liefern **HTTP 200**:
```
/ratgeber/gibt-es-nicht-xyz  -> 200   (Inhalt der 404-Seite wird gerendert!)
/funktionen/quatsch-123      -> 200
```
Die 404-Seite **rendert korrekt** („404 · Seite nicht gefunden"), nur der Statuscode stimmt
nicht. Google indexiert solche Seiten als Soft-404 und verbrennt Crawl-Budget.
*Ursache noch nicht abschließend geklärt* — Verdacht: Layout/Middleware überschreiben den
Status. Muss beim Fix lokal reproduziert werden.

### 🟠 Weitere Lücken
| Lücke | Wirkung |
|---|---|
| `dateModified` fehlt im Article-JSON-LD | Aktualitätssignal bei YMYL-Steuerinhalten |
| `author` = `Organization` statt Person | **schwächstes** E-E-A-T-Signal bei YMYL |
| Keine Autoren-/Über-uns-Seite | zentrales Vertrauenssignal fehlt komplett |
| Kein `BreadcrumbList` | eines der wenigen 2026 verbliebenen Rich Results |
| Canonical fehlt auf `/funktionen`, `/preise`, `/vision` | Duplicate-Risiko |
| `next/image` an **0** Stellen genutzt | CLS/LCP verschenkt |
| Alle Artikel teilen `/og.png` | schwächere Share-CTR |
| Kein Speed Insights installiert | **null Felddaten** — CWV nicht messbar |
| Titel ohne Jahreszahl | CTR + Aktualität bei jahresabhängigen Themen |

---

## 6. Priorisiert — was am meisten bringt

**Sofort (großer Hebel, kleiner Aufwand)**
1. **D1: Öffentliche Seiten statisch machen** — von ~0,5 s TTFB auf Edge. Verbessert LCP,
   Crawl-Effizienz und Absprungrate gleichzeitig.
2. **D2: Soft 404 reparieren** — 404 muss 404 liefern.
3. **Search Console + Bing/IndexNow einrichten** (~2 h, 0 €). Ohne GSC steuern wir blind,
   ohne Bing sind wir für ChatGPT unsichtbar.
4. **`@vercel/speed-insights`** — ohne Felddaten ist jede CWV-Aussage Spekulation.

**Kurzfristig (YMYL/E-E-A-T)**
5. Namentliche Autorenschaft + Autorenseite mit `ProfilePage`-Markup.
6. `dateModified` ergänzen, Rechtsstand sichtbar je Artikel.
7. `BreadcrumbList`-JSON-LD.
8. Canonicals vervollständigen.

**Strategisch**
9. **Nicht** auf „Vermieter Software" optimieren — stattdessen Listung bei trusted.de,
   softwareabc24.de, hausverwaltungschecker.de, ohnehausverwaltung.de beantragen.
10. Ratgeber gezielt auf Longtail ausbauen (objegos Position 2 belegt, dass es trägt),
    Jahreszahlen in Titel — **aber nicht skalieren um des Skalierens willen**.
11. **Öffentliche Rechner** aus der vorhandenen App-Logik — der einzige Content-Typ, den ein
    AI Overview strukturell nicht ersetzt.
12. GEO leichtgewichtig: konkrete Zahlen und Paragrafen als zitierbare Sätze (die im
    KDD-Paper belegte Wirkmechanik).

**Ausdrücklich nicht tun**
13. Kein FAQPage-/HowTo-Markup (seit Mai 2026 bzw. 2023 wirkungslos) · kein hreflang ·
    kein llms.txt.
