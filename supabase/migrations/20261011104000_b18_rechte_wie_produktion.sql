-- ⚠️ MANUELL IM SUPABASE-SQL-EDITOR AUSFÜHREN — enthält ein Entfern-Schlüsselwort (Funktion). In der
-- Produktion ist diese Datei ein No-op: Dort sind die Rechte bereits so (live verglichen 11.10.2026),
-- und die parameterlose demo_zuruecksetzen() existiert nicht mehr.
--
-- B18 – Reproduzierbare Datenbank (11.10.2026). Ein Abgleich „Repo-Migrationen auf leerer
-- PostgreSQL 16“ gegen die Produktion (scripts/db/testdb.sh + supabase/test/fingerabdruck*.sql,
-- nur lesend) ergab: Tabellen, Regeln, Tabellenrechte, RLS, Trigger, Sichten, Indizes und alle
-- Funktionsrümpfe sind gleich. Abweichend waren NUR Ausführungsrechte — die Produktion war an fünf
-- Stellen STRENGER als das, was die Migrationsdateien ergeben (dort per SQL-Editor ohne Datei
-- entzogen). Diese Datei zieht das Repo nach, damit eine neu aufgebaute Datenbank nicht offener ist
-- als die laufende:
--   · auftrag_public_info / bewerber_link_info / bewerbung_einreichen: PUBLIC entzogen
--     (anon + authenticated behalten das Recht — öffentliche Token-Funktionen),
--   · demo_zuruecksetzen(date): nur Service-Role (lokal war sie für JEDEN ausführbar),
--   · parameterlose demo_zuruecksetzen(): gibt es in der Produktion nicht mehr.
-- delete_own_account() regelt 20261011103000 (B02).

revoke execute on function public.auftrag_public_info(uuid) from public;
revoke execute on function public.bewerber_link_info(uuid) from public;
revoke execute on function public.bewerbung_einreichen(uuid, jsonb) from public;
revoke all on function public.demo_zuruecksetzen(date) from public, anon, authenticated;
drop function if exists public.demo_zuruecksetzen();
