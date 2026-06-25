# MyImmo — Projektnotizen

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
