-- =============================================================================
-- Kontolöschung (Art. 17 DSGVO): blockierenden Fremdschlüssel beheben
-- =============================================================================
--
-- Beim Erstellen der Schema-Baseline aufgefallen:
--
-- `einladungscodes.eingeloest_von` verweist auf `auth.users(id)` OHNE
-- ON-DELETE-Regel, also mit NO ACTION.
--
-- Für den VERMIETER fällt das nicht auf: Sein eigener Einladungscode hängt über
-- `vermieter_id` mit ON DELETE CASCADE an ihm und verschwindet zusammen mit dem
-- Konto — der Verweis läuft ins Leere, bevor er stören kann.
--
-- Für MIETER- und SERVICE-Konten dagegen scheitert die Löschung zuverlässig:
-- Der eingelöste Code gehört dem VERMIETER, wird also nicht mitgelöscht, und
-- sein `eingeloest_von` zeigt weiter auf das zu löschende Konto. Reproduziert
-- gegen ein leeres Postgres 16 mit dieser Baseline:
--
--   ERROR: update or delete on table "users" violates foreign key constraint
--          "einladungscodes_eingeloest_von_fkey" on table "einladungscodes"
--   CONTEXT: SQL statement "delete from auth.users where id = uid"
--
-- Der Abbruch passiert in der LETZTEN Zeile von `delete_own_account()` —
-- die Fachdaten sind zu dem Zeitpunkt bereits gelöscht. Ergebnis: ein
-- ausgeräumtes, aber weiterhin existierendes Konto, und für den Nutzer eine
-- Fehlermeldung statt einer Löschung. Genau die Nutzergruppe, die ohnehin
-- keine eigenen Einstellungen hat (siehe Merkliste), kommt so nicht aus der App
-- heraus.
--
-- Fix: ON DELETE SET NULL. Der Code bleibt als eingelöst erhalten — der
-- Vermieter soll weiterhin sehen, dass er verbraucht ist — verliert aber den
-- Personenbezug, was Art. 17 genügt.
--
-- Zusätzlich wird `delete_own_account()` um drei Tabellen ergänzt, die keinen
-- eigenen Fremdschlüssel auf `auth.users` haben (bewertung_historie,
-- vergleichsangebote, miet_zeitraeume). Sie verschwinden heute bereits über die
-- Cascade-Kette properties/mieter — das ist geprüft und funktioniert. Die
-- expliziten DELETEs machen die Funktion aber unabhängig davon: Wer künftig
-- einen dieser Fremdschlüssel ändert, reißt damit kein stilles Loch in die
-- Kontolöschung. Kein Verhaltensunterschied heute, nur weniger Fernwirkung.
-- =============================================================================

alter table public.einladungscodes drop constraint if exists einladungscodes_eingeloest_von_fkey;
alter table public.einladungscodes
  add constraint einladungscodes_eingeloest_von_fkey
  foreign key (eingeloest_von) references auth.users(id) on delete set null;

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Tabellen ohne eigenen Fremdschlüssel auf auth.users zuerst und explizit
  -- (siehe Kopfkommentar) — nicht auf die Cascade-Kette verlassen.
  delete from public.bewertung_historie where user_id = uid;
  delete from public.vergleichsangebote  where user_id = uid;
  delete from public.miet_zeitraeume     where user_id = uid;

  -- Kind-Tabellen vor Eltern (FK-Reihenfolge).
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

  -- Alles Übrige hängt per ON DELETE CASCADE an auth.users.
  delete from auth.users where id = uid;
end;
$function$;
