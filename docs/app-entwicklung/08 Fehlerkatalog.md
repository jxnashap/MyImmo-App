# 08 — Fehlerkatalog

Echte Fehler aus diesem Projekt. Jeder mit **Symptom, Ursache, Gegenprüfung**.
Die Ursache ist der Teil, der zählt — Symptome wiederholen sich nie gleich.

## Rechnen

**Formularzeilen aus einem alten Vordruck**
Die Anlage-V-Hilfe nannte feste Zeilen (Schuldzinsen „Zeile 37“, Summe „51“) — seit der
Neufassung des Vordrucks lag dort eine andere Zeile (§ 7b). Bezeichnung und Betrag stimmten,
die Nummer führte in die falsche Zeile.
→ *Gegenprüfung:* Zeilennummern je Steuerjahr aus dem Vordruck selbst lesen, mit Quelle
ablegen; ein Jahr ohne geprüften Vordruck bekommt **keine** Nummer. Test gegen den
wörtlichen Auszug der Summenzeile, die die Endzeilen aller Blöcke nennt.

**Jahresfrist ab dem 29. Februar**
`Date.setFullYear(+10)` macht aus dem 29.02. den 01.03. — die Frist endete einen Tag zu
spät (§ 188 Abs. 3 BGB: letzter Tag des Monats).
→ *Gegenprüfung:* Fristen auf den Zahlen des Datums rechnen und auf das Monatsende klemmen;
Testfall 29.02. in ein Nicht-Schaltjahr.

**Grunderwerbsteuer um Faktor 1000 verrechnet**
Ein Maschinenwert (`"0.035"` aus einer Auswahl) lief durch den deutschen
Zahlenparser. Der hielt den Punkt für ein Tausendertrennzeichen → 35 → 3500 %.
→ *Gegenprüfung:* Maschinenwerte nie durch den Nutzer-Parser. Test mit
Auswahlwerten aller Bundesländer.

**Kennzahl auf den falschen Nenner bezogen**
Nettorendite auf den Kaufpreis statt auf die Gesamtinvestition — die
Nebenkosten verschwinden lautlos, das Ergebnis sieht plausibel aus.
→ *Gegenprüfung:* Bezugsgröße im Test explizit prüfen, nicht nur den Wert.

**Gerundete Teilbeträge ergeben eine falsche Summe**
368 € Zins + 194 € Tilgung = 562 €, die Rate ist aber 561 €.
→ *Gegenprüfung:* Nach dem Runden die Summe gegen den ungerundeten Wert testen.

**Eine Aussage kippt durch eine Parameteränderung**
Nach Erhöhung des Eigenkapitalanteils von 10 auf 15 % stimmte der Satz
„einzige positive Eigenkapitalrendite" nicht mehr — ein Objekt rutschte ins Plus.
→ *Gegenprüfung:* Nach jeder Parameteränderung die **Rangfolge** neu prüfen und
alle Texte durchsuchen, die eine Rangaussage treffen.

**„Erst lesen, dann schreiben“ bucht doppelt (B07, 11.10.2026)**
Mietbuchung, wiederkehrende Buchungen, Zählerübernahme, Auftrag → Kosten und Angebot → Auftrag
prüften per Abfrage „schon gebucht?“ und schrieben danach. Zwei gleichzeitige Aufrufe (Doppelklick,
zwei Tabs, Wiederholung nach Zeitüberlauf) sahen beide „nein“. Dazu die Zählregel der Vorlagen: Bei
n Buchungen galten die ERSTEN n Termine als gebucht — eine gelöschte Buchung in der Mitte ließ den
LETZTEN Termin doppelt entstehen.
→ *Gegenprüfung:* Die fachliche Einheit steht als UNIQUE-Regel in der Datenbank (Zahlungskennung,
Vorlage + Termin, Auftrag, Meldung); die Action fügt mit `upsert … ignoreDuplicates` ein bzw. wertet
23505 aus oder BEANSPRUCHT zuerst bedingt (`update … where status = 'offen' returning`). Test mit
`Promise.all` gegen eine Attrappe, die die Regel durchsetzt (`tests/stubs/speicherDb.ts`), und ein
echter Zwei-Sitzungen-Test (`scripts/db/nebenlaeufig.sh`).

