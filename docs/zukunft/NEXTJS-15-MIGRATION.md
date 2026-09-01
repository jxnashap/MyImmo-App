# Migrationsplan: Next.js 14.2.35 → 15.5.25

Stand 01.09.2026. Grundlage: `docs/SICHERHEIT-ABHAENGIGKEITEN.md` (Next 14 bekommt keine
Sicherheitsfixes mehr) und die offiziellen Upgrade-Guides von Next.js, abgerufen am
01.09.2026. **Noch nicht umgesetzt** — dies ist der Plan, nicht der Bericht.

## Zielversion: 15.5.25, ausdrücklich nicht 16

| | Next 15.5.25 | Next 16.3.4 |
|---|---|---|
| Schließt die 21 Meldungen | ✅ (Fixes ab 15.5.21) | ✅ |
| Bekommt weiter Sicherheitsfixes | ✅ (zweitneuester Major) | ✅ |
| `middleware.ts` → `proxy.ts` | nein | **ja, Pflicht** — und der **Edge-Runtime wird in `proxy` NICHT unterstützt** |
| Turbopack als Standard-Bundler | nein | ja (Build und Dev) |
| `next lint` | vorhanden | **entfernt**, ESLint-CLI + Flat Config |
| Synchroner Zugriff auf `headers()` etc. | Übergangsfrist mit Warnung | vollständig entfernt |

**Begründung für 15.5:** Der Sicherheitsdruck ist mit 15.5.25 vollständig weg. Alles, was 16
zusätzlich verlangt, ist Umbau ohne Sicherheitsgewinn — und trifft mit `middleware` → `proxy`
ausgerechnet das Bauteil, an dem Login-Gate, Demo-Sperre und die Nonce-CSP hängen. Zwei
getrennte, jeweils überprüfbare Schritte sind hier mehr wert als ein großer Sprung.
16 wird später ein eigenes Vorhaben, ohne Zeitdruck.

## Was das Projekt betrifft — gezählt, nicht geschätzt

| Punkt aus dem Guide | Bei MyImmo |
|---|---|
| `cookies()`, `headers()`, `draftMode()` werden asynchron | **10 Aufrufstellen in 7 Dateien** |
| `params` / `searchParams` werden Promises | **54 Dateien** (Seiten, Layouts, Route-Handler) |
| React 19 ist Pflicht | 18.3.1 → 19; `@types/react`(-dom) von `^18` mit |
| `useFormState` → `useActionState` | **0 Treffer** — nichts zu tun |
| `fetch` wird nicht mehr automatisch gecacht | **praktisch folgenlos**: 9 Server-`fetch`; alle sind POST, `no-store` oder liegen in `force-dynamic`-Routen. Einzige Ausnahme `lib/wert/hpi.ts` mit explizitem `next: { revalidate: 86400 }` — explizite Angaben gelten weiter |
| GET-Route-Handler werden nicht mehr gecacht | 23 GET-Handler, durchweg auth- oder zeitabhängig und überwiegend schon `force-dynamic`. Die Änderung macht sie **sicherer**, nicht kaputt |
| Client-Cache: Seiten-Segmente werden beim Navigieren nicht mehr wiederverwendet | **Spürbar für Nutzer.** Kein Fehler, aber Zurück-/Vorwärts-Navigation kann mehr Server-Runden kosten. Falls es sich zäh anfühlt: `experimental.staleTimes` |
| `NextRequest.geo` / `.ip` entfernt | **nicht betroffen** — die IP kommt bereits aus `x-forwarded-for` (`lib/net/bremse.ts`, `bewerbenPublic`, `beleihungPublic`) |
| Speed-Insights-Auto-Instrumentierung entfernt | **nicht betroffen** — `<SpeedInsights />` steht explizit im Layout; `@vercel/speed-insights` 2.0.0 erlaubt React 19 |
| `@next/font` entfernt | nicht betroffen (kein Import, Geist wird selbst gehostet) |
| `runtime: "experimental-edge"` | nicht betroffen (nirgends gesetzt) |
| `serverComponentsExternalPackages` / `bundlePagesExternals` umbenannt | nicht betroffen (nicht gesetzt) |
| React 19: `defaultProps` auf Funktionskomponenten, `propTypes`, `findDOMNode` entfallen | **0 Treffer** |
| Fremdpakete mit React-Peer-Abhängigkeit | nur `lucide-react` (erlaubt `^19`) und `@vercel/speed-insights` (erlaubt `^19`) — **kein Blocker** |

Die drei Zeilen mit den 54 Dateien und den 10 Aufrufstellen sind die eigentliche Arbeit.
Beides erledigt der Codemod weitgehend mechanisch; er wird trotzdem Datei für Datei
durchgesehen, weil er auch dort `await` einsetzt, wo der Wert nie benutzt wird.

