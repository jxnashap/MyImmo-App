# Marketingplan Oktober 2026 – Juni 2027

**Stand 03.10.2026.** Dies ist der **ausführbare Plan**: wer was wann tut, mit wie viel Zeit
und Geld, und woran gemessen wird.

| Wofür | Wo es steht |
|---|---|
| Warum diese Positionierung und welche Kampagnen | `[[MARKETING]]` (Juli 2026, gilt weiter) |
| Was vor dem Start erledigt sein muss | `[[LAUNCH-FUNDAMENT]]` |
| Handwerk je Kanal (Formate, Benchmarks, Quellen) | Memory `02 - MyImmo/01 - Marketing/` (Notizen 01–09) |
| Instagram-Startpaket | `docs/marketing/INSTAGRAM.md` |

Die Zahlen hier sind **Ziele, keine Prognosen**. Es gibt noch keinen einzigen echten Nutzer,
an dem sich eine Prognose festmachen ließe.

---

## 0. Die Risiken zuerst

1. **Zeit ist der Engpass, nicht Geld oder Wissen.**
   - Der Plan rechnet mit **5 Stunden pro Woche** von Jonas, neben der Ausbildung.
   - Alles darüber hinaus produziert Claude: Texte, Bilder, Mails und Seiten.
   - Jonas bleibt nur, was eine Person tun muss: posten, antworten, Gespräche führen.
   - Ein Plan für 15 Stunden pro Woche würde nach drei Wochen sterben. Der Juli-Plan hatte keine Stundenangabe und ist genau so gestorben.
2. **Wir werben für etwas, das man noch nicht nutzen kann.** Bis zum Gratis-Start (S1) ist das einzige
   Ziel jeder Maßnahme ein Eintrag in der Warteliste. Die ist ohne Brevo ausgeblendet. **Vor Brevo ist
   Marketing verschenkte Reichweite.**
3. **Die Instagram-Messung kann so nicht funktionieren.**
   - `INSTAGRAM.md` misst „Klicks auf den Bio-Link (UTM in Vercel Analytics)“ und daraus „Registrierungen“.
   - Vercel Analytics gibt es nicht (Datenschutz Ziffer 2), und die Registrierung ist geschlossen.
   - **Ersatz:** Der Bio-Link führt auf `/?quelle=instagram`, die Warteliste speichert die Herkunft (Baustein F1 in `[[LAUNCH-FUNDAMENT]]`).
   - Bis das gebaut ist, misst der Test nur Saves und Reichweite in der Instagram-Statistik.
4. **Konflikt mit dem Arbeitgeber.**
   - Eine Bankausbildung und ein eigenes Gewerbe, das Vermieter anspricht, berühren die Nebentätigkeitsklausel und gegebenenfalls Kundenschutzregeln. Die Kunden der Bank sind genau die Zielgruppe.
   - **Vor jeder Ansprache im beruflichen Umfeld:** die Nebentätigkeit schriftlich genehmigen lassen (falls nicht schon geschehen).
   - **Nie** Daten oder Kontakte aus der Bank nutzen.
   - Das ist kein Marketing-Detail. Ein Verstoß kostet den Ausbildungsplatz.
5. **Zwei Zielgruppen, die verschieden erreichbar sind.**
   - Die Werbung zielte bisher auf den Durchschnittsvermieter: **58 Jahre**, 58 % mit genau einer Wohnung (IW-Vermieterreport 2026).
   - **Software kaufen eher Vermieter mit mehreren Einheiten**, und die jüngeren davon sind online erreichbar: Kapitalanleger-Gemeinschaft, YouTube, Instagram.
   - Dieser Plan setzt deshalb **zum Start auf Segment A** (unten) und auf Segment B über die Suche. Ob das stimmt, zeigt erst die Herkunftsmessung. Bis dahin ist es eine **Hypothese**.

---

## 1. Zielgruppen und Botschaft

