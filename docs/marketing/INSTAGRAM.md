# Instagram-Aufbau MyImmo

Stand: 29.08.2026 · Status: **Startpaket fertig — Account-Anlage & Posten macht der Betreiber**

> **Ehrliche Einordnung (wichtig):** `docs/MARKETING.md` hat Instagram organisch
> bewusst mit „nein" bewertet (Zielgruppe entscheidet über Google-Suche, hoher
> Pflegeaufwand für einen Ein-Personen-Betrieb). Diese Einschätzung bleibt
> fachlich richtig — der Kanal läuft deshalb als **begrenzter Test mit klaren
> Messkriterien und Abbruchkriterium** (siehe unten), nicht als Dauerverpflichtung.
> Entscheidung des Betreibers vom 29.08.2026.

---

## 1. Positionierung

**Wer:** MyImmo — die aufgeräumte Verwaltungs-App für private Vermieter (1–24 Einheiten).
**Für wen auf Instagram:** die *jüngere* Hälfte der Zielgruppe — Kapitalanleger
30–50, die ihre erste/zweite Wohnung vermieten und aktiv nach Vermieter-Wissen
suchen. (Die 65-jährige ETW-Vermieterin erreichen wir hier nicht — die kommt
über Google/Ratgeber.)
**Ton:** ruhig, kompetent, ohne Hype. Quiet Luxury auch im Feed — Nachtblau,
Gold, Serifen. Kein Meme-Marketing, keine Emojis-Schlachten. Du-Form wie die App.
**Kernversprechen je Post:** Ein konkreter Vermieter-Nutzen pro Post — kein
generisches „Immobilien sind toll".

## 2. Content-Säulen (Verhältnis pro Monat)

| Säule | Anteil | Inhalt | Quelle |
|---|---|---|---|
| **Vermieter-Wissen** | ~50 % | NK-Abrechnung, Anlage V, Fristen, Mieterhöhung § 558, Kaution — als Merk-Karten/Carousels | vorhandene Ratgeber-Artikel (`lib/ratgeber.ts`) zweitverwerten |
| **Produkt** | ~25 % | Ein Feature, ein Screenshot, ein Satz Nutzen | Landing-Screenshots (`public/landing/*.webp`) |
| **Vision/Story** | ~15 % | „Leben, wo du willst" — warum es MyImmo gibt | Vision-Seite, Ostsee-Motive |
| **FAQ/Community** | ~10 % | Häufige Fragen als Karte beantworten | FAQ aus `components/landing/data.tsx` |

**Regel:** Wissens-Posts sind der Köder, Produkt-Posts die Ernte. Nie zwei
Produkt-Posts hintereinander.

## 3. Formate & Rhythmus

- **Rhythmus: 3 Posts/Woche** (Mo/Mi/Fr) — realistisch für Solo, genug für den Algorithmus.
- **Formate:** Feed-Karten 1080×1350 (4:5), Carousels 3–6 Slides für Wissens-Themen,
  Reels erst ab Monat 2 (nur wenn die Karten funktionieren — Reels kosten 5–10× Zeit).
