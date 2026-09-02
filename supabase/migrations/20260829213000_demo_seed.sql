-- Demo-Bestand sichern und wiederherstellbar machen
--
-- Ausgangslage (29.08.2026): Das Demo-Konto demo.vermieter@myimmo.test existiert
-- seit dem 01.07.2026 und ist gefuellt — 6 Objekte, 6 Mieter, 99 Einnahmen,
-- 90 Kosten, 48 Mieter-Positionen, 5 Verbrauchswerte, 4 Kredite. Angemeldet hat
-- sich damit nie jemand; die Daten stammen aus einem einmaligen Seed, der
-- NIRGENDS im Repo liegt. Geht der Bestand kaputt, ist er weg.
--
-- Das ist die Voraussetzung fuer den geplanten oeffentlichen Demo-Zugang: Sobald
-- sich Besucher ein gemeinsames Konto teilen, veraendert der erste, der etwas
-- loescht, die Demo fuer alle danach. Ohne Ruecksetzung zerstoert sich so ein
-- Zugang selbst.
--
-- Diese Migration legt deshalb einen Schnappschuss im Schema `demo_seed` an und
-- eine Funktion, die den Live-Bestand daraus wiederherstellt.
--
-- WICHTIG: Der Schnappschuss wird aus den AKTUELLEN Live-Daten gezogen. Diese
-- Migration also nur laufen lassen, solange der Bestand unberuehrt ist.

create schema if not exists demo_seed;

-- Kein Zugriff fuer normale Nutzer: Das Schema liegt ausserhalb der API-Schemas,
-- zusaetzlich werden die Rechte hier explizit entzogen.
revoke all on schema demo_seed from anon, authenticated;

do $$
declare
  demo_id uuid;
  t text;
  tabellen text[] := array[
    'properties', 'mieter', 'einnahmen', 'kosten',
    'mieter_positionen', 'verbrauch', 'kredite', 'vermieter_profil'
  ];
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — Schnappschuss uebersprungen.';
    return;
  end if;

  foreach t in array tabellen loop
    execute format('drop table if exists demo_seed.%I', t);
    execute format(
      'create table demo_seed.%I as select * from public.%I where user_id = %L',
      t, t, demo_id
    );
  end loop;
end $$;

-- Setzt den Demo-Bestand auf den Schnappschuss zurueck.
--
-- Loeschreihenfolge ist umgekehrt zur Anlagereihenfolge (Fremdschluessel).
-- `konto_freischaltung` wird BEWUSST nicht angefasst: Ein fehlgeschlagener
-- Durchlauf wuerde das Demo-Konto sonst aussperren, und die Freischaltung ist
-- kein Inhalt, den ein Besucher kaputtmachen kann.
create or replace function public.demo_zuruecksetzen()
returns void
language plpgsql
security definer
set search_path = public, demo_seed
as $$
declare
  demo_id uuid;
  t text;
  -- Anlagereihenfolge: Eltern vor Kindern.
  tabellen text[] := array[
    'properties', 'mieter', 'einnahmen', 'kosten',
    'mieter_positionen', 'verbrauch', 'kredite', 'vermieter_profil'
  ];
  i int;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  -- Rueckwaerts loeschen, damit keine Fremdschluessel brechen.
  for i in reverse array_length(tabellen, 1) .. 1 loop
    execute format('delete from public.%I where user_id = %L', tabellen[i], demo_id);
  end loop;

  -- Vorwaerts wieder einfuegen.
  for i in 1 .. array_length(tabellen, 1) loop
    execute format(
      'insert into public.%I select * from demo_seed.%I',
      tabellen[i], tabellen[i]
    );
  end loop;
end $$;

-- Nur der Server (Service-Role) darf zuruecksetzen, niemals ein Besucher.
revoke all on function public.demo_zuruecksetzen() from public, anon, authenticated;