| | **A · Anleger mit Bestand** | **B · Kleinvermieter** | **C · Erben** (Nische) |
|---|---|---|---|
| Wer | 30–55, 2–10 Einheiten, baut auf | 55+, 1–3 Einheiten, oft Altbestand | plötzlich Vermieter, ohne Vorwissen |
| Schmerz | Überblick, Steuer, Kredite, Zeit | Nebenkostenabrechnung, Fristen, Fehlerangst | „Was muss ich jetzt tun?“ |
| Wo erreichbar | Instagram, YouTube, Anleger-Gemeinschaften (immocation), LinkedIn | Google, Haus & Grund, Lokalzeitung, Bekannte | Google („Wohnung geerbt vermieten“) |
| Kampagne (`[[MARKETING]]` §4) | K2 Steuer, K4 Wechsel | K1 Nebenkosten | K3 Geerbt |
| Kernsatz | „Alle Objekte, Kredite und Anlage V an einem Ort, auch von unterwegs.“ | „Die Nebenkostenabrechnung in einem Abend statt einem Wochenende.“ | „Die ersten Schritte als Vermieter, ohne etwas zu vergessen.“ |

**Überall gleich:** Hero „Deine Immobilien. Ein System. Von überall.“ und die belegten
Vertrauenssätze („Datenbank in Frankfurt“, Bankdaten verschlüsselt, Export, Löschen).

**Nie:**
- „KI-gestützt“, „All-in-One“, „100 % EU“ (§ 5 UWG, siehe `CLAUDE.md`);
- erfundene Kundenstimmen;
- „Steuerberatung“ oder „wir empfehlen“ (StBerG, § 34i).

**Zeitangaben wie „in einem Abend“ erst verwenden, wenn ein echter Nutzer es so erlebt hat.**
Bis dahin gilt: „ohne Excel, mit Vorlage und Prüfung“.

---

## 2. Kanäle: Entscheidung, Aufwand, Abbruchregel

| Kanal | Segment | Rolle | Jonas/Woche | Claude liefert | Weiter, wenn … | Sonst |
|---|---|---|---|---|---|---|
| **Suche (Ratgeber, Rechner, Vorlagen)** | B, C, A | Fundament, wirkt verzögert | 0 h | 2 Artikel bzw. Aktualisierungen pro Monat, saisonal | Klicks in der Search Console wachsen von Quartal zu Quartal | — (immer) |
| **E-Mail (Warteliste, später Nutzer)** | alle | eigene Reichweite | 0,5 h (freigeben) | Mails, Abläufe | Öffnungsrate ≥ 30 % | Betreff/Takt ändern |
| **Foren und Gruppen** (vermieter-forum, Facebook-Gruppen, immocation-Gemeinschaft) | A, B | Vertrauen, erste Nutzer | **1,5 h** (3 × 30 min) | Antwortbausteine zu häufigen Fragen | ≥ 5 Wartelisten-Einträge pro Monat mit Herkunft „forum“ | auf 1 × pro Woche senken |
| **LinkedIn** (Gründer-Profil, nicht Firmenseite) | A, Partner | Gründergeschichte, Beirat-Netz, Steuerberater | **1 h** | 2 Posts pro Woche als Entwurf | Gespräche mit Partnern entstehen | 1 Post pro Woche |
| **Instagram** (Test seit 29.08.) | A | Wissenskarten | **1 h** | 3 Bilder + Texte pro Woche | Saves steigen und ≥ 5 Wartelisten-Einträge mit `quelle=instagram` nach 8 Wochen | **einstellen**, Zeit an die Foren |
| **Persönliches Netz + Beirat** | A, B | die ersten 20 Nutzer | **1 h** | Einladungstext, Gesprächsleitfaden | 20 Nutzer in Welle 1 | — |
| **Vergleichsportale** | B, A | Listung ab dem Start | einmalig 1 h | Profiltexte (fertig) | — | — |
| **Lokalpresse / Haus & Grund** | B | Anlass-Geschichte | nach Anlass | Pressetext, Vortragsfolien | 1 Bericht oder 1 Vortrag | — |
| YouTube | A, B | **nicht als Wochenformat** | — | ab Phase C: 3 Bildschirmvideos ohne Gesicht als Test | Aufrufe aus der Suche | nicht fortsetzen |
| Google Ads | B | erst Phase D | — | Anzeigen, Landingpages | Kosten je aktiviertem Konto < 80 € | stoppen |
| TikTok, Product Hunt, BetaList | — | **nein** (Gründe: `[[LAUNCH-FUNDAMENT]]` §8) | — | — | — | — |

