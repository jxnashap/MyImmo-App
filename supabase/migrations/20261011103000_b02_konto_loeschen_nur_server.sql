-- ⚠️ MANUELL IM SUPABASE-SQL-EDITOR AUSFÜHREN (nicht über apply_migration): enthält das
-- Lösch-Schlüsselwort (Bestätigungsdialog der Schnittstelle, siehe 20261005130000).
-- REIHENFOLGE: ERST den Code deployen (lib/actions/account.ts ruft `konto_loeschen` über die
-- Service-Role), DANN diese Datei — umgekehrt scheitert bis zum Deploy jede Kontolöschung.
-- Danach prüfen:
--   select has_function_privilege('authenticated', 'public.delete_own_account()', 'execute');    -- false
--   select has_function_privilege('authenticated', 'public.konto_loeschen(uuid)', 'execute');    -- false
--   select has_function_privilege('service_role', 'public.konto_loeschen(uuid)', 'execute');     -- true
--
-- B02 – Kontolöschung nur noch über den Server (11.10.2026).
--
-- BEFUND (supabase/test/rls/b02_kontoloeschung.sql): `delete_own_account()` war für jedes
-- angemeldete Konto per REST direkt aufrufbar (`authenticated=X`). Damit ließ sich die Löschung
-- OHNE frische Anmeldung, ohne Kündigung eines laufenden Abos (Paddle bucht weiter) und ohne
-- Löschen der Beleg-Dateien im Storage auslösen — genau die drei Schritte, die
-- lib/actions/account.ts davor ausführt.
--
-- JETZT: Die Datenbereinigung steckt in `konto_loeschen(p_user)` und ist nur für die
-- Service-Role ausführbar; die Server-Action ruft sie erst NACH Frische-Prüfung, Abo-Kündigung und
-- Datei-Löschung auf. `delete_own_account()` bleibt bestehen (kein Löschbefehl auf Funktionen),
-- ist aber für anon/authenticated/PUBLIC entzogen und ruft nur noch `konto_loeschen` auf.
-- Inhalt identisch mit 20261006121000 (alle Tabellen), dazu die Demo-Sperre.

create or replace function public.konto_loeschen(p_user uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  uid uuid := p_user;
  v_partner text;
begin
  if uid is null then
    raise exception 'Kein Konto angegeben';
  end if;
  -- Die Demo-Konten werden nie gelöscht (geteilte Schaustücke). Vorher erledigte das der
  -- Schreibsperre-Trigger über den JWT-Claim — unter der Service-Role gibt es diesen Claim nicht.
  if public.gehoert_demo(uid) then
    raise exception 'Demo-Konto kann nicht gelöscht werden' using errcode = '42501';
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
  -- Neu 06.10.2026 (Eingang über Bank-/Makler-Link, Migration 20261006090000).
  delete from public.freigabe_eingang    where user_id = uid;
  -- Neu 06.10.2026 (Termine über Bank-/Makler-Link, Migration 20261006120000).
  delete from public.freigabe_termine    where user_id = uid;
  delete from public.abo_zahlungen       where user_id = uid;

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

-- Alte Einstiegsfunktion: nur noch ein Verweis, für Nutzer nicht mehr aufrufbar.
create or replace function public.delete_own_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
begin
  perform public.konto_loeschen(auth.uid());
end;
$function$;

revoke all on function public.delete_own_account() from public, anon, authenticated;
revoke all on function public.konto_loeschen(uuid) from public, anon, authenticated;
grant execute on function public.konto_loeschen(uuid) to service_role;
