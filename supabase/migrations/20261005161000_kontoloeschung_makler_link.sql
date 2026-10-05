-- ⚠️ MANUELL IM SUPABASE-SQL-EDITOR AUSFÜHREN (nicht über apply_migration): enthält das
-- Lösch-Schlüsselwort (Bestätigungsdialog der Schnittstelle, siehe 20261005130000).
-- Danach prüfen:
--   select pg_get_functiondef('public.delete_own_account'::regproc) like '%makler_freigaben%';  -- true
--
-- Kontolöschung für die zwei Tabellen aus 20261005160000 (Makler-Link, Abruf-Protokoll). Beide
-- haben bewusst KEINEN Fremdschlüssel mit Kaskade (das Schlüsselwort hätte die Migration selbst
-- in den Dialog geschickt). Sonst unverändert gegenüber 20261005130000.

create or replace function public.delete_own_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  uid uuid := auth.uid();
  v_partner text;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  select coalesce(nullif(trim(coalesce(z.firma, '')), ''), z.email, 'Ehemaliger Partner')
    into v_partner
    from public.service_zugaenge z
   where z.user_id = uid
   limit 1;

  update public.auftraege
     set service_name = coalesce(service_name, v_partner, 'Ehemaliger Partner')
   where service_user_id = uid;

  -- Neu 05.10.2026: Tabellen ohne Kaskade auf auth.users. Kinder vor Eltern.
  delete from public.anliegen_ereignisse
   where anliegen_id in (select id from public.anliegen where vermieter_id = uid);
  delete from public.auftrag_notizen     where vermieter_id = uid;
  delete from public.angebote
   where anfrage_id in (select id from public.angebotsanfragen where vermieter_id = uid);
  delete from public.angebotsanfragen    where vermieter_id = uid;
  delete from public.zustellungen        where vermieter_id = uid;
  delete from public.gebaeude_infos      where vermieter_id = uid;
  delete from public.service_objekte     where vermieter_id = uid or service_user_id = uid;
  delete from public.vertreter           where user_id = uid;
  -- Neu 05.10.2026 (Makler-Link + Abruf-Protokoll, Migration 20261005160000).
  delete from public.freigabe_abrufe     where user_id = uid;
  delete from public.makler_freigaben    where user_id = uid;

  delete from public.bewertung_historie where user_id = uid;
  delete from public.vergleichsangebote  where user_id = uid;
  delete from public.miet_zeitraeume     where user_id = uid;

  delete from public.mieter_positionen   where user_id = uid;
  delete from public.notizen             where user_id = uid;
  delete from public.kosten              where user_id = uid;
  delete from public.einnahmen           where user_id = uid;
  delete from public.verbrauch           where user_id = uid;
  delete from public.kredite             where user_id = uid;
  delete from public.termine             where user_id = uid;
  delete from public.mieter              where user_id = uid;
  delete from public.properties          where user_id = uid;
  delete from public.ibans               where user_id = uid;
  delete from public.dokument_vorlagen   where user_id = uid;
  delete from public.vermieter_profil    where user_id = uid;

  delete from auth.users where id = uid;
end;
$function$;
