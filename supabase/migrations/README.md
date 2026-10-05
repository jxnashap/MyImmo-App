# Migrationen — Regeln & Historie

## Baseline (ab 28.07.2026)
`20260728120000_baseline_schema.sql` ist ein **Snapshot des kompletten
Live-Schemas** — 42 Tabellen, 161 Constraints, 113 Indizes, 78 RLS-Policies und
14 Funktionen (davon 11 SECURITY DEFINER). Vorher lag nur ein Bruchteil davon im
Repo: Das Fundament (`properties`, `mieter`, `einnahmen`, `kosten`) und vor allem
**sämtliche RLS-Policies** existierten ausschließlich in der Datenbank. Damit war
die Zugriffskontrolle der App weder reviewbar noch reproduzierbar — und alle
Server-Actions verlassen sich darauf.

Die Datei ist idempotent und wurde gegen ein leeres PostgreSQL 16 verifiziert;
Spalten- und Policy-Hash stimmen exakt mit der Produktionsdatenbank überein. Sie
ist ein Snapshot, **kein nachgespieltes Änderungsprotokoll**: Die Alt-Migrationen
unten bleiben die Historie, die Baseline ist der reviewbare Ist-Stand und der Weg,
die Datenbank aus dem Repo neu aufzubauen.

Ab hier gilt die Regel unten wieder unverändert für jede weitere Änderung.

## Die Regel (ab 19.07.2026, verbindlich)
Jede Schemaänderung läuft über **zwei Schritte, immer beide**:
1. `apply_migration` (Supabase MCP) — führt aus und versioniert in
   `supabase_migrations.schema_migrations` (Version + Name + Statements).
2. **Dieselbe SQL als Datei hier ablegen**: `supabase/migrations/<version>_<name>.sql`
   (Version = von apply_migration vergebener Zeitstempel `YYYYMMDDHHMMSS`).

Kein direktes `execute_sql` für DDL. Kein Schema-Edit ohne Repo-Datei im selben PR.

## Historie exportieren (bei Bedarf)
Die vollständige SQL aller Alt-Migrationen liegt in der Prod-DB:
```sql
select version, name, statements
from supabase_migrations.schema_migrations
order by version;
```
Einzelne Datei nachziehen: Statement(s) der Version in `<version>_<name>.sql` kopieren.

## Bekannte Schema-Schulden (bewusst offen)
- `kosten.mieter_id` ist `text` (statt uuid-FK auf `mieter.id`) — Altlast, Fix = Datenmigration.
- `termine.prop_id` ist `text` — dito.
- `supabase/schema.sql` ist veraltet; `schema-reference.sql` ist Doku, keine Quelle der Wahrheit.

