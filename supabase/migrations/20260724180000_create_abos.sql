-- Bezahlsystem (Paddle als Merchant of Record): ein Abo-Datensatz je Nutzer.
-- GEBAUT, ABER INAKTIV — durchgesetzt wird erst mit Env BILLING_ENFORCED=true
-- (Early Access: alles kostenlos). Geschrieben wird die Tabelle ausschließlich
-- serverseitig über den Paddle-Webhook (Service-Role); Nutzer dürfen nur lesen.

create table public.abos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'kostenlos'
    check (plan in ('kostenlos', 'privat', 'plus', 'business')),
  status text not null default 'aktiv'
    check (status in ('aktiv', 'testphase', 'ueberfaellig', 'pausiert', 'gekuendigt')),
  zyklus text check (zyklus in ('monat', 'jahr')),
  banking_addon boolean not null default false,
  provider text not null default 'paddle',
  provider_customer_id text,
  provider_subscription_id text,
  gueltig_bis timestamptz,      -- Ende der bezahlten Periode (Paddle billing period)
  storniert_zum timestamptz,    -- geplante Kündigung (scheduled_change: cancel)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.abos enable row level security;

-- Nur Lesen für den eigenen Datensatz; KEINE insert/update/delete-Policies —
-- Schreibzugriff hat allein die Service-Role (Webhook), die RLS umgeht.
create policy "abos_select_own" on public.abos
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Webhook-Lookups über die Paddle-Subscription-ID.
create index abos_provider_subscription_idx
  on public.abos (provider_subscription_id);
