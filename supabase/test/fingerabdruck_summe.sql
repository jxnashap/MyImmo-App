-- Fingerabdruck des Schemas public — dieselbe Abfrage lokal und in der Produktion (nur lesend).
-- Eine Zeile je Objekt: art | name | md5. Vergleich mit `diff` (scripts/db/vergleich.sh).
with
spalten as (
  select 'tabelle' art, c.table_name::text name,
         md5(string_agg(c.column_name||':'||c.data_type||':'||coalesce(c.column_default,'')||':'||c.is_nullable, '|' order by c.column_name)) h
  from information_schema.columns c where c.table_schema='public' group by c.table_name),
funktionen as (
  select 'funktion', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
         md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
funktionsrechte as (
  select 'ausfuehren', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
         md5(coalesce((select string_agg(r, ',' order by r) from unnest(string_to_array(trim(both '{}' from coalesce(p.proacl::text,'')), ',')) r
                       where r ~ '^(=|anon=|authenticated=|service_role=)'), 'standard'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
policies as (
  select 'policy', tablename||'.'||policyname,
         md5(permissive||cmd||array_to_string(roles, ',')||coalesce(regexp_replace(qual,'\s+',' ','g'),'')||coalesce(regexp_replace(with_check,'\s+',' ','g'),''))
  from pg_policies where schemaname='public'),
rls as (
  select 'rls', c.relname::text, md5(c.relrowsecurity::text||c.relforcerowsecurity::text)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
rechte as (
  select 'rechte', table_name::text, md5(string_agg(grantee||':'||privilege_type, ',' order by grantee, privilege_type))
  from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') group by table_name),
trigger as (
  select 'trigger', c.relname||'.'||t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and n.nspname in ('public','auth')),
sichten as (
  select 'sicht', viewname::text, md5(regexp_replace(definition,'\s+',' ','g')) from pg_views where schemaname='public'),
indizes as (
  select 'index', indexname::text, md5(indexdef) from pg_indexes where schemaname='public')
select split_part(zeile,' | ',1) art, count(*) n, md5(string_agg(zeile, E'\n' order by zeile)) h from (
select art||' | '||name||' | '||h as zeile from (
  select * from spalten union all select * from funktionen union all select * from funktionsrechte union all
  select * from policies union all select * from rls union all select * from rechte union all
  select * from trigger union all select * from sichten union all select * from indizes) x

) z group by 1 order by 1;
