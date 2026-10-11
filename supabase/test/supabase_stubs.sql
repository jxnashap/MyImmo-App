-- =============================================================================
-- Nachbildung der Supabase-Umgebung für eine LOKALE Test-Datenbank (11.10.2026)
-- =============================================================================
--
-- Zweck: Migrationen und RLS-Regeln gegen ein leeres PostgreSQL prüfen, ohne
-- Produktion oder gemeinsam genutzte Testprojekte zu berühren (Auftrag B18 und die
-- Gegenproben zu B01–B04). Geladen von scripts/db/testdb.sh VOR der Baseline.
--
-- NUR das, was die Migrationen voraussetzen — keine vollständige Supabase:
--   · Rollen anon / authenticated / service_role (service_role umgeht RLS wie bei Supabase)
--   · auth.users mit den Spalten, die Migrationen und Funktionen lesen; auth.mfa_factors
--   · auth.uid() / auth.jwt() / auth.role() lesen `request.jwt.claims` — wie PostgREST sie
--     je Anfrage setzt. Tests setzen sie mit `set local request.jwt.claims = '{…}'`.
--   · storage.buckets / storage.objects für Datei-Regeln
--   · Standard-Rechte im Schema public wie bei Supabase (alles an anon/authenticated/service_role,
--     die Sperren machen RLS und gezielte REVOKEs)
--
-- GRENZE: Das ist KEIN GoTrue. Anmeldung, Faktoren-Prüfung und Token-Ausstellung gibt es hier
-- nicht; ein Test setzt die Claims selbst. Was nur der Auth-Server prüft (TOTP, aal-Vergabe),
-- belegt diese Datenbank nicht.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin; end if;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friendly_name text,
  factor_type text not null default 'totp',
  status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role(), auth.email() to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant all on storage.buckets, storage.objects to authenticated, service_role;

-- Supabase-Standard: neue Objekte in public gehören allen drei API-Rollen; die Sperren setzen
-- RLS und gezielte REVOKEs in den Migrationen.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
