-- =============================================================================
-- Kontolöschung darf keine Daten Dritter vernichten
-- =============================================================================
--
-- Mit der neuen Seite /konto können Mieter und Service-Partner ihr Konto selbst
-- löschen (Art. 17 DSGVO — vorher konnten sie es gar nicht). Dabei fiel auf:
-- drei Tabellen hängen mit ON DELETE CASCADE an `auth.users`, obwohl die Zeilen
-- fachlich dem VERMIETER gehören.
--
--   auftraege.service_user_id            → CASCADE
--   anliegen.mieter_user_id              → CASCADE
--   zaehlerstand_meldungen.mieter_user_id → CASCADE
--
-- Löscht ein Handwerksbetrieb sein Konto, verschwinden beim Vermieter sämtliche
-- Aufträge — inklusive `betrag`, `lohnanteil` und `rechnung_name`, also Belege
-- zu bereits verbuchten Kosten (`kosten_id` zeigt darauf). Löscht ein Mieter
-- sein Konto, verschwinden dessen Anliegen und gemeldete Zählerstände aus der
-- Vermieter-Verwaltung. Der Löschdialog behauptete dabei ausdrücklich das
-- Gegenteil.
--
-- Richtig ist: Der Personenbezug muss weg, die Geschäftsunterlage des
-- Vermieters bleibt. Deshalb ON DELETE SET NULL statt CASCADE.
--
-- Damit der Vermieter danach noch weiß, WER der Partner war, bekommt
-- `auftraege` eine denormalisierte Spalte `service_name`; sie wird beim Löschen
-- gefüllt (siehe delete_own_account unten). Bei `anliegen` und
-- `zaehlerstand_meldungen` ist das nicht nötig — dort zeigt `mieter_id`
-- weiterhin auf die Mieter-Stammdaten, die dem Vermieter gehören und nicht
-- mitgelöscht werden.
-- =============================================================================

-- ---- auftraege ----
alter table public.auftraege add column if not exists service_name text;
alter table public.auftraege alter column service_user_id drop not null;
alter table public.auftraege drop constraint if exists auftraege_service_user_id_fkey;
alter table public.auftraege
  add constraint auftraege_service_user_id_fkey
  foreign key (service_user_id) references auth.users(id) on delete set null;

comment on column public.auftraege.service_name is
  'Anzeigename des Service-Partners. Wird beim Loeschen des Partner-Kontos gefuellt, damit der Auftrag beim Vermieter zuordenbar bleibt.';

-- ---- anliegen ----
alter table public.anliegen alter column mieter_user_id drop not null;
alter table public.anliegen drop constraint if exists anliegen_mieter_user_id_fkey;
alter table public.anliegen
  add constraint anliegen_mieter_user_id_fkey
  foreign key (mieter_user_id) references auth.users(id) on delete set null;

-- ---- zaehlerstand_meldungen ----
alter table public.zaehlerstand_meldungen alter column mieter_user_id drop not null;
alter table public.zaehlerstand_meldungen drop constraint if exists zaehlerstand_meldungen_mieter_user_id_fkey;
alter table public.zaehlerstand_meldungen
  add constraint zaehlerstand_meldungen_mieter_user_id_fkey
  foreign key (mieter_user_id) references auth.users(id) on delete set null;

-- =============================================================================
-- Spaltenschutz-Trigger müssen das Ablösen zulassen
-- =============================================================================
--
-- Beide Tabellen haben einen BEFORE-UPDATE-Trigger, der Mietern bzw.
-- Service-Partnern verbietet, fremde Spalten zu ändern. Der greift auch bei dem
-- UPDATE, das der Fremdschlüssel beim Löschen des Kontos selbst auslöst
-- (SET NULL) — und macht es damit unmöglich:
--
--   ERROR: insert or update on table "auftraege" violates foreign key
--          constraint "auftraege_service_user_id_fkey"
--   ERROR: Mieter duerfen nur den Termin bestaetigen
--
-- (Beim lokalen Durchspielen aufgefallen; ohne die folgende Ausnahme scheitert
-- die Kontolöschung komplett.)
--
-- Die Ausnahme ist eng gefasst: Sie greift NUR, wenn die Spalte auf NULL geht
-- UND der zugehörige Auth-Nutzer bereits nicht mehr existiert. PostgreSQL
-- löscht die Zeile in auth.users vor der referenziellen Aktion, deshalb ist das
-- der zuverlässige Marker für „hier läuft eine Kontolöschung". Ein angemeldeter
-- Nutzer kann diese Bedingung nicht herbeiführen.

