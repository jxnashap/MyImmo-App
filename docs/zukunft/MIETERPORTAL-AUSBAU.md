# Mieterportal — Bestandsaufnahme, Fehlzustellung, Ausbau

Stand 02.10.2026. Gegen Code und Datenbank geprüft (Policies, Funktionen, Zählungen — keine
Inhalte gelesen). Auftrag des Betreibers: Das Portal ausbauen, und **der Vermieter darf eine
Nebenkostenabrechnung nicht versehentlich an die falsche Person senden.**

## 0. Umsetzungsstand

**02.10.2026 — Schritt 1 gebaut** (Vorgabe des Betreibers: Einladung an eine E-Mail-Adresse):
- **F3 geschlossen:** Der Vermieter trägt die Adresse des Mieters zweimal ein (Einfügen im
  zweiten Feld gesperrt), MyImmo schickt die Einladung genau dorthin (sobald Brevo eingerichtet
  ist; sonst fertiger Text), und **nur ein Konto mit genau dieser bestätigten Adresse** wird
  verknüpft — in der Datenbank erzwungen (Migration `20261002100000`), nicht nur im Formular.
  Damit entfällt S5 (Vermieter bestätigt jede Verknüpfung): Die Adress-Bindung ist die Bestätigung.
- **S3 teilweise:** Die Mieterseite zeigt, WER verbunden ist (Adresse, seit wann), mit
  „Zugang trennen“ und „E-Mail-Adresse ändern“ (= trennen + neu einladen; erst nach erneuter
  Registrierung sieht der Mieter wieder etwas). Automatisches Ende bei Auszug: noch offen.
- **F5 geschlossen, S2 gebaut:** „Ins Mieterportal zustellen…“ öffnet eine Karte mit Name,
  Wohnung, Mietzeit und Portal-Adresse. **Gesperrt** ohne verbundenes Konto und bei einem
  Abrechnungsjahr außerhalb der Mietzeit — im Server, nicht nur in der Oberfläche.
  Warnungen: unbekannte Adresse (Altverknüpfung), Jahr schon zugestellt.
- Tests: `tests/mieterZugang.test.ts`, elf Mutationen (eine gleichwertig).

**02.10.2026 — Zugangsende gebaut** (Entscheidung des Betreibers: bis 31.12. des Folgejahres):
Ein Ex-Mieter sieht sein Portal nach dem Auszug noch bis zum 31.12. des Jahres danach, dann
nichts mehr — in der Datenbank zeitgesteuert, ohne Aufräum-Job (Migration `20261002120000`).
Belege nur noch aus der eigenen Mietzeit (F2 geschlossen, F6 teilweise). Zustellen nach Ablauf
gesperrt; die Mieterseite nennt das Enddatum.

**Noch offen:** S1 (Zustellungen als eigene Tabelle — bis dahin hängt ein Dokument weiter an der
Mieter-ZEILE, F1/F4 sind also erst durch „trennen“ beherrschbar, nicht strukturell gelöst),
S4, S6, S7 (Reichweite im Schalter), S8, S9.

## 1. Kurzfazit

Das Portal ist inhaltlich stark (Wohnung, Anliegen mit Fotos und Terminen, Zahlungen, Dokumente,
Belegeinsicht, Zähler) und an den Lese-Grenzen sauber abgesichert (Sichten statt Tabellen seit
Audit A4). **Der Zustellweg ist es nicht.** Ein Dokument geht heute nicht an eine *Person*,
sondern an eine *Mieter-Zeile* — und wer an dieser Zeile hängt, wechselt unbemerkt, endet nie und
ist für den Vermieter nicht einmal sichtbar. Dazu meldet „Speichern & zustellen“ Erfolg, auch wenn
niemand das Dokument je sehen kann.

Live ist noch nichts passiert: 2 verknüpfte Mieter-Konten, 3 freigegebene NK-Abrechnungen, alles
Testkonten. **Das ist das Fenster, den Zustellweg umzubauen — vor dem Start, nicht danach.**

## 2. Wie das Portal heute funktioniert

