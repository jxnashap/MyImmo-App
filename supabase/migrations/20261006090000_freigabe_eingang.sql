-- Rücklauf über Bank- und Makler-Link (06.10.2026, Wunsch des Betreibers: „der Makler oder die
-- Bank muss auch Dokumente zurückschicken können“).
--
-- Bisher konnte die Bank nur Text zurückmelden, der Makler gar nichts. Jetzt können beide über
-- ihren Link (nur nach dem Zugangscode, also mit dem Hash aus 20261005170000/180000) Dateien
-- hochladen. Sie landen in einem EINGANG des Eigentümers — nicht direkt im Archiv: Fremde ohne
-- Konto legen hier zum ersten Mal Dateien in ein Konto. Der Eigentümer übernimmt sie bewusst ins
-- Archiv oder verwirft sie; in beiden Fällen wird die Datei im Eingang geleert.
--
-- Schranken in der Datenbank (die App prüft zusätzlich Dateikopf und Größe):
--   * nur PDF, JPEG, PNG, WebP; höchstens 8 MB je Datei;
--   * je Link höchstens 10 Dateien pro Stunde, 30 insgesamt, 80 MB insgesamt;
--   * nur mit gültigem Link (aktiv, nicht abgelaufen) UND passendem Code-Hash.
--
-- Kein Lösch- und kein Entfern-Schlüsselwort in dieser Datei (Bestätigungsdialog der
-- Schnittstelle). Die Kontolöschung steht in 20261006091000 — MANUELL im SQL-Editor.

create table if not exists public.freigabe_eingang (
  id uuid primary key default gen_random_uuid(),
  art text not null check (art in ('bank', 'makler')),
  token uuid not null,
  user_id uuid not null,               -- Eigentümer des Links
  absender text check (absender is null or char_length(absender) <= 200),
  nachricht text check (nachricht is null or char_length(nachricht) <= 2000),
  datei_name text not null check (char_length(datei_name) between 1 and 200),
  datei_type text not null check (datei_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  datei_size integer not null check (datei_size > 0 and datei_size <= 8388608),
  datei_data text,                     -- data:…;base64,…  — geleert nach der Entscheidung
  status text not null default 'neu' check (status in ('neu', 'uebernommen', 'verworfen')),
  notiz_id uuid,                       -- Archiv-Eintrag nach der Übernahme
  created_at timestamptz not null default now(),
  entschieden_am timestamptz
);
create index if not exists freigabe_eingang_user on public.freigabe_eingang (user_id, created_at desc);
create index if not exists freigabe_eingang_token on public.freigabe_eingang (token, created_at desc);
alter table public.freigabe_eingang enable row level security;

create policy freigabe_eingang_lesen on public.freigabe_eingang
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Ändern heißt nur: entscheiden. Danach ist die Datei im Eingang leer; zurück auf „neu“ geht nicht.
create policy freigabe_eingang_entscheiden on public.freigabe_eingang
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'neu')
  with check (user_id = (select auth.uid()) and status in ('uebernommen', 'verworfen') and datei_data is null);
-- Bewusst KEINE Insert-Policy: geschrieben wird nur von freigabe_public_hochladen (SECURITY DEFINER).

create policy demo_kein_update on public.freigabe_eingang
  as restrictive for update to authenticated
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.freigabe_eingang
  for each statement execute function public.demo_schreibsperre();

-- Hochladen über den Link. Antwort: 'ok' | 'ungueltig' (Link/Code) | 'limit' | 'format'.
create or replace function public.freigabe_public_hochladen(
  p_art text, p_token uuid, p_code_hash text,
  p_absender text, p_nachricht text,
  p_datei_name text, p_datei_type text, p_datei_size integer, p_datei_data text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid;
  n_stunde int;
  n_gesamt int;
  v_bytes bigint;
begin
  if p_code_hash is null or char_length(p_code_hash) <> 64 then return 'ungueltig'; end if;
  if p_art = 'bank' then
    select user_id into v_user from public.beleihung_freigaben
     where token = p_token and aktiv and ablauf > now() and code_hash = p_code_hash;
  elsif p_art = 'makler' then
    select user_id into v_user from public.makler_freigaben
     where token = p_token and aktiv and ablauf > now() and code_hash = p_code_hash;
  else
    return 'ungueltig';
  end if;
  if v_user is null then return 'ungueltig'; end if;

  if p_datei_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
     or p_datei_size is null or p_datei_size <= 0 or p_datei_size > 8388608
     or p_datei_data is null
     or p_datei_data not like ('data:' || p_datei_type || ';base64,%')
     or char_length(p_datei_data) > 11300000 then
    return 'format';
  end if;

  perform pg_advisory_xact_lock(hashtext('freigabe_eingang:' || p_token::text));
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*),
         coalesce(sum(datei_size), 0)
    into n_stunde, n_gesamt, v_bytes
    from public.freigabe_eingang where token = p_token;
  if n_stunde >= 10 or n_gesamt >= 30 or v_bytes + p_datei_size > 83886080 then
    return 'limit';
  end if;

  insert into public.freigabe_eingang
    (art, token, user_id, absender, nachricht, datei_name, datei_type, datei_size, datei_data)
  values
    (p_art, p_token, v_user,
     nullif(left(trim(coalesce(p_absender, '')), 200), ''),
     nullif(left(trim(coalesce(p_nachricht, '')), 2000), ''),
     left(coalesce(nullif(trim(p_datei_name), ''), 'Dokument'), 200),
     p_datei_type, p_datei_size, p_datei_data);
  return 'ok';