## Vorgehen

**Eigener Branch, eigener PR, nichts anderes darin.**

1. **Absichern:** `main` ist grün, 544 Tests laufen, Bau- und Startpfad sind bekannt.
2. **Codemod als Startpunkt:** `npx @next/codemod@canary upgrade latest`, danach gezielt
   `npx @next/codemod@canary next-async-request-api .`. Anschließend `git diff` vollständig
   lesen — der Codemod ist ein Vorschlag, kein Ergebnis.
3. **Pakete:** `next@15.5.25`, `react@19`, `react-dom@19`, `@types/react`,
   `@types/react-dom`, `eslint-config-next` auf passende Stände.
4. **Übersetzen und Testen:** `npm run build` und die 544 Tests. Erst wenn beides grün ist,
   überhaupt weiterschauen.
5. **Von Hand nachziehen**, was der Codemod nicht kann: Typen, die auf `params` als Objekt
   bauen, und Stellen, an denen `headers()` in einer Nicht-`async`-Funktion steht.

## Abnahme — was VOR dem Merge nachgewiesen sein muss

Nicht „sieht gut aus", sondern gemessen. Die Reihenfolge ist nach Schadenshöhe sortiert:

1. **Anmeldung und Zugangs-Gate.** Registrieren mit Zugangscode → Bestätigungsmail →
   erster Login → `freischaltung_nachholen()` löst die Vormerkung ein, **ohne** erneute
   Code-Abfrage. Das hing zuletzt an zwei stillen Fehlern; ein Regress hier sperrt neue
   Nutzer aus.
2. **Demo-Konto, alle drei Ebenen.** RLS verweigert Schreiben, `demoDarfRoute` sperrt die
   Routen (auch nicht-GET), `DemoNurLesen` macht Felder schreibgeschützt. Ausnahme
   Mieterhöhungs-Dokument samt PDF muss weiter gehen.
3. **Nonce-CSP.** Auf einer App-Seite prüfen: Antwort trägt `Content-Security-Policy` mit
   `nonce-…`, die Seite hydriert, keine CSP-Verstöße in der Browser-Konsole.
4. **Statische Auslieferung der `(pub)`-Strecke — neu messen, nicht annehmen.**
   Zielwerte aus `docs/SEO.md`: `/ratgeber` TTFB ≈ 0,16 s und `x-vercel-cache: HIT`.
   Wird das schlechter, ist der Layout-Split beschädigt; das war teuer erkämpft.
5. **Echte 404** für `/ratgeber/<unbekannt>` und `/funktionen/<unbekannt>` — Status 404 mit
   der gebrandeten deutschen Fehlerseite, nicht 200 und nicht die englische Next-Seite.
6. **Domain-Weiterleitungen** mit Host-Header: `.store` und `.com` → 308 auf `.de`,
   Pfad erhalten, `.de` unberührt.
7. **PDF-Erzeugung** je einmal: Mieterhöhung, NK-Abrechnung, Beleihung — pdf-lib ist von
   Next unabhängig, aber die Route drumherum nicht.
8. **Vercel-Preview durchklicken**, bevor gemerged wird. Der lokale Produktionsserver
   deckt Edge-Verhalten und CDN nicht ab.
9. **Zum Abschluss `osv-scanner` erneut laufen lassen** — Erwartung: die 21 next-Meldungen
   und die 4 zu `postcss` 8.4.31 sind weg.

## Risiken, ehrlich benannt

- **Die stillen Regressionen sind gefährlicher als die lauten.** Ein Bauabbruch fällt sofort
  auf. Eine Anmelde-Weiche, die eine Umleitung zu früh auslöst, oder eine Demo-Sperre, die
  nicht mehr greift, fällt erst einem Besucher auf. Deshalb steht oben eine Abnahmeliste und
  keine Sichtprüfung.
- **Der Codemod erzeugt Diffs in über 50 Dateien.** Wer den nicht liest, merged blind.
- **React 19 kann sich in Randfällen anders verhalten** (Effekt-Reihenfolge, Hydration-
  Warnungen), auch ohne API-Bruch. Die Tests laufen im Node-Environment und fangen das
  nicht — dafür ist Punkt 8 der Abnahme da.
- **Zurückrollen ist möglich und billig:** Vercel kann auf das vorige Deployment
  zurückspringen, der Merge lässt sich revertieren. Genau deshalb gehört sonst nichts in
  diesen PR — ein Revert darf nicht auch Fachliches mitreißen.

## Aufwand

Ein zusammenhängender Arbeitsblock. Der mechanische Teil ist kurz; der Anteil, der zählt,
ist das Lesen des Diffs und die Abnahmeliste. Kein Nebenbei-PR, und nichts, was man halb
fertig auf `main` schiebt.
