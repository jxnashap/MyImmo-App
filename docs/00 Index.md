# 🏠 MyImmo — Wissensbasis (Obsidian-Vault)

> **So nutzt du diesen Ordner als Obsidian-Vault:**
> 1. Repo einmal klonen: `git clone https://github.com/jxnashap/myimmo-app.git`
> 2. In Obsidian: **„Ordner als Vault öffnen"** → den Unterordner **`docs/`** wählen.
> 3. Aktuell halten: im Repo-Ordner `git pull` (oder GitHub-Desktop „Pull"). Damit ist der
>    Vault immer auf dem neuesten Stand — er *ist* die Projekt-Doku, kein Duplikat.

## 📌 Zuerst lesen
- [[VAULT-REGELN]] — **was in diese Vault gehört und was nicht. Verbindlich für jeden Chat.**
- [[BRIEFING]] — Onboarding in 5 Minuten (Stack, Konventionen, aktueller Stand, offene Punkte)

## 🏗️ App-Entwicklung (wiederverwendbares Bau-Wissen)
- [[00 App-Entwicklung Index]] — Einstieg in den Wissensspeicher
- [[09 Neue App bauen]] — Ablauf, wenn aus einer Idee eine App werden soll
- [[07 Volatile Kennzahlen und Pruefzyklus]] — **bei Sessionstart auf fällige Prüfungen sehen**
- [[08 Fehlerkatalog]] — echte Fehler mit Ursache und Gegenprüfung

## 📚 Kern-Doku
- [[PROJEKT-STATUS]] — Feature-Inventar
- [[MASTERPLAN]] — Markt / Compliance / Steuer-Roadmap
- [[FINANZKONZEPT]] — Geschäftsmodell **und** Finanzierungs-Assistent (Kosten, Preise, Recht)

## 💼 Beteiligung & Investorengespräch (30.09.2026)
- [[INVESTOR-GESPRAECH]] — **Gesprächsvorbereitung**: die Zahlen auswendig, die fünf
  kritischen Fragen mit ehrlichen Antworten, was du IHN fragen musst
- [[KOSTENMODELL]] — was der Betrieb bei 100 / 1.000 / 10.000 Nutzern kostet
  (erzeugt aus `scripts/gen-kostenmodell.mjs`, Anbieterpreise nachgelesen)
- [[BETEILIGUNG]] — Rechtsform, Anteile, Vesting, Wandeldarlehen, Trennungsfall
- `business/MyImmo-Businessplan-2026-09.pdf` — **aktuelle Fassung.** Die Juli-Fassung
  daneben ist überholt (beschreibt ein entferntes Feature als gebaut) — nicht mehr herausgeben.

## 🏦 Kauf-Tool (Kauf- & Finanzierungs-Assistent)
- [[00 Kauf-Tool Übersicht]] — Fahrplan, Roadmap, Risiken
- [[Kunden-Guide]] · [[Makler-Ordner]] · [[Bank-Ordner]] · [[KfW-Foerderung-2026]]

## 🎓 Unterricht / Workshop
- **Online-Fassung für die Klasse:** https://claude.ai/code/artifact/70a9c592-9fde-4132-ae06-c0e6cfef587f
  (erst privat — vor dem Unterricht einmal über das Teilen-Menü freigeben)
- `workshop/immobilien-workshop-online.html` — Quelle der Online-Fassung (interaktiv, mit Prüfung)
- `workshop/immobilien-workshop.html` — Aufgabenblatt für die Klasse (drei Objekte, zwei Entscheidungen)
- [[MENTIMETER]] — acht Fragen zum Abtippen in Mentimeter (Fragetyp, Optionen, Lösung)
- `workshop/immobilien-workshop-loesung.html` — Musterlösung, Rechenweg, Bewertungsraster (**nur Lehrkraft**)
- [[README]] in `docs/workshop/` — Rechengrundlage, Herkunft der Zahlen, Anpassen

## 📣 Marketing & Sichtbarkeit
- [[SEO]] — Stand der Technik 2026 **+ Prüfung von MyImmo** (live gemessen)
- [[MARKETING]] — Kanäle, Prioritäten, was sich lohnt
- [[INSTAGRAM]] — Strategie, Profil, erste Post-Visuals (Test, zurückgestellt)

## 🚀 Vor dem Start
- [[START-CHECKLISTE]] — was vor dem Start ansteht, nach Dringlichkeit sortiert (04.09.2026)
- [[AUDIT-2026-10-01]] — **Gesamt-Audit 01.10.2026**: Links, UX, Browser, Zahlen, Sicherheit — 12 A · 36 B · 40 C, mit PR-Paketen
- [[FEEDBACK-BEWERTUNG-2026-09]] — externes Feedback vom 08.09.2026, geprüft, mit Plan
- [[FEEDBACK-BEWERTUNG-2026-10]] — externes Feedback vom 01.10.2026 (Vision „Betriebssystem für Vermieter“), gegen Nutzungszahlen geprüft, mit Plan

## ⚖️ Compliance
- [[SICHERHEIT-ABHAENGIGKEITEN]] — OSV-Scanner-Befund, Bewertung, Next.js-14-Ende
- [[NEXTJS-15-MIGRATION]] — Umstieg auf Next.js 15.5 ✅ umgesetzt 01.09.2026 (Plan + Bericht)
- [[AVV-STATUS]] — DSGVO / AVV je Anbieter
- [[APP-STORE-RECHT]] — App/Play Store: Gesetze, Store-Regeln, Gebühren **+ Prüfung von MyImmo**
- [[anthropic-dpa-archiv]] — archiviertes Anthropic-DPA

## 🔮 Zukunftsprojekte (notiert, nicht gebaut)
- [[MIETERPORTAL-AUSBAU]] — Bestandsaufnahme, acht Wege zur Fehlzustellung, sicherer Zustellweg + Ausbau (02.10.2026)
- [[HANDWERKER-ANFRAGEN]] — Angebote einholen, später Handwerkerportal; Entscheidungen + Risiken (02.10.2026)
- [[VERTRETER-ZUGANG]] — Bevollmächtigter mit eigener Anmeldung, Rechten und Protokoll (Plan 02.10.2026)
- [[AI-AGENCY-OS]] — Firmen-Verfassung bewertet (29 → 6 Rollen), n8n-Umsetzung + Betreiber-Cockpit `/cockpit` (03.10.2026)
  · Einrichtung: `agency/README.md` im Repo-Wurzelverzeichnis
- [[STRATEGIE-REITER]] — Ankaufsstrategie: wann ist das nächste Objekt finanzierbar? (Idee 30.08.2026)
- [[OPEN-BANKING]] — Konto-Anbindung, zurückgestellt 29.08.2026 (Code in der Git-Historie)

## 🛠️ Technik
- [[README]] (in `supabase/migrations/`) — Migrations-Regeln + Historie
- `CLAUDE.md` (Repo-Wurzel) — verbindliche Projekt-Regeln + Merkliste

## 🗺️ Schnell-Orientierung
- **Live:** https://www.myimmoapp.de
- **Repo:** `jxnashap/myimmo-app` · **Branch:** `claude/magical-feynman-l8w9s5`
- **Stack:** Next.js 15 (App Router) · Supabase (RLS) · Vercel · TypeScript · vitest
- **Arbeitsweise:** ehrlicher Sparringspartner, Risiken zuerst, Deutsch.

---
*Diese Startseite ist eine „Map of Content". Die `[[Verlinkungen]]` funktionieren in Obsidian
per Dateiname — Klick öffnet die jeweilige Notiz.*
