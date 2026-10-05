-- Bank-Link mit Zugangscode (05.10.2026, Betreiber: „Bank auch“) — dasselbe Verfahren wie
-- beim Makler-Link (20261005170000): E-Mail des Bankberaters beim Erstellen, fertige Mail im
-- Mailprogramm des Kunden (Empfänger, Betreff, Link, Code), MyImmo verschickt nichts.
-- Gespeichert wird nur der HMAC über Token + Code; Inhalte, Dateien UND die Rückmeldung der
-- Bank gibt es nur mit diesem Hash. Nach 10 falschen Codes ist die Anmeldung gesperrt.
--
-- Die Fassungen ohne Code werden stillgelegt (geben nichts zurück bzw. false, Aufrufrecht
-- entzogen) statt entfernt — das Entfern-Schlüsselwort löst den Bestätigungsdialog aus.
-- Live gab es zum Zeitpunkt 0 aktive Bank-Links (2 abgelaufene vom Juli); keiner verliert etwas.

alter table public.beleihung_freigaben
  add column if not exists empfaenger_email text check (empfaenger_email is null or char_length(empfaenger_email) <= 200),
  add column if not exists code_hash text,
  add column if not exists fehlversuche integer not null default 0;

-- Neue Links nur mit Code und Empfänger. Restriktiv zusätzlich zu `own_freigaben`.
create policy freigabe_braucht_code on public.beleihung_freigaben
  as restrictive for insert to authenticated
  with check (code_hash is not null and char_length(code_hash) = 64 and empfaenger_email is not null);

create or replace function public.beleihung_public_anmelden(p_token uuid, p_code_hash text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare f record;
begin
  select * into f from public.beleihung_freigaben
   where token = p_token and aktiv and ablauf > now()
   for update;
  if not found then return null; end if;
  if f.fehlversuche >= 10 then return 'gesperrt'; end if;
  if f.code_hash is not null and p_code_hash = f.code_hash then return 'ok'; end if;
  update public.beleihung_freigaben set fehlversuche = fehlversuche + 1 where token = p_token;
  return case when f.fehlversuche + 1 >= 10 then 'gesperrt' else 'falsch' end;
end $$;
revoke all on function public.beleihung_public_anmelden(uuid, text) from public;
grant execute on function public.beleihung_public_anmelden(uuid, text) to anon, authenticated;

create or replace function public.beleihung_public_status(p_token uuid)
returns text
language sql
security definer
set search_path to ''
as $$
  select case when fehlversuche >= 10 then 'gesperrt' else 'offen' end
    from public.beleihung_freigaben
   where token = p_token and aktiv and ablauf > now()
$$;
revoke all on function public.beleihung_public_status(uuid) from public;
grant execute on function public.beleihung_public_status(uuid) to anon, authenticated;

-- Inhalt der Bank-Seite — wie bisher (Baseline), jetzt nur mit Hash.
create or replace function public.beleihung_public_info(p_token uuid, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f record;
  prop jsonb;
  dokliste jsonb;
  v_miete numeric;
  v_restschuld numeric;
  v_absender text;
begin
  select * into f from public.beleihung_freigaben
    where token = p_token and aktiv and ablauf > now()
      and code_hash is not null and code_hash = p_code_hash;
  if not found then return null; end if;

  select to_jsonb(p) into prop from (
    select bezeichnung, adresse, typ, baujahr, flaeche, zimmer, energieklasse, kaufpreis, wert, miete
    from public.properties where id = f.prop_id
  ) p;

  select coalesce(sum(kaltmiete), 0) into v_miete
    from public.mieter where prop_id = f.prop_id and (mietende is null or mietende >= current_date);
  select coalesce(sum(coalesce(restschuld, betrag, 0)), 0) into v_restschuld
    from public.kredite where prop_id = f.prop_id;
  select name into v_absender from public.vermieter_profil where user_id = f.user_id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_key', d.item_key, 'datei_name', d.datei_name,
           'datei_type', d.datei_type, 'datei_size', d.datei_size)
           order by d.item_key), '[]'::jsonb)
    into dokliste
    from public.beleihung_dokumente d
    where d.prop_id = f.prop_id and d.user_id = f.user_id
      and d.item_key = any(f.item_keys) and d.datei_data is not null;

  return jsonb_build_object(
    'objekt', prop, 'miete_mo', v_miete, 'restschuld', v_restschuld,
    'absender', v_absender, 'angaben', f.angaben, 'ablauf', f.ablauf,
    'dokumente', dokliste);
end $$;
revoke all on function public.beleihung_public_info(uuid, text) from public;
grant execute on function public.beleihung_public_info(uuid, text) to anon, authenticated;

create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text, p_code_hash text)
returns table(datei_name text, datei_type text, datei_data text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare f record; d record;
begin
  select * into f from public.beleihung_freigaben
   where token = p_token and aktiv and ablauf > now() and p_item_key = any(item_keys)
     and code_hash is not null and code_hash = p_code_hash;
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
revoke all on function public.beleihung_public_datei(uuid, text, text) from public;
grant execute on function public.beleihung_public_datei(uuid, text, text) to anon, authenticated;

-- Rückmeldung der Bank — wie bisher (Baseline), jetzt nur mit Hash.
create or replace function public.beleihung_public_rueckmeldung(
  p_token uuid, p_name text, p_bank text, p_kontakt text, p_nachricht text, p_fehlend text[], p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f record;
  cnt_hour int;
  cnt_total int;
begin
  select * into f from public.beleihung_freigaben
    where token = p_token and aktiv and ablauf > now()
      and code_hash is not null and code_hash = p_code_hash;
  if not found then return false; end if;

  select count(*) into cnt_hour from public.beleihung_rueckmeldungen
    where token = p_token and created_at > now() - interval '1 hour';
  select count(*) into cnt_total from public.beleihung_rueckmeldungen where token = p_token;
  if cnt_hour >= 5 or cnt_total >= 50 then
    raise exception 'Zu viele Rückmeldungen — bitte später erneut versuchen.';
  end if;

  insert into public.beleihung_rueckmeldungen (token, name, bank, kontakt, nachricht, fehlend)
  values (p_token, left(p_name, 200), left(p_bank, 200), left(p_kontakt, 300),
          left(p_nachricht, 4000), (select array_agg(left(x, 100)) from unnest(coalesce(p_fehlend, '{}')) x));
  return true;
end $$;
revoke all on function public.beleihung_public_rueckmeldung(uuid, text, text, text, text, text[], text) from public;
grant execute on function public.beleihung_public_rueckmeldung(uuid, text, text, text, text, text[], text) to anon, authenticated;

-- Stilllegen der Fassungen ohne Code.
create or replace function public.beleihung_public_info(p_token uuid)
returns jsonb
language sql
security definer
set search_path to ''
as $$ select null::jsonb $$;
revoke all on function public.beleihung_public_info(uuid) from public, anon, authenticated;

create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text)
returns table(datei_name text, datei_type text, datei_data text)
language sql
security definer
set search_path to ''
as $$ select null::text, null::text, null::text where false $$;
revoke all on function public.beleihung_public_datei(uuid, text) from public, anon, authenticated;

create or replace function public.beleihung_public_rueckmeldung(
  p_token uuid, p_name text, p_bank text, p_kontakt text, p_nachricht text, p_fehlend text[])
returns boolean
language sql
security definer
set search_path to ''
as $$ select false $$;
revoke all on function public.beleihung_public_rueckmeldung(uuid, text, text, text, text, text[]) from public, anon, authenticated;
