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
2. **Bing Webmaster Tools** — kostenlos, ~15 Min über den Import aus der Google Search
   Console. Liefert eine zweite Datenquelle; Bing ist in Deutschland klein, aber die Daten
   kosten nichts.
   **IndexNow dagegen: bei MyImmo kaum sinnvoll.** Das Protokoll (Bing, Yandex, Naver,
   Seznam, Yep — **Google nutzt es nicht**) spielt seine Stärke bei Seiten aus, die sich
   ständig ändern. Rund 30 selten geänderte Seiten gewinnen dadurch Stunden, nicht Rang.

   > **⚠️ Korrektur (01.09.2026).** Hier stand: „ChatGPT Search und Copilot nutzen den
   > Bing-Index. Was Bing nicht kennt, kann ChatGPT nicht zitieren." **Das war überholt**
   > und ungeprüft aus älterem Wissen übernommen. OpenAI betreibt mit `OAI-SearchBot` einen
   > eigenen Crawler und kombiniert eigene Erfassung mit lizenzierten Daten. Die
   > Übereinstimmung von ChatGPT-Zitaten mit Bing-Ergebnissen ist laut Profound von **26 %
   > auf 8 %** gefallen, die mit Google von **12 % auf 33 %** gestiegen.
   > **Bing ist keine Eintrittskarte zu ChatGPT mehr.** Für ChatGPT ist nichts zu tun:
   > `robots.txt` erlaubt `User-Agent: *` mit `Allow: /`, `OAI-SearchBot` darf also crawlen
   > (live geprüft 01.09.2026).
   > Quellen: <https://developers.openai.com/api/docs/bots> ·
   > <https://en.wikipedia.org/wiki/IndexNow>
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
Trotz `generateStaticParams` greift **kein** Prerendering.

> **⚠️ Korrektur der Ursache (30.08.2026).** Die zuerst notierte Erklärung — „das Root-Layout
> ruft `supabase.auth.getUser()`" — war **falsch**. Drei Experimente haben sie widerlegt:
> 1. Middleware-Matcher für eine Route ausgenommen → weiterhin dynamisch.
> 2. Minimales Layout ohne Auth/`headers()` → weiterhin dynamisch.
> 3. `next.config.mjs` und alle `export const dynamic` geprüft → unauffällig.
>
> **Die echte Ursache ist die nonce-basierte CSP.** Die Next.js-Doku sagt es wörtlich:
> *„To use a nonce, your page must be dynamically rendered. […] When you use nonces in your CSP,
> **all pages must be dynamically rendered**. Static optimization and ISR are disabled. Pages
> cannot be cached by CDNs."*
> <https://nextjs.org/docs/app/guides/content-security-policy>
>
> Eine Nonce muss pro Request neu und unvorhersehbar sein — zur Bauzeit gibt es keinen Request,
> also keine Nonce. `middleware.ts:15` setzt `script-src 'self' 'nonce-…'` für **alle** Routen.

➡️ **Das ist kein Bug, sondern ein bewusster Zielkonflikt: Sicherheit gegen Auslieferungstempo.**
Der Sicherheits-Audit (08/2026) hat genau diese strenge CSP als Stärke bewertet.

**Drei Wege, mit Kosten:**

| Weg | Ergebnis | Preis |
|---|---|---|
| **A — so lassen** | Alles bleibt dynamisch, ~0,5 s TTFB | keine Änderung, Sicherheit unangetastet |
| **B — Strecken trennen** | Marketing/Ratgeber statisch + CDN-cachebar, App behält Nonce-CSP | Öffentliche Seiten brauchen `script-src 'self' 'unsafe-inline'` (Next.js gibt seine Flight-Daten als Inline-`<script>` aus) |
| **C — SRI global** | Alles statisch möglich | `experimental.sri` gibt es **erst ab Next 15**; das Projekt läuft auf **14.2.35** → nicht verfügbar |

### ✅ Umgesetzt: Weg B (30.08.2026)

Die App hat jetzt **zwei Root-Layouts**:

| | `app/(app)/layout.tsx` | `app/(pub)/layout.tsx` |
|---|---|---|
| Inhalt | gesamte Vermieter-App, `/`, Login, Token-Seiten (`/bewerben`, `/beleihung`, `/auftrag`) | `/funktionen`, `/ratgeber`, `/vision`, `/vorlagen`, `/preise`, `/agb`, `/avv`, `/datenschutz`, `/impressum` |
| liest `headers()` / Session | ja | **nein** |
| CSP | Nonce, aus `middleware.ts` — **unverändert** | statisch, aus `next.config.mjs` |
| Middleware | läuft | **ausgenommen** (kein Supabase-Roundtrip pro Aufruf) |
| Rendering | dynamisch | **statisch, `s-maxage=31536000`** |

