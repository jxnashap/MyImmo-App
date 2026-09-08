-- Wiederherstellungscodes für die Zwei-Faktor-Anmeldung (08.09.2026).
-- Supabase-MFA (TOTP) bringt keine mit; ohne sie sperrt ein verlorenes Handy
-- das Konto dauerhaft aus. Es liegt nur der SHA-256-Hash; Einlösen läuft über
-- lib/actions/mfa.ts (markiert verbraucht, entfernt den Faktor per Service-Role).
-- Ausgeführt am 08.09.2026 (apply_migration).

create table if not exists public.mfa_wiederherstellung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  verbraucht_am timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
create index if not exists mfa_wiederherstellung_user_idx on public.mfa_wiederherstellung (user_id);
comment on table public.mfa_wiederherstellung is
  'Wiederherstellungscodes (nur Hash) für 2FA. Einlösen über lib/actions/mfa.ts; entfernt den TOTP-Faktor.';

alter table public.mfa_wiederherstellung enable row level security;

drop policy if exists own_mfa_wiederherstellung on public.mfa_wiederherstellung;
create policy own_mfa_wiederherstellung on public.mfa_wiederherstellung
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Demo-Konto: Nur-Lesen wie überall (Migration 20260830150000 greift für neue
-- Tabellen nicht automatisch — deshalb hier ausdrücklich).
drop policy if exists demo_kein_insert on public.mfa_wiederherstellung;
create policy demo_kein_insert on public.mfa_wiederherstellung as restrictive for insert to authenticated
  with check (not public.ist_demo_nutzer());
drop policy if exists demo_kein_update on public.mfa_wiederherstellung;
create policy demo_kein_update on public.mfa_wiederherstellung as restrictive for update to authenticated
  using (not public.ist_demo_nutzer()) with check (not public.ist_demo_nutzer());
drop policy if exists demo_kein_delete on public.mfa_wiederherstellung;
create policy demo_kein_delete on public.mfa_wiederherstellung as restrictive for delete to authenticated
  using (not public.ist_demo_nutzer());