**Teilzahlung verworfen, NK-Anteil vom falschen Monat (B09/B10, 11.10.2026)**
Jede weitere Zahlung in einem Monat mit IRGENDEINER Buchung galt als Dublette; beim Kontoauszug
kam der NK-Anteil aus dem Browser, berechnet für den zuerst erkannten Monat.
→ *Gegenprüfung:* Soll, NK-Anteil und Verteilung rechnet der Server aus Vertrag + bestehenden
Buchungen (`lib/mietZahlung.ts`); Testfälle Teilzahlung, Überzahlung, Sammelzahlung, Monatswechsel.

**Kennung „Monat ausgeglichen“ sperrte den Monat nach einer Rücklastschrift (Ablauf A, 11.10.2026)**
Die Kennung `a:<mieter>|<monat>` (B07) machte zwei gleichzeitige Bestätigungen zu EINER Buchung. Sobald
eine Rücklastschrift den Monat wieder öffnete, existierte die Kennung aber schon — die erneute
Bestätigung meldete „übersprungen“, der Monat ließ sich nie wieder als bezahlt buchen. Beim Bau von
Ablauf A gefunden, bevor Rückbuchungen überhaupt möglich waren.
→ *Gegenprüfung:* Eine Kennung, die einen ZUSTAND beschreibt („Monat ausgeglichen“), braucht eine
Generation, sobald der Zustand zurückgesetzt werden kann (`|r<Anzahl Rückbuchungen>`). Test: Zustand
herstellen → zurücksetzen → erneut herstellen, auch gleichzeitig.

**Negative Buchungen fielen aus dem DATEV-Export (Ablauf A/E, 11.10.2026)**
`baueDatevBuchungen` übersprang `betrag <= 0` — eine Rücklastschrift stand in MyImmo, nicht in DATEV;
die Summen beider liefen auseinander.
→ *Gegenprüfung:* DATEV-Umsatz ist immer positiv, die Richtung trägt das Soll/Haben-Kennzeichen.
Abstimmungstest: Σ Haben − Σ Soll je Konto = Σ Beträge in MyImmo.

**Steuerliche Kostenart und Umlagefähigkeit waren dasselbe Feld (Ablauf B, 11.10.2026)**
Ob eine Buchung in die NK-Abrechnung durfte, entschied allein `istUmlagefaehig(kategorie)`. Eine
„Hausmeister“-Rechnung mit Reparaturanteil ging damit ganz in die Abrechnung; „Versicherung“ zählte
pauschal als umlagefähig, auch für eine Rechtsschutzversicherung.
→ *Gegenprüfung:* Zwei Felder, zwei Fragen — `kosten.kategorie` (Kostenart) und `kosten.umlagefaehig`
(§ 2 BetrKV, je Buchung bestätigt). `nkAusBuchungen` nimmt die Bestätigung vor der Kategorie. Test:
gleiche Kategorie, verschiedene Bestätigung → verschiedenes NK-Ergebnis.

**Ein Wächter fand die neue Tabelle, die Hand hätte sie vergessen (Ablauf B, 11.10.2026)**
Beim Bau des Belegeingangs wurden fünf Wächter rot: Kontolöschung, Vollexport, Lade-Zustand,
GET-Routen-Sperrliste, Schreibfehler im KI-Abbruchweg. Jeder davon wäre sonst eine Lücke geworden
(Belege nach Kontolöschung behalten, im Export fehlend …).
→ *Gegenprüfung:* Nach jeder neuen Tabelle/Route den VOLLEN Testlauf, nicht nur die neue Datei.
Gebuchte Belege teilen ihre Datei mit der Buchung — der Export lädt sie dort, nicht doppelt
(`storage.wenn`); sonst meldete er nach einer gelöschten Buchung „unvollständig“.

