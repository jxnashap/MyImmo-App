-- Prüf-Helfer für Rollentests an der Datenbankgrenze (11.10.2026, Auftrag B01–B04, B18).
-- Liegt im eigenen Schema `pruef` — nie in `public`, nie in Produktion. Geladen von
-- scripts/db/testdb.sh nach den Migrationen.
--
-- Muster einer Testdatei (supabase/test/rls/*.sql):
--   begin;
--   select pruef.konto('a');                      -- synthetisches Konto, Kennung „a“
--   select pruef.als('a');                        -- ab hier: Rolle authenticated, JWT von „a“
--   … Abfrage …
--   select pruef.ja(<bedingung>, 'was geprüft wird');
--   select pruef.zurueck();                       -- wieder postgres (für Aufbau/Kontrolle)
--   rollback;                                     -- nichts bleibt liegen
--
-- `pruef.ja` wirft bei falscher Bedingung; scripts/db/rlstest.sh bricht dann mit Exit 1 ab.
-- `pruef.wirft(sql, text)` erwartet einen Fehler (z. B. permission denied, RLS-Verstoß).

create schema if not exists pruef;
grant usage on schema pruef to anon, authenticated, service_role;

create table if not exists pruef.konten (kennung text primary key, id uuid not null);
grant select on pruef.konten to anon, authenticated, service_role;

-- Legt ein Konto in auth.users an (E-Mail pruef-<kennung>@myimmo.test, bestätigt).
create or replace function pruef.konto(p_kennung text, p_meta jsonb default '{}'::jsonb) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
    values (v, 'pruef-' || p_kennung || '@myimmo.test', now(), p_meta, 'authenticated', 'authenticated');
  insert into pruef.konten values (p_kennung, v);
  return v;
end $$;

create or replace function pruef.id(p_kennung text) returns uuid language sql stable as $$
  select id from pruef.konten where kennung = p_kennung
$$;
grant execute on function pruef.id(text) to anon, authenticated, service_role;

-- Wechselt in die Rolle `authenticated` mit den Claims des Kontos.
-- p_aal: 'aal1' | 'aal2'; p_alter_s: Alter der letzten Anmeldung in Sekunden (amr-Zeitstempel).
create or replace function pruef.als(p_kennung text, p_aal text default 'aal1', p_alter_s int default 0) returns void
language plpgsql as $$
declare v uuid := pruef.id(p_kennung); ts bigint := extract(epoch from now())::bigint - p_alter_s;
begin
  if v is null then raise exception 'pruef.als: unbekanntes Konto %', p_kennung; end if;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v, 'role', 'authenticated', 'email', 'pruef-' || p_kennung || '@myimmo.test', 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', 'password', 'timestamp', ts)))::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pruef.als_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create or replace function pruef.als_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end $$;

create or replace function pruef.zurueck() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pruef.zurueck() to anon, authenticated, service_role;

create or replace function pruef.ja(p_bedingung boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_bedingung is not true then raise exception 'PRÜFUNG FEHLGESCHLAGEN: %', p_text; end if;
  raise notice 'ok  %', p_text;
end $$;
grant execute on function pruef.ja(boolean, text) to anon, authenticated, service_role;

-- Erwartet, dass p_sql einen Fehler wirft (in einem Unterblock, die Transaktion bleibt nutzbar).
create or replace function pruef.wirft(p_sql text, p_text text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok  % (Fehler: %)', p_text, sqlerrm;
    return;
  end;
  raise exception 'PRÜFUNG FEHLGESCHLAGEN (kein Fehler): %', p_text;
end $$;
grant execute on function pruef.wirft(text, text) to anon, authenticated, service_role;

-- Liefert die Zeilenzahl, die p_sql zurückgibt bzw. betrifft (für „0 Zeilen sichtbar“).
create or replace function pruef.zeilen(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;
grant execute on function pruef.zeilen(text) to anon, authenticated, service_role;

-- Wie viele Zeilen hat eine schreibende Anweisung (UPDATE/DELETE/INSERT) getroffen?
create or replace function pruef.betroffen(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function pruef.betroffen(text) to anon, authenticated, service_role;