Nachgemessen (lokaler Prod-Build, `next start`):

```
/funktionen           200  Cache-Control: s-maxage=31536000, stale-while-revalidate
/ratgeber/<artikel>   200  Cache-Control: s-maxage=31536000, stale-while-revalidate
/impressum /agb /datenschutz /avv /preise /vision   ebenso
/ratgeber/gibt-es-nicht   404  (gebrandete deutsche 404-Seite)
/  /login  /steuer    unverändert: Nonce-CSP, 307-Login-Weiche intakt
```
14 Seiten im echten Chromium geprüft: **0 CSP-Verstöße, 0 JS-Fehler, alle hydrieren.**

**Was der Weg kostet — ehrlich:**
- Auf den 9 öffentlichen Pfaden gilt `script-src 'self' 'unsafe-inline'` statt der Nonce.
  Ein XSS dort wäre nicht mehr durch die CSP gebremst. Realistisch ist die Angriffsfläche
  klein: die Inhalte stammen fest aus `lib/ratgeber.ts` / `lib/funktionen.ts`, es wird keine
  Nutzereingabe gerendert, und das einzige Formular (Vorlagen-Verteiler) postet gegen
  `form-action 'self'`. **Gleicher Origin wie die App** — deshalb ist die Restrisiko-Frage
  nicht null, sondern nur klein.
- Alle übrigen Direktiven bleiben streng (`default-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`, kein fremder Origin, kein `blob:`).
- Das Theme-Skript liegt jetzt als Datei `public/theme.js` statt inline — dadurch braucht
  die öffentliche Strecke kein eigenes Inline-Skript mehr.
- **Zwei Listen müssen zusammen gepflegt werden:** der Middleware-Matcher (`middleware.ts`)
  und `OEFFENTLICH` in `next.config.mjs`. Ein neuer Pfad in nur einer der beiden Listen
  bedeutet entweder fehlende Security-Header oder eine Login-Weiche auf einer öffentlichen
  Seite. Beide Stellen tragen einen Kommentar mit Verweis aufeinander.
- **`/` bleibt dynamisch.** Die Startseite entscheidet anhand der Session zwischen Landing
  und Dashboard — sie ließe sich nur statisch machen, wenn das Dashboard eine eigene Adresse
  bekäme. Das ist eine Produktentscheidung, keine technische, und steht offen.

