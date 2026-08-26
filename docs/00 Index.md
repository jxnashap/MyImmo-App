# 🏠 MyImmo — Wissensbasis (Obsidian-Vault)

> **So nutzt du diesen Ordner als Obsidian-Vault:**
> 1. Repo einmal klonen: `git clone https://github.com/jxnashap/myimmo-app.git`
> 2. In Obsidian: **„Ordner als Vault öffnen"** → den Unterordner **`docs/`** wählen.
> 3. Aktuell halten: im Repo-Ordner `git pull` (oder GitHub-Desktop „Pull"). Damit ist der
>    Vault immer auf dem neuesten Stand — er *ist* die Projekt-Doku, kein Duplikat.

## 📌 Zuerst lesen
- [[BRIEFING]] — Onboarding in 5 Minuten (Stack, Konventionen, aktueller Stand, offene Punkte)

## 📚 Kern-Doku
- [[PROJEKT-STATUS]] — Feature-Inventar
- [[MASTERPLAN]] — Markt / Compliance / Steuer-Roadmap
- [[FINANZKONZEPT]] — Geschäftsmodell **und** Finanzierungs-Assistent (Kosten, Preise, Recht)

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

## ⚖️ Compliance
- [[AVV-STATUS]] — DSGVO / AVV je Anbieter
- [[anthropic-dpa-archiv]] — archiviertes Anthropic-DPA

## 🛠️ Technik
- [[README]] (in `supabase/migrations/`) — Migrations-Regeln + Historie
- `CLAUDE.md` (Repo-Wurzel) — verbindliche Projekt-Regeln + Merkliste

## 🗺️ Schnell-Orientierung
- **Live:** https://www.myimmoapp.de
- **Repo:** `jxnashap/myimmo-app` · **Branch:** `claude/magical-feynman-l8w9s5`
- **Stack:** Next.js 14 (App Router) · Supabase (RLS) · Vercel · TypeScript · vitest
- **Arbeitsweise:** ehrlicher Sparringspartner, Risiken zuerst, Deutsch.

---
*Diese Startseite ist eine „Map of Content". Die `[[Verlinkungen]]` funktionieren in Obsidian
per Dateiname — Klick öffnet die jeweilige Notiz.*
