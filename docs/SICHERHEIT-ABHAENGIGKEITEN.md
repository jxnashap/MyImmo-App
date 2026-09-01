# Sicherheit der Abhängigkeiten — Stand 01.09.2026

Erster Lauf des **OSV-Scanners** (`google/osv-scanner`, v2.5.1) gegen `package-lock.json`.
OSV ist die Schwachstellen-Datenbank von Google/OpenSSF; sie führt GitHub-Advisories und
Distributions-Meldungen zusammen. Der Scanner vergleicht die **exakt gesperrten** Versionen
aus der Lockdatei mit dieser Datenbank — er rät nicht anhand der Semver-Bereiche aus
`package.json`.

## Wiederholen

```bash
go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest
osv-scanner scan source --lockfile=package-lock.json
```

Läuft offline gegen die OSV-API, braucht keinen Zugang und lädt nichts ins Netz hoch außer
den Paketnamen/-versionen.

## Befund

| | Pakete | Meldungen |
|---|---|---|
| Erster Lauf | 4 | 29 (0 kritisch, 13 hoch, 14 mittel, 2 niedrig) |
| Nach dem Update | 2 | 25 |
| **Nach der Next-15-Migration (01.09.2026)** | 1 | **4** |

**Behoben (01.09.2026):** `postcss` 8.5.15 → 8.5.26, `nanoid` 3.3.15 → 3.3.18 — die eigenen
Abhängigkeiten, per `npm update` innerhalb des bestehenden Semver-Bereichs. Beide laufen
ausschließlich **zur Bauzeit** in der CSS-Pipeline, nicht im Betrieb; die Meldungen sind
ReDoS-/Parserprobleme, die eine Angreifer-kontrollierte CSS-Eingabe voraussetzen. Also ein
normales Update, kein Notfall.

**Offen — und nicht ohne Versionssprung behebbar:**

- **21 Meldungen zu `next` 14.2.35**
- **4 Meldungen zu `postcss` 8.4.31** — diese Version verdrahtet `next` 14 fest; sie hängt
  nicht am eigenen `postcss`-Eintrag und lässt sich einzeln nicht heben.

## Die eigentliche Nachricht: Next.js 14 bekommt keine Sicherheitsfixes mehr

`14.2.35` ist die **letzte je veröffentlichte** 14.2.x (geprüft über `npm view next versions`;
der dist-tag `next-14` zeigt genau darauf). Bei allen 21 Meldungen läuft der betroffene
Bereich ohne Unterbrechung von 12.x/13.x/14.x bis in die **15.5.x** hinein — es gibt also
keinen 14er-Patch, der übersprungen wurde, sondern der Zweig wird nicht mehr bedient.
Beispiel `GHSA-p9j2-gv94-2wf4`: betroffen ab 12.0.0, behoben erst in 15.5.21.

Damit gilt: **Jede künftige Next.js-Lücke trifft diese App und wird nie geschlossen.** Der
Abstand wächst ab jetzt monatlich. Das ist der Punkt, der Aufmerksamkeit verdient — nicht
die einzelne CVSS-Zahl.

## Was davon MyImmo tatsächlich trifft

Nicht alle 21 Meldungen sind hier anwendbar. Geprüft, nicht geschätzt:

