-- Makler-Ordner: Käufer-Dokumente (Finanzierungsbestätigung, Eigenkapital,
-- Selbstauskunft, SCHUFA, Einkommen, Ausweis). Nicht objektabhängig, deshalb
-- pro Nutzer (unique user_id + item_key). Datei als base64-Data-URI inline,
-- wie beleihung_dokumente. Zugriff strikt eigentümergebunden (RLS).
create table if not exists public.makler_dokumente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  status text not null default 'offen',
  notiz text,
  datum date,
  datei_name text,
  datei_type text,
  datei_size integer,
  datei_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_key)
);

alter table public.makler_dokumente enable row level security;

drop policy if exists "makler_dokumente_own" on public.makler_dokumente;
create policy "makler_dokumente_own"
  on public.makler_dokumente
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
