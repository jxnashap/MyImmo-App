-- Demo: öffentliche Links des Demo-Kontos nehmen nichts an (Gesamtprüfung P5, B53).
--
-- Befund: Der Auftrags-Link der Demo (`/auftrag/<token>`, Token steht im HTML von /service) war voll
-- bedienbar. `auftrag_public_rueckmeldung` läuft als SECURITY DEFINER für `anon` — der
-- Demo-Schreibschutz (`demo_schreibsperre`) greift aber nur bei `ist_demo_nutzer()`, und ein anonymer
-- Aufrufer ist kein Demo-Nutzer. Jeder Besucher konnte so in den gemeinsamen Demo-Bestand schreiben
-- (Rückmeldung bis 4.000 Zeichen, bei einer Zusage den Termin am Auftrag).
--
-- Jetzt zwei Linien:
--   1. Die RPC bricht früh ab und sagt warum; die Info-RPC meldet `demo`, damit die Seite den
--      Hinweis zeigt und den Senden-Knopf abschaltet (Ausfüllen ja, Senden nein).
--   2. Ein Zeilen-Trigger auf allen Tabellen, in die öffentliche Links schreiben, wirft für
--      Demo-Besitzer einen Fehler — auch für künftige RPCs, an die niemand denkt. Der Demo-Reset
--      (service_role) schreibt weiter.
-- Enthält keine Löschbefehle.

-- Gehört ein Konto zur Demo? Dieselbe Liste wie ist_demo_nutzer() und lib/demo.ts
-- (tests/paketP5.test.ts vergleicht sie).
create or replace function public.gehoert_demo(p_user uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select p_user is not null and exists (
    select 1 from auth.users u
     where u.id = p_user
       and u.email in (
         'demo.vermieter@myimmo.test', 'demo.mieter@myimmo.test',
         'demo.hausmeister@myimmo.test', 'demo.sanitaer@myimmo.test', 'demo.garten@myimmo.test'
       )
  );
$function$;
revoke execute on function public.gehoert_demo(uuid) from public, anon, authenticated;

create or replace function public.auftrag_public_info(p_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a record;
begin
  select au.titel, au.beschreibung, au.objekt_name, au.vermieter_name, au.termin, au.status, au.vermieter_id,
         m.vorname, m.nachname, m.telefon, m.email
    into a
  from auftraege au
  left join mieter m on m.id = au.mieter_id
  where au.public_token = p_token
    and au.status in ('offen','angenommen')
    and au.public_token_ablauf > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'titel', a.titel,
    'beschreibung', a.beschreibung,
    'objekt', a.objekt_name,
    'vermieter', a.vermieter_name,
    'termin', a.termin,
    'mieter_name', nullif(trim(coalesce(a.vorname,'') || ' ' || coalesce(a.nachname,'')), ''),
    'mieter_telefon', a.telefon,
    'mieter_email', a.email,
    -- Beispiel-Auftrag der Demo: die Seite zeigt den Hinweis und sendet nichts (P5, B53).
    'demo', public.gehoert_demo(a.vermieter_id)
  );
end $function$;

create or replace function public.auftrag_public_rueckmeldung(p_token uuid, p_art text, p_firma text, p_kontakt text, p_termin date, p_nachricht text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a record;
  cnt int;
begin
  if p_art not in ('zusage','absage','rueckfrage') then
    return jsonb_build_object('error','Unbekannte Rueckmeldung.');
  end if;

  select au.id, au.status, au.vermieter_id into a
  from auftraege au
  where au.public_token = p_token
    and au.status in ('offen','angenommen')
    and au.public_token_ablauf > now();
  if not found then
    return jsonb_build_object('error','Dieser Link ist nicht mehr gültig.');
  end if;

  -- Demo: alle Besucher teilen den Bestand — nichts annehmen (P5, B53).
  if public.gehoert_demo(a.vermieter_id) then
    return jsonb_build_object('error','Das ist ein Beispiel-Auftrag aus der Demo — Rückmeldungen werden nicht gespeichert.', 'demo', true);
  end if;

  -- Mengenbremse je Auftrag (wie bei den Beleihungs-Rueckmeldungen).
  select count(*) into cnt from auftrag_rueckmeldungen
   where auftrag_id = a.id and created_at > now() - interval '1 hour';
  if cnt >= 10 then
    return jsonb_build_object('error','Zu viele Rückmeldungen — bitte später erneut versuchen.');
  end if;

  insert into auftrag_rueckmeldungen (auftrag_id, art, firma, kontakt, termin, nachricht)
  values (a.id, p_art, left(p_firma, 200), left(p_kontakt, 300), p_termin, left(p_nachricht, 4000));

  -- Eine Zusage mit Termin traegt den Termin gleich am Auftrag nach; der
  -- Vermieter sieht ihn dann ohne Umweg in seiner Liste. Der Status bleibt
  -- unangetastet — das ist die Entscheidung des Vermieters, nicht der Firma.
  if p_art = 'zusage' and p_termin is not null then
    update auftraege set termin = p_termin, updated_at = now() where id = a.id;
  end if;

  return jsonb_build_object('ok', true);
end $function$;

-- Zweite Linie: Zeilen-Trigger auf den Eingangstabellen öffentlicher Links.
create or replace function public.demo_eingang_sperre()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rolle text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_besitzer uuid;
begin
  -- Nur Zugriffe von außen (anon) und angemeldeter Konten. Der Demo-Reset (service_role) und der
  -- SQL-Editor (ohne Claims) schreiben weiter.
  if v_rolle not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_table_name = 'auftrag_rueckmeldungen' then
    select vermieter_id into v_besitzer from auftraege where id = new.auftrag_id;
  elsif tg_table_name = 'angebote' then
    select vermieter_id into v_besitzer from angebotsanfragen where id = new.anfrage_id;
  elsif tg_table_name = 'beleihung_rueckmeldungen' then
    select user_id into v_besitzer from beleihung_freigaben where token = new.token;
  else
    v_besitzer := (to_jsonb(new) ->> 'user_id')::uuid;
  end if;
  if public.gehoert_demo(v_besitzer) then
    raise exception 'In der Demo wird nichts gespeichert. Mit eigenem Zugang steht die Funktion bereit.'
      using errcode = '42501', hint = 'demo_nur_lesen';
  end if;
  return new;
end $function$;
revoke execute on function public.demo_eingang_sperre() from public, anon, authenticated;

create or replace trigger demo_eingang_sperre before insert on public.auftrag_rueckmeldungen
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.angebote
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.beleihung_rueckmeldungen
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.bewerbungen
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.bewerbung_dateien
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.freigabe_eingang
  for each row execute function public.demo_eingang_sperre();
create or replace trigger demo_eingang_sperre before insert on public.freigabe_termine
  for each row execute function public.demo_eingang_sperre();