**D2 — Soft 404.** Nicht existierende Seiten liefern **HTTP 200**:
```
/ratgeber/gibt-es-nicht-xyz  -> 200   (Inhalt der 404-Seite wird gerendert!)
/funktionen/quatsch-123      -> 200
```
Die 404-Seite **rendert korrekt** („404 · Seite nicht gefunden"), nur der Statuscode stimmt
nicht. Google indexiert solche Seiten als Soft-404 und verbrennt Crawl-Budget.

> **✅ Ursache geklärt und behoben (30.08.2026, lokal nachgemessen) — D2 war ein SYMPTOM von D1.**
> Der Reihe nach geprüft:
> 1. `dynamicParams = false` auf den `[slug]`-Routen → **reicht nicht**, weiterhin 200.
> 2. `notFound()` schon in `generateMetadata()` → **reicht auch nicht**, weiterhin 200.
> 3. Middleware als Verursacher → **nein**. Mit aus dem Matcher ausgenommener Route ebenfalls 200.
> 4. **Treffer:** Die Seite wurde zur Laufzeit trotz `●` im Build dynamisch gerendert
>    (Ursache siehe D1: die **nonce-basierte CSP**) und dabei gestreamt — der Status 200 war
>    bereits gesendet, bevor `notFound()` greifen konnte.
>
> ➡️ Mit dem Layout-Split (Weg B oben) liefern `/ratgeber/<unbekannt>` und
> `/funktionen/<unbekannt>` jetzt **echte 404** samt gebrandeter deutscher Fehlerseite.
> `dynamicParams = false` wurde wieder entfernt: es erzwang zwar den Status, aber über den
> Router — und damit die ungestylte englische Next-Standardseite statt der eigenen.

**D3 — Weitere Domains liefern dieselbe Seite (gefunden 01.09.2026).**
Bei der Suche nach „MyImmo" zeigt Google die Seite unter **`myimmoapp.store`** statt unter
`myimmoapp.de`. Nachgemessen:
```
myimmoapp.store       308 -> www.myimmoapp.store
www.myimmoapp.store   200  (server: Vercel — liefert dieselbe App aus)
```
Die Seite ist damit unter **zwei** Domains erreichbar. Google muss eine davon als die
maßgebliche wählen — und hat sich für `.store` entschieden.

**Nachtrag vom selben Tag — es waren nicht zwei, sondern drei.** Die Vercel-Domainliste
(Screenshot des Betreibers) zeigte eine dritte Adresse, die ich vorher nicht kannte:
```
myimmoapp.com         308 -> www.myimmoapp.com
www.myimmoapp.com     200  („Production", Valid Configuration — dieselbe App)
```
Auch `.com` sendet ein korrektes Canonical auf `.de` — und hilft aus demselben Grund
nicht. Die erste Fassung der Weiterleitung kannte nur `.store`; das Problem wäre also
nur zur Hälfte behoben gewesen. **Lehre:** Beim Duplicate-Domain-Problem nicht die eine
Domain reparieren, die aufgefallen ist, sondern die **Domainliste des Hosters** ansehen.
Die Liste steht deshalb jetzt als `NEBENDOMAINS` an einer Stelle in `next.config.mjs` —
neue Domain im Vercel-Projekt heißt: dort eintragen.

**Bemerkenswert:** Technisch ist alles richtig gesetzt. `.store` liefert bereits
`<link rel="canonical" href="https://www.myimmoapp.de">`, und die Sitemap dort listet
ausschließlich `.de`-Adressen. **Es hat trotzdem nicht gereicht** — Canonical ist ein
Hinweis, keine Anweisung. Google wägt weitere Signale ab (welche Domain zuerst gefunden
wurde, Verlinkungen, Nutzerverhalten) und kann sich anders entscheiden.

➡️ **Der einzige verlässliche Weg: Nur `.de` darf noch Inhalt ausliefern.**
Eine dauerhafte Weiterleitung auf `.de` nimmt Google die Wahl ab.
Zwei Wege, gleiches Ergebnis:
1. **Vercel** → Projekt → Settings → Domains → `myimmoapp.store` **und** `myimmoapp.com`
   (samt `www.`-Varianten) auf „Redirect to www.myimmoapp.de" stellen. Sauberster Weg:
   Die App wird gar nicht erst aufgerufen. Nur der Betreiber kann das.
2. **Im Code** — `next.config.mjs`, `redirects()` mit `has: [{ type: "host" }]`. Wirkt mit
   dem nächsten Deploy und ist versioniert.

**Nicht „aufräumen": Die `.com`-Weiterleitung ist gewollt.** Am 01.09.2026 stand die Frage
im Raum, `myimmoapp.com` stattdessen als englische Fassung zu betreiben. Entscheidung des
Betreibers: **nein** — `.de` bleibt vorerst die einzige Adresse, `.com` bleibt Weiterleitung
und wird lediglich weiter verlängert. Begründung und der Weg für eine spätere Expansion
stehen in `CLAUDE.md` unter „Zukunftsideen → Englische Fassung".

**Erwartungshaltung:** Der Wechsel im Index dauert Wochen, nicht Stunden. Beschleunigen
lässt er sich über die **Adressänderung** in der Search Console — dafür müssen beide
Domains dort als Property bestätigt sein.

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
1. ~~**D1: Öffentliche Seiten statisch machen**~~ ✅ **erledigt 30.08.2026** (Layout-Split,
   siehe Abschnitt 5). Preis: `'unsafe-inline'` auf den 9 öffentlichen Pfaden — dort dokumentiert.
2. ~~**D2: Soft 404**~~ ✅ **erledigt** — fiel wie erwartet mit D1 weg.
3. **Search Console** ✅ vorhanden (Betreiber, bestätigt 30.08.2026).
   ⏳ **Bing Webmaster Tools** noch offen — der GSC-Import macht die Einrichtung zu einer
   Sache von Minuten. **IndexNow zurückgestellt** (geringer Nutzen bei selten geänderten
   Seiten); die frühere ChatGPT-Begründung war falsch, siehe Korrektur oben.
4. ~~**`@vercel/speed-insights`**~~ ✅ erledigt (#278) — Felddaten laufen auf, sind aber noch
   zu jung für belastbare CWV-Aussagen.

**Kurzfristig (YMYL/E-E-A-T)**
5. Namentliche Autorenschaft + Autorenseite mit `ProfilePage`-Markup.
   ⏸️ **ZURÜCKGESTELLT (30.08.2026, Entscheidung des Betreibers)** — Begründung, Risiken und
   die vorab zu klärende Frage (wer hat die Artikel tatsächlich verantwortet?) stehen in
   `CLAUDE.md` unter „Sonstiges". Bleibt damit die größte offene E-E-A-T-Lücke.
6. ~~`dateModified` ergänzen, Rechtsstand sichtbar je Artikel~~ ✅ **erledigt 30.08.2026.**
   Siehe Abschnitt 8 — mit einer Einschränkung, die man kennen muss.
7. ~~`BreadcrumbList`-JSON-LD~~ ✅ **erledigt 30.08.2026** — auf `/ratgeber/<slug>` und
   `/funktionen/<slug>`, sichtbare Navigation und Markup aus einer Quelle
   (`components/landing/Brotkrumen.tsx`).
8. ~~Canonicals vervollständigen~~ ✅ erledigt (#278).

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


## 8. Aktualitätssignale — was am 30.08.2026 gebaut wurde (und was es NICHT leistet)

**Gebaut:**
- `RECHTSSTAND` als eine Konstante in `lib/ratgeber.ts`, über jedem Artikel sichtbar
  ausgewiesen (Kopfzeile neben Lesezeit und Datum, nicht im Fußbereich versteckt).
  Bei Steuer- und Mietrechtsthemen ist das die Angabe, an der ein Leser erkennt, ob er
  sich auf den Text noch verlassen kann.
- Optionales Feld `aktualisiert` je Artikel → speist `dateModified` im Article-Markup.
- Die Anbieter-Entität (`ORGANISATION` in `lib/seo/jsonLd.ts`) hat ein festes `@id`.
  Startseite und Artikel verweisen jetzt auf **dieselbe** Organisation statt auf mehrere
  gleichnamige — Entitäts-Konsolidierung ist eines der wenigen E-E-A-T-Signale, die sich
  technisch überhaupt setzen lassen.
- `"Stand Juli 2026."` stand zusätzlich fest im Fließtext von 12 Artikeln. Entfernt und
  durch die Konstante ersetzt; ein Test verhindert den Rückfall. Sonst hätte beim nächsten
  Rechtsstand-Update die Kopfzeile etwas anderes behauptet als der Text darunter.

**Was es ausdrücklich NICHT leistet — wichtig:**
`dateModified` ist bei **allen 17 Artikeln gleich `datePublished`**, weil seit der
Veröffentlichung (Juli 2026) kein Artikel inhaltlich überarbeitet wurde. Das Feld auf
„heute" zu setzen wäre das billigste Frische-Signal überhaupt — und eine Falschaussage
gegenüber Google **und** gegenüber dem Leser, der glaubt, der Text sei gegen die aktuelle
Rechtslage geprüft worden. Google erkennt aufgeblasene `dateModified`-Werte und wertet sie
ab. **Frische entsteht durch Überarbeiten, nicht durch ein Datumsfeld.**

Das Gerüst dafür steht jetzt: wer einen Artikel überarbeitet, setzt `aktualisiert` und hebt
bei Bedarf `RECHTSSTAND` (oder das artikeleigene `rechtsstand`). Erst dann bewegt sich das
Signal — zu Recht.

**Konkret fällig sind zwei Artikel:**
| Artikel | Warum |
|---|---|
| ~~`grundsteuer-2025-auf-mieter-umlegen`~~ | ✅ **überarbeitet 30.08.2026** → `grundsteuer-auf-mieter-umlegen` (301/308-Weiterleitung in `next.config.mjs`). Jahreszahl raus, BFH-Urteile vom 10.12.2025 und 27.05.2024 ergänzt, jährlich wechselnde Hebesätze erklärt. **Erster Artikel mit echtem `aktualisiert`-Datum** — `dateModified` weicht jetzt zu Recht von `datePublished` ab. |
| `heizkostenabrechnung-50-70-regel-fernablesung` | wirbt mit der Frist 31.12.2026 — ab 01.01.2027 Vergangenheit (steht schon als Termin in `CLAUDE.md`) |
