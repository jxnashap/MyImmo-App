# MyImmo — Marketingkonzept

**Stand 30.07.2026.** Grundlage: `[[MASTERPLAN]]` Abschnitt 1, 2, 7, 8 (Zielgruppe,
Wettbewerb, SEO-Plan, Risiken) und `[[FINANZKONZEPT]]` (Tarife, Bezahlsystem).
Ziel laut Betreiber: **Sichtbarkeit aufbauen UND zahlende Kunden gewinnen.**
Redesign-Status: **offen, dauert noch** → alle Bildbestände müssen per Skript
reproduzierbar sein.

Verwandt: `[[BEZAHLSYSTEM]]` · `[[FINANZKONZEPT]]` · `[[MASTERPLAN]]` · `[[BRIEFING]]`

---

## 1. Die unbequeme Reihenfolge

Beide Ziele sind gewollt, aber sie sind **nicht gleichzeitig** erreichbar — und das
liegt nicht am Marketing.

**Zahlende Kunden setzen eine Kette voraus, von der aktuell kein Glied steht:**

| Voraussetzung | Stand | Quelle |
|---|---|---|
| Bezahlsystem scharf (`BILLING_ENFORCED=true`) | ❌ aus | `[[BEZAHLSYSTEM]]` |
| Preise öffentlich (`PREISE_SICHTBAR`) | ❌ ausgeblendet | `lib/preise.ts` |
| AGB + Widerrufsbelehrung anwaltlich frei | ❌ offen | `[[MASTERPLAN]]` P1 |
| Paddle-Konto verifiziert | ❌ offen | `[[BEZAHLSYSTEM]]` Schritt 3 |
| Feature-Gates in den Actions aktiv | ❌ offen | `[[BEZAHLSYSTEM]]` Schritt 11 |

Solange das so ist, kann eine Kampagne **keinen einzigen Euro** einnehmen. Wer jetzt
auf „zahlende Kunden" optimiert, erzeugt Nachfrage, die ins Leere läuft.

**Das ist aber kein Grund zu warten**, denn:

> SEO wirkt mit 3–6 Monaten Verzögerung. Wer erst mit dem Ratgeber anfängt, wenn die
> Kasse aufmacht, hat ein halbes Jahr Funkstille. **Sichtbarkeit ist die Vorstufe,
> nicht die Alternative.**

**Deshalb die Reihenfolge:** Sichtbarkeit jetzt aufbauen, so dass der Trichter voll
ist, wenn die Kasse aufmacht. Jeder Inhalt wird von Anfang an auf Kaufabsicht hin
geschrieben — nur der Abschluss-Knopf zeigt vorerst auf „kostenlos starten" statt auf
den Checkout.

**Konkreter Zeitversatz:**

```
Monat 0–2   Inhalte + Infrastruktur          → Sichtbarkeit beginnt zu wachsen
Monat 2–3   Rechtstexte + Paddle + Redesign  → parallel, unabhängig vom Marketing
Monat 3     BILLING_ENFORCED=true, Preise an → Trichter ist gefüllt, Kasse auf
Monat 3+    Bezahlte Reichweite (erst jetzt) → CAC ist messbar, weil Umsatz existiert
```

---

## 2. Zielgruppe — was daraus für die Kanäle folgt

Aus `[[MASTERPLAN]]` Abschnitt 1:

- **5,5 Mio. private Vermieterhaushalte**, 16,1 Mio. Wohnungen = 64 % des Mietbestands
- **Durchschnittsalter 58**, 41 % über 65, nur 5 % unter 35
- **58 % besitzen genau ein Objekt**, 19 % zwei
- **Schmerzpunkt Nr. 1: Nebenkostenabrechnung** — über 80 % fehlerhaft, Ø-Korrektur ~515 €

### Was das ausschließt

| Kanal | Urteil | Begründung |
|---|---|---|
| TikTok, Reels, Shorts | **nein** | Altersschnitt 58; wir würden für die falsche Kohorte produzieren |
| Instagram organisch | **nein** | dito, plus hoher Pflegeaufwand für einen Ein-Personen-Betrieb |
| LinkedIn | **später, klein** | nur für die Hausverwaltungs-Schiene (Business-Tarif) |
| Podcast/YouTube-Format | **nein (jetzt)** | Produktionsaufwand steht in keinem Verhältnis |

> Die Higgsfield-Anbindung könnte Videos und TikTok-Uploads erzeugen. **Technisch
> möglich heißt hier nicht sinnvoll.** Für 65-Jährige mit einer Eigentumswohnung
> entscheidet die Google-Suche „nebenkostenabrechnung frist", nicht ein Reel.

### Was das nahelegt