**Fremdschlüssel prüfen kein Eigentum (Ablauf C, 11.10.2026)**
Die Schreibregel auf `auftraege` prüfte nur `vermieter_id = auth.uid()`. `mieter_id`, `anliegen_id`,
`prop_id`, `firma_id` sind Fremdschlüssel — die Datenbank prüft dabei nur, OB die Zeile existiert, nicht
WEM sie gehört (der FK-Check läuft ohne RLS). Über den eigenen Auftrags-Link kam so der Kontakt eines
fremden Mieters heraus. Dazu eine eigene Testfalle: Die erste Probe holte das Link-Token als `anon` —
leer — und meldete „kein fremder Kontakt“ aus dem falschen Grund; die zweite simulierte den Altbestand
mit abgeschaltetem Trigger, aber der Spaltenschutz-Trigger setzte `mieter_id` zurück.
→ *Gegenprüfung:* Jede Spalte, die auf eine Zeile eines Kontos zeigt, braucht eine Eigentumsprüfung
(Trigger oder Policy mit `exists … user_id = …`). In SECURITY-DEFINER-Funktionen jeden Join auf den
Besitzer einschränken. Proben erst glauben, wenn eine „sieht hin“-Prüfung belegt, dass die Testdaten
tatsächlich so stehen.

**Ein Auftrag ohne Partner kam nie auf „erledigt“ (Ablauf C, 11.10.2026)**
Eine Firma über den Auftrags-Link kann nur zu- oder absagen; „erledigt mit Betrag“ meldet nur ein Partner
mit Konto. Aufträge aus angenommenen Angeboten blieben offen, „Als Kosten übernehmen“ war unerreichbar.
→ *Gegenprüfung:* Jeder Weg, der einen Vorgang beginnt, braucht einen Weg, ihn zu beenden — für JEDE
Art von Beteiligtem (`schliesseAuftragAb` für Aufträge ohne verknüpften Partner).

**Zinsen gezahlt, als liefe die Rate nach der Tilgung weiter (B13, 11.10.2026)**
„Zinsen in der Bindung = Rate × 12 × Jahre − getilgt“ zählte bei 100.000 € · 4 % · 4 % · 20 Jahre die
Raten nach der Volltilgung (Monat 209) als Zinsen: 60.000 € statt 38.860,59 €.
→ *Gegenprüfung:* Monat für Monat rechnen, letzte Rate auf Restschuld + Zinsen kappen
(`tilgungsVerlauf()`); Testfall, in dem das Darlehen INNERHALB des Zeitraums getilgt ist, und die
Probe „Σ Raten = Darlehen + Zinsen“.

**Folgetermin wandert und verdoppelt sich (B12, 11.10.2026)**
Jede Instanz rechnete vom gekappten Vorgänger (31.01. → 28.02. → 28.03. …); „erledigt“ wurde vor dem
Folgetermin gespeichert, und eine Wiederholung schaltete den Haken zurück.
→ *Gegenprüfung:* Tag der Serie speichern; Reihenfolge „erst das Abhängige, dann der Status“; ein
Formular sendet den ZIELzustand, nicht „umschalten“; Folgetermin eindeutig je Vorgänger.

**Name als Schlüssel beim Import (B15, 11.10.2026)**
Objektnamen in einer Map — bei zwei gleichnamigen Objekten gewann still das letzte.
→ *Gegenprüfung:* Nur zuordnen, wenn GENAU ein Treffer existiert; sonst abbrechen und sagen, welcher
Name mehrdeutig ist. Vorschau und Server mit derselben Funktion.

## Oberfläche

**Fokus springt beim Feldwechsel zurück**
Der `blur`-Handler baute die ganze Karte neu auf. Damit wurde das gerade
angeklickte Zielfeld zerstört, bevor der Klick ankam — und ein erzwungener Fokus
setzte den Cursor ins alte Feld. Nach dem ersten Feld war keine Eingabe mehr
möglich.
→ *Gegenprüfung:* Klickfolge im Browser nachstellen (`mousedown` → `focus` →
`mouseup` → `click`) und `document.activeElement` prüfen.