**Summe Jonas: ≈ 5 h pro Woche.** Wird es mehr, fällt zuerst Instagram weg, dann LinkedIn,
**nie** die Foren und das persönliche Netz: Dort entstehen die ersten Nutzer.

**Zum YouTube-Widerspruch** (`[[LAUNCH-FUNDAMENT]]` §9): Der Vorschlag ist der Mittelweg in der
Tabelle, also kein Wochenformat, aber ein Test mit Bildschirmvideos, die ohne Kamera auskommen.
**Entscheidet Jonas.**

---

## 3. Der Beirat als Türöffner

Der Freund bringt Kontakte mit, kein Marketingbudget. Kontakte wirken dort, wo eine Empfehlung mehr zählt
als Reichweite. Konkret anfragen, mit **einer** Bitte je Person:

| Kontaktart | Bitte | Was Claude vorbereitet |
|---|---|---|
| Vermieter im Umfeld (5–10) | in Welle 1 mitmachen, 20 min Gespräch nach 2 Wochen | Einladungstext, Gesprächsleitfaden (Anhang B) |
| Steuerberater, Hausverwaltungen | „Darf ich Ihnen das zeigen? Passt das für Ihre Mandanten mit 1–5 Wohnungen?“ | 1-seitige Vorstellung als PDF im Dokument-Stil |
| Haus & Grund, Vereinsvorstand | Vortrag „Nebenkostenabrechnung ohne Fehler“, ohne Verkauf | Folien, Handout |
| Presse/Medien | Kontakt zu Lokal- oder Fachredaktion | Pressetext (Anhang D) |

**Risiko:** Empfehlungen aus dem Freundeskreis bringen höfliche Nutzer, nicht ehrliche. Die
Gesprächsfrage ist deshalb nicht „Wie gefällt es dir?“, sondern „Was hast du **nicht** gemacht
und warum?“

---

## 4. Ablauf in vier Phasen

### Phase A: Warteliste und Saison (KW 41–46, bis Mitte November)

Voraussetzung: Brevo (`[[LAUNCH-FUNDAMENT]]` §6, Punkt 1).

| KW | Jonas | Claude |
|---|---|---|
| 41 | Brevo eintragen · Social-Media-Namen sichern · Nebentätigkeit klären | Herkunftsmessung (F1), Wartelisten-Mail und Bestätigungstext prüfen |
| 42 | Instagram: Stand prüfen, Bio-Link mit `?quelle=instagram` · erste Forenantworten | Ratgeber „Nebenkostenabrechnung 2025: Frist 31.12.2026, was jetzt zu tun ist“ + Checkliste als Vorlage gegen E-Mail |
| 43 | LinkedIn: Gründerpost 1 (warum MyImmo, Anhang C) · Beirat: Liste mit 10 Namen | Rechner oder Prüfliste „Ist meine Abrechnung fristgerecht?“ (öffentlich, ohne Anmeldung) |
| 44 | Instagram-Auswertung nach 8 Wochen (24.10.) → weiter oder einstellen | Instagram-Karussells aus den zwei Saisoninhalten |
| 45–46 | Welle-1-Gespräche vereinbaren | Willkommens-Mails (F2), Startmail (Anhang A) |

**Ziel bis Ende der Phase:** **100 Wartelisten-Einträge**, davon 30 mit Herkunft außer „direkt“.
Gelingen 30, ist das kein Scheitern, sondern ein Messwert. Er sagt, dass Reichweite der
Engpass ist, nicht das Produkt.

### Phase B: Gratis-Start in Wellen (ab Freigabe B1, Ziel Mitte November bis Dezember)

