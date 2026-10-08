-- Mieter: nur lesen — außer genau dem, was das Portal ausdrücklich erlaubt (08.10.2026,
-- Vorgabe des Betreibers nach dem Sichten-Fund aus P7).
--
-- Was ein Mieter in der Datenbank überhaupt schreiben darf (live nachgesehen 08.10.2026):
-- Anliegen melden (+ Fotos), Nachricht im Verlauf, Zählerstand melden, einen vorgeschlagenen
-- Termin bestätigen und eine Anfrage des Vermieters beantworten. Die Portal-Sichten sind seit
-- 20261008081000 nur lesbar.
--
-- Die zwei Spaltenschutz-Trigger für UPDATE waren SPERRLISTEN: Sie zählten die verbotenen Spalten
-- auf. Heute deckten sie alle Spalten ab — aber jede künftig angelegte Spalte (z. B. „kosten“,
-- „prioritaet“) wäre für den Mieter still beschreibbar gewesen. Jetzt ERLAUBNISLISTEN: Verglichen
-- wird die ganze Zeile ohne die erlaubten Spalten. Was neu hinzukommt, ist automatisch gesperrt.
-- Verhalten für heutige Spalten unverändert. Enthält keine Löschbefehle.

create or replace function public.anliegen_mieter_spaltenschutz()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Mieter-Konto gelöscht → Fremdschlüssel setzt mieter_user_id auf null: durchlassen.
  if new.mieter_user_id is null and old.mieter_user_id is not null
     and not exists (select 1 from auth.users u where u.id = old.mieter_user_id) then
    return new;
  end if;

  if (select auth.uid()) = old.mieter_user_id
     and (select auth.uid()) is distinct from old.vermieter_id then
    -- Erlaubt: den bestätigten Termin (und den Zeitstempel). Alles andere, auch künftige Spalten, nicht.
    if (to_jsonb(new) - array['termin_bestaetigt', 'updated_at'])
       is distinct from (to_jsonb(old) - array['termin_bestaetigt', 'updated_at']) then
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

create or replace function public.vermieter_anfragen_mieter_spaltenschutz()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (select auth.uid()) is distinct from old.vermieter_id then
    -- Erlaubt: Status und Antwort (und den Zeitstempel). Alles andere, auch künftige Spalten, nicht.
    if (to_jsonb(new) - array['status', 'antwort', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'antwort', 'updated_at']) then
      raise exception 'Mieter duerfen nur Status und Antwort aendern';
    end if;
  end if;
  return new;
end;
$function$;

-- Trigger-Funktionen: Aufrufrecht wie bisher entzogen (Postgres prüft EXECUTE beim Anlegen des
-- Triggers, nicht beim Auslösen).
revoke execute on function public.anliegen_mieter_spaltenschutz() from public, anon, authenticated;
revoke execute on function public.vermieter_anfragen_mieter_spaltenschutz() from public, anon, authenticated;