| Meldung | Für MyImmo |
|---|---|
| `GHSA-ffhc-5mcf-pf4q` — XSS in App Router **mit CSP-Nonces** | **Nicht anwendbar.** Klingt nach genau unserem Aufbau, ist es aber nicht: Die Lücke braucht eine Nonce, die aus einem **Request-Header** abgeleitet wird. `middleware.ts` erzeugt sie mit `crypto.randomUUID()` und liest dafür keinen eingehenden Header. |
| `GHSA-36qx-fr4f-26g5` — Middleware-Bypass im **Pages Router mit i18n** | **Nicht anwendbar.** App Router, kein i18n. |
| `GHSA-p9j2-gv94-2wf4`, `GHSA-ggv3-7p47-pfv8` — SSRF / Request Smuggling in **`rewrites`** | **Nicht anwendbar.** Die App nutzt keine `rewrites`; die `redirects()` haben feste Ziele. |
| `GHSA-89xv-2m56-2m9x` — SSRF in Server Actions auf **eigenem Server** | **Nicht anwendbar.** Betrieb auf Vercel, kein Custom Server. |
| `GHSA-9g9p-9gw9-jx7f`, `GHSA-h64f-5h5j-jqjh`, `GHSA-3x4c-7xq6-9pq8` — Image Optimizer | **Kaum.** `next/image` wird an **null** Stellen genutzt (siehe `docs/SEO.md`). |
| `GHSA-955p-x3mx-jcvp` — Server-Action-Endpunkte für Unangemeldete auffindbar | **Anwendbar, aber abgefedert.** Der empfohlene Umgang ist genau der gebaute: Authentifizierung **innerhalb** der Aktion. Von 30 Actions prüfen 28 selbst die Sitzung; die beiden ohne Prüfung heißen `beleihungPublic` und `bewerbenPublic` und sind absichtlich öffentlich (Token-/Ablaufprüfung in einer SECURITY-DEFINER-RPC plus IP-Rate-Limit). Darunter liegt weiterhin die RLS. |
| `GHSA-m99w-x7hq-7vfj`, `GHSA-8h8q-6873-q5fj`, `GHSA-q4gf-8mx6-v5v3`, `GHSA-h25m-26qc-wcjf` — DoS über Server Actions / Server Components | **Anwendbar.** Kein Datenabfluss, aber Verfügbarkeit und — auf Vercel — Rechenzeit. |
| `GHSA-vfv6-92ff-j949`, `GHSA-wfc6-r584-vfw7`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`, `GHSA-3g8h-86w9-wvmq` — Cache Poisoning von RSC-Antworten | **Teilweise.** Betrifft geteilte Caches. Die App-Strecke sendet `private, no-cache, no-store`; gecacht wird nur die öffentliche `(pub)`-Strecke, die keine Nutzerdaten führt. Verunstaltung wäre möglich, Datenabfluss nicht. |

**Keine dieser Lücken erlaubt nach jetzigem Stand den Zugriff auf fremde Mieter- oder
Bankdaten.** Die Datentrennung hängt nicht an Next.js, sondern an der RLS in Postgres und
der App-Layer-Verschlüsselung. Das ist der Grund, warum hier kein Alarm steht — aber kein
Grund, auf 14 zu bleiben.

> ✅ **ERLEDIGT am 01.09.2026: Next 15.5.25 / React 19.2.8 sind drin.** Alle 21
> next-Meldungen geschlossen, `browserslist` (dev) mit aktualisiert. Übrig bleiben die
> **4 Meldungen zu `postcss` 8.4.31** — diese Version verdrahtet auch Next 15 (und 16)
> fest. Bewertung: reine **Bauzeit**-Exposition (ReDoS auf Angreifer-kontrolliertes CSS,
> das es in diesem Build nicht gibt); ein npm-`override` würde Nexts eigene CSS-Pipeline
> auf eine ungetestete Version heben — mehr Risiko als Gewinn. Bewusst belassen; beim
> nächsten Next-Update erneut prüfen. Details der Umsetzung: [[NEXTJS-15-MIGRATION]].
> Die Bewertungstabelle oben bleibt als Zeitdokument stehen.

## Empfehlung: Umstieg auf Next.js 15.5.x, als eigenes Vorhaben — ✅ umgesetzt

Nicht nebenbei. Die Migration berührt genau die Stellen, die zuletzt mühsam richtig gestellt
wurden:

1. **`headers()`, `cookies()`, `params`, `searchParams` sind in 15 asynchron.** Betrifft
   jede Server-Komponente und jede Action, die sie nutzt — u. a. beide Root-Layouts.
2. **Caching-Vorgaben sind gedreht.** `fetch` wird nicht mehr automatisch gecacht,
   GET-Route-Handler ebenso wenig. Die frisch erreichte statische Auslieferung der
   `(pub)`-Strecke (TTFB 0,59 s → 0,16 s, `x-vercel-cache: HIT`) muss danach **neu gemessen**
   werden, nicht angenommen.
3. **React 19 ist Voraussetzung** (derzeit 18.3.1). Das zieht `react-dom`, Typen und ggf.
   Fremdkomponenten mit.
4. **Middleware und die Nonce-CSP** sind der empfindlichste Teil — dort hängt das Login-Gate,
   die Demo-Sperre und die Trennung öffentlich/privat.

**Der ausgearbeitete Plan liegt in [[NEXTJS-15-MIGRATION]]** (`docs/zukunft/NEXTJS-15-MIGRATION.md`):
Zielversion **15.5.25** und ausdrücklich nicht 16, gezählte Betroffenheit je Guide-Punkt,
Abnahmeliste vor dem Merge.

**Vorgehen, wenn es angegangen wird:** eigener Branch, `npx @next/codemod@canary upgrade
latest` als Startpunkt, danach Punkt für Punkt: Build, 544 Tests, Login-Weiche, Demo-Sperre
(alle drei Ebenen), statische Auslieferung nachmessen, Vercel-Preview vor dem Merge
durchklicken. Realistisch ein zusammenhängender Arbeitsblock, kein Nebenbei-PR.

**Bis dahin bewusst in Kauf genommen:** die 21 Meldungen oben, mit der Bewertung in der
Tabelle. Diese Datei ist die Begründung — sie sollte bei jedem Scanner-Lauf mitwandern.

## Merkposten

- Den Scanner **vor jedem größeren Release** laufen lassen, mindestens aber monatlich.
- Erscheint eine Next.js-Meldung, die auf diese Konfiguration passt (App Router, Server
  Actions, Middleware, CSP-Nonce, Vercel), ist der Umstieg keine Fleißaufgabe mehr, sondern
  dringend.
- Fürs Automatisieren gibt es eine fertige GitHub-Action (`google/osv-scanner-action`).
  Bewusst noch nicht eingerichtet: Ein Lauf, der ohne Bewertung rot wird, wird nach zwei
  Wochen ignoriert — die Bewertung oben muss zuerst gepflegt sein.