| Baustein | Wo | Wie es entscheidet, wer etwas sieht |
|---|---|---|
| Verknüpfung | `lib/actions/einladung.ts`, DB `einladungscode_einloesen()` | Vermieter erzeugt Code `MI-XXXX-XXXX` (14 Tage) für eine Mieter-Zeile. **Wer den Code einlöst**, bekommt eine Zeile in `mieter_zugaenge` (Konto → Mieter-Zeile → Objekt). Keine Bindung an eine E-Mail. |
| Lesen | `lib/portalDaten.ts` | Alles hängt an `mieter_zugaenge`: Dokumente und Zahlungen über `mieter_id`, Belege über `prop_id`, Anliegen/Zähler über das Konto. |
| Dokumente | `notizen.mieter_freigabe` | Ein Schalter je Archiv-Eintrag (`FreigabeToggle`). Sichtbar für **jedes** Konto, das mit dieser Mieter-Zeile verknüpft ist. |
| NK-Abrechnung | `NkSpeichernButton` → `speichereNk()` | „Speichern & zustellen“ = PDF ins Archiv mit `mieter_freigabe = true`. Ein Klick, keine Rückfrage. |
| Belege | `kosten.mieter_freigabe` | Ein Schalter je Kostenbuchung. Sichtbar für **alle** verknüpften Mieter des Objekts. |
| Zugang beenden | — | Gibt es nicht. Die DB-Regel `zugang_delete_vermieter` existiert, ein Knopf nicht. |

## 3. Wie ein Dokument heute bei der falschen Person landet

Nach Schwere geordnet. „Beleg“ = Stelle im Code, an der es nachzulesen ist.

### F1 — Mieterwechsel in derselben Zeile (schwer, wahrscheinlich)
Zieht ein Mieter aus und trägt der Vermieter den Nachfolger in die **bestehende** Mieter-Zeile ein
(Name überschreiben statt neuen Mieter anlegen — bei privaten Vermietern naheliegend), bleibt das
Konto des Vormieters mit der Zeile verknüpft. **Jede künftige NK-Abrechnung des Nachmieters geht
an den Vormieter.** Nichts warnt. Beleg: `updateTenant` fasst `mieter_zugaenge` nicht an; die
Zugangs-Karte zeigt nur „Mieter-Konto verbunden“.

### F2 — Zugang endet nie (schwer, sicher)
Kein Ablauf bei Auszug, kein Trennen-Knopf. Der Ex-Mieter sieht dauerhaft: alles, was später an
seine Zeile gehängt wird, und **alle künftig freigegebenen Belege des Objekts** (Policy
`kosten_select_mieter_freigabe` prüft nur `prop_id`) — also Rechnungen aus Jahren, in denen er
dort gar nicht wohnte.

### F3 — Die falsche Person löst den Code ein (mittel)
Der Code ist ein Inhaber-Schlüssel: Wer ihn hat, wird Mieter dieser Wohnung — weitergeleitete
Nachricht, Mitbewohner, alter Mailverlauf. Der Vermieter sieht danach nur „verbunden“, **nicht
mit welcher E-Mail-Adresse**. Er kann den Fehler also nicht einmal bemerken.

### F4 — Archiv: Empfänger nachträglich geändert (mittel)
Im Archiv lässt sich bei einem bestehenden Dokument der Mieter umstellen
(`ArchivManager.tsx:284` → `updateDokument`). Ist das Dokument bereits freigegeben, erscheint es
**sofort im Portal des neuen Mieters** — ohne Rückfrage, die Freigabe wird mitgenommen. Auch eine
Prüfung, ob Mieter und Objekt zusammenpassen, fehlt.

### F5 — „Zugestellt“, obwohl niemand es sieht (schwer, rechtlich)
`speichereNk()` prüft nicht, ob der Mieter überhaupt ein verknüpftes Konto hat. Der Toast meldet
„Gespeichert & im Mieterportal zugestellt ✓“ auch dann. Folge: Der Vermieter glaubt, die Frist
nach § 556 Abs. 3 BGB gewahrt zu haben — und verliert die Nachforderung.
Außerdem keine Plausibilität: Abrechnungsjahr außerhalb der Mietzeit, Mieter ohne Objekt,
bereits eine NK für dasselbe Jahr zugestellt — alles geht ohne Hinweis durch.