**Klick auf einen Reiter kommt nie an**
Dieselbe Ursache: Wird das Element zwischen `mousedown` und `mouseup` neu
erzeugt, löst der Browser gar kein Klick-Ereignis aus.
→ *Gegenprüfung:* Nie DOM neu bauen, die der Nutzer gerade anklickt. Einmal
bauen, danach nur beschriften.

**Zoomen mit zwei Fingern war auf Wisch-Seiten abgeschaltet** (MyImmo, 10.10.2026)
`touch-action: pan-y` erlaubt dem Browser NUR senkrechtes Scrollen — Pinch-Zoom gehört
nicht dazu und war damit auf allen Wisch-Reitern (Mieterportal, Anliegen) und am
Diagramm aus. Aufgefallen erst bei der Frage nach einer „Lupe für Ältere“.
→ *Gegenprüfung:* Jeder `touch-action`-Wert mit `pan-x`/`pan-y` enthält `pinch-zoom`
(`pan-y pinch-zoom`); ein Test durchsucht JSX und CSS. Die Geste selbst bricht bei zwei
Fingern ab, sonst schiebt der Zoom die Seite seitwärts.

**Tippflächen-Scan meldete 42 „zu kleine“ Lösch-Knöpfe, die es nicht waren** (MyImmo, 10.10.2026)
Gemessen wurde mit `getBoundingClientRect()` (28 × 20 px). Die Knöpfe haben eine
unsichtbare Tippfläche über `::after` (`inset: -10px` → 48 × 40) — die sieht diese
Messung nicht.
→ *Gegenprüfung:* Bei einem Tippflächen-Befund erst die Pseudo-Elemente des Elements
ansehen (`getComputedStyle(el, "::after")`), dann bauen. Umgekehrt: Wer eine Fläche
per `::after` vergrößert, braucht `position: relative` am Element.

**Favicon verschwand, sobald ein Apple-Symbol in die Metadaten kam** (MyImmo, 10.10.2026)
Next.js nimmt das Datei-Favicon (`app/icon.svg`) nur, solange `metadata.icons` leer ist. Mit
`icons: { apple: … }` fehlte `<link rel="icon">` auf JEDER Seite — Tests und Typprüfung waren
grün, gesehen erst im gebauten HTML.
→ *Gegenprüfung:* Nach einer Änderung an `metadata` im gebauten HTML (`.next/server/app/*.html`)
die `<link>`-Zeilen zählen. Wer `icons` setzt, nennt das Favicon mit (`icon: [{ url: "/icon.svg" }]`).

## Grafik

**Zwölf ausgelieferte Icons hatten einen 87 px schwarzen Streifen**
Chrome rendert bei `--window-size=1024,1024` nur rund 937 px Viewporthöhe. Der
Fehler war im Bild sichtbar, wurde aber nicht gemessen.
→ *Gegenprüfung:* Mit Reserve rendern, exakt beschneiden, danach **messen**:
Größe, Modus, Ecken deckend, unterste Zeilen nicht schwarz. Seitenhintergrund
auf Magenta setzen, dann fällt Durchscheinen sofort auf.

**Alle dünnen Linien unsichtbar**
Der Farbverlauf war in Bounding-Box-Einheiten definiert. Eine senkrechte Linie
hat eine null Pixel breite Box → Verlauf ungültig → Element wird **gar nicht**
gezeichnet.
→ *Gegenprüfung:* `gradientUnits="userSpaceOnUse"`. Nach dem Rendern Pixel an
der erwarteten Stelle abtasten.

**Pfad falsch, weil ein Punkt fehlte**
`… L646,306 L780,764` verband First und Sockel direkt statt über die Traufe —
der rechte Schenkel wurde eine Diagonale.
→ *Gegenprüfung:* Geometrie ansehen, nicht nur den Code lesen.

