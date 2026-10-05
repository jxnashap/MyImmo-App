-- Makler-Link mit Zugangscode (05.10.2026, Vorgabe des Betreibers).
--
-- Der Kunde trägt beim Erstellen die E-Mail des Maklers ein; MyImmo öffnet eine fertige Mail im
-- Mailprogramm des Kunden (Empfänger, Betreff, Link, Code) — MyImmo selbst verschickt nichts.
-- Der Makler öffnet den Link und gibt den Code ein; erst dann sieht er die Dokumente.
--
-- Der Code wird nie gespeichert, nur sein HMAC (`code_hash`, in der App mit dem Schlüssel aus
-- DATA_ENCRYPTION_KEY gebildet). Die Datenbank vergleicht nur Hashes. Wer den Link hat, aber nicht
-- den Code, kommt auch über die REST-Schnittstelle nicht an Inhalte: Die öffentlichen Funktionen
-- verlangen jetzt den Hash, und der ist ohne Schlüssel nicht zu bilden.
-- Nach 10 falschen Codes ist die Anmeldung für diesen Link gesperrt (neuer Link nötig).
--
-- Die Funktionen ohne Code aus 20261005160000 werden stillgelegt (geben nichts mehr zurück,
-- Aufrufrecht entzogen) statt entfernt — das Entfern-Schlüsselwort löst den Bestätigungsdialog aus.
-- Live gab es zum Zeitpunkt der Migration 0 Makler-Links; kein bestehender Link verliert etwas.

alter table public.makler_freigaben
  add column if not exists empfaenger_email text check (empfaenger_email is null or char_length(empfaenger_email) <= 200),
  add column if not exists code_hash text,
  add column if not exists fehlversuche integer not null default 0;

-- Neue Links nur mit Code und Empfänger.
alter policy makler_freigaben_anlegen on public.makler_freigaben
  with check (
    user_id = (select auth.uid())
    and ablauf > now() and ablauf <= now() + interval '31 days'
    and code_hash is not null and char_length(code_hash) = 64
    and empfaenger_email is not null
  );

-- Anmelden mit Code: 'ok' | 'falsch' | 'gesperrt' | null (Link ungültig/abgelaufen/widerrufen).
create or replace function public.makler_public_anmelden(p_token uuid, p_code_hash text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare f record;
begin
  select * into f from public.makler_freigaben
   where token = p_token and aktiv and ablauf > now()
   for update;
  if not found then return null; end if;
  if f.fehlversuche >= 10 then return 'gesperrt'; end if;
  if f.code_hash is not null and p_code_hash = f.code_hash then return 'ok'; end if;
  update public.makler_freigaben set fehlversuche = fehlversuche + 1 where token = p_token;
  return case when f.fehlversuche + 1 >= 10 then 'gesperrt' else 'falsch' end;
end $$;
revoke all on function public.makler_public_anmelden(uuid, text) from public;
grant execute on function public.makler_public_anmelden(uuid, text) to anon, authenticated;

-- Gibt es den Link (ohne Inhalte)? Für die Anmeldeseite: Formular oder „abgelaufen“.
create or replace function public.makler_public_status(p_token uuid)
returns text
language sql
security definer
set search_path to ''
as $$
  select case when fehlversuche >= 10 then 'gesperrt' else 'offen' end
    from public.makler_freigaben
   where token = p_token and aktiv and ablauf > now()
$$;
revoke all on function public.makler_public_status(uuid) from public;
grant execute on function public.makler_public_status(uuid) to anon, authenticated;

-- Inhalte nur mit dem richtigen Hash.
create or replace function public.makler_public_info(p_token uuid, p_code_hash text)
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
   where token = p_token and aktiv and ablauf > now()
     and code_hash is not null and code_hash = p_code_hash;
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
revoke all on function public.makler_public_info(uuid, text) from public;
grant execute on function public.makler_public_info(uuid, text) to anon, authenticated;

create or replace function public.makler_public_datei(p_token uuid, p_item_key text, p_code_hash text)
returns table(datei_name text, datei_type text, datei_data text)
language plpgsql
security definer
set search_path to ''
as $$
declare f record; d record;
begin
  select * into f from public.makler_freigaben
   where token = p_token and aktiv and ablauf > now() and p_item_key = any(item_keys)
     and code_hash is not null and code_hash = p_code_hash;
  if not found then return; end if;
  select m.datei_name, m.datei_type, m.datei_data into d
    from public.makler_dokumente m
   where m.user_id = f.user_id and m.item_key = p_item_key and m.datei_data is not null;
  if not found then return; end if;
  perform public.freigabe_abruf_merken('makler', p_token, f.user_id, p_item_key);
  datei_name := d.datei_name; datei_type := d.datei_type; datei_data := d.datei_data;
  return next;
end $$;
revoke all on function public.makler_public_datei(uuid, text, text) from public;
grant execute on function public.makler_public_datei(uuid, text, text) to anon, authenticated;

-- Stilllegen der Fassungen ohne Code: geben nichts mehr zurück, niemand darf sie aufrufen.
create or replace function public.makler_public_info(p_token uuid)
returns jsonb
language sql
security definer
set search_path to ''
as $$ select null::jsonb $$;
revoke all on function public.makler_public_info(uuid) from public, anon, authenticated;

create or replace function public.makler_public_datei(p_token uuid, p_item_key text)
returns table(datei_name text, datei_type text, datei_data text)
language sql
security definer
set search_path to ''
as $$ select null::text, null::text, null::text where false $$;
revoke all on function public.makler_public_datei(uuid, text) from public, anon, authenticated;