### F6 — Beleg-Freigabe gilt für das ganze Haus (mittel)
Im Mehrfamilienhaus sieht jeder verknüpfte Mieter jeden freigegebenen Beleg des Objekts. Das ist
für Belegeinsicht (§ 556 BGB) bei Hauskosten richtig — **nicht** für eine Handwerkerrechnung
„Wohnung 3, Familie X“. Der Schalter sagt nicht, wer den Beleg danach sieht.

### F7 — Datenbank prüft die Herkunft nicht (gering, Härtung)
Die Mieter-Regeln auf `notizen` und `kosten` prüfen nicht, dass das Dokument vom **eigenen**
Vermieter stammt (`z.vermieter_id = notizen.user_id` fehlt), und das Einfügen prüft nicht, dass
`mieter_id`/`prop_id` dem Einfügenden gehören. Ausnutzbar nur mit einer fremden UUID, also kein
Alltagsfehler — aber genau die Art Lücke, die ein Programmierfehler später aufreißt.

### F8 — Kein Nachweis (rechtlich)
Keine Benachrichtigung des Mieters, kein Abrufzeitpunkt, keine Historie, wann was wem sichtbar
war. Im Streit um den Zugang (Beweislast beim Vermieter) hat der Vermieter nichts in der Hand.

### Nebenbefund
`einladungscode_einloesen()` lässt auch ein **Vermieter-Konto** einen Mieter-Code einlösen; es
behält dann seine Rolle und bekommt zusätzlich einen Mieter-Zugang. Kein Datenleck, aber ein
verwirrender Zustand.

## 4. Rechtliche Lage — was feststeht, was offen ist