**Eine Ersetzung traf viermal dieselbe Stelle**
Weil der eingefügte Block den Suchtext selbst enthielt, landete die Grundlinie
viermal in einem Entwurf und in dreien gar nicht.
→ *Gegenprüfung:* Bei wiederholten Ersetzungen pro Abschnitt arbeiten, danach
Vorkommen zählen.

## Eigene Prüfungen

**Ein Linkprüfer setzte die Demo fünfmal zurück** (MyImmo, Audit 07.10.2026)
Er folgte jedem `href` per GET — auch „Demo ansehen“ (`/api/demo`), das anmeldet und den geteilten
Bestand zurücksetzt. „GET ist harmlos“ stimmt nicht: Adressen lösen Links ein, protokollieren
Abrufe, schreiben.
→ *Gegenprüfung:* Eine Sperrliste (`scripts/crawlSperrliste.mjs`), die jedes Werkzeug vor dem
Aufruf fragt — Start, Link und Weiterleitung. Ein Test verlangt, dass jede GET-Route entweder
gesperrt oder ausdrücklich „nur lesend“ ist.

**Fremde ID galt als gute Seite — HTTP 200 trotz `notFound()`** (MyImmo, Audit 07.10.2026)
Mit `loading.tsx` streamt Next: `notFound()`/`redirect()` kommen als 200, der Ausgang steht nur als
`NEXT_HTTP_ERROR_FALLBACK;404` bzw. `NEXT_REDIRECT;replace;/ziel;307;` im HTML. Wer nur den
Statuscode liest, zählt Fehler nicht.
→ *Gegenprüfung:* Marker auswerten (`scripts/streamingMarker.mjs`) und einen Weg mit bewusst
unbekannter ID prüfen, der „nicht gefunden“ ERWARTET — sonst merkt niemand, wenn die Erkennung
selbst ausfällt. Muster aus echten Antworten übernehmen; ein `&amp;` im Ziel enthält ein `;`.

**Bildschirmaufnahmen zeigten halbe Seiten** (MyImmo, Audit 07.10.2026)
`html { scroll-behavior: smooth }` gilt auch für `window.scrollTo(0, y)` aus einem Skript — die
Aufnahme lief, während die Seite noch glitt.
→ *Gegenprüfung:* `scrollTo({ top, behavior: "instant" })`; bei Bildreihen eine Aufnahme mit
bekanntem Inhalt am Abschnittsanfang ansehen.

**Eine Prüfung meldete „sauber", obwohl sie nichts geprüft hatte**
Das Suchmuster fand keine Skript-Dateien → null durchsucht → null Treffer → grün.
→ *Gegenprüfung:* Jede Prüfung meldet mit, **wie viel** sie geprüft hat. Null
untersuchte Einheiten sind ein Fehler, kein Erfolg.

**Ein Test, der auch die kaputte Fassung besteht**
→ *Gegenprüfung:* Nach jeder Behebung den Test gegen den alten Stand laufen
lassen und **prüfen, dass er dort durchfällt**.

**Fehlalarm durch eine zu grobe Schwelle**
Ein dunkler Bildentwurf wurde als „abgeschnitten" gemeldet, weil die
Helligkeitsschwelle nicht zwischen Gestaltung und Beschnitt unterschied.
→ *Gegenprüfung:* Bei einem Alarm erst prüfen, ob die **Prüfung** falsch liegt.

**Eine Einladung ersetzte den Zugangscode (B04, 11.10.2026)**
Die Regel auf `einladungscodes` prüfte nur „du stellst für dich selbst aus“, nicht „du darfst
überhaupt einladen“. Ein Konto ohne Freischaltung (Google oder direkt über die Auth-API, Metadaten
`rolle: hausverwaltung`) stellte sich einen Service-Code aus, löste ihn selbst ein — und war über
`konto_freischaltung` (quelle 'einladung') freigeschaltet, mit der nutzergewählten Rolle. Jede
einzelne Regel sah für sich richtig aus; die Lücke entstand erst aus ihrem Zusammenspiel
(Aussteller ≠ berechtigt, Rolle aus Metadaten, Freischaltung als Nebenwirkung).
→ *Gegenprüfung:* Für jeden Weg, der `konto_freischaltung` schreibt, ein Rollentest mit einem NICHT
freigeschalteten Konto als Aussteller UND als Einlöser (`supabase/test/rls/b04_einladung.sql`).
Eine Freischaltung als Nebenwirkung gilt nur für die eingeladene Rolle.