| Welle | Wer | Wie | Ziel |
|---|---|---|---|
| 1 | Persönliches Netz + Beirat (10–20) | persönliche Mail mit Zugangscode, **Gespräch nach 14 Tagen** | 10 aktivierte Konten, 10 Gespräche |
| 2 | Warteliste | Startmail (Anhang A), Code in der Mail | 30 % der Liste registriert |
| 3 | offen | `REGISTRIERUNG_OFFEN = true`, Vergleichsportale einreichen, LinkedIn-Startpost | — |

**Gleichzeitig:**
- Die Monatsmail an alle Nutzer im Dezember: „Deine Abrechnung 2025: noch X Tage“.
- Lokalpresse: Gründer aus Bad Schwartau, Anlass ist die Frist (Anhang D).

**Ziel:** 50 registrierte Konten, Aktivierung ≥ 30 % (Objekt + Mieter + Buchung binnen 7 Tagen).

### Phase C: Steuer-Saison und Belege (Januar bis März 2027)

- **Kampagne K2:** Anlage V für 2026 (Abgabe ohne Berater bis 31.07.2027). Ratgeber aktualisieren und die Steuerseite in den Mails zeigen.
- **Belege sammeln:** Wer in Phase B eine Abrechnung fertig hat, wird um ein Zitat mit schriftlicher Einwilligung gebeten. Erst danach kommen Stimmen auf die Website.
- **Fernablese-Ratgeber entschärfen** (Termin 01.01.2027 in `CLAUDE.md`).
- YouTube-Test (3 Videos), falls Jonas zustimmt.
- **Auswertung Ende März** nach Herkunft: Welcher Kanal brachte **aktivierte** Konten? Die Zeitanteile für Phase D werden danach neu verteilt.

### Phase D: Bezahlstart und Verstärker (April bis Juni 2027, nur ab den Schwellen)

**Schwellen, alle drei nötig:**
- 5–10 Konten sind 4 Wochen nach der Anmeldung noch aktiv;
- A1–A4 sind erledigt;
- mindestens ein Kanal bringt nachweislich aktivierte Konten.

**Dann:**
- **Bezahlstart (S2):** Bestandsnutzer vorher informieren (A8).
- **Google Ads:** Test mit 300 €/Monat auf Suchbegriffe kurz vor der Kaufentscheidung, Negativliste ab Tag 1 (Memory `06 - Paid Ads`).
- **Empfehlungsprogramm:** 1 Monat gratis für beide, ausgelöst nach der ersten fertigen Abrechnung.
- **Partner:** Steuerberater oder Hausverwaltung mit Empfehlungsrabatt.
- **Stores (S3):** frühestens jetzt.

---

## 5. Budget

| Posten | Phase A–C | Phase D |
|---|---|---|
| Brevo | 0 € (300 Mails/Tag frei) | ~10–20 €/Monat |
| Planungswerkzeug Social Media (z. B. Metricool) | 0 € (Gratisstufe) | 0–18 €/Monat |
| Druck (Handout für Vortrag) | ~30 € einmalig | — |
| Google Ads | 0 € | 300 €/Monat als Test, Abbruch nach 6 Wochen ohne aktivierte Konten |
| Vergleichsportale | 0 € (Basiseintrag) | bezahlte Platzierung erst bei Bedarf |
| **Summe** | **≈ 0–30 €** | **≈ 320–340 €/Monat** |

Die Infrastruktur steht in `docs/business/KOSTENMODELL.md`, hier nur Marketing.

---

## 6. Messung, ohne Analyse-Werkzeug

Ein Messwert gilt erst, wenn er aus einer dieser Quellen kommt:

| Kennzahl | Quelle | Wann |
|---|---|---|
| Wartelisten-Einträge nach Herkunft | `newsletter_anmeldungen.quelle` + Herkunftsmarke (F1) | wöchentlich |
| Registrierungen nach Welle und Herkunft | Datenbank (F1) | wöchentlich |
| **Aktivierung** (Objekt + Mieter + Buchung ≤ 7 Tage) | Datenbank (F1) | wöchentlich |
| Aktiv nach 4 Wochen | Datenbank (F1) | monatlich |
| Suchklicks, Positionen | Google Search Console | monatlich |
| Öffnungen und Klicks der Mails | Brevo | je Versand |
| Saves und Reichweite | Instagram-Statistik | wöchentlich |