create or replace function public.auftraege_service_spaltenschutz()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Ablösen beim Löschen des Partner-Kontos durchlassen (siehe Migration).
  if new.service_user_id is null and old.service_user_id is not null
     and not exists (select 1 from auth.users u where u.id = old.service_user_id) then
    return new;
  end if;

  -- Der Vermieter (Eigentümer) darf alles; der Service-Partner nur
  -- status/antwort/betrag/lohnanteil/rechnung_* (+updated_at) —
  -- alles andere wird zurückgesetzt.
  if (select auth.uid()) is distinct from old.vermieter_id then
    new.vermieter_id    := old.vermieter_id;
    new.service_user_id := old.service_user_id;
    new.prop_id         := old.prop_id;
    new.anliegen_id     := old.anliegen_id;
    new.mieter_id       := old.mieter_id;
    new.firma_id        := old.firma_id;
    new.objekt_name     := old.objekt_name;
    new.vermieter_name  := old.vermieter_name;
    new.titel           := old.titel;
    new.beschreibung    := old.beschreibung;
    new.termin          := old.termin;
    new.erstellt_von    := old.erstellt_von;
    new.public_token    := old.public_token;
    new.created_at      := old.created_at;
    new.kosten_id       := old.kosten_id;
  end if;
  return new;
end $function$;

create or replace function public.anliegen_mieter_spaltenschutz()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Ablösen beim Löschen des Mieter-Kontos durchlassen (siehe Migration).
  if new.mieter_user_id is null and old.mieter_user_id is not null
     and not exists (select 1 from auth.users u where u.id = old.mieter_user_id) then
    return new;
  end if;

  -- Nur einschränken, wenn der MIETER schreibt (Vermieter bleibt frei).
  if (select auth.uid()) = old.mieter_user_id
     and (select auth.uid()) is distinct from old.vermieter_id then
    if new.id is distinct from old.id
       or new.mieter_user_id is distinct from old.mieter_user_id
       or new.vermieter_id is distinct from old.vermieter_id
       or new.mieter_id is distinct from old.mieter_id
       or new.prop_id is distinct from old.prop_id
       or new.typ is distinct from old.typ
       or new.titel is distinct from old.titel
       or new.beschreibung is distinct from old.beschreibung
       or new.status is distinct from old.status
       or new.antwort is distinct from old.antwort
       or new.termin_vorschlaege is distinct from old.termin_vorschlaege
       or new.created_at is distinct from old.created_at then
      raise exception 'Mieter duerfen nur den Termin bestaetigen';
    end if;
    if new.termin_bestaetigt is not null
       and not (coalesce(old.termin_vorschlaege, '[]'::jsonb) ? new.termin_bestaetigt) then
      raise exception 'Termin ist kein gueltiger Vorschlag';
    end if;
  end if;
  return new;
end;
$function$;

-- =============================================================================
-- delete_own_account: Namen sichern, bevor der Personenbezug verschwindet
-- =============================================================================
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  uid uuid := auth.uid();
  v_partner text;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Anzeigename des Service-Partners denormalisieren, solange der Zugang noch
  -- existiert. Danach setzt der Fremdschluessel service_user_id auf NULL und
  -- der Auftrag bleibt beim Vermieter zuordenbar.
  select coalesce(nullif(trim(coalesce(z.firma, '')), ''), z.email, 'Ehemaliger Partner')
    into v_partner
    from public.service_zugaenge z
   where z.user_id = uid
   limit 1;

  update public.auftraege
     set service_name = coalesce(service_name, v_partner, 'Ehemaliger Partner')
   where service_user_id = uid;

  -- Tabellen ohne eigenen Fremdschluessel auf auth.users zuerst und explizit —
  -- nicht auf die Cascade-Kette verlassen.
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

  -- Alles Uebrige haengt per ON DELETE CASCADE bzw. SET NULL an auth.users.
  delete from auth.users where id = uid;
end;
$function$;