**Widerruf entfernte die Verknüpfung, nicht den Zugriff (B03, 11.10.2026)**
Die Regeln auf Aufträgen, Notizen und Rückmeldungen prüften `service_user_id = auth.uid()` — eine
Spalte am Auftrag, die der Widerruf nicht anfasst. Dazu ein Nebenweg außerhalb der Datenbank: der
öffentliche Auftrags-Link, den der Partner kannte. Und eine Testfalle: Ein `UPDATE … WHERE id = …`
prüft zusätzlich die LESE-Regel; nur ein `UPDATE` ohne WHERE zeigt, ob die Update-Regel allein hält.
→ *Gegenprüfung:* Widerruf als Zustandswechsel testen — vorher (positiv) und nachher (negativ) für
jede Tabelle, Sicht, RPC und jeden Inhaber-Link, den die Rolle kannte.

**Mutationsprobe blind bei REVOKE (11.10.2026)**
Die erste DB-Mutationsprobe spielte die mutierte Migration über eine Datenbank, in der die echte
schon gelaufen war. Für `CREATE OR REPLACE`/`ALTER POLICY` genügt das; ein entferntes `REVOKE` stellt
die Rechte aber nicht wieder her — alle drei Mutationen blieben grün, auch der Ursprungszustand.
→ *Gegenprüfung:* Zielmigration beim Aufbau auslassen (`OHNE_MIGRATION`), dann mutiert einspielen;
und immer eine Mutation „Ursprungszustand“ mitlaufen lassen — sie MUSS rot werden.

**Auswertung aus einem Teilbestand (B08, 11.10.2026)**
Dashboard, Ein- & Ausgaben, Jahresbericht, DATEV-/CSV-Export, Rückstandswächter und Nebenkosten
luden ohne `.range()` (PostgREST liefert still höchstens 1.000 Zeilen) und werteten `error` nicht
aus — eine gescheiterte Abfrage sah aus wie „nichts gebucht“. Ein Sammel-PDF übersprang einen
Mieter, dessen Abrechnung nicht entstand.
→ *Gegenprüfung:* Grundlagen über `alleZeilen()` (`lib/db/auswertung.ts`): Fehler → Fehlerkarte bzw.
503, nie Zahlen aus einem Teil. Testdaten über 1.000 Zeilen gegen eine Attrappe, die wie PostgREST
abschneidet, und die SEITE selbst ausführen (`tests/auswertungVollstaendig.test.ts`) — ein zweiter
Ladeweg kann einen Fehler sonst verdecken (eine Mutation überlebte genau so, bis die angezeigte
Summe geprüft wurde).

**Grenze nur am Haupteingang (B14, 11.10.2026)**
Die Tarifgrenze prüfte „Objekt anlegen“ — nicht „Bearbeiten“, nicht den CSV-Import, nicht den direkten
REST-Weg; ein Lesefehler beim Zählen ergab 0 belegte Einheiten.
→ *Gegenprüfung:* Alle Schreibwege auf die Tabelle aufzählen (Actions, Import, REST) und je einen Test;
Zählfehler sperren; die Datenbank als letzte Linie (Trigger mit Sperre je Konto). Testkonten bekommen
per Bestandsschutz-Trigger automatisch „plus“ — im Test den Tarif ausdrücklich setzen.