**Freitags 15 Minuten:** Zahlen ansehen und eine Sache für die nächste Woche ändern. Das ersetzt
jede Marketing-Software.

---

## Anhang: Textvorlagen

Alle Texte mit „du“, wie die App. Platzhalter in eckigen Klammern. **Keine Zahl, die nicht
belegt ist.**

### A · Startmail an die Warteliste

> **Betreff:** MyImmo ist offen, dein Zugang
>
> Hallo,
>
> du hast dich eingetragen, um beim Start von MyImmo Bescheid zu bekommen. Es ist so weit.
>
> Mit diesem Code kannst du dich registrieren: **[CODE]**, unter www.myimmoapp.de/login.
> MyImmo ist in der Startphase kostenlos.
>
> Wenn du nur eine Sache ausprobierst: Lege ein Objekt und einen Mieter an. Danach zeigt dir das
> Dashboard, was als Nächstes ansteht, auch die Frist für die Nebenkostenabrechnung 2025
> (31.12.2026).
>
> Antworte einfach auf diese Mail, wenn etwas hakt. Hier liest ein Mensch, ich.
>
> [Name], MyImmo

### B · Gesprächsleitfaden Welle 1 (20 Minuten, nach 14 Tagen)

1. Was hast du angelegt, und was **nicht**? Warum nicht?
2. An welcher Stelle hast du aufgehört oder gezögert?
3. Was hast du vorher benutzt (Excel, Papier, andere App)? Was fehlt dir gegenüber vorher?
4. Wofür würdest du die App nächsten Monat wieder öffnen?
5. Wie enttäuscht wärst du, wenn es MyImmo nicht mehr gäbe: sehr, etwas, gar nicht?

Notieren, nicht verteidigen. Ergebnisse gehören als Zahlen in die Freitagsrunde, nicht in die Vault.

### C · LinkedIn, Gründerpost 1 (Entwurf)

> Ich verwalte [Zahl] Wohnungen und habe dafür keine Software gefunden, der ich meine Daten und
> meine Anlage V anvertrauen wollte. Also habe ich eine gebaut.
>
> MyImmo ist für private Vermieter mit einer bis 24 Einheiten: Mieten, Nebenkosten, Anlage V,
> Kredite und das Mieterportal an einem Ort. Die Datenbank steht in Frankfurt, Bankdaten sind
> zusätzlich verschlüsselt.
>
> Ab [Monat] öffnen wir in Wellen. Wer früh dabei sein will: Link im ersten Kommentar.

*Vor dem Posten: Die Zahl muss stimmen. Steht da keine, den ersten Satz umschreiben. Link in den
Kommentar, nicht in den Post.*

### D · Pressetext für die Lokalzeitung (Anschreiben, 4 Sätze)

> Guten Tag [Name], bis zum 31.12. müssen private Vermieter die Nebenkostenabrechnung für 2025
> zustellen. Sonst verfallen Nachforderungen (§ 556 Abs. 3 BGB). Ich bin [Alter], komme aus Bad
> Schwartau und habe dafür eine kostenlose App gebaut, die gerade startet. Gern erzähle ich, welche
> Fehler in Abrechnungen am häufigsten vorkommen und wie man sie vermeidet. Ein Gespräch dauert
> 15 Minuten; Bilder und Zugang zur Demo schicke ich mit.

### E · Forenantwort (Grundmuster)

1. Die Frage vollständig beantworten, mit Paragraf, ohne Link.
2. Nur wenn es die Antwort ist: „Ich habe mir dafür ein Werkzeug gebaut, [Link]. Ich bin der
   Entwickler.“ Die Offenlegung ist Pflicht (Werbekennzeichnung, Forenregeln).
3. Höchstens jede fünfte Antwort mit Link.

---

## Änderungshistorie

- **03.10.2026:** angelegt, auf Wunsch des Betreibers („mehr einen Marketingplan“). Ergänzt
  `[[MARKETING]]` (Konzept) und `[[LAUNCH-FUNDAMENT]]` (Voraussetzungen) um Zeit, Ablauf und
  Zuständigkeit.
