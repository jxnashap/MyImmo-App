-- B04 – Einladungen ersetzen keine Freischaltung (11.10.2026, Prüfstand 11.10.2026).
--
-- BEFUND (lokal nachgestellt, supabase/test/rls/b04_einladung.sql): Ein Konto, das OHNE
-- Zugangscode angelegt wurde (Google oder direkt über die Auth-Schnittstelle, Metadaten
-- `rolle: hausverwaltung`), konnte
--   1. sich per REST selbst einen Service-Code anlegen (Regel `einladung_vermieter_all` prüfte nur
--      `auth.uid() = vermieter_id`),
--   2. ihn mit `einladungscode_einloesen` selbst einlösen,
-- und war danach über `konto_freischaltung` (quelle 'einladung') freigeschaltet — mit der
-- unveränderten Rolle `hausverwaltung`, also mit dem vollen Vermieter-Bereich. Der Zugangscode
-- (BETA_CODE) war damit umgangen. Nebenbefund: Ein freigeschalteter Vermieter OHNE Rollen-Eintrag,
-- der einen fremden Mieter-/Service-Code einlöste, wurde still zum Mieter/Service-Konto.
--
-- REGELN AB JETZT:
--   (1) Einladen darf nur ein freigeschaltetes Vermieter-Konto (Freischaltung vorhanden, Rolle
--       weder mieter noch service) — in der RLS-Regel UND beim Einlösen geprüft.
--   (2) Eine eigene Einladung lässt sich nie einlösen.
--   (3) Ein noch NICHT freigeschaltetes Konto bekommt beim Einlösen GENAU die eingeladene Rolle
--       (eine Metadaten-Rolle wird überschrieben) — die Freischaltung gilt nur für das Portal,
--       zu dem eingeladen wurde.
--   (4) Ein bereits freigeschaltetes Konto behält Rolle und Freischaltung; es wird nur verknüpft.
-- Der Anmelde-Trigger `handle_new_user_rolle` prüft den Aussteller genauso.
--
-- Rein additiv bzw. CREATE OR REPLACE / ALTER POLICY — kein Löschbefehl.

-- Darf das angemeldete Konto Einladungen ausstellen? Ohne Parameter: Es lässt sich nur das EIGENE
-- Konto abfragen, nicht das eines anderen.
create or replace function public.darf_einladen()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (select auth.uid()) is not null
     and exists (select 1 from public.konto_freischaltung k where k.user_id = (select auth.uid()))
     and not exists (select 1 from public.nutzer_rollen r
                      where r.user_id = (select auth.uid()) and r.rolle in ('mieter', 'service'))
$$;
revoke all on function public.darf_einladen() from public, anon;
grant execute on function public.darf_einladen() to authenticated, service_role;

-- Aussteller-Prüfung für die SECURITY-DEFINER-Funktionen unten (nicht für Nutzer aufrufbar).
create or replace function public.einladung_aussteller_gueltig(p_vermieter uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.konto_freischaltung k where k.user_id = p_vermieter)
     and not exists (select 1 from public.nutzer_rollen r
                      where r.user_id = p_vermieter and r.rolle in ('mieter', 'service'))
$$;
revoke all on function public.einladung_aussteller_gueltig(uuid) from public, anon, authenticated;
grant execute on function public.einladung_aussteller_gueltig(uuid) to service_role;

alter policy einladung_vermieter_all on public.einladungscodes
  with check (
    ((select auth.uid()) = vermieter_id)
    and public.darf_einladen()
    and ((rolle <> 'mieter') or ((mieter_id is not null) and exists (
      select 1 from public.mieter m
       where m.id = einladungscodes.mieter_id and m.user_id = einladungscodes.vermieter_id
         and not (m.prop_id is distinct from einladungscodes.prop_id))))
  );

