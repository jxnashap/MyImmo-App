# Bewertung des externen Feedbacks vom 08.09.2026 — und der Plan daraus

**Stand:** 08.09.2026 · **Methode:** Jede Behauptung des Feedbacks wurde gegen den
aktuellen Code (`main`, nach #316) geprüft, nicht gegen die Beschreibung. Wo das
Feedback recht hat, steht es hier; wo es zu kurz greift oder falsch gewichtet, auch.

---

## 1. Gesamturteil zum Gesamturteil

Das Feedback trifft den Kern: **MyImmo ist funktionsreicher als geführt.** Die Zahl der
Sidebar-Punkte (15), die Reihenfolge des Dashboards und der Demo-Text belegen das. Auch
die Datenschutz-Befunde stimmen — alle vier, ohne Abstriche.

Was das Feedback **nicht** sieht, weil es eine Oberflächen- und Compliance-Sicht ist:
- Es lobt „viele Tests". Das stimmt erst seit dieser Woche. Vor dem 04.09. führte keine
  einzige Testdatei eine Server-Action aus; die 1.118 Tests von heute sind fünf Tage alt.
- Die schwerste Frage des Projekts — **A2, StBerG** — kommt im Feedback nicht vor. Sie
  entscheidet, ob ein Kernfeature bleiben darf, und steht vor jeder Phase.
- Die elf fail-open-Abfragen und die Mieter-Export-Lücke (#316) hätte ein
  Oberflächen-Review nie gefunden. Das ist kein Vorwurf an das Feedback, aber ein
  Hinweis, dass „Vertrauen" nicht nur aus Texten und 2FA besteht.

**Die wichtigste Produktentscheidung im Feedback** („ruhiger Assistent, der jeden Tag die
nächste richtige Handlung zeigt") **ist richtig** — und sie ist billiger umzusetzen, als
der Plan des Feedbacks vermuten lässt. Siehe Phase 3.

## 2. Befunde: geprüft, einzeln

| # | Behauptung | Geprüft | Befund im Code | Schwere | Aufwand |
|---|---|---|---|---|---|
| 1 | Datenschutz sagt „keine Analyse-Tools", Speed Insights lädt überall | **stimmt** | `app/(pub)/layout.tsx:28`, `app/(app)/layout.tsx:62` und `:143`; `datenschutz/page.tsx:54` sagt „Kein Tracking, keine Analyse-Tools" | **hoch** — die Aussage ist falsch, Art. 13 DSGVO | 1 h |
| 2 | Platzhalter „[zuständige Landesdatenschutzbehörde]" | **stimmt** | `datenschutz/page.tsx:213` | **hoch** — nicht veröffentlichungsreif, seit Monaten live | 15 min (Sitz Bad Schwartau → ULD Schleswig-Holstein) |
| 3 | Google für Schriftarten genannt, Schriften sind selbst gehostet | **stimmt** | Ziffer 7 sagt korrekt „lokal", aber `datenschutz:155` und `avv:133` nennen Google „für Schriftarten"; `public/fonts/` bestätigt Self-Hosting | mittel — Widerspruch auf derselben Seite | 15 min |
| 4 | „kurzer Zeit", „turnusmäßig" zu unbestimmt | **stimmt** | `datenschutz:94`, `:200` | mittel | Betreiber: echte Fristen bei Vercel/Supabase nachsehen, dann 30 min |
| 5 | Keine 2FA; Auto-Abmeldung standardmäßig aus | **stimmt** | kein MFA/TOTP im Code; `AutoLogout.tsx:32` liest `localStorage` mit Default `"0"` = aus | **hoch** für Bank-/Bewerberdaten | 2FA: 2–3 Tage (Supabase TOTP ist im Free-Plan enthalten); Default: 10 min |
| 6 | Vollexport entschlüsselt ohne erneute Passwortabfrage | **stimmt** | `api/export/alles` prüft nur die Sitzung | mittel–hoch | 1 Tag (Re-Auth-Schritt, siehe Phase 2) |
| 7 | Aufgaben stehen auf dem Dashboard nach Chart und Kennzahlen | **stimmt — aber die Folgerung war falsch, siehe unten** | „Fristen & Aufgaben" ist der **letzte** Abschnitt (`page.tsx:501`), nach KPIs, zwei Charts, Karte, Einnahmen/Ausgaben, Krediten und Buchungen | **hoch** — die Kernfrage „was muss ich tun?" steht ganz unten | 2 h (verschieben) · 1–2 Tage (Karte „Heute wichtig" mit Handlungen) |
| 8 | Seitenleiste mit sehr vielen gleichrangigen Punkten | **teils** | 11 + 4 Punkte in **zwei** Gruppen (`lib/nav.ts`) — gruppiert, aber die erste Gruppe ist zu lang | mittel | 2 h |
| 9 | Demo-Hinweis „kannst alles ausprobieren; Änderungen werden zurückgesetzt" stimmt nicht | **stimmt** | `app/(app)/layout.tsx:207–209`; die Demo ist seit 30.08. Nur-Lesen (`CLAUDE.md`) | **hoch** — erster Kontakt, falsche Aussage | 10 min |
| 10 | Fünf Kennzahlen als 2–2–1 | **stimmt** | `.grid-5` → `1fr 1fr` unter 1100 px, fünf Kacheln → eine allein | niedrig | 30 min |
| 11 | `scripts/demo-video.mjs` unversioniert | **nicht prüfbar** | Datei existiert im Repo nicht — sie liegt nur auf dem Rechner des Reviewers | — | Betreiber: sichern oder löschen |
| 12 | 54 Seiten ohne Ladeanzeige | **stimmt** | 66 `page.tsx`, 12 `loading.tsx` = Punkt T3 der Checkliste | niedrig | 3 h |

**Zwölf Behauptungen, elf zutreffend, eine nicht prüfbar, keine falsch.** Das ist ein
gutes Feedback. Es ist aber ein Feedback zur *Oberfläche* — die Rückseite hat es nicht
gesehen.

## 3. Wo ich dem Feedback widerspreche oder es schärfe

1. **„Speed Insights entfernen ODER Erklärung anpassen"** — ich rate zu **entfernen**,
   vollständig. Speed Insights liefert für eine Seite dieser Größe keine Erkenntnis, die
   den Datenschutz-Passus rechtfertigt, und jeder Passus über Vercel-Messdaten macht die
   bisher schlichte Erklärung („kein Tracking") komplizierter. Weniger ist hier mehr.
2. **„Automatische Abmeldung standardmäßig 15 oder 30 Minuten"** — 30, nicht 15. Eine
   Nebenkostenabrechnung dauert länger als 15 Minuten, und der Timer misst Inaktivität,
   nicht Sitzungsdauer. Bei 15 Minuten verliert der Nutzer Formulareingaben. Vorher
   prüfen, ob lange Formulare einen Entwurf halten.
3. **„Fortgeschrittene Funktionen erst zeigen, wenn Grundlagen eingerichtet sind"** —
   riskant. Wer die App kennt und ein zweites Konto anlegt, sucht dann die Funktionen.
   Besser: **gruppieren und einklappen** (Phase 3), nicht verstecken.
4. **Die Reihenfolge der Phasen.** Das Feedback stellt Datenschutz vor Kontoschutz vor
   Kern-UX. Richtig — aber die Datenschutz-Fixes 1–3 und der Demo-Text sind **zusammen
   unter zwei Stunden**. Die gehören nicht in eine „Phase", sondern in den nächsten PR.
5. **Was im Plan fehlt:** A2 (StBerG) vor jedem Euro; die Aktivierungs-Checkliste
   `docs/BEZAHLSYSTEM.md`; und dass „Vertrauen" auch heißt, dass die Rückseite hält —
   die fünf Durchgänge dieser Woche haben 44 stille Fehler gefunden, davon einen, der
   Mietern die Kaufpreise ihrer Vermieter zeigte.

## 4. Der Plan — nach Nutzen je Stunde, nicht nach Phase

### Sofort (ein PR, unter drei Stunden, nur Code) — ✅ erledigt 08.09.2026, PR #318
1. Speed Insights aus allen drei Layouts entfernen; Paket deinstallieren.
2. `[zuständige Landesdatenschutzbehörde]` → ULD Schleswig-Holstein (Sitz Bad Schwartau),
   mit Anschrift und Link.
3. Google aus „Schriftarten" streichen (Datenschutz Ziffer 4 und AVV) — Google bleibt
   nur für den Login.
4. Demo-Banner: „Du siehst Beispieldaten und kannst alle Funktionen erkunden. Speichern
   ist in der Demo nicht möglich."
5. „Fristen & Aufgaben" vom Ende des Dashboards **ganz nach oben**, vor die Kennzahlen.
   Das ist ein Verschieben von 30 Zeilen und ändert die App mehr als jede andere Zeile
   dieses Plans.
6. `.grid-5` unter 1100 px: fünfte Kachel über volle Breite (`:last-child { grid-column: 1 / -1 }`).

### Betreiber, parallel (kein Code)
- Löschfristen ermitteln: Vercel-Log-Aufbewahrung des Pro-Plans, Supabase-Backup-Fenster
  des Free-Plans (Achtung: ohne Pro gibt es womöglich **gar keine** automatischen Backups —
  das wäre ein eigener Befund), Brevo 100 Tage (bekannt), Bewerberdaten 6 Monate (im Code
  so gebaut), Kontolöschung sofort (`delete_own_account`). Dann Ziffern 3 und 9 der
  Datenschutzerklärung konkret machen.
- `scripts/demo-video.mjs` lokal sichern oder löschen; lokalen Ordner auf `main` bringen.
- **A2 abschicken:** `docs/compliance/StBerG-ANFRAGE.md` liegt fertig.

### Woche 1–2: Kontoschutz (Code, ~4 Tage) — ✅ erledigt 08.09.2026, PR #319
1. **2FA per Authenticator-App** über Supabase MFA (TOTP, im Free-Plan enthalten):
   Einrichten in Einstellungen → Sicherheit, Wiederherstellungscodes, Abfrage beim Login.
   Nicht erzwingen, aber prominent anbieten; für Konten mit IBANs oder Bewerberdaten
   einen Hinweis zeigen.
2. **Erneute Anmeldung vor sensiblen Aktionen**: Vollexport, Kontolöschung, Bank-Freigabe.
   Umsetzung: Supabase-Sitzungsalter prüfen (AAL2 bzw. Passwort erneut abfragen, wenn die
   letzte Anmeldung älter als 10 Minuten ist). Ein Nebeneffekt: Das schließt den Weg
   „offener Rechner im Café → Vollexport", den das Feedback zu Recht nennt.
3. **Auto-Abmeldung Standard 30 Minuten**, mit Vorwarnung 60 Sekunden davor.
4. **Sicherheitsbereich** in den Einstellungen: letzte Anmeldung, aktive Sitzungen
   (Supabase liefert sie), Passwort ändern, 2FA.

### Woche 3: Der Kern nach vorn (Code, ~3 Tage) — ✅ erledigt 08.09.2026, PR #320
1. Karte **„Heute wichtig"** ganz oben: überfällige Fristen, offene Mieten des Monats,
   neue Anliegen, ausstehende Zählerstand-Freigaben — jede Zeile mit **einer** Handlung
   („Miete bestätigen" → `bestaetigeMieteingang`, „Anliegen öffnen", „Termin abhaken").
   Die Daten liegen alle schon auf dem Dashboard; es fehlt die Zusammenführung.
2. Sidebar in drei Gruppen: **Verwalten** (Dashboard, Immobilien, Mieter, Ein- & Ausgaben,
   Mieterportal) · **Abrechnen** (Mietkonto, Verbrauch, Kredite, Steuer, Jahresbericht,
   Archiv) · **Planen** (Kauf, Verkauf, Marktwert, AfA). Dritte Gruppe standardmäßig
   eingeklappt — eingeklappt, nicht versteckt.
3. Drei Demo-Pfade als Links auf der Landing („Miete prüfen", „NK vorbereiten",
   „Schaden verfolgen") — je ein Deep-Link ins Demo-Konto mit Hinweistext. Kein neues
   Feature, nur drei URLs.
4. Registrierungs-Knopf: „Early-Access-Zugang anfragen", solange der Zugangscode nötig ist.

### Woche 4: Qualität (Code, ~3 Tage)
1. `loading.tsx` für die 54 Seiten (T3) — ein Skelett-Bauteil, 54 Dateien à drei Zeilen.
2. 11-px-Texte auf 12 px (Design Runde 2, Punkt aus `CLAUDE.md`).
3. **Ende-zu-Ende-Tests mit Playwright** (ist installiert) für sechs Wege: Registrierung
   mit Code, Objekt anlegen, Mieter anlegen, Mieteingang bestätigen, Vollexport,
   Kontolöschung. Das ist die Testart, die diese Woche gefehlt hat: Der Prüfstand testet
   Actions, nicht Klickwege.
4. Leere Zustände mit je einer nächsten Handlung.

### Nicht vor Abschluss der Wochen 1–4
Banking, weitere KI, WEG-Modul, Strategie-Reiter, englische Fassung. Das Feedback hat
recht: Erst die Führung, dann der Umfang.

## 4b. Korrektur am eigenen Plan: Befund 7 war richtig, die Lösung nicht

**08.09.2026 abends, nach dem Live-Blick des Betreibers.** Das Feedback wollte die
Aufgaben ganz oben; #318 und #320 haben genau das gebaut. Am fertigen Dashboard
gesehen, war es falsch: **Kennzahlen und Verläufe gehören nach oben, Termine und
Aufgaben ans Ende.** Zurückgedreht in PR #321.

Was daran zu lernen ist — für mich wie für das Feedback:
- Der Befund stimmte (die Aufgaben standen ganz unten, auf dem Handy unsichtbar).
  Die **Folgerung** „also ganz nach oben" war eine Vermutung, keine Beobachtung.
- Ein Dashboard beantwortet zwei Fragen: „Wie steht es?" und „Was ist zu tun?".
  Das Feedback hat die zweite für die wichtigere gehalten. Der Betreiber, der die
  Seite täglich benutzt, sieht es umgekehrt — und **eine gesehene Seite schlägt
  eine vermutete.**
- Was vom Umbau bleibt und richtig war: die **Zusammenführung**. Vorher gab es
  zwei Blöcke mit denselben Fristen; jetzt einen, mit je einer Handlung pro Zeile
  („Miete bestätigen", „Anliegen öffnen"). Nur eben unten.
- Drei Tests halten die Reihenfolge jetzt fest, damit sie nicht beim nächsten
  Feedback-Durchlauf still zurückgedreht wird.

**Konsequenz für den Rest dieses Plans:** Bei jedem weiteren Layout-Punkt
(Phase 5) erst zeigen, dann festschreiben — nicht umgekehrt.

## 5. Was ich als Nächstes tun würde

**Nachtrag 08.09.2026, nach dem Sofort-PR:** Die sechs Punkte sind drin. Dabei ist ein
eigener Fehler aufgefallen: PR #317 war mit **einem roten Test** gemergt worden, weil
`npx vitest run | tail -3 && git commit` den Exit-Code von `tail` prüft, nicht den von
vitest. Der Test (alte A9-Annahme „Skript liegt NICHT in migrations") war inhaltlich
überholt und ist ersetzt — aber die Pipeline hätte ihn nicht durchlassen dürfen.
Regel jetzt in `CLAUDE.md`: Testlauf nie hinter eine Pipe hängen, wenn danach
committet wird.


Den **Sofort-PR** — sechs Punkte, unter drei Stunden, davon vier reine Wahrheitskorrekturen
an Texten, die heute live falsch sind. Danach ist die App nicht besser, aber ehrlich.
Dann Woche 1 (2FA), weil Bank- und Bewerberdaten das verlangen, bevor mehr Nutzer kommen.

Was ich **nicht** tun würde: mit Phase 3 (Dashboard-Umbau) anfangen, solange Ziffer 2
der Datenschutzerklärung einen Platzhalter enthält.