end $$;
revoke all on function public.freigabe_public_hochladen(text, uuid, text, text, text, text, text, integer, text) from public;
grant execute on function public.freigabe_public_hochladen(text, uuid, text, text, text, text, text, integer, text) to anon, authenticated;

-- Was über DIESEN Link schon geschickt wurde — für die Bestätigung auf der Link-Seite.
-- Nur Name, Größe, Zeitpunkt, Stand; nie die Datei.
create or replace function public.freigabe_public_eingang(p_art text, p_token uuid, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare ok boolean;
begin
  if p_art = 'bank' then
    select true into ok from public.beleihung_freigaben
     where token = p_token and aktiv and ablauf > now() and code_hash is not null and code_hash = p_code_hash;
  elsif p_art = 'makler' then
    select true into ok from public.makler_freigaben
     where token = p_token and aktiv and ablauf > now() and code_hash is not null and code_hash = p_code_hash;
  end if;
  if ok is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'datei_name', e.datei_name, 'datei_size', e.datei_size,
             'created_at', e.created_at, 'status', e.status) order by e.created_at desc)
      from public.freigabe_eingang e where e.token = p_token and e.art = p_art), '[]'::jsonb);
end $$;
revoke all on function public.freigabe_public_eingang(text, uuid, text) from public;
grant execute on function public.freigabe_public_eingang(text, uuid, text) to anon, authenticated;

-- Übernehmen ins Archiv: EIN Schritt (Archiv-Eintrag anlegen + Eingang leeren), damit ein
-- Fehler dazwischen keine doppelte Ablage erzeugt. Läuft als AUFRUFER — RLS und Demo-Sperre
-- gelten wie bei jedem anderen Schreiben des Eigentümers.
create or replace function public.freigabe_eingang_uebernehmen(p_id uuid, p_titel text, p_kategorie text)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $$
declare
  e record;
  v_prop uuid;
  v_id uuid;
  v_quelle text;
begin
  select * into e from public.freigabe_eingang
   where id = p_id and user_id = auth.uid() and status = 'neu' and datei_data is not null
   for update;
  if not found then return null; end if;

  if e.art = 'bank' then
    select prop_id into v_prop from public.beleihung_freigaben where token = e.token;
    v_quelle := 'Von der Bank';
  else
    v_quelle := 'Vom Makler';
  end if;

  insert into public.notizen (user_id, prop_id, titel, kategorie, inhalt,
                              datei_name, datei_type, datei_size, datei_data)
  values (e.user_id, v_prop,
          left(coalesce(nullif(trim(p_titel), ''), e.datei_name), 200),
          left(coalesce(nullif(trim(p_kategorie), ''), 'Sonstiges'), 100),
          v_quelle || ' über den Freigabe-Link, eingegangen am '
            || to_char(e.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
            || coalesce(' · ' || e.absender, '')
            || coalesce(E'\n' || e.nachricht, ''),
          e.datei_name, e.datei_type, e.datei_size, e.datei_data)
  returning id into v_id;

  update public.freigabe_eingang
     set status = 'uebernommen', notiz_id = v_id, datei_data = null, entschieden_am = now()
   where id = p_id;
  return v_id;
end $$;
revoke all on function public.freigabe_eingang_uebernehmen(uuid, text, text) from public, anon;
grant execute on function public.freigabe_eingang_uebernehmen(uuid, text, text) to authenticated;