create or replace function public.einladungscode_einloesen(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  v_e public.einladungscodes;
  v_rolle text;
  v_mail text;
  v_bestaetigt timestamptz;
  v_frei boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'fehler', 'Nicht angemeldet.');
  end if;

  select * into v_e from public.einladungscodes
   where code = p_code
     and eingeloest_am is null
     and gueltig_bis > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'fehler', 'Code ungueltig, bereits benutzt oder abgelaufen.');
  end if;

  -- (2) Eigene Einladung nie einlösbar. (1) Aussteller muss ein freigeschalteter Vermieter sein —
  -- beides mit derselben neutralen Meldung, damit sich Codes nicht ausforschen lassen.
  if v_e.vermieter_id = uid or not public.einladung_aussteller_gueltig(v_e.vermieter_id) then
    return jsonb_build_object('ok', false, 'fehler', 'Code ungueltig, bereits benutzt oder abgelaufen.');
  end if;

  v_frei := exists (select 1 from public.konto_freischaltung where user_id = uid);

  if v_e.rolle = 'mieter' then
    if v_e.mieter_id is null or v_e.email is null then
      return jsonb_build_object(
        'ok', false,
        'fehler', 'Dieser Code ist keiner E-Mail-Adresse zugeordnet. Bitte den Vermieter um eine neue Einladung bitten.');
    end if;
    -- Nur das Konto mit GENAU der eingeladenen, BESTAETIGTEN Adresse.
    select lower(email), email_confirmed_at into v_mail, v_bestaetigt from auth.users where id = uid;
    if v_mail is distinct from v_e.email or v_bestaetigt is null then
      return jsonb_build_object(
        'ok', false,
        'fehler', 'Diese Einladung gilt für eine andere E-Mail-Adresse. Bitte mit der Adresse anmelden, an die die Einladung ging.');
    end if;
    if not exists (
      select 1 from public.mieter m
      where m.id = v_e.mieter_id and m.user_id = v_e.vermieter_id
        and m.prop_id is not distinct from v_e.prop_id
    ) then
      return jsonb_build_object('ok', false, 'fehler', 'Code ungueltig, bereits benutzt oder abgelaufen.');
    end if;
    insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id, email)
      values (uid, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id, v_e.email)
      on conflict (user_id, mieter_id) do update set email = excluded.email;
    v_rolle := 'mieter';
  elsif v_e.rolle = 'service' then
    insert into public.service_zugaenge (user_id, vermieter_id, email)
      values (uid, v_e.vermieter_id, (select email from auth.users where id = uid))
      on conflict do nothing;
    v_rolle := 'service';
  else
    return jsonb_build_object('ok', false, 'fehler', 'Unbekannte Code-Art.');
  end if;

  if not v_frei then
    -- (3) Die Freischaltung über eine Einladung gilt NUR für das eingeladene Portal: Eine Rolle aus
    -- den (nutzeränderbaren) Anmelde-Metadaten wird überschrieben.
    insert into public.nutzer_rollen (user_id, rolle)
      values (uid, v_rolle)
      on conflict (user_id) do update set rolle = excluded.rolle;
    insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
      values (uid, true, true, 'einladung')
      on conflict (user_id) do nothing;
  end if;
  -- (4) Bereits freigeschaltet: Rolle und Freischaltung bleiben, wie sie sind.

  update public.einladungscodes
     set eingeloest_von = uid, eingeloest_am = now()
   where id = v_e.id;

  return jsonb_build_object('ok', true, 'rolle',
    coalesce((select rolle from public.nutzer_rollen where user_id = uid), 'vermieter'));
end;
$function$;

create or replace function public.handle_new_user_rolle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rolle text := new.raw_user_meta_data->>'rolle';
  v_code  text := new.raw_user_meta_data->>'einladungscode';
  v_firma text := new.raw_user_meta_data->>'firma';
  v_e     public.einladungscodes;
begin
  begin
    -- Die Metadaten-Rolle ist nutzeränderbar. Sie darf nur EINSCHRÄNKEN (mieter/service) oder ein
    -- Etikett setzen (hausverwaltung); freigeschaltet wird ein Konto damit nie. Die Freischaltung
    -- kommt aus dem Zugangscode (Server-Action) oder aus einer Einladung eines freigeschalteten
    -- Vermieters (unten).
    if v_rolle in ('mieter','service','hausverwaltung') then
      insert into public.nutzer_rollen (user_id, rolle)
        values (new.id, v_rolle) on conflict do nothing;
    end if;

    if v_rolle = 'mieter' and v_code is not null then
      select e.* into v_e from public.einladungscodes e
        where e.code = v_code and e.rolle = 'mieter'
          and e.eingeloest_am is null and e.gueltig_bis > now()
          and e.mieter_id is not null
          and e.email is not null
          and e.email = lower(btrim(new.email))
          and e.vermieter_id <> new.id
          and public.einladung_aussteller_gueltig(e.vermieter_id)
          and exists (
            select 1 from public.mieter m
            where m.id = e.mieter_id and m.user_id = e.vermieter_id
              and m.prop_id is not distinct from e.prop_id
          )
        for update of e;
      if found then
        insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id, email)
          values (new.id, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id, v_e.email)
          on conflict do nothing;
        update public.einladungscodes
          set eingeloest_von = new.id, eingeloest_am = now() where id = v_e.id;
        insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
          values (new.id, true, true, 'einladung') on conflict (user_id) do nothing;
      end if;
    elsif v_rolle = 'service' and v_code is not null then
      select * into v_e from public.einladungscodes
        where code = v_code and rolle = 'service'
          and eingeloest_am is null and gueltig_bis > now()
          and vermieter_id <> new.id
          and public.einladung_aussteller_gueltig(vermieter_id)
        for update;
      if found then
        insert into public.service_zugaenge (user_id, vermieter_id, firma, email)
          values (new.id, v_e.vermieter_id, nullif(trim(coalesce(v_firma,'')), ''), new.email)
          on conflict do nothing;
        update public.einladungscodes
          set eingeloest_von = new.id, eingeloest_am = now() where id = v_e.id;
        insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
          values (new.id, true, true, 'einladung') on conflict (user_id) do nothing;
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end $function$;
revoke all on function public.handle_new_user_rolle() from public, anon, authenticated;