- **Form:** § 556 Abs. 3 BGB schreibt für die Betriebskostenabrechnung keine Form vor;
  elektronische Übermittlung ist grundsätzlich möglich.
  [dejure § 556](https://dejure.org/gesetze/BGB/556.html) ·
  [juraforum](https://www.juraforum.de/lexikon/nebenkostenabrechnung-per-mail)
- **Entscheidend ist der Zugang**, nicht der Versand: spätestens 12 Monate nach Ende des
  Abrechnungszeitraums. **Beweislast beim Vermieter.**
  [nebenkostenpro](https://nebenkostenpro.de/ratgeber/nebenkostenabrechnung-zustellung)
- **E-Mail** gilt als zugegangen, wenn sie abrufbar im Postfach liegt; bei Privatpersonen kommt es
  darauf an, wann mit dem Abruf zu rechnen ist. Sicherheit schafft eine vorherige Absprache
  (Vertragsklausel/Einwilligung). (ebd.)
- **Mieterportal:** Eine Entscheidung speziell zum Zugang über ein Portal habe ich **nicht**
  gefunden. Naheliegend ist: Ein Dokument, das nur stillschweigend in einem Portal liegt, ist
  ohne Benachrichtigung und ohne Absprache schwer als „zugegangen“ zu beweisen. **Das gehört auf
  die Anwaltsliste** — mit der Frage, welche Einwilligung und welche Benachrichtigung genügen.
- **Fehlzustellung ist eine Datenpanne:** Eine NK-Abrechnung enthält Name, Anschrift, Verbrauch,
  Zahlungen. Geht sie an die falsche Person, muss der Vermieter (Verantwortlicher) prüfen, ob er
  sie nach Art. 33 DSGVO binnen 72 Stunden der Aufsicht melden muss. MyImmo ist hier
  Auftragsverarbeiter — ein Fehler im *Produkt*, der dazu führt, fällt auf uns zurück.
  [dr-datenschutz](https://www.dr-datenschutz.de/die-betriebskostenabrechnung-unter-anwendung-der-dsgvo/)

## 5. Markt — was andere bieten

objego (private Vermieter): Zählerstände mit Foto, Tickets, Abrechnungen abrufen. Immomio:
Dokumente, Verbrauchsdaten, News, Schadensmeldung mit Chat. casavi (Verwaltungen): Portal + App,
E-Mail-Integration, Vorgangsmanagement.
[trusted.de/objego](https://trusted.de/objego) ·
[Immomio](https://www.vermieter.immomio.com/mieterportalundmieterapp) ·
[casavi](https://casavi.com/de/software/kundenkommunikation/service-app-kundenportal/)

**Einordnung:** Funktional ist MyImmo bereits auf diesem Niveau, bei der Belegeinsicht und der
Vorschau „mit den Augen des Mieters“ darüber. Ein **sichtbar sicherer Zustellweg mit
Nachweis** ist in den Beschreibungen der Wettbewerber nirgends Thema — das wäre ein echtes
Unterscheidungsmerkmal, und es ist ohnehin nötig.

## 6. Vorschläge

### Paket S — Sicherer Zustellweg (vor jedem Ausbau, vor dem Start)

**S1 Zustellung an eine Person, nicht an eine Zeile.** Neue Tabelle `zustellungen`:
`dokument_id`, `mieter_id`, **`empfaenger_user_id`** und **Schnappschuss der Empfänger-E-Mail**,
`zugestellt_am`, `zugestellt_von`, `abgerufen_am`, `zurueckgezogen_am`. Das Portal zeigt Dokumente
nur noch über `zustellungen` mit `empfaenger_user_id = auth.uid()`. Damit schließen F1, F2 und F4
für Dokumente strukturell: Ein späterer Wechsel der Zeile, ein neuer Mieter oder ein umgehängter
Archiv-Eintrag verschiebt keine bereits erfolgte Zustellung, und neue gehen nur an die Person, die
der Vermieter im Dialog gesehen hat. Bestehende `mieter_freigabe`-Einträge werden einmalig
übernommen.

**S2 Zustell-Dialog statt Ein-Klick.** „Zustellen“ öffnet eine Karte:
*An: Anna Berger · Wohnung 2, Musterstr. 5 · Portal-Konto anna.b@… (verbunden seit 03.05.2026) ·
Abrechnung 2025 · Mietzeit 01.03.2021 – heute.* Erst nach Bestätigung wird zugestellt.
**Harte Sperren:** kein verbundenes Konto (dann „Nur speichern — bitte per Post/E-Mail
zustellen“), Abrechnungsjahr ganz außerhalb der Mietzeit, Konto des Empfängers getrennt.
**Warnungen:** Abrechnung für dieses Jahr schon zugestellt; Mietende überschritten.
Toast und Archiv sagen danach wahrheitsgemäß, *wem* zugestellt wurde.

**S3 Wer ist verbunden — sichtbar und trennbar.** Zugangs-Karte zeigt E-Mail und „verbunden seit“,
dazu „Zugang trennen“. Zugang erhält ein Ende: automatisch mit `mietende` + Nachlauf (Vorschlag:
bis die Abrechnungsfrist für das Auszugsjahr abgelaufen ist, also bis 31.12. des Folgejahres), in
dem nur noch Dokumente aus der eigenen Mietzeit sichtbar sind.

**S4 Mieterwechsel erkennen.** Ändert sich bei einer Zeile mit verbundenem Konto der Name oder
der Mietbeginn, fragt die App: „Ist das ein neuer Mieter? Dann bitte neu anlegen — der bisherige
Zugang (anna.b@…) würde sonst alles sehen.“ Zustimmen = Zugang trennen.

**S5 Verknüpfung bestätigen.** Nach dem Einlösen steht der Zugang auf „wartet auf Bestätigung“;
der Vermieter sieht die E-Mail und bestätigt mit einem Klick. Bis dahin sieht das Konto nur die
Wohnungsstammdaten. Optional zusätzlich: Ist beim Mieter eine E-Mail hinterlegt, gilt der Code
nur für genau diese Adresse.

**S6 Archiv entschärfen.** Mieter/Objekt eines bereits zugestellten Dokuments sind nicht mehr
änderbar (zurückziehen, dann neu zustellen). Mieter muss zum gewählten Objekt passen.

**S7 Belege mit klarer Reichweite.** Schalter-Text: „Sichtbar für 3 Mieter in Musterstr. 5“.
Ex-Mieter sehen nur Belege mit Buchungsdatum in ihrer Mietzeit. Optional: Beleg nur für eine
Wohnung freigeben.

**S8 Datenbank-Härtung (F7).** Mieter-Regeln prüfen die Herkunft (`vermieter_id`), Einfügen
prüft, dass `mieter_id`/`prop_id` dem Einfügenden gehören. Nachweis wie bei A4: als echter Mieter
in einer zurückgerollten Transaktion.

**S9 Rückruf und Protokoll.** „Zustellung zurückziehen“ (sofort unsichtbar, Protokoll bleibt).
War sie schon abgerufen, ein Hinweis auf die Prüfpflicht nach Art. 33 DSGVO.

Jeder Punkt bekommt Tests mit Mutationen; der Rauchtest prüft mit dem Demo-Mieter, dass ein
Dokument eines *anderen* Mieters nie erscheint.

### Paket A — Ausbau (danach, nach Nutzen)

| | Vorschlag | Nutzen | Abhängig von |
|---|---|---|---|
| A1 | **E-Mail an den Mieter bei neuem Dokument/Antwort** — nur „Es liegt etwas für Sie bereit“, kein Inhalt, kein Anhang | Zugang beweisbarer, Mieter kommt zurück | Brevo-Zugang (offen), S1 |
| A2 | **Abrufnachweis** beim Vermieter: „zugestellt 03.10., abgerufen 04.10. 18:12“ | Beweis im Fristenstreit | S1 |
| A3 | **Einwilligung zur elektronischen Zustellung** beim ersten Portal-Besuch, Wortlaut gespeichert | rechtliche Grundlage für A1/A2 | Anwalt |
| A4 | **NK-Abrechnung im Portal lesbar** (Positionen, je Position der passende Beleg, „Frage zu dieser Position“ als Anliegen) | weniger Rückfragen, Belegeinsicht ohne Termin | S7 |
| A5 | **Mietkonto für den Mieter**: Soll/Ist je Monat, offene Beträge, Kaution | Klarheit, weniger Streit | — |
| A6 | **Mitmieter**: mehrere Konten je Mietverhältnis (Ehepaar, WG) | Realität vieler Verträge | S1, S5 |
| A7 | **Hausmitteilungen** an alle Mieter eines Objekts (Wasser aus, Treppenhausreinigung) | ersetzt den Aushang | A1 |
| A8 | **Monatliche Verbrauchsinformation** (§ 6a HeizkostenV, bei fernablesbaren Zählern Pflicht) | Pflicht erfüllen, Alleinstellung | Zählerdaten-Quelle; prüfen |
| A9 | **Auszug geführt**: Übergabeprotokoll, Kautionsabrechnung, Zugang läuft geordnet aus | sauberes Ende | S3 |

### Bewusst NICHT
- **Echtzeit-Chat** — erzeugt Erwartung an Antwortzeiten; Anliegen mit Verlauf reichen.
- **Mietzahlung über das Portal** — Zahlungsdienste-Aufsicht (ZAG), Haftung, Kosten.
- **Rechtsverbindliche Erklärungen über das Portal** (Mieterhöhung, Kündigung) — Formfragen und
  Zugang sind dort noch heikler; erst nach Anwalt und A3.
- **Native App / Push** — die Web-App reicht, bis echte Nutzer etwas anderes zeigen.

## 7. Reihenfolge und Umfang

1. **S2 + S3 + F5-Fix** (Dialog, Sperre ohne Konto, E-Mail sichtbar, Trennen) — ein PR,
   ohne Schemaänderung bis auf ein Zugangs-Ende. Schließt die wahrscheinlichsten Fehler sofort.
2. **S1 + S6 + S8** (Zustellungen als eigene Tabelle, Archiv-Sperre, DB-Härtung) — Migration,
   der größte Brocken, die eigentliche Absicherung.
3. **S4 + S5 + S7 + S9**.
4. Dann A1 → A2 → A4 → A5 …

## 8. Offene Fragen

**An den Betreiber:**
- Zugang nach Auszug: Nachlauf bis 31.12. des Folgejahres — passt das?
- S5 (Vermieter bestätigt jede Verknüpfung): ein Klick mehr, dafür kein Fremder im Portal. Ja?
- Code nur für die hinterlegte E-Mail des Mieters — oder zu streng (Mieter nutzt andere Adresse)?

**An den Anwalt** (zur bestehenden Liste):
- Genügt Bereitstellung im Portal + E-Mail-Hinweis + Abrufnachweis als Zugang der
  NK-Abrechnung (§ 556 Abs. 3 BGB)? Welche Einwilligung braucht es dafür?
- Verantwortung von MyImmo (Auftragsverarbeiter) bei einer produktbedingten Fehlzustellung.
