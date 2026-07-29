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
