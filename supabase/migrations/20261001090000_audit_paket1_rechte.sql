-- Audit 01.10.2026, Paket 1: fünf Rechte-/Integritätslücken in der Datenbank
-- (docs/AUDIT-2026-10-01.md, A1, B1, B2, B4, B6). Idempotent.

-- A1: konto_freischalten() war für anon/authenticated ausführbar und prüft
-- keinen Code — der Zugangscode war per REST umgehbar. Jetzt nur noch
-- Service-Role (die Action schreibt nach geprüftem Code selbst).
-- `public` MIT entziehen (CLAUDE.md, 08.09.2026).
revoke execute on function public.konto_freischalten(text) from public, anon, authenticated;

-- B2: einladungscode_pruefen() bremste über anfrage_ip() → IP im Klartext in
-- zugriff_limit. Die Prüfung läuft jetzt als Server-Action mit HMAC-Bremse
-- und Service-Role-Lesezugriff; die RPC braucht niemand mehr von außen.
revoke execute on function public.einladungscode_pruefen(text, text) from public, anon, authenticated;

-- B1: Einladungscodes banden mieter_id/prop_id nicht an den ausstellenden
-- Vermieter. Jetzt an drei Stellen: WITH CHECK beim Anlegen, und beide
-- Einlöse-Wege prüfen, dass der Mieter dem Aussteller gehört.
drop policy if exists einladung_vermieter_all on public.einladungscodes;
create policy einladung_vermieter_all on public.einladungscodes
  for all to authenticated
  using ((select auth.uid()) = vermieter_id)
  with check (
    (select auth.uid()) = vermieter_id
    and (
      rolle <> 'mieter'
      or (
        mieter_id is not null
        and exists (
          select 1 from public.mieter m
          where m.id = einladungscodes.mieter_id
            and m.user_id = einladungscodes.vermieter_id
            and m.prop_id is not distinct from einladungscodes.prop_id
        )
      )
    )
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
    if v_e.mieter_id is null then
      return jsonb_build_object(
        'ok', false,
        'fehler', 'Dieser Code ist keinem Mietverhaeltnis zugeordnet. Bitte den Vermieter um einen neuen Code bitten.');
    end if;
    -- Der Mieter muss dem Aussteller gehoeren — sonst liesse sich mit einer
    -- fremden mieter_id ein Lesezugang auf fremde Daten erzeugen.
    if not exists (
      select 1 from public.mieter m
      where m.id = v_e.mieter_id and m.user_id = v_e.vermieter_id
        and m.prop_id is not distinct from v_e.prop_id
    ) then
      return jsonb_build_object('ok', false, 'fehler', 'Code ungueltig, bereits benutzt oder abgelaufen.');
    end if;
    insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id)
      values (uid, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id)
      on conflict do nothing;
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
          -- Bindung an den Aussteller (Audit 01.10.2026, B1)
          and e.mieter_id is not null
          and exists (
            select 1 from public.mieter m
            where m.id = e.mieter_id and m.user_id = e.vermieter_id
              and m.prop_id is not distinct from e.prop_id
          )
        for update of e;
      if found then
        insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id)
          values (new.id, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id)
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

-- B4: vermieter_anfragen — die Mieter-UPDATE-Policy erlaubte alle Spalten.
-- Wie bei anliegen: ein Spaltenschutz-Trigger, der Mietern nur status,
-- antwort und updated_at lässt.
create or replace function public.vermieter_anfragen_mieter_spaltenschutz()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (select auth.uid()) is distinct from old.vermieter_id then
    if new.id is distinct from old.id
       or new.vermieter_id is distinct from old.vermieter_id
       or new.mieter_id is distinct from old.mieter_id
       or new.prop_id is distinct from old.prop_id
       or new.typ is distinct from old.typ
       or new.titel is distinct from old.titel
       or new.beschreibung is distinct from old.beschreibung
       or new.termin is distinct from old.termin
       or new.faellig_bis is distinct from old.faellig_bis
       or new.created_at is distinct from old.created_at then
      raise exception 'Mieter duerfen nur Status und Antwort aendern';
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.vermieter_anfragen_mieter_spaltenschutz() from public, anon, authenticated;

drop trigger if exists trg_vanfrage_mieter_spaltenschutz on public.vermieter_anfragen;
create trigger trg_vanfrage_mieter_spaltenschutz
  before update on public.vermieter_anfragen
  for each row execute function public.vermieter_anfragen_mieter_spaltenschutz();

-- B6a: nk_co2 — ein Mieter konnte für seine mieter_id eine Zeile vorbelegen
-- und damit den Upsert des Vermieters blockieren. Nur für eigene Mieter.
drop policy if exists nk_co2_insert on public.nk_co2;
create policy nk_co2_insert on public.nk_co2
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.mieter m where m.id = nk_co2.mieter_id and m.user_id = nk_co2.user_id)
  );

-- B6b: service_zugaenge — Vermieter brauchen nur Lesen und Lösen; Anlegen
-- läuft ausschließlich über Einladungscodes (RPC/Trigger). Die ALL-Policy
-- erlaubte, beliebige Konten als Partner einzutragen.
drop policy if exists service_zugaenge_vermieter on public.service_zugaenge;
create policy service_zugaenge_vermieter_select on public.service_zugaenge
  for select to authenticated using ((select auth.uid()) = vermieter_id);
create policy service_zugaenge_vermieter_delete on public.service_zugaenge
  for delete to authenticated using ((select auth.uid()) = vermieter_id);