## Index der Alt-Migrationen (vor Einführung dieses Ordners; SQL in der DB, s. o.)
| Version | Name |
|---|---|
| 20260623170752 | add_mieter_positionen |
| 20260623210858 | add_vermieter_profil |
| 20260624174201 | create_dokument_vorlagen |
| 20260624195032 | add_quelle_to_mieter_positionen |
| 20260625080940 | notizen_add_mieter_id_for_archiv |
| 20260625121009 | ibans_unique_user_iban |
| 20260625141130 | delete_own_account_function |
| 20260625142947 | harden_update_updated_at_search_path |
| 20260625173551 | ibans_standard_flag |
| 20260626073039 | einnahmen_mieter_id |
| 20260626111207 | wiederkehr_schema |
| 20260628104825 | revert_wiederkehr_feature |
| 20260629083625 | ibans_blind_index_encryption |
| 20260701161241 | einnahmen_nk_anteil |
| 20260701165802 | harden_db |
| 20260701194938 | add_kalkulationen |
| 20260701222958 | beleihung_dokumente |
| 20260701225130 | beleihung_freigaben_phase2 |
| 20260702064227 | termine_kalender_ausbau |
| 20260702102037 | belege_storage_bucket |
| 20260702104701 | properties_afa_einstellungen |
| 20260703060216 | mieter_iban_verschluesselt |
| 20260703062555 | mieter_stellplatz |
| 20260703070244 | mieter_staffelplan |
| 20260703081027 | properties_einheiten_anzahl |
| 20260705144534 | miet_zeitraeume |
| 20260705160221 | nk_co2_eingaben |
| 20260705162100 | mieter_positionen_aufteilung |
| 20260705163429 | mieter_positionen_verbrauch |
| 20260705174232 | miet_zeitraeume_rls_initplan_fix |
| 20260705175559 | wiederkehrende_buchungen |
| 20260705200346 | add_grundstuecksflaeche_to_properties |
| 20260705215745 | immobilienbewertung_schema |
| 20260712115536 | rollen_system_etappe1 |
| 20260712122546 | mieterportal_anliegen |
| 20260712124746 | anliegen_dateien |
| 20260712133332 | archiv_mieter_freigabe |
| 20260712141354 | zaehlerstand_meldungen |
| 20260712144408 | vermieter_anfragen |
| 20260712151325 | portal_zahlungen_belege |
| 20260712153915 | bewerber_esignatur |
| 20260712162410 | service_hausverwaltung_rollen |
| 20260712162756 | service_hausverwaltung_rollen_v2 |
| 20260712162933 | service_zugaenge_email |
| 20260712170319 | firmen_auftrag_freigabe |
| 20260712171527 | auftrag_firmenlink |
| 20260712172822 | einladungscode_rollen_fix |
| 20260712173319 | auftraege_service_haertung |
| 20260712173356 | bewerbung_rpc_haertung |
| 20260712185211 | konto_freischaltung_gate |
| 20260712204628 | banking_tabellen |
| 20260713205058 | nk_positionen_gesamt_basis_anteil |
| 20260715132628 | einnahmen_soll_monat |
| 20260715140713 | properties_kaufdatum |
| 20260715141828 | mieter_positionen_lohnanteil |
| 20260715152641 | mieter_positionen_hkvo |
| 20260716081320 | anliegen_terminkoordination |
| 20260716083527 | auftraege_kosten_bruecke |
| 20260718001145 | create_selbstauskunft |
| 20260719073404 | properties_geo_coords |
| 20260720190000 | create_makler_dokumente |

