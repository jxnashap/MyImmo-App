-- Makler-Link + Abruf-Protokoll (05.10.2026, Wunsch des Betreibers).
--
-- (A) Freigabe-Link für den Makler — Gegenstück zum Bank-Link (`beleihung_freigaben`):
--     Token-Link auf ausgewählte Dokumente des Makler-Ordners, Ablauf 7/14/30 Tage, widerrufbar.
--     Lesen nur über die beiden SECURITY-DEFINER-Funktionen unten, die Token, `aktiv` und Ablauf
--     prüfen — nie über die Tabelle selbst.
-- (B) Abruf-Protokoll für BEIDE Links: Jeder Datei-Abruf über einen Bank- oder Makler-Link
--     schreibt eine Zeile (Zeitpunkt, Dokument). Bis heute sah der Vermieter nicht, ob und wie oft
--     z. B. sein Ausweis heruntergeladen wurde. Bewusst KEINE IP (Datensparsamkeit; die Zeile
--     soll „wann, was“ belegen, nicht „wer“). Gleicher Link + gleiches Dokument innerhalb von
--     60 Sekunden zählt einmal (Doppelklick, Vorschau + Download), sonst füllt ein Skript mit dem
--     Token die Tabelle.
--
-- Kein Lösch- und kein Entfern-Schlüsselwort in dieser Datei (Bestätigungsdialog der
-- Schnittstelle). Die Kontolöschung für die zwei neuen Tabellen steht deshalb in
-- 20261005161000_kontoloeschung_makler_link.sql — MANUELL im SQL-Editor auszuführen.
-- Bis dahin bleiben nach einer Kontolöschung höchstens Token/Zeitpunkte zurück, keine Dateien:
-- die Dokumente selbst hängen per Kaskade an `makler_dokumente` bzw. `beleihung_dokumente`.

create table if not exists public.makler_freigaben (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_keys text[] not null check (cardinality(item_keys) between 1 and 10),
  ablauf timestamptz not null,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists makler_freigaben_user on public.makler_freigaben (user_id, created_at desc);
alter table public.makler_freigaben enable row level security;

create policy makler_freigaben_lesen on public.makler_freigaben
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Anlegen nur für sich selbst und höchstens 31 Tage in die Zukunft (die App bietet 7/14/30).
create policy makler_freigaben_anlegen on public.makler_freigaben
  for insert to authenticated
  with check (user_id = (select auth.uid()) and ablauf > now() and ablauf <= now() + interval '31 days');
-- Ändern = Widerrufen. Wieder AKTIV setzen oder den Ablauf verlängern geht nicht.
create policy makler_freigaben_widerrufen on public.makler_freigaben
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and aktiv = false);

create policy demo_kein_insert on public.makler_freigaben
  as restrictive for insert to authenticated
  with check (not public.ist_demo_nutzer());
create policy demo_kein_update on public.makler_freigaben
  as restrictive for update to authenticated
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.makler_freigaben
  for each statement execute function public.demo_schreibsperre();

create table if not exists public.freigabe_abrufe (
  id uuid primary key default gen_random_uuid(),
  art text not null check (art in ('bank', 'makler')),
  token uuid not null,
  user_id uuid not null,            -- Eigentümer des Links (nicht der Abrufende)
  item_key text not null,
  abgerufen_am timestamptz not null default now()
);
create index if not exists freigabe_abrufe_token on public.freigabe_abrufe (token, abgerufen_am desc);
alter table public.freigabe_abrufe enable row level security;

-- Nur lesen, nur die eigenen. Geschrieben wird ausschließlich von den Datei-Funktionen unten
-- (SECURITY DEFINER) — es gibt bewusst keine Schreib-Policy, auch nicht für den Eigentümer:
-- ein Protokoll, das man selbst bearbeiten kann, belegt nichts.
create policy freigabe_abrufe_lesen on public.freigabe_abrufe
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Protokoll-Eintrag mit 60-Sekunden-Bündelung. Intern, nicht aufrufbar.
create or replace function public.freigabe_abruf_merken(p_art text, p_token uuid, p_user uuid, p_item text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if exists (select 1 from public.freigabe_abrufe
              where token = p_token and item_key = p_item
                and abgerufen_am > now() - interval '60 seconds') then
    return;
  end if;
  insert into public.freigabe_abrufe (art, token, user_id, item_key)
  values (p_art, p_token, p_user, p_item);
end $$;
revoke all on function public.freigabe_abruf_merken(text, uuid, uuid, text) from public, anon, authenticated;

-- Öffentliche Makler-Seite: wer teilt, bis wann, welche Dokumente (ohne Inhalt).
create or replace function public.makler_public_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  f record;
  v_name text;
  dokliste jsonb;
begin
  select * into f from public.makler_freigaben
   where token = p_token and aktiv and ablauf > now();
  if not found then return null; end if;

  select name into v_name from public.vermieter_profil where user_id = f.user_id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_key', d.item_key, 'datei_name', d.datei_name,
           'datei_type', d.datei_type, 'datei_size', d.datei_size)
           order by array_position(f.item_keys, d.item_key)), '[]'::jsonb)
    into dokliste
    from public.makler_dokumente d
   where d.user_id = f.user_id and d.item_key = any(f.item_keys) and d.datei_data is not null;

  return jsonb_build_object('name', v_name, 'ablauf', f.ablauf, 'dokumente', dokliste);
end $$;
revoke all on function public.makler_public_info(uuid) from public;
grant execute on function public.makler_public_info(uuid) to anon, authenticated;

-- Öffentliche Datei eines Makler-Links — und Protokoll.
create or replace function public.makler_public_datei(p_token uuid, p_item_key text)
returns table(datei_name text, datei_type text, datei_data text)
language plpgsql
security definer
set search_path to ''
as $$
declare f record; d record;
begin
  select * into f from public.makler_freigaben
   where token = p_token and aktiv and ablauf > now() and p_item_key = any(item_keys);
  if not found then return; end if;
  select m.datei_name, m.datei_type, m.datei_data into d
    from public.makler_dokumente m
   where m.user_id = f.user_id and m.item_key = p_item_key and m.datei_data is not null;
  if not found then return; end if;
  perform public.freigabe_abruf_merken('makler', p_token, f.user_id, p_item_key);
  datei_name := d.datei_name; datei_type := d.datei_type; datei_data := d.datei_data;
  return next;
end $$;
revoke all on function public.makler_public_datei(uuid, text) from public;
grant execute on function public.makler_public_datei(uuid, text) to anon, authenticated;

-- Bank-Link: dieselbe Abfrage wie bisher (Baseline), jetzt mit Protokoll. Rückgabetyp unverändert.
create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text)
returns table(datei_name text, datei_type text, datei_data text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare f record; d record;
begin
  select * into f from public.beleihung_freigaben
   where token = p_token and aktiv and ablauf > now() and p_item_key = any(item_keys);
  if not found then return; end if;
  select b.datei_name, b.datei_type, b.datei_data into d
    from public.beleihung_dokumente b
   where b.prop_id = f.prop_id and b.user_id = f.user_id and b.item_key = p_item_key
     and b.datei_data is not null
   limit 1;
  if not found then return; end if;
  perform public.freigabe_abruf_merken('bank', p_token, f.user_id, p_item_key);
  datei_name := d.datei_name; datei_type := d.datei_type; datei_data := d.datei_data;
  return next;
end $$;
revoke all on function public.beleihung_public_datei(uuid, text) from public;
grant execute on function public.beleihung_public_datei(uuid, text) to anon, authenticated;
