-- Termin über Bank- und Makler-Link (06.10.2026, Vorgabe des Betreibers: „Der Bankmitarbeiter soll
-- die Auswahl haben, ob er 1–3 Termine zur Auswahl gibt oder einfach seine Telefonnummer hinterlässt
-- und man telefonisch einen Termin abmacht.“)
--
-- Zwei Wege, eine Tabelle:
--   * modus 'termine'  — 1 bis 3 Zeitpunkte (in der Zukunft, höchstens 180 Tage), der Eigentümer
--                        wählt EINEN davon oder schreibt „keiner passt“ zurück;
--   * modus 'rueckruf' — Telefonnummer (Pflicht), der Eigentümer ruft an und trägt den vereinbarten
--                        Zeitpunkt selbst ein (oder markiert „erledigt“).
-- Bestätigen legt in EINEM Schritt einen Eintrag in `termine` an (Kalender des Eigentümers).
-- Nur mit gültigem Link UND Code-Hash. Je Link höchstens EIN offener Vorschlag und 10 insgesamt.
--
-- Kein Lösch- und kein Entfern-Schlüsselwort in dieser Datei (Bestätigungsdialog). Die
-- Kontolöschung steht in 20261006121000 — MANUELL im SQL-Editor; sie enthält auch
-- 20261006091000 (Eingang), die damit nicht mehr eigens laufen muss.

create table if not exists public.freigabe_termine (
  id uuid primary key default gen_random_uuid(),
  art text not null check (art in ('bank', 'makler')),
  token uuid not null,
  user_id uuid not null,
  modus text not null check (modus in ('termine', 'rueckruf')),
  vorschlaege timestamptz[] not null default '{}',
  ort text check (ort is null or char_length(ort) <= 200),
  name text check (name is null or char_length(name) <= 200),
  telefon text check (telefon is null or telefon ~ '^\+?[0-9 ()/-]{6,30}$'),
  nachricht text check (nachricht is null or char_length(nachricht) <= 1000),
  status text not null default 'offen' check (status in ('offen', 'bestaetigt', 'abgelehnt', 'erledigt')),
  gewaehlt timestamptz,
  antwort text check (antwort is null or char_length(antwort) <= 1000),
  termin_id uuid,
  created_at timestamptz not null default now(),
  entschieden_am timestamptz,
  check (cardinality(vorschlaege) <= 3),
  check (modus <> 'termine' or cardinality(vorschlaege) >= 1),
  check (modus <> 'rueckruf' or telefon is not null)
);
create index if not exists freigabe_termine_user on public.freigabe_termine (user_id, created_at desc);
create index if not exists freigabe_termine_token on public.freigabe_termine (token, created_at desc);
alter table public.freigabe_termine enable row level security;

create policy freigabe_termine_lesen on public.freigabe_termine
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Entscheiden: nur einmal (von 'offen' aus). Bei Terminwahl muss der Zeitpunkt einer der
-- Vorschläge sein; beim Rückruf trägt der Eigentümer den vereinbarten Zeitpunkt selbst ein.
create policy freigabe_termine_entscheiden on public.freigabe_termine
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'offen')
  with check (
    user_id = (select auth.uid())
    and status in ('bestaetigt', 'abgelehnt', 'erledigt')
    and (status <> 'bestaetigt' or (gewaehlt is not null and (modus = 'rueckruf' or gewaehlt = any(vorschlaege))))
  );

create policy demo_kein_update on public.freigabe_termine
  as restrictive for update to authenticated
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.freigabe_termine
  for each statement execute function public.demo_schreibsperre();

