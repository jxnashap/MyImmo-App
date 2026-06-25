# MyImmo — Projekt-Handoff

> Übergabe-Dokument für die Weiterarbeit in einer neuen Session.
> Stand: nach Stabilisierungs-Runde (Umlage-Fix, Tests, CI).

## Projekt & Deployment
- **App:** MyImmo — privates Immobilien-Management. Next.js 14 (App Router), TypeScript, Supabase (SSR-Auth), pdf-lib, Vitest.
- **Repo:** `jxnashap/myimmo-app`. Deploy-Branch: **`main`**. Arbeitsbranch: `claude/magical-feynman-l8w9s5` (wird nach jedem Merge auf `main`-Stand zurückgesetzt).
- **Live (Vercel, Auto-Deploy bei Merge in `main`): https://my-immo-app.vercel.app**
- **Supabase:** Projekt `kozhxrvyilkchjpcuwcm` (eu-central-1). Dateien (Belege/Archiv) liegen als **Base64 in Tabellenspalten** — kein Storage-Bucket. **DB ist mit dem Code synchron** (geprüft, keine Migration offen).
- **Vercel-Env nötig:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (für OCR/KI-Import).
- **Build/Test:** `npm run build` (Platzhalter-Supabase-Env genügen), `npm test` (Vitest). **CI** läuft beides bei jedem PR/Push auf `main` (`.github/workflows/ci.yml`).

## Funktionsumfang (vorhanden)
Objekte, Mieter, Einnahmen/Kosten/Kredite/Verbrauch, Termine/Fristen + Refinanzierung, **Umlage-Assistent (NK-Verteilung)**, Dokument-Generator (Briefe + A4-PDF), Übergabeprotokoll, **NK-OCR**, IBAN-Verwaltung, **Steuer/Anlage V** (Export), **Archiv**, Kalkulatoren (Roter Faden, Cockpit, Bankgespräch).

## Zuletzt erledigt (alles live, PRs #2/#3/#4 gemerged)
1. **Umlage:** zeitanteilig nach belegten Monaten, 5 Default-Positionen, Drag&Drop (Maus+Finger), NK-Upload→Positionen per OCR.
2. **Adressblock** in Briefen/NK-PDF: PLZ+Ort in eigener Zeile (`lib/format.ts → adressZeilen`).
3. **UX-Overhaul:** mobile Drawer-Navigation, responsive Breakpoints, Toast-System (`components/Toast.tsx` + `FlashToast.tsx`), Ladeskelette (`components/Skeleton.tsx` + `loading.tsx`), Pending-States (`components/SubmitButton.tsx`), Inline-Lösch-Bestätigung (`DeleteButton.tsx`), lange Listen „erste 25 + aufklappen" (`components/ExpandableRows.tsx`, in Kosten/Einnahmen/Verbrauch).
4. **Login** neu im Wunsch-Layout (`app/login/page.tsx`) + **Redirect-Bug behoben** (harte Navigation statt `router.push`).
5. **Tests:** Vitest, 18 Tests (`tests/umlage.test.ts`, `tests/anlageV.test.ts`). Dabei echten Bug gefixt: bei Mieterwechsel in derselben Wohnung wurde nur die Hälfte umgelegt (Flächen-Doppelzählung in `lib/umlage.ts`).
6. **CI-Action** eingerichtet.

## Sicherheits-Check (Stand dieser Runde — verifiziert)
- **RLS ist auf allen 13 Tabellen aktiv**, Policy `auth.uid() = user_id` für ALLE Operationen (USING + WITH CHECK, an der DB geprüft). → Die in Reviews oft gemeldeten „IDOR"-Befunde (fehlende `.eq("user_id")`-Filter in Server-Actions/Datei-Routen) sind **kein ausnutzbares Leck**, nur fehlende Defense-in-Depth. Nicht als „kritisch" behandeln.
- **PDF-Umlaute** (ä/ö/ü/ß) werden korrekt gerendert — `sanitize()` ersetzt nur Codepoints > 255. Kein Bug.
- **KI-Routen `/api/import` + `/api/nk-ocr`** sind jetzt auth-geschützt (nur eingeloggte Nutzer), mit Timeout, Upload-Limits (5 MB Bild / 20 MB PDF) und JSON-Validierung.

## Offen / als Option vorgemerkt
- **Pro-Nutzer-Rate-Limit für die KI-Routen** bewusst NICHT gebaut (spart bis Launch die monatliche Gebühr für Redis/Vercel KV). Der Auth-Check deckt anonymen Missbrauch ab; ein eingeloggter Nutzer kann die KI weiterhin in einer Schleife aufrufen. Wenn mehrere Nutzer aufgeschaltet werden: **DB-Zähler** (kostenlos, etwas Code) statt externem Dienst.
- **`fristen.ts`** parst Datumswerte als UTC-Mitternacht — für DE-Zeitzone + UTC-Server (Vercel) konsistent, kein Off-by-one. Erst relevant, falls Client-seitig in einer westlichen Zeitzone gerechnet wird.

## Offene Risiken / unverifiziert (WICHTIG)
- **UI-Flows nie echt durchgeklickt** (Drag&Drop, OCR, Toasts, Login). Browser-Test aus der Sandbox unmöglich (Egress-Proxy blockt headless Chromium — bestätigt). → Nur der Nutzer kann live klicken.
- **NK-/Steuer-Fachlogik** ist technisch durch Tests abgesichert, aber die fachlichen Annahmen (Umlagefähigkeit, Leerstand-Behandlung, AfA-Schätzung) **müssen an einer echten Abrechnung gegengerechnet werden**, bevor das produktiv an Mieter/ans Finanzamt geht.
- **Base64-Dateien in der DB** = wachsende Altlast (DB-Bloat); für später Storage-Bucket erwägen.
- **Test-Account `jxnashap@gmail.de` / `Claude1234`** existiert (bestätigt) — löschen/Passwort ändern.

## Gotchas
- Nach **Squash-Merge** nicht auf demselben Branch weiterarbeiten → Konflikte. Branch nach jedem Merge auf `main` zurücksetzen (`git reset --hard origin/main`) oder neu von `main` abzweigen.
- **SWC** stolpert über `<` in JSX-Kommentaren (`{/* … < … */}`) → vermeiden.

## Nächste sinnvolle Schritte
1. **Mietzahlungs-Tracking + Mahnwesen** (Soll/Ist, offene Posten, automatische Mahnstufen) — größter „Sorglos"-Hebel.
2. **Wartungs-/Prüfkalender** (Rauchmelder, Legionellen, Heizung).
3. Aufklapp-Listen auf weitere Seiten (Termine/Archiv/Objekt-Detail), Breadcrumbs.
4. Live-App durchklicken → fixen, was hakt.
