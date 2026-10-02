-- Mieter-Einladung an eine E-Mail-Adresse gebunden (02.10.2026, Vorgabe des Betreibers).
--
-- Vorher war der Einladungscode ein Inhaber-Schlüssel: Wer ihn hatte, wurde Mieter der
-- Wohnung — und der Vermieter sah danach nur „verbunden“, nicht WER. Ein weitergeleiteter
-- Code machte einen Fremden zum Empfänger jeder künftigen Nebenkostenabrechnung
-- (docs/zukunft/MIETERPORTAL-AUSBAU.md, F3).
--
-- Jetzt: Der Vermieter trägt die Adresse des Mieters ein, der Code gilt NUR für ein Konto
-- mit genau dieser (bestätigten) Adresse. Die Verknüpfung merkt sich die Adresse, damit der
-- Vermieter sieht, wer verbunden ist.
--
-- Alte Mieter-Codes ohne Adresse lassen sich nicht mehr einlösen (live: 3 offene, alle
-- Testkonten). Bereits bestehende Verknüpfungen bleiben, zeigen aber „Adresse unbekannt“.

alter table public.einladungscodes add column if not exists email text;
alter table public.mieter_zugaenge add column if not exists email text;

-- Neue Mieter-Codes MÜSSEN eine Adresse tragen. NOT VALID: Altbestand bleibt unberührt,
-- jede neue oder geänderte Zeile wird geprüft.
alter table public.einladungscodes drop constraint if exists einladungscodes_mieter_email;
alter table public.einladungscodes
  add constraint einladungscodes_mieter_email
  check (rolle <> 'mieter' or (email is not null and email = lower(btrim(email)) and position('@' in email) > 1))
  not valid;

-- Einlösen nach der Anmeldung (/willkommen, Rückfallweg).
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

  insert into public.nutzer_rollen (user_id, rolle)
    values (uid, v_rolle) on conflict (user_id) do nothing;

  update public.einladungscodes
     set eingeloest_von = uid, eingeloest_am = now()
   where id = v_e.id;

  insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (uid, true, true, 'einladung')
    on conflict (user_id) do update set
      consent_agb = true, consent_datenschutz = true, freigeschaltet_am = now();

  return jsonb_build_object('ok', true, 'rolle', v_rolle);
end;
$function$;

-- Einlösen bei der Registrierung (Trigger auf auth.users). Die Adresse ist hier noch nicht
-- bestätigt — anmelden kann sich das Konto aber erst NACH der Bestätigung, und die Adresse
-- muss exakt die eingeladene sein. Wer eine fremde Adresse einträgt, kommt nie hinein.
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

-- Rechte wie bisher: der Trigger nur für postgres/service_role.
revoke execute on function public.handle_new_user_rolle() from public, anon, authenticated;
