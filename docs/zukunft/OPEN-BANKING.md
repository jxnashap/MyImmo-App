---
title: Open Banking (Konto-Anbindung) — zurückgestellt
status: eingemottet
---

# Open Banking / Konto-Anbindung — ZURÜCKGESTELLT (29.08.2026)

> **Warum hier:** Das Feature war fertig gebaut, aber nie live (nie end-to-end gegen
> die echte API gelaufen). Es kostet im echten Betrieb laufend Geld je Konto/Monat und
> braucht Anbietervertrag + AVV. Entscheidung: **komplett aus der App entfernen und
> zurückstellen**, bis das Produkt Geld verdient — dann als bezahltes Add-on wieder
> aufbauen. Diese Datei sichert Konzept, Entscheidungen und den Wiederherstellungsweg.

## Was es war
Automatischer Abgleich von **Kontoumsätzen** mit den erwarteten Mieten und den
Ausgaben — Prinzip **„vorschlagen + per Klick bestätigen"**, keine stille Automatik.
**Nur Lesezugriff** (Kontoinformationsdienst / AISP), kein Zahlungsverkehr.

## Getroffene Entscheidungen (aus der Planung 12.07.2026, weiterhin gültig)
- **Nur Lesezugriff (AISP)** über einen **lizenzierten Anbieter** → keine eigene
  BaFin-Lizenz nötig.
- **Anbieter: Enable Banking** (EU-weit, kostenlose Self-Service-Sandbox + „Restricted
  Production" für die EIGENEN Konten des Inhabers). GoCardless/Nordigen fällt weg
  (Neuanmeldungen abgewickelt). Deutsche Alternative: **finAPI** (Zugang verkaufsgebunden).
  **Nicht** das GoCardless-„Payments"-Produkt (Lastschrift) — falsches Produkt.
- **Mehrere Bankverbindungen je Nutzer** (Sparkasse/Groß-/Direktbank via PSD2/XS2A).
- **Datenschutz:** Umsätze App-Layer-verschlüsselt (wie IBANs) + RLS. PSD2 = alle
  90 Tage Reauth (App erinnerte über eine Frist). Bei gemischt privat/geschäftlichem
  Konto separates Mietkonto empfehlen.

## Zwei Aktivierungswege (für den späteren Wiederaufbau)
1. **Nur eigenes Konto (dein Portfolio):** Enable Banking „Restricted Production",
   **kostenlos**. Nur Application registrieren + eigene Konten freischalten + Env setzen.
   Kein Nutzer-AVV nötig (du bist selbst Kontoinhaber).
2. **Für alle Nutzer (SaaS-Feature):** Full Production → **Anbietervertrag +
   laufende Kosten je Konto/Monat + AVV** (MyImmo wird Auftragsverarbeiter der
   Bankdaten der Nutzer). Monetarisierung als **bezahltes Add-on** (war im Tarifmodell
   als `banking_addon` vorgesehen).

## Technik (wie es gebaut war)
- **Auth:** selbst signierter JWT (RS256) mit dem privaten Schlüssel der registrierten
  Enable-Banking-Application, Header `kid` = Application ID. Base-URL
  `https://api.enablebanking.com`.
- **Benötigte Env (Vercel):** `ENABLE_BANKING_APP_ID` + `ENABLE_BANKING_PRIVATE_KEY`
  (privaten Schlüssel wie `DATA_ENCRYPTION_KEY` behandeln — nie ins Repo/Logs).
- **Redirect-URL** bei der App-Registrierung: `https://www.myimmoapp.de/api/banking/callback`.
- **Flow:** Bankenliste (`/aspsps?country=DE`) → Autorisierung starten → Callback tauscht
  Code gegen Session → Kontodetails + Transaktionen abrufen → Abgleich-Engine.

## Was fehlte (bevor es live gehen konnte)
- Anbietervertrag + AVV mit Enable Banking (+ Eintrag in `docs/compliance/AVV-STATUS.md`).
- Ein echter Sandbox-Durchlauf (nie passiert).
- Tests für den API-Client (`lib/banking/enableBanking.ts` hatte keine; die
  Abgleich-Engine hatte welche).

## Wiederherstellung
Der **vollständige Code liegt in der Git-Historie bis Commit `85feb98`** (der Commit
direkt vor der Entfernung). Zum Zurückholen:

```
# Dateien aus dem letzten Stand vor der Entfernung zurückholen:
git checkout 85feb98 -- lib/banking app/banking app/api/banking lib/actions/banking.ts \
  components/BankKonten.tsx components/BankUmsaetze.tsx components/BankVerbinden.tsx \
  tests/abgleich.test.ts
```

Die **DB-Tabellen** (`bankverbindungen`, `bank_umsaetze`, `bank_auth_anfragen`) wurden
per Migration gedroppt; ihre CREATE-Statements liegen in den ursprünglichen
Migrationsdateien unter `supabase/migrations/` (bis Commit `85feb98`). Ebenso die Spalte
`abos.banking_addon` und das Tarif-Feature `"banking"` in `lib/plan.ts`.

## Dateien, die es umfasste (Stand Entfernung)
- `lib/banking/enableBanking.ts` (API-Client), `lib/banking/abgleich.ts` (Abgleich-Engine)
- `lib/actions/banking.ts` (Server-Actions), `app/banking/page.tsx`,
  `app/api/banking/callback/route.ts`
- `components/BankKonten.tsx`, `components/BankUmsaetze.tsx`, `components/BankVerbinden.tsx`
- `tests/abgleich.test.ts`
- `bankingFristen()` in `lib/fristen.ts` (90-Tage-Reauth)
- Verzweigungen in Dashboard, Termine, Command-Palette, Einstellungen, Daten-Export,
  Navigation; Datenschutz-Ziffer „Konto-Anbindung"; Landing/Funktionen-Erwähnungen
  („bald").