-- Vorschlag über den Link. Antwort: 'ok' | 'ungueltig' | 'offen' (es gibt schon einen offenen) |
-- 'limit' | 'format'.
create or replace function public.freigabe_public_termin(
  p_art text, p_token uuid, p_code_hash text, p_modus text,
  p_vorschlaege timestamptz[], p_ort text, p_name text, p_telefon text, p_nachricht text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid;
  n_offen int;
  n_gesamt int;
  v_tel text := nullif(trim(coalesce(p_telefon, '')), '');
  v_vor timestamptz[] := coalesce(p_vorschlaege, '{}');
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

  if p_modus = 'termine' then
    if cardinality(v_vor) not between 1 and 3 then return 'format'; end if;
    if exists (select 1 from unnest(v_vor) z where z <= now() or z > now() + interval '180 days') then
      return 'format';
    end if;
    if (select count(distinct z) from unnest(v_vor) z) <> cardinality(v_vor) then return 'format'; end if;
  elsif p_modus = 'rueckruf' then
    if v_tel is null or v_tel !~ '^\+?[0-9 ()/-]{6,30}$'
       or char_length(regexp_replace(v_tel, '[^0-9]', '', 'g')) < 6 then
      return 'format';
    end if;
    v_vor := '{}';
  else
    return 'format';
  end if;

  perform pg_advisory_xact_lock(hashtext('freigabe_termine:' || p_token::text));
  select count(*) filter (where status = 'offen'), count(*)
    into n_offen, n_gesamt
    from public.freigabe_termine where token = p_token;
  if n_offen > 0 then return 'offen'; end if;
  if n_gesamt >= 10 then return 'limit'; end if;

  insert into public.freigabe_termine (art, token, user_id, modus, vorschlaege, ort, name, telefon, nachricht)
  values (p_art, p_token, v_user, p_modus,
          (select coalesce(array_agg(z order by z), '{}') from unnest(v_vor) z),
          nullif(left(trim(coalesce(p_ort, '')), 200), ''),
          nullif(left(trim(coalesce(p_name, '')), 200), ''),
          v_tel,
          nullif(left(trim(coalesce(p_nachricht, '')), 1000), ''));
  return 'ok';
end $$;
revoke all on function public.freigabe_public_termin(text, uuid, text, text, timestamptz[], text, text, text, text) from public;
grant execute on function public.freigabe_public_termin(text, uuid, text, text, timestamptz[], text, text, text, text) to anon, authenticated;

-- Was über DIESEN Link vorgeschlagen wurde und wie der Eigentümer entschieden hat.
create or replace function public.freigabe_public_termine(p_art text, p_token uuid, p_code_hash text)
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
             'modus', t.modus, 'vorschlaege', t.vorschlaege, 'ort', t.ort, 'status', t.status,
             'gewaehlt', t.gewaehlt, 'antwort', t.antwort, 'created_at', t.created_at)
             order by t.created_at desc)
      from public.freigabe_termine t where t.token = p_token and t.art = p_art), '[]'::jsonb);
end $$;
revoke all on function public.freigabe_public_termine(text, uuid, text) from public;
grant execute on function public.freigabe_public_termine(text, uuid, text) to anon, authenticated;

-- Bestätigen: Status + Kalendereintrag in EINEM Schritt. Läuft als AUFRUFER (RLS + Demo-Sperre).
create or replace function public.freigabe_termin_bestaetigen(p_id uuid, p_zeit timestamptz, p_antwort text)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $$
declare
  t record;
  v_prop uuid;
  v_id uuid;
  v_wer text;
begin
  select * into t from public.freigabe_termine
   where id = p_id and user_id = auth.uid() and status = 'offen'
   for update;
  if not found then return null; end if;
  if p_zeit is null then return null; end if;
  if t.modus = 'termine' and not (p_zeit = any(t.vorschlaege)) then return null; end if;

  if t.art = 'bank' then
    select prop_id into v_prop from public.beleihung_freigaben where token = t.token;
    v_wer := 'Bank';
  else
    v_wer := 'Makler';
  end if;

  insert into public.termine (user_id, prop_id, titel, datum, kategorie, notiz)
  values (t.user_id, v_prop,
          left('Termin ' || v_wer || ' ' || to_char(p_zeit at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr'
               || coalesce(' · ' || t.name, ''), 200),
          (p_zeit at time zone 'Europe/Berlin')::date,
          case when t.art = 'bank' then 'Finanzierung' else 'Sonstiges' end,
          concat_ws(E'\n',
            'Vereinbart über den Freigabe-Link',
            case when t.ort is not null then 'Ort: ' || t.ort end,
            case when t.telefon is not null then 'Telefon: ' || t.telefon end,
            t.nachricht))
  returning id into v_id;

  update public.freigabe_termine
     set status = 'bestaetigt', gewaehlt = p_zeit, termin_id = v_id, entschieden_am = now(),
         antwort = nullif(left(trim(coalesce(p_antwort, '')), 1000), '')
   where id = p_id;
  return v_id;
end $$;
revoke all on function public.freigabe_termin_bestaetigen(uuid, timestamptz, text) from public, anon;
grant execute on function public.freigabe_termin_bestaetigen(uuid, timestamptz, text) to authenticated;