**Erst prüfen, dann mit dem Namen verbinden — DNS-Rebinding (B17, 11.10.2026)**
Der Link-Import löste den Namen auf, prüfte die Adresse und rief danach `fetch` mit dem NAMEN auf, das
erneut auflöste. Ein Angreifer-DNS mit TTL 0 antwortet einmal öffentlich, einmal mit 169.254.169.254.
→ *Gegenprüfung:* Mit der GEPRÜFTEN Adresse verbinden (eigener Dispatcher mit festem `lookup`), Name nur für
Host-Kopf und TLS; Test mit einem Namen, den es nicht gibt (`*.invalid`), gegen einen lokalen Server, und
mit einem Auflöser, der beim zweiten Mal eine interne Adresse liefert — er darf nur einmal gefragt werden.

**Zeitgeber endet mit den Kopfzeilen (B16, 11.10.2026)**
`setTimeout(abort)` … `finally clearTimeout` um `await fetch()` — der Body wurde danach ohne Zeitgrenze und
ohne Größengrenze gelesen (`arrayBuffer()`, `text()`, `req.json()`).
→ *Gegenprüfung:* Body innerhalb desselben `try` begrenzt lesen; Tests mit einem Server, der die Kopfzeilen
sofort schickt und den Body nie beendet, und mit einem Body ohne `Content-Length`, bei dem gezählt wird,
wie viel tatsächlich abgeholt wurde (die Statusprüfung allein übersah eine Mutation).

## Projektführung

**Punkte standen monatelang fälschlich als offen**
Onboarding-Tour und Open Banking Etappen 1–4 waren längst gebaut. Das hat zu
Fehleinschätzungen bei der Planung geführt. (Open Banking wurde am 29.08.2026
bewusst wieder entfernt — das entwertet den Fehler nicht, er lag davor.)
→ *Gegenprüfung:* Vor jeder Aussage „das fehlt noch" in
`docs/PROJEKT-STATUS.md` nachsehen. Erledigtes sofort umtragen.

**Der Wissensspeicher selbst wurde aus einem veralteten Baum geschrieben**
Die Notizen 00–10 entstanden am 01.09.2026 auf einem Arbeitsbranch, der
**56 Commits hinter `main`** lag. Ergebnis: Der Stack stand an vier Stellen als
Next.js 14 (main lief seit #293 auf 15.5.25), Open Banking galt als gebaut
(am 29.08.2026 entfernt), und von den drei als „überfällig" markierten Prüfungen
waren **zwei längst erledigt** (KfW-308 am 28.08., Supabase-Passwortlänge am
30.08.2026). Eine Notiz, die Erledigtes als offen meldet, richtet denselben
Schaden an wie eine, die Offenes als erledigt meldet — sie kostet die nächste
Session Arbeit an einem gelösten Problem.
→ *Gegenprüfung:* **Vor** dem Schreiben einer Vault-Notiz `git fetch` und gegen
den aktuellen Stand von `main` schreiben, nicht gegen den Arbeitsbaum. Jede
Behauptung über Code beim Schreiben am Pfad verifizieren (`ls`, `grep`), jede
Behauptung über einen Stand gegen `CLAUDE.md` und `docs/PROJEKT-STATUS.md` auf
`main`. Und: **die Vault gehört auf `main`**, nicht auf einen Themenbranch —
sonst findet die nächste Session sie nicht und schreibt sie ein zweites Mal.

**Schema existierte nur in der Datenbank**
Fundament-Tabellen und alle 78 RLS-Policies lagen nicht im Repo — die
Zugriffskontrolle war weder reviewbar noch reproduzierbar.
→ *Gegenprüfung:* Migrationsregel (zwei Schritte, immer beide). Baseline-Snapshot
gegen ein leeres PostgreSQL verifizieren.

**Ein Dashboard-Schalter wurde für wirksam gehalten**
→ *Gegenprüfung:* Sicherheitseinstellungen durch einen echten Versuch prüfen.

**Arbeit ging verloren, weil sie nicht gepusht war**
Sessions laufen in einem Container, der frisch geklont wird. Nicht Committetes
ist beim Sessionende weg.
→ *Gegenprüfung:* Was zählt, wird committet und gepusht — im selben Zug.