| Kanal | Priorität | Warum |
|---|---|---|
| **Suchmaschine (Ratgeber + Vorlagen)** | 1 | Die Zielgruppe sucht aktiv bei konkretem Problem |
| **Vergleichsportale** | 2 | trusted.de, softwareabc24 — dort fehlt MyImmo komplett |
| **Vorlagen als Einstiegspunkt** | 3 | objego hat 67.000 Downloads damit gemacht |
| **Foren/Communities** | 4 | Vermieter-Foren, WEG-Gruppen — beratend, nicht werbend |
| **E-Mail** | 5 | erst wenn Adressen da sind; hält den Kontakt bis zur Kaufreife |
| **Google Ads** | 6 | **erst nach Kassenöffnung** — vorher unmessbar |

---

## 3. Positionierung — der Satz, der überall gilt

> **MyImmo ist die Vermieter-App, die mitdenkt: Sie rechnet nicht nur, sie sagt
> rechtzeitig Bescheid.**

Abgeleitet aus den Lücken in `[[MASTERPLAN]]` Abschnitt 2 — Dinge, die **kein**
Wettbewerber besetzt:

1. **Proaktive Wächter** — Rückstands-Wächter, 15-%-Falle, Fristen. Bietet keiner.
2. **NK-Abrechnung per Foto vorbefüllt** — als *Ergebnis* kommuniziert („zwei Stunden
   statt zwei Abenden"), nicht als KI-Feature. KI ist Marktstandard, taugt nicht als USP.
3. **Ehrlicher Umgang mit Unsicherheit** — die App sagt, wenn ein Wert geschätzt ist.
   Das ist bei Steuerzahlen ein Vertrauensargument, das sonst niemand führt.
4. **Daten in Deutschland, Bankdaten zusätzlich verschlüsselt** — für 58+ ein echtes
   Kaufargument, kein Techniknebel.

**Was wir NICHT sagen:** „KI-gestützt", „All-in-One", „revolutionär". Alles drei ist
in diesem Markt Rauschen.

### Der Wettbewerbs-Keil

VermietenPlus (ImmoScout24) steht bei **Trustpilot 1,4/5** nach einer verpatzten
Migration. Das ist die größte offene Flanke im Markt.

- Ratgeber-Artikel „Von vermietet.de zu MyImmo umziehen" + Import-Assistent
- Nicht über den Wettbewerber herziehen — sachlich den Umstieg erklären. Wer
  unzufrieden sucht, sucht nach genau dieser Anleitung.

---

## 4. Kampagnen

Vier Kampagnen, aufeinander aufbauend. Jede hat ein Ziel, einen Kanal, ein
messbares Ergebnis — und eine ehrliche Aufwandsangabe.

### K1 · „Der teure Fehler" — Nebenkosten (Fundament)

- **Ziel:** Sichtbarkeit für den Schmerzpunkt Nr. 1
- **Aufhänger:** über 80 % der NK-Abrechnungen sind fehlerhaft, Ø-Korrektur ~515 €
- **Assets:** 5 Ratgeber-Artikel, 1 Funktions-Landingpage, 3 Vorlagen
- **Kanal:** Suche, organisch
- **Messgröße:** Sichtbarkeit für „nebenkostenabrechnung erstellen/frist/vorlage"
- **Warum zuerst:** höchstes Suchvolumen, direkteste Produktbrücke

### K2 · „Was das Finanzamt nicht sagt" — Steuer (Differenzierung)

- **Ziel:** das Alleinstellungsmerkmal besetzen, das keiner hat
- **Aufhänger:** 15-%-Falle, § 35a, Anlage V, § 82b-Verteilung
- **Assets:** 4 Ratgeber-Artikel, 1 Landingpage „Anlage V für Vermieter", 1 Rechner
  öffentlich gespiegelt
- **Kanal:** Suche + Vermieter-Foren (beratend)
- **Messgröße:** Verweildauer, Anteil Wiederkehrer
- **Achtung:** StBerG-Grenze. Jeder Text bleibt bei „rechnen und informieren", nie
  „wir beraten". Formulierungen aus `[[MASTERPLAN]]` 10.3 übernehmen.

### K3 · „Geerbt und plötzlich Vermieter" — Einstieg (unbesetzte Nische)

- **Ziel:** eine wachsende Gruppe abholen, die niemand adressiert
- **Aufhänger:** Erbfall → erste Mietabrechnung, völlig ohne Vorwissen
- **Assets:** 3 Ratgeber-Artikel, 1 Landingpage, Checkliste als PDF
- **Kanal:** Suche; langfristig Kooperation mit Erbrechts-Blogs
- **Messgröße:** Anmeldungen aus dieser Artikelgruppe
- **Warum stark:** kaum Wettbewerb, hohe Hilflosigkeit, klarer Bedarf

### K4 · „Wechseln ohne Datenverlust" — Umstieg (opportunistisch)

- **Ziel:** unzufriedene Wettbewerbskunden abholen
- **Aufhänger:** VermietenPlus 1,4/5, Migrationsprobleme
- **Assets:** 1 Vergleichs-Landingpage, 1 Umzugs-Anleitung, Import-Assistent
- **Kanal:** Suche + Vergleichsportale
- **Messgröße:** Anmeldungen mit Import-Nutzung
- **Voraussetzung:** Der Import-Assistent muss halten, was der Text verspricht.
  Sonst wird aus dem Keil ein Bumerang.

---

## 5. Redaktionsplan — 12 Artikel

Bestand: **5 Artikel** in `lib/ratgeber.ts`. Neu: **12**. Reihenfolge = Priorität.
Stand 30.07.2026: **15 Artikel live** — K1 (1–4), K2 (5–7) und K3 (9–11) fertig.
Offen: Artikel 8 (Mieterhöhung, K1) und Artikel 12 (Umstieg, K4 — setzt den Import-Assistenten voraus).

> Artikel 5 heißt bewusst „Abschnitt für Abschnitt“ statt „Zeile für Zeile“: Die
> Zeilennummern der Anlage V ändern sich fast jedes Jahr, die Struktur nicht. Ein
> Artikel mit Zeilennummern wäre jeden Januar falsch.

| # | Arbeitstitel | Kampagne | Suchabsicht | Status |
|---|---|---|---|---|
| — | Nebenkostenabrechnung: Fristen und Fehler | K1 | Problem | ✅ vorhanden |
| — | Grundsteuer 2025 auf Mieter umlegen | K1 | Problem | ✅ vorhanden |
| — | § 35a EStG für Mieter | K2 | Problem | ✅ vorhanden |
| — | Die 15-%-Falle | K2 | Problem | ✅ vorhanden |
| — | Geerbte Immobilie vermieten | K3 | Einstieg | ✅ vorhanden |
| 1 | Nebenkostenabrechnung erstellen — Schritt für Schritt | K1 | **Lösung** | ✅ 30.07.2026 |
| 2 | Umlageschlüssel: Fläche, Personen, Verbrauch — was wann gilt | K1 | Problem | ✅ 30.07.2026 |
| 3 | Heizkostenabrechnung: 50–70-%-Regel + Frist 31.12.2026 | K1 | Problem | ✅ 30.07.2026 |
| 4 | Belegeinsicht: was Mieter verlangen dürfen | K1 | Problem | ✅ 30.07.2026 |
| 5 | Anlage V ausfüllen — Abschnitt für Abschnitt | K2 | **Lösung** | ✅ 30.07.2026 |
| 6 | AfA richtig ansetzen: 2 %, 2,5 %, 3 % oder degressiv | K2 | Problem | ✅ 30.07.2026 |
| 7 | Erhaltungsaufwand über 5 Jahre verteilen (§ 82b) | K2 | Problem | ✅ 30.07.2026 |
| 8 | Mieterhöhung: Fristen, Kappungsgrenze, Formfehler | K1 | Problem | offen |
| 9 | Erste Vermietung: die 10 Schritte | K3 | Einstieg | ✅ 30.07.2026 |
| 10 | Mietvertrag prüfen: die Klauseln, die Geld kosten | K3 | Einstieg | ✅ 30.07.2026 |
| 11 | Wohnung geerbt: Steuern, Fristen, erste Abrechnung | K3 | Einstieg | ✅ 30.07.2026 |
| 12 | Von vermietet.de umziehen — ohne Datenverlust | K4 | **Kauf** | offen |

**Regel für jeden Artikel:** ein klar benanntes Problem, die rechtliche Grundlage mit
Paragraf, ein Rechenbeispiel — und *erst am Schluss* der Hinweis auf die passende
MyImmo-Funktion. Wer mit dem Produkt anfängt, verliert die Suchabsicht.

**Pflichtsatz unter jedem Steuerartikel:** Anhaltspunkte ohne Gewähr, keine Steuer-
oder Rechtsberatung. (Steht schon so in der Artikel-Vorlage.)

---

## 6. Trichter und Messgrößen

```
Suche/Portal  →  Ratgeber  →  Vorlage (E-Mail)  →  Anmeldung  →  Nutzung  →  Abo
                    │             │                   │            │          │
                 Reichweite    Adresse            Registrierung  Aktivierung  Umsatz
```

**Was gemessen wird — und was nicht.**

Bewusst schlank: Es gibt **kein Tracking, keine Analytics, keine Cookies** in der App
(geprüft). Das ist ein Datenschutz-Vorteil, den wir behalten. Messen daher nur über:

| Größe | Quelle | Ehrlichkeit |
|---|---|---|
| Sichtbarkeit, Klicks | Google Search Console | echt, kostenlos, ohne Cookies |
| Anmeldungen | `auth.users` in Supabase | echt |
| Aktivierung (1. Objekt angelegt) | eigene Abfrage | echt |
| Vorlagen-Downloads | E-Mail-Anbieter | erst nach Anbindung |
| Abos | `abos`-Tabelle | erst nach Kassenöffnung |

> **Nicht** Analytics einbauen, nur um eine Zahl zu haben. Der Verzicht ist Teil der
> Positionierung („kein Tracking, keine Werbung" steht bereits im Footer).

**Realistische Erwartung, damit niemand enttäuscht wird:** Ein neuer Ratgeber-Artikel
braucht typisch **3–6 Monate** bis zu nennenswerten Klicks. Die ersten zwei Monate
werden nach nichts aussehen. Das ist normal und kein Grund umzusteuern.

---

## 7. Voraussetzungen, die kein Text ersetzt

| # | Was | Warum blockierend | Wer |
|---|---|---|---|
| V1 | **E-Mail-Anbieter** (Brevo oder Resend, EU) + Double-Opt-in + AVV | Ohne ihn kein Vorlagen-Gate, kein Kontakt bis zur Kaufreife | Claude baut, Konto legst du an |
| V2 | **AGB + Widerruf anwaltlich** | Vor dem ersten Euro Pflicht | nur du |
| V3 | **Impressum/Datenschutz anwaltlich** | läuft bereits mit V2 | nur du |
| V4 | **Support-Kanal** (E-Mail-Adresse + Reaktionszeit) | 41 % über 65 rufen an oder schreiben. Reichweite ohne Antwort = schlechte Bewertungen — und die sind das Ranking-Kriterium der Vergleichsportale | du, mit Vorlagen von Claude |
| V5 | **Screenshot-Skript** | Redesign ist offen; Bilder müssen in Minuten neu erzeugbar sein | ✅ `scripts/screenshots.mjs` (einmalig `npm i -D playwright`) |

**V4 wird regelmäßig unterschätzt.** `[[MASTERPLAN]]` Abschnitt 8 nennt es selbst als
Risiko. Lieber 50 Nutzer mit Antwort als 500 ohne.

---

## 8. Was Claude übernehmen kann

### Planen
Redaktionsplan, Keyword-Zuordnung, Kampagnenstruktur, Trichter, Portal-Profile,
Wettbewerbsbeobachtung. **Vollständig.**

### Produzieren

| Art | Möglich | Anmerkung |
|---|---|---|
| Ratgeber-Artikel | ✅ | liegen als Code in `lib/ratgeber.ts` — schreiben und ausliefern in einem Schritt |
| Funktions-Landingpages | ✅ | |
| Vorlagen (Text + PDF) | ✅ | PDF-Generator und Dokument-Design existieren |
| **App-Screenshots** | ✅ | `scripts/screenshots.mjs` — beide Themes, Handy und Desktop, reproduzierbar |
| E-Mail-Strecken (Text) | ✅ | Versand erst nach V1 |
| Portal-Profiltexte | ✅ | Einreichen musst du |
| Bilder / Video | ⚠️ | Higgsfield vorhanden; kostet Credits, Markentreue ungeprüft. Für diese Zielgruppe nachrangig |
| Canva | ❌ | Verbindung nicht autorisiert — Freigabe in den claude.ai-Connector-Einstellungen |

### Hochladen

| Ziel | Möglich |
|---|---|
| Website (dieses Repo) | ✅ vollständig — schreiben, prüfen, ausliefern |
| TikTok | ⚠️ technisch über Higgsfield — für diese Zielgruppe nicht empfohlen |
| Instagram, LinkedIn, Google Ads | ❌ vorbereiten ja, einreichen nur du |
| Vergleichsportale | ❌ Texte ja, Anmeldung nur du |

---

## 9. Nächste Schritte

**Sofort, unabhängig vom Redesign — nichts davon wird weggeworfen:**

1. Artikel 1–4 aus dem Redaktionsplan (Nebenkosten, K1)
2. Landingpage-Texte für die vier Funktionen
3. E-Mail-Anbieter anbinden (V1)
4. Vergleichsportal-Profile vorbereiten

**Nach dem Redesign:**

5. `scripts/screenshots.mjs` laufen lassen, Artikel bebildern
6. Vorlagen-Gate scharf schalten
7. Erst danach bezahlte Reichweite (K4, Ads)

---

## Änderungshistorie

- **30.07.2026** — angelegt. Ziele „Sichtbarkeit + zahlende Kunden", Redesign offen.