## Migrationen mit Datei im Repo
| Version | Name | Zweck |
|---|---|---|
| 20260718001145 | create_selbstauskunft | Käufer-Selbstauskunft (verschlüsselt) |
| 20260719073404 | properties_geo_coords | lat/lng für die Karte |
| 20260720190000 | create_makler_dokumente | Makler-Unterlagen |
| 20260724180000 | create_abos | Abo-/Bezahlsystem (inaktiv) |
| 20260724190000 | abos_event_ordnung | Reihenfolge-Schutz im Paddle-Webhook |
| 20260728120000 | baseline_schema | **Snapshot des Gesamtschemas** (s. o.) |
| 20260728130000 | kontoloeschung_vollstaendig | FK blockierte die Löschung von Mieter-/Service-Konten |
| 20260728140000 | umlage_ersetzen_transaktion | Verteiler ersetzt Positionen atomar statt delete-dann-insert |
| 20260728150000 | bewerber_link_verantwortlicher | Bewerbungsseite nennt den Verantwortlichen (Art. 13 DSGVO) |
| 20260728160000 | einladungscode_nachtraeglich_einloesen | Ausweg aus dem Freischaltungs-Gate für Mieter/Service |
| 20260729150000 | kontoloeschung_schont_fremddaten | Kontolöschung vernichtet keine Aufträge/Anliegen des Vermieters mehr |
| 20260729180000 | auftrag_link_ablauf | Öffentlicher Auftrags-Link (Mieter-Kontakt) läuft nach 90 Tagen ab |
| 20260729200000 | zugriffsbremse_und_trigger_sperren | Zugriffsbremse je IP für Code-Prüfungen; Trigger-Funktionen aus der API genommen |
| 20260729210000 | fristen_ausblenden | Abgeleitete Fristen ausblendbar — vorher unschließbare Altlasten |
| 20260729210500 | auftrag_firmen_rueckmeldung | Rückkanal für Handwerksfirmen auf der öffentlichen Auftragsseite |
| 20260731180000 | newsletter_double_opt_in | Vorlagen-Verteiler mit Double-Opt-in; Tabelle ist der Einwilligungsnachweis |
| 20260731181000 | newsletter_abmelde_token | Eigener Abmelde-Schlüssel, damit Abmeldungen nicht nur bei Brevo landen |
| 20260731182000 | newsletter_email_unique_direkt | Unique auf `email` statt `lower(email)` — Ausdrucks-Index taugt nicht für ON CONFLICT |
| 20260827100000 | bewerbung_dateien | Bewerber legen der Selbstauskunft Dokumente bei (Gehaltsabrechnungen, SCHUFA) |
| 20260827110000 | bewerbung_dateien_verschluesselt | Anhänge-RPC akzeptiert App-Chiffretext (enc:v1), Limit 12 MB Text |
| 20260827120000 | bewerber_link_steckbrief_slots | Objekt-Steckbrief am Bewerbungs-Link + wählbare Dokument-Slots (max. 12 Dateien) |
| 20260829120000 | open_banking_entfernen | Open Banking zurückgestellt: Tabellen (bankverbindungen, bank_umsaetze, bank_auth_anfragen) + abos.banking_addon gedroppt (Code in Historie bis 85feb98; docs/zukunft/OPEN-BANKING.md) |
| 20260830150000 | demo_nur_lesen | Demo-Konto: restriktive RLS-Policies verweigern jedes INSERT/UPDATE/DELETE; `ist_demo_nutzer()`. SELECT und Service-Role (Reset) bleiben frei |
| 20260830153000 | demo_mieterhoehung_beispielwerte | Beispiel-Vergleichsmieten und Sperrfrist-Daten für die 6 Demo-Mieter, damit das Mieterhöhungs-Dokument rechnet; Schnappschuss nachgezogen |
| 20260831090000 | registrierung_freigabe_vormerken | Zugangscode nur noch EINMAL: Freigabe wird bei der Registrierung serverseitig vorgemerkt, `freischaltung_nachholen()` löst sie beim ersten Login ein |
| 20260930150643 | demo_schreibsperre_laut | Demo-Konto: BEFORE-Anweisungs-Trigger auf allen RLS-Tabellen wirft einen Fehler, statt dass UPDATE/DELETE still 0 Zeilen treffen. SECURITY DEFINER, sonst scheitert die Service-Role (Reset, Cron). Policies bleiben als zweite Linie |
| 20260930150903 | demo_koordinaten | Feste lat/lng für die 6 Demo-Objekte (Live + Schnappschuss), damit die Karte ohne Nominatim-Aufruf je Besucher auskommt |
| 20260930154606 | demo_daten_bis_heute | Demo läuft mit der Zeit: Reset schreibt Mieten (Vormonat, nur laufende Verträge) und Kosten (Vorjahresmonat) bis heute fort, verschiebt ganze Jahre, lässt eine Miete offen. Nachmieterin Reihenhaus Halle, Beispiel-Anliegen/Archiv/Zählermeldung. Reset löscht auch über vermieter_id und überträgt nur gemeinsame Spalten |
| 20260930162539 | demo_warmmiete_kaufdaten | Demo-Mietbuchungen = Warmmiete laut Vertrag mit NK-Anteil (vorher ~Kaltmiete, beschriftet als Warmmiete), Kaufdaten der 6 Objekte, Auszahlungsdaten der 4 Kredite; Live-Bestand per Reset angeglichen |
| 20260930174605 | demo_schuldzinsen | Demo: monatliche Schuldzinsen-Buchungen je Darlehen (2025-01 bis 2026-06, Restschuld rückwärts fortgeschrieben) — Steuerseite zeigte sonst „aus Restschuld hochgerechnet"; Live-Bestand per Reset angeglichen |
| 20261001180100 | demo_service_seed | Schnappschuss für die Service-Demo: fünf Firmen (Telefon aus dem Medienblock 030 23125, E-Mails `.test`), sechs Aufträge in allen Zuständen, eine Firmen-Zusage. Ohne `delete` (frische Tabellen); erscheint mit `demo_service_reset` |
| 20261001180200 | demo_service_reset | `demo_zuruecksetzen()`: `firmen` in der Tabellenschleife, Aufträge und Rückmeldungen gezielt (Partner-ID aus `service_email`, Daten tagesgenau) — der Spaltenschutz-Trigger lässt kein nachträgliches UPDATE zu. **Manuell im SQL-Editor ausgeführt** (01.10.2026, Betreiber): `apply_migration` lief wegen des `delete`-Bestätigungsdialogs in der Cloud-Sitzung in den Timeout. Danach per `pg_get_functiondef` geprüft |
| 20261005180000 | bank_link_code | Bank-Link nur mit Zugangscode (wie 20261005170000): `beleihung_freigaben.empfaenger_email`/`code_hash`/`fehlversuche`, restriktive Regel `freigabe_braucht_code` fürs Anlegen; `beleihung_public_anmelden`/`_status`; `beleihung_public_info`/`_datei`/`_rueckmeldung` verlangen den Hash (Datei weiter mit Protokoll). Fassungen ohne Code stillgelegt statt entfernt. Zurückgerollt bewiesen (ohne Code/alte Funktionen nichts, Rückmeldung nur mit Hash, Sperre nach 10, Protokoll 1 Zeile, Anlegen ohne Code abgelehnt). Live 0 aktive Bank-Links zum Zeitpunkt. Kein delete |
| 20261005170000 | makler_link_code | Makler-Link nur mit Zugangscode: `makler_freigaben.empfaenger_email`/`code_hash`/`fehlversuche`; Anlegen nur mit Hash (64 Zeichen) und Adresse (`ALTER POLICY`); `makler_public_anmelden` (ok/falsch/gesperrt nach 10), `makler_public_status`, `makler_public_info`/`_datei` verlangen den Hash. Die Fassungen ohne Code stillgelegt (geben nichts zurück, Aufrufrecht entzogen) statt entfernt. Zurückgerollt bewiesen (ohne Code/alte Funktionen nichts, mit Hash Datei+Liste, Sperre nach 10, Angemeldete behalten Zugriff, Anlegen ohne Code/Adresse abgelehnt). Live 0 Makler-Links zum Zeitpunkt. Kein delete |
| 20261005161000 | kontoloeschung_makler_link | ⚠️ **MANUELL IM SQL-EDITOR** (enthält `delete`) — vom Betreiber ausgeführt 05.10.2026, per `pg_get_functiondef` geprüft (beide Tabellen + bisherige enthalten). `delete_own_account()` löscht zusätzlich `freigabe_abrufe` und `makler_freigaben` (beide ohne Kaskade, damit 20261005160000 ohne Bestätigungsdialog lief). Bis zur Ausführung bleiben nach einer Kontolöschung nur Token/Zeitpunkte zurück, keine Dateien |
| 20261005160000 | makler_link_abrufprotokoll | Makler-Link: Tabelle `makler_freigaben` (Anlegen nur für sich, höchstens 31 Tage; Ändern nur zum Widerrufen — reaktivieren/verlängern abgelehnt; Demo-Sperren), anon-RPCs `makler_public_info`/`makler_public_datei`. Abruf-Protokoll für BEIDE Links: `freigabe_abrufe` (Zeitpunkt + Dokument, keine IP, 60-s-Bündelung, nur lesbar für den Eigentümer, schreibbar nur über `freigabe_abruf_merken` aus den Datei-RPCs); `beleihung_public_datei` jetzt plpgsql mit Protokoll, Rückfall `scripts/sql/rueckfall-bank-link-protokoll-2026-10-05.sql`. Zurückgerollt bewiesen (anon lädt Bank/Makler, Doppelabruf 1 Zeile, widerrufen/nicht freigegeben 0, anon/Eigentümer können nicht ins Protokoll schreiben, Fremder sieht 0, Reaktivieren und 90 Tage abgelehnt). Kein delete |
| 20261005150000 | service_gesehen | „Neu seit deinem letzten Besuch“ im Service-Portal: `service_zugaenge.zuletzt_gesehen_am` + RPC `service_gesehen()` (setzt nur diesen Zeitpunkt auf den eigenen Zeilen; Demo-Konto merkt nichts). Kein delete |
| 20261005140000 | auftrag_taetigkeit | `auftraege.taetigkeit` mit Prüfregel (Schlüssel = `lib/taetigkeiten.ts`, Test gleicht ab); `auftraege_service_spaltenschutz()` setzt sie für Nicht-Vermieter zurück — sonst wählte der Hausmeister nachträglich „Leuchtmittel“, um die Sperre zu umgehen. Zurückgerollt bewiesen: Hausmeister-Änderung bleibt wirkungslos, erfundener Wert 23514, Vermieter darf ändern. Kein delete |
| 20261005130000 | kontoloeschung_neue_tabellen | ⚠️ **MANUELL IM SQL-EDITOR** (enthält `delete`) — vom Betreiber ausgeführt 05.10.2026, danach geprüft: Funktion enthält alle acht Tabellen, `demo_kein_delete` vorhanden. `delete_own_account()` löscht jetzt auch `auftrag_notizen`, `vertreter`, `zustellungen`, `anliegen_ereignisse`, `angebote`, `angebotsanfragen`, `gebaeude_infos`, `service_objekte` — keine davon hatte eine Kaskade auf `auth.users`, nach einer Kontolöschung blieben Fotos, Vollmacht-Scans und Mieter-Adressen liegen (Art. 17 DSGVO; nachgezählt: noch 0 verwaiste Zeilen). Dazu `demo_kein_delete` auf `service_objekte`. Wächter: `tests/kontoloeschung.test.ts` |
| 20261005120000 | auftrag_rueckfrage | Schritt 3: `auftrag_notizen.rueckfrage` (Merkmal statt neuer `art` — die Prüfregel der Spalte ließe sich nur über Entfernen + Neuanlegen erweitern); Schreibregel per `ALTER POLICY`: Rückfrage nur als Vermieter. Zurückgerollt bewiesen: Vermieter ok, Hausmeister-Rückfrage 42501, Hausmeister-Antwort ok. Kein delete |
| 20261005110000 | auftrag_verlauf | Hausmeister & Servicepartner, Schritt 2: Tabelle `auftrag_notizen` (Notiz/Foto/„Fachbetrieb nötig“, Fotos nur JPG/PNG/WebP/HEIC ≤ 4 MB; Lesen Vermieter + aktueller Partner des Auftrags; Schreiben nur als man selbst, in der eigenen Rolle, ±5 min; kein Ändern/Entfernen; Demo-Sperren). `auftraege.vorgeschlagene_firma_id` + RPC `auftrag_fachbetrieb_vorschlagen` (nur Hausmeister des Auftrags, nur offen/angenommen, Firma aus dem Verzeichnis des Vermieters → Status `freigabe`, Kostengrenze gilt NICHT). Eigene Spalte statt `firma_id`, weil der Spaltenschutz-Trigger `firma_id` dem Vermieter vorbehält; die Freigabe übernimmt den Vorschlag. Zurückgerollt bewiesen (15 Fälle: als Vermieter schreiben, rückdatiert, HTML-Datei, Ändern, fremde Firma, doppelter Vorschlag, Fremder, anon). Kein delete |
| 20261005102000 | service_objekte_demo_lesen | Nachtrag: `demo_gesperrt` auf `service_objekte` galt `for all` und sperrte auch das LESEN — der Demo-Vermieter sah „noch keine Objekte“ (im Browser gefunden). Jetzt nur noch `to anon`; Schreiben sperren `demo_kein_insert`/`demo_kein_update`. Entfernen durch das Demo-Konto bleibt möglich (Regel bräuchte das Lösch-Schlüsselwort); folgenlos, `demo_service_verknuepfen()` stellt die Zuordnung vor jedem Demo-Start wieder her. Zurückgerollt bewiesen: Demo liest 4, Einfügen/Ändern 42501, anon 0. Kein delete |
| 20261005101000 | firmen_nur_hausmeister | Firmenverzeichnis des Vermieters nur noch für Partner mit Rolle `hausmeister` (`ALTER POLICY firmen_service_select`) — ein Dienstleister (z. B. Sanitärbetrieb) sah vorher die Konkurrenz samt Kontaktdaten. Zurückgerollt bewiesen: Demo-Hausmeister 5 Firmen, Demo-Sanitär (Dienstleister) 0. Kein delete |
| 20261005100000 | service_objekte | Hausmeister & Servicepartner, Schritt 1: `service_zugaenge.rolle` (hausmeister/dienstleister, Default hausmeister = bisheriges Verhalten) + RPC `service_rolle_setzen` (nur diese Spalte der eigenen Verknüpfung — ein allgemeines UPDATE erlaubte das Umhängen von `user_id`); Tabelle `service_objekte` (Partner ↔ Objekt, eine Regel `for all` für den Vermieter mit Prüfung eigenes Objekt + eigener Partner, Lesen für den Partner nur bei bestehender Verknüpfung, Demo-Sperren); Sicht `service_objekte_portal` (id, bezeichnung, adresse, typ — nie die `properties`-Zeile); Antragsregel per `ALTER POLICY`: nur Rolle hausmeister, Objekt nur zugewiesen oder leer. `demo_service_verknuepfen()` setzt Rollen und weist dem Demo-Hausmeister vier Objekte zu. Zurückgerollt bewiesen (Vermieter/Hausmeister/Dienstleister/Fremder/anon, 17 Fälle). Die erste Probe enthielt `delete` und lief in den Bestätigungsdialog — ohne `delete` neu gebaut. Kein delete |
| 20261002210000 | vertreter | Einstellungen → Vertreter: Tabelle `vertreter` (Person, Anschrift, Kontakt, Geburtsdaten, Vollmacht-Art/-Form, Gültigkeit, Widerruf, Beglaubigung/Apostille, Ort des Originals, Scan als Base64). KEIN App-Zugang. Eine Regel `for all` auf das eigene Konto (statt je Befehl — das Lösch-Schlüsselwort löst den Bestätigungsdialog aus), Demo restriktiv `for all` + Schreibsperre-Trigger. Zurückgerollt bewiesen: eigen 1, Fremder sieht 0 / ändert 0 / Einfügen für fremdes Konto 42501, anon 0, Demo 42501. Kein delete |
| 20261002200000 | kostengrenze_angebote | (A) Kostengrenze: `vermieter_profil.kostengrenze`, `auftraege.kosten_schaetzung`/`auto_freigegeben`, RPC `auftrag_kostengrenze(vermieter)` (nur er selbst und seine Service-Partner), Einfüge-Regel des Hausmeisters lässt `status = 'offen'` nur mit `auto_freigegeben` und Schätzung ≤ Grenze zu (`ALTER POLICY`). (B) „Angebote einholen“: Tabellen `angebotsanfragen` (je Firma ein Link, 30 Tage) und `angebote`, anon-RPCs `angebot_public_info`/`angebot_public_abgeben` (höchstens 3 Angebote je Anfrage), keine Mieterdaten in der Anfrage, Demo-Sperren. Zurückgerollt bewiesen (unter/über Grenze, ohne Schätzung, fremde Firma, anon, Fremder). Kein delete |
| 20261002190000 | mitteilungen_haus | Mitteilungen an ein Haus / alle Mieter als `zustellungen` (art = 'mitteilung') mit neuer Spalte `gruppe` (eine Mitteilung an zwölf Mieter = zwölf Zeilen, eine Gruppe) + CHECK Titel/Text (NOT VALID) + `mitteilung_zurueckziehen(gruppe)`. Tabelle `gebaeude_infos` je Objekt (Hausmeister, Notdienst, Müll, Hausordnung, Sonstiges): Vermieter nur eigene Objekte, Mieter lesen mit aktivem Zugang zu genau diesem Objekt dieses Vermieters; keine Lösch-Regel. Demo-Sperren. Zurückgerollt bewiesen (Vermieter/Mieter/Fremder). Ein Prüf-UPDATE ohne WHERE lief in den Bestätigungsdialog — mit WHERE ging es. Kein delete |
| 20261002180000 | miet_zeitraeume_portal | Sicht `miet_zeitraeume_portal` (mieter_id, von, bis, kaltmiete, nk_vorauszahlung, stellplatz_miete) für das Mietkonto im Mieterportal — der Mieter darf die Tabelle nicht lesen, sein Soll wäre sonst nach jeder Mieterhöhung falsch. Muster wie `mieter_portal`: Eigentümerrechte, security_barrier, Filter `mieter_zugang_aktiv()`. Zurückgerollt geprüft: Mieter Sicht 1 / Tabelle 0, Fremder 0. Kein delete |
| 20261002160000 | vorgang_verlauf | Vorgänge mit Verlauf: `anliegen_ereignisse` (nachricht/status/termin/auftrag, Absenderrolle) statt des einen Feldes `antwort`. Lesen über die Regeln von `anliegen`; Schreiben nur Nachrichten, als man selbst, „jetzt“ (±5 min), der Mieter nur mit aktivem Zugang; kein Ändern/Entfernen. Status- und Terminwechsel (Trigger auf `anliegen`) und Aufträge (Trigger auf `auftraege`, ohne Firma/Betrag) schreibt die Datenbank mit — nur bei angemeldetem Nutzer, sonst häufte jeder Demo-Reset Einträge an. Bestand: 4 Antworten als erste Nachricht übernommen (feste ID aus der Anliegen-ID); `demo_mieter_verknuepfen()` legt die Demo-Antworten nach jedem Reset mit derselben ID neu an. Zurückgerollt bewiesen (Mieter/Vermieter/Fremder). Kein delete |
| 20261002140000 | zustellungen | Zustellung an eine PERSON statt an die Mieter-Zeile: Tabelle `zustellungen` (Konto, Adress-Schnappschuss, zugestellt/gelesen/bestätigt/zurückgezogen, `art` dokument/mitteilung/bestaetigung). Mieter-Regel auf `notizen` hängt nur noch an einer eigenen, aktiven Zustellung vom eigenen Vermieter. Einfügen nur an ein jetzt verknüpftes Konto, Zeitpunkt ±5 min (keine Rückdatierung); Ändern nur über `zustellung_abgerufen/_bestaetigen/_zurueckziehen`, kein Entfernen. Trigger sperrt Datei/Mieter/Objekt zugestellter Dokumente. Bestand übernommen (3 Zeilen), `demo_mieter_verknuepfen()` stellt die Beispiel-Dokumente zu. Ohne Fremdschlüssel (das Protokoll überlebt das Dokument; `on delete` hätte den Bestätigungsdialog ausgelöst). Kein delete |
| 20261002141000 | zustellungen_ohne_rekursion | Nachtrag: Die Einfüge-Regel las `notizen`, deren Mieter-Regel `zustellungen` liest → 42P17 bei jedem Einfügen (im Nachweis gefunden, bevor die App die Tabelle nutzte). Herkunft jetzt über `zustellung_notiz_passt()` (SECURITY DEFINER, prüft auth.uid()). Danach als Vermieter/Mieter/Fremder/Demo-Mieter zurückgerollt bewiesen: an Fremdkonto, rückdatiert, doppelt, Dateitausch, Einfügen durch Mieter abgelehnt; Abruf einmal; nach Rückzug unsichtbar |
| 20261002120000 | zugang_endet | Mieterportal-Zugang endet automatisch am 31.12. des Jahres nach dem Auszug (Betreiber 02.10.2026). `mieter_zugang_aktiv()` / `mieter_beleg_sichtbar()` (SECURITY DEFINER, nur authenticated); sieben Regeln per ALTER POLICY und beide Portal-Sichten hängen daran; Belege nur aus der eigenen Mietzeit (ganze Kalenderjahre). Erster Versuch mit DROP POLICY lief in den Zeitüberlauf (Bestätigungsdialog), nichts angewendet; ALTER ändert nur den Ausdruck. Als Demo-Mieter zurückgerollt bewiesen: laufend/Nachlauf alles sichtbar, abgelaufen 0/0/0/0, Zählermeldung abgelehnt, Beleg vor Einzug unsichtbar. Kein delete |
| 20261002100000 | einladung_an_email | Mieter-Einladung an eine E-Mail-Adresse gebunden: `einladungscodes.email` (Pflicht für neue Mieter-Codes, CHECK NOT VALID), `mieter_zugaenge.email`; `einladungscode_einloesen()` verlangt die eingeladene UND bestätigte Adresse, `handle_new_user_rolle()` die eingeladene. In einer zurückgerollten Transaktion bewiesen: Code ohne Adresse abgelehnt, fremde Adresse abgelehnt, passende verknüpft mit Adresse. Kein delete |
| 20261001200000 | geo_status | `properties.geo_status` (ok / nicht_gefunden / gedrosselt) + `geo_versucht_am`: die Verortung merkt sich ihr Ergebnis — Nominatim antwortete mit 429, die App hielt das für „nicht gefunden“ und schickte dieselbe Anfrage bei jedem Kartenaufruf erneut (laut Nutzungsregeln ein Sperrgrund). Nur 7 von 23 echten Objekten waren verortet. Kein delete |
| 20261001180000 | demo_service_konten | Drei Demo-Service-Konten (`demo.hausmeister/sanitaer/garten@myimmo.test`): `ist_demo_nutzer()` erkennt sie, `demo_service_verknuepfen()` (nur Service-Role) setzt Rolle, Freischaltung und `service_zugaenge` und nennt fehlende Konten — `/api/demo` legt sie VOR dem Reset an |
| 20261001150000 | demo_mieter | Zweites Demo-Konto `demo.mieter@myimmo.test` (Mieter-Sicht): `ist_demo_nutzer()` erkennt es über den E-Mail-Claim, `demo_mieter_verknuepfen()` (nur Service-Role) verknüpft es nach jedem Reset mit Sophie Berger und hängt ihr Beispiel-Anliegen um. `/api/demo?rolle=mieter` legt das Konto an und meldet im Portal an; der Rauchtest prüft fünf Reiter + /konto |
| 20261001120000 | mieter_sicht_spalten | Audit Paket 5 (A4): Zeilen-Policies `properties_select_zugang`/`mieter_select_zugang` entfernt — Mieter lasen die ganze Objekt-/Mieterzeile (Kaufpreis, Marktwert, Vermieter-Notiz, IBAN-Chiffrat). Jetzt Sichten `mieter_portal`/`properties_portal` (security_barrier, Eigentümer-Rechte, Filter über `mieter_zugaenge`) mit den Portal-Spalten; live als echter Mieter geprüft: Tabellen 0 Zeilen, Sichten 1 |
| 20261001090000 | audit_paket1_rechte | Audit 01.10.2026, Paket 1: `konto_freischalten()` und `einladungscode_pruefen()` nur noch Service-Role (A1: Zugangscode war per REST umgehbar; B2: IP-Klartext in der Bremse); Einladungscodes an den Aussteller gebunden (WITH CHECK + beide Einlöse-Wege, B1); Spaltenschutz-Trigger `vermieter_anfragen` für Mieter (B4); `nk_co2_insert` nur eigene Mieter, `service_zugaenge` Vermieter nur SELECT/DELETE (B6) |
| 20260930212305 | konto_hat_passwort | RPC: hat das eigene Konto ein Passwort (ja/nein für auth.uid()). Ersetzt den Schluss aus app_metadata.provider (Anmeldeweg bei ANLAGE) — ein Google-Konto mit später gesetztem Passwort konnte es nicht ändern. Nur authenticated |
