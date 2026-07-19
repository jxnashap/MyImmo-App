-- Selbstauskunft / Haushaltsrechnung für den Finanzierungs-Assistenten.
-- Eine Zeile je Nutzer. Alle sensiblen Angaben (Einkommen, Vermögen,
-- Verbindlichkeiten) liegen ausschließlich als App-Layer-verschlüsselter
-- JSON-Blob (daten_enc) vor — der Schlüssel (DATA_ENCRYPTION_KEY) liegt
-- außerhalb der DB. Die DB sieht nur Chiffretext.
create table if not exists public.selbstauskunft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daten_enc text,
  updated_at timestamptz not null default now(),
  constraint selbstauskunft_user_unique unique (user_id)
);

alter table public.selbstauskunft enable row level security;

create policy "selbstauskunft_select_own" on public.selbstauskunft
  for select using (auth.uid() = user_id);
create policy "selbstauskunft_insert_own" on public.selbstauskunft
  for insert with check (auth.uid() = user_id);
create policy "selbstauskunft_update_own" on public.selbstauskunft
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "selbstauskunft_delete_own" on public.selbstauskunft
  for delete using (auth.uid() = user_id);