- **Stories:** locker, hinter den Kulissen, Umfragen („Machst du deine NK-Abrechnung selbst?").
- Die Higgsfield-Videos (Fassade, Ostsee) eignen sich als Reel-B-Roll, wenn Reels starten.

## 4. Profil

- **Handle (Priorität):** `@myimmoapp` (= Domain) → `@myimmo.app` → `@myimmo.de`
- **Name:** MyImmo · Vermieter-App (Name ist durchsuchbar — „Vermieter" muss rein)
- **Profilbild:** das App-Icon (`public/myimmo_logo_2048.png`) — Haus gut erkennbar im Kreis
- **Kategorie:** Software · **Konto:** Business-Konto (Insights nötig)
- **Bio** (unter 150 Zeichen):
  ```
  Die aufgeräumte App für private Vermieter 🏠
  NK-Abrechnung · Anlage V · Mieterportal
  Daten in der EU · Early Access kostenlos ↓
  ```
- **Link:** `https://www.myimmoapp.de/?utm_source=instagram&utm_medium=bio`
  (ein Link reicht — kein Linktree, der verwässert nur)
- **Highlights** (nach den ersten Wochen füllen): Funktionen · Ratgeber · Vorlagen · Vision · FAQ

## 5. Redaktionsplan — Wochen 1–4

Die ersten 9 Posts sind als fertige Visuals erstellt: **`docs/marketing/instagram/post-01…09.png`**
(Reihenfolge = geplante Post-Reihenfolge, ergibt zusammen ein stimmiges 9er-Grid).

| # | Woche | Säule | Post | Caption-Kern |
|---|---|---|---|---|
| 01 | 1 Mo | Marke | Intro: „Vermieten ohne Papierkram" | Wer wir sind, für wen, Early Access kostenlos |
| 02 | 1 Mi | Wissen | NK-Abrechnung: Frist 31.12. | 12-Monats-Frist § 556 BGB, danach keine Nachforderung |
| 03 | 1 Fr | Produkt | Dashboard: „Dein Portfolio auf einen Blick" | Wert, Cashflow, Rendite ohne Excel |
| 04 | 2 Mo | Wissen | Mieterhöhung § 558: die 3 Grenzen | Kappungsgrenze, Vergleichsmiete, Sperrfrist |
| 05 | 2 Mi | Vision | „Leben, wo du willst" | Warum es MyImmo gibt — Ostsee-Story |
| 06 | 2 Fr | Wissen | Kaution: 3 Fehler, die Geld kosten | max. 3 Kaltmieten, getrennt anlegen, Abrechnung |
| 07 | 3 Mo | Produkt | Mieterportal: „Schluss mit dem Anrufbeantworter" | Schaden mit Foto → Auftrag → Freigabe |
| 08 | 3 Mi | Wissen | Anlage V ohne Panik | Zeilen sind Buchungen schon zugeordnet |
| 09 | 3 Fr | CTA | „Kostenlos im Early Access" | Kein Abo, keine Kreditkarte, Daten in der EU |
| 10–12 | 4 | Mix | FAQ-Karte + Wissens-Carousel + Produkt | aus Säulen-Pool, je nach Insights der Wochen 1–3 |

**Caption-Formel:** Hook (1 Zeile) → 3–5 kurze Absätze Wert → 1 Frage an die
Leser → CTA („Link in der Bio") → 5–8 Hashtags. Rechtliches immer mit
„Anhaltspunkte ohne Gewähr, keine Rechts-/Steuerberatung" abbinden.

**Hashtag-Set (mischen, 5–8 pro Post):**
`#vermieter #privatvermieter #immobilien #kapitalanlage #eigentumswohnung
#nebenkostenabrechnung #anlagev #mietrecht #vermietung #immobilienverwaltung`

## 6. Messkriterien (Test-Charakter!)

Nach **8 Wochen** (24 Posts) auswerten:
- Reichweite/Post, Follower, Saves (Saves = wichtigster Indikator für Wissens-Content)
- **Klicks auf den Bio-Link** (UTM in Vercel Analytics) und daraus **Registrierungen**
- **Weiter machen, wenn:** ≥ 5 Registrierungen über UTM *oder* klar wachsende Saves/Reichweite.
- **Einstellen/pausieren, wenn nicht** — dann gilt wieder die MARKETING.md-Einschätzung,
  und die Energie geht in SEO/Ratgeber (dort ist die Kaufabsicht).

## 7. Was der Betreiber tun muss (kann nicht automatisiert werden)

1. Account als **Business-Konto** anlegen (Handle-Priorität oben), Profilbild + Bio einsetzen.
2. Die 9 Visuals aus `docs/marketing/instagram/` in der Reihenfolge posten (Plan oben).
3. Impressum-Pflicht: Im Profil auf `myimmoapp.de/impressum` verweisen (Bio-Link deckt das ab,
   zusätzlich in der Konto-Info „Impressum" eintragen — Abmahn-Klassiker).
4. Kommentare/DMs beantworten (15 Min/Tag reichen am Anfang).
