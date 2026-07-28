-- =============================================================================
-- Nebenkosten-Verteiler: Ersetzen in EINER Transaktion
-- =============================================================================
--
-- `lib/actions/umlage.ts` löschte bisher erst alle Positionen des Jahres mit
-- `quelle = 'umlage'` und fügte danach die neu berechneten ein — zwei getrennte
-- Supabase-Aufrufe, also zwei getrennte Transaktionen.
--
-- Schlägt der INSERT fehl (Constraint-Verletzung, Timeout, Netzabbruch zwischen
-- den beiden Aufrufen), ist der DELETE bereits committet: Die komplette
-- Verteilung des Jahres ist weg, der Nutzer bekommt nur eine Fehlermeldung und
-- muss alle Positionen von Hand neu erfassen. Bei 8 Mietern mit je 20
-- Positionen sind das 160 verlorene Zeilen.
--
-- Diese Funktion macht beides in einer Transaktion: Entweder die neue
-- Verteilung steht vollständig, oder die alte bleibt unangetastet.
--
-- SECURITY INVOKER (Standard): Die Funktion läuft mit den Rechten des
-- aufrufenden Nutzers, RLS greift also unverändert. Zusätzlich wird explizit
-- geprüft, dass alle betroffenen Mieter dem Aufrufer gehören — damit hängt die
-- Absicherung nicht allein an der Policy.
-- =============================================================================

create or replace function public.umlage_positionen_ersetzen(
  p_mieter_ids uuid[],
  p_jahr integer,
  p_rows jsonb
)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  fremde integer;
  geschrieben integer;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_mieter_ids is null or array_length(p_mieter_ids, 1) is null then
    raise exception 'Keine Mieter angegeben';
  end if;

  -- Gehören ALLE angegebenen Mieter dem Aufrufer? (Gürtel neben den
  -- Hosenträgern der RLS-Policy.)
  select count(*) into fremde
  from unnest(p_mieter_ids) as m(id)
  where not exists (
    select 1 from public.mieter t where t.id = m.id and t.user_id = uid
  );
  if fremde > 0 then
    raise exception 'Mieter gehoert nicht zum Konto';
  end if;

  -- Ab hier: alles in DIESER Transaktion.
  delete from public.mieter_positionen
   where mieter_id = any(p_mieter_ids)
     and jahr = p_jahr
     and quelle = 'umlage';

  insert into public.mieter_positionen (
    user_id, mieter_id, bezeichnung, betrag, umlageschluessel,
    jahr, umlagefaehig, quelle, lohnanteil, art_35a
  )
  select
    uid,
    (r->>'mieter_id')::uuid,
    r->>'bezeichnung',
    (r->>'betrag')::numeric,
    r->>'umlageschluessel',
    p_jahr,
    true,
    'umlage',
    nullif(r->>'lohnanteil','')::numeric,
    nullif(r->>'art_35a','')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  where (r->>'mieter_id')::uuid = any(p_mieter_ids);

  get diagnostics geschrieben = row_count;
  return geschrieben;
end;
$function$;
