-- Demo-Konto: Schreibsperre auf Datenbankebene
--
-- Vorgabe des Betreibers (30.08.2026): Die oeffentliche Demo soll ein
-- Schaustueck sein, kein Sandkasten. Felder nicht bearbeitbar, keine Werkzeuge,
-- die schreiben — Ausnahme ist das Mieterhoehungs-Dokument samt PDF, das
-- niemand speichert.
--
-- WARUM AUF DB-EBENE und nicht in den Server-Actions:
-- Es gibt 128 exportierte Server-Actions und 14 API-Routen. Jede einzeln zu
-- bewachen heisst, dass die naechste hinzugefuegte Action die Sperre vergisst —
-- und niemand merkt es, weil in der Demo optisch alles richtig aussieht. Eine
-- restriktive RLS-Policy greift dagegen unabhaengig vom Weg: Server-Action,
-- API-Route, direkter PostgREST-Aufruf mit dem Demo-Token. Das ist dieselbe
-- Ueberlegung wie in `lib/demo.ts`: "Das Ausgrauen allein waere reine Optik."
--
-- WAS NICHT gesperrt wird:
--   * SELECT — die Demo muss lesbar bleiben.
--   * Die Service-Role. `demo_zuruecksetzen()` laeuft als SECURITY DEFINER und
--     muss weiter loeschen und schreiben duerfen, sonst gibt es keinen Reset.
--     Restriktive Policies gelten nur fuer die Rolle `authenticated`.
--   * Alle anderen Nutzer. Die Policies pruefen ausschliesslich auf die eine
--     Demo-Nutzer-ID; fuer jeden anderen `auth.uid()` sind sie wahr und damit
--     wirkungslos.

-- ID statt E-Mail-Lookup in der Policy: Ein `select id from auth.users where
-- email = ...` liefe bei JEDER geprueften Zeile mit. Die Funktion ist STABLE,
-- damit der Planer sie einmal pro Anweisung auswertet.
create or replace function public.ist_demo_nutzer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.uid() = 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4'::uuid, false);
$$;

comment on function public.ist_demo_nutzer() is
  'Wahr, wenn die aktuelle Sitzung das oeffentliche Demo-Konto ist. Basis der Schreibsperre; siehe lib/demo.ts.';

revoke all on function public.ist_demo_nutzer() from public;
grant execute on function public.ist_demo_nutzer() to authenticated, anon;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity          -- nur Tabellen, die ueberhaupt RLS haben
  loop
    -- Getrennte Policies je Operation. Ein einzelnes `for all` wuerde ueber die
    -- USING-Klausel auch SELECT erfassen und die Demo blind machen.
    execute format('drop policy if exists demo_kein_insert on public.%I', t.relname);
    execute format(
      'create policy demo_kein_insert on public.%I as restrictive for insert to authenticated with check (not public.ist_demo_nutzer())',
      t.relname
    );

    execute format('drop policy if exists demo_kein_update on public.%I', t.relname);
    execute format(
      'create policy demo_kein_update on public.%I as restrictive for update to authenticated using (not public.ist_demo_nutzer()) with check (not public.ist_demo_nutzer())',
      t.relname
    );

    execute format('drop policy if exists demo_kein_delete on public.%I', t.relname);
    execute format(
      'create policy demo_kein_delete on public.%I as restrictive for delete to authenticated using (not public.ist_demo_nutzer())',
      t.relname
    );
  end loop;
end $$;
