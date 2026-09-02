-- Bankkonten in den Demo-Schnappschuss aufnehmen.
--
-- Beim ersten Schnappschuss (20260829213000_demo_seed) hatte das Demo-Konto noch
-- keine Bankverbindungen; die Tabelle fehlte deshalb in der Liste. Am 29.08.2026
-- kamen zwei dazu (Mietkonto, Ruecklagen) — ohne diese Ergaenzung wuerde sie der
-- naechste Reset ersatzlos loeschen, weil `demo_zuruecksetzen()` alle
-- Nutzerzeilen entfernt und nur aus dem Schnappschuss zurueckschreibt.
--
-- Hinweis zur Verschluesselung: `ibans.iban`/`inhaber` sind normalerweise
-- App-Layer-verschluesselt. `decryptIbanRow` laesst Klartext-Altzeilen aber
-- unveraendert durch (lib/ibanData.ts) — die Demo-Konten liegen deshalb bewusst
-- im Klartext. Es sind offizielle Beispiel-IBANs, keine echten Bankdaten.

do $$
declare demo_id uuid;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden - uebersprungen.';
    return;
  end if;
  drop table if exists demo_seed.ibans;
  execute format('create table demo_seed.ibans as select * from public.ibans where user_id = %L', demo_id);
end $$;

grant select on demo_seed.ibans to service_role;

create or replace function public.demo_zuruecksetzen()
returns void
language plpgsql
security definer
set search_path = public, demo_seed
as $$
declare
  demo_id uuid;
  -- Anlagereihenfolge: Eltern vor Kindern. `ibans` haengt an keiner anderen
  -- Tabelle und steht deshalb am Ende.
  tabellen text[] := array[
    'properties', 'mieter', 'einnahmen', 'kosten',
    'mieter_positionen', 'verbrauch', 'kredite', 'vermieter_profil', 'ibans'
  ];
  i int;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  for i in reverse array_length(tabellen, 1) .. 1 loop
    execute format('delete from public.%I where user_id = %L', tabellen[i], demo_id);
  end loop;

  for i in 1 .. array_length(tabellen, 1) loop
    execute format('insert into public.%I select * from demo_seed.%I', tabellen[i], tabellen[i]);
  end loop;
end $$;

revoke all on function public.demo_zuruecksetzen() from public, anon, authenticated;
grant execute on function public.demo_zuruecksetzen() to service_role;
