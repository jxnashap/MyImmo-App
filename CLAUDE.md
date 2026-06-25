# MyImmo — Projektnotizen

## Arbeitsweise / Feedback-Stil (vom Nutzer gewünscht)
- Sei ein ehrlicher Sparring-Partner — kritisch, finde Schwachstellen und blinde Flecken.
- Nicht einfach zustimmen — erst prüfen, ob es stimmt.
- Die Wahrheit sagen, auch wenn sie unbequem ist; ruhig direkt, ohne Schönfärberei.
- Keine Floskeln („Großartige Frage!", „Du hast absolut recht!").
- Bei jeder Entscheidung des Nutzers zuerst die Risiken nennen, bevor zugestimmt wird.


## Offene Punkte / Merkliste
- **„Sign in with Apple" nachrüsten, sobald die App in den iOS App Store geht.** Apple verlangt
  das, sobald ein anderer Social-Login (Google) angeboten wird. Braucht Apple-Developer-Programm
  (99 $/Jahr), App-ID/Services-ID/Key + Provider-Config in Supabase. Aktuell reine Web-App → noch nicht nötig.
- **AVV-Verträge (Art. 28 DSGVO)** mit Supabase, Vercel, Anthropic, Google abschließen.
- **Impressum/Datenschutz**: Platzhalter in `app/impressum` + `app/datenschutz` mit echten Daten
  (Gewerbeanmeldung) füllen und rechtlich prüfen lassen.
- **Optional (Härtung):** Spalten-Verschlüsselung für IBAN/Bankdaten (pgcrypto/Vault). At-rest-
  Verschlüsselung auf Platten-Ebene ist durch Supabase bereits gegeben — kein Launch-Blocker.

## Deployment
- **Live-URL (Produktion): https://my-immo-app.vercel.app**
- Gehostet auf **Vercel**, verbunden mit dem GitHub-Repo `jxnashap/myimmo-app` (Branch `main`).
- Ein Merge nach `main` löst automatisch einen neuen Vercel-Build/Deploy aus.
- **Wichtig:** Nach jedem Merge eines PR die Live-URL mitschicken/erwähnen, damit der Stand direkt geprüft werden kann.

### Benötigte Environment-Variablen (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` — für OCR / KI-Import (NK-Abrechnung auslesen, Objekt-Import)

## Datenbank
- Supabase-Projekt `kozhxrvyilkchjpcuwcm` (Region eu-central-1).
- Dateien (Belege, Archiv-Dokumente) werden als Base64 in Tabellenspalten gespeichert — **kein Storage-Bucket** nötig.

## Build / Test
- `npm run build` zum Verifizieren (braucht die NEXT_PUBLIC_SUPABASE_*-Variablen, Platzhalter genügen für den Build).
