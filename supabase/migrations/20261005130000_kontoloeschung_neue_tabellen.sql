-- ⚠️ MANUELL IM SUPABASE-SQL-EDITOR AUSFÜHREN (nicht über apply_migration): Die Datei enthält das
-- Lösch-Schlüsselwort, und der Bestätigungsdialog der Schnittstelle erreicht den Betreiber in der
-- Cloud-Sitzung nicht (siehe Demo-Service-Reset, 01.10.2026). Danach prüfen:
--   select pg_get_functiondef('public.delete_own_account'::regproc);   -- enthält auftrag_notizen
--   select policyname from pg_policies where tablename = 'service_objekte';  -- enthält demo_kein_delete
--
-- (1) KONTOLÖSCHUNG VOLLSTÄNDIG (05.10.2026, gefunden bei der Prüfung vor dem Livegang).
-- `delete_own_account()` kannte die seit Oktober angelegten Tabellen nicht, und keine davon hat
-- einen Fremdschlüssel mit Kaskade auf `auth.users`. Nach einer Kontolöschung blieben liegen:
-- Fotos aus Wohnungen (`auftrag_notizen`), Vollmacht-Scans und Geburtsdaten (`vertreter`),
-- E-Mail-Adressen von Mietern (`zustellungen`), Nachrichten von Mietern (`anliegen_ereignisse` —
-- `anliegen` verschwindet per Kaskade, der Verlauf nicht), Angebote von Firmen (`angebote`,
-- `angebotsanfragen`), Haus-Infos (`gebaeude_infos`) und Objekt-Zuordnungen (`service_objekte`).
-- Art. 17 DSGVO. Am 05.10.2026 nachgezählt: noch keine verwaiste Zeile — es ist nur noch nicht passiert.
--
-- Bewusst NICHT gelöscht, wenn ein MIETER- oder PARTNER-Konto sich löscht: Zustellungen an ihn,
-- Notizen und Verlaufseinträge, die er geschrieben hat. Das sind Unterlagen des VERMIETERS
-- (Zugangsnachweis, Auftragsprotokoll), wie schon bei `auftraege` (Migration 20260729150000).
-- Zuordnungen eines Partners (`service_objekte.service_user_id`) gehen dagegen mit.
--
-- `tests/kontoloeschung.test.ts` gleicht ab sofort jede neue Tabelle gegen diese Funktion ab.

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

-- (2) DEMO-LÖSCHSPERRE auf `service_objekte` (Nachtrag zu 20261005102000): Das geteilte Demo-Konto
-- konnte seine Zuordnungen per Schnittstelle entfernen (fremde Konten nie — das regelt
-- `service_objekte_vermieter`). Folgenlos, weil `demo_service_verknuepfen()` sie vor jedem
-- Demo-Start wiederherstellt, aber die Demo soll nur lesbar sein.
create policy demo_kein_delete on public.service_objekte
  as restrictive for delete to authenticated
  using (not public.ist_demo_nutzer());
