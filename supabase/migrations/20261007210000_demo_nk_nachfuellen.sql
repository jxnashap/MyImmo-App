-- Demo: Nebenkosten am Objekt überleben den Reset (Audit 07.10.2026, B5) — OHNE SQL-Editor.
--
-- Ersetzt 20261007193000 (nie ausgeführt): Die wollte `demo_zuruecksetzen()` neu schreiben; deren
-- Text enthält Löschbefehle → Bestätigungsdialog → SQL-Editor, und die Datei war dem Betreiber zu
-- lang zum Kopieren. Hier bleibt die Reset-Funktion unangetastet. Stattdessen füllt eine eigene,
-- reine EINFÜGE-Funktion die zwei Tabellen nach jedem Reset wieder auf (die Kaskade von
-- `properties` hat sie beim Reset geleert). `/api/demo` ruft sie direkt nach `demo_zuruecksetzen()`.
-- Das Jahr wandert wie im Reset jahresweise mit (gleiche Rechnung, Anker 2026-06-01).
--
-- Beispiel „Zweifamilienhaus Dresden“ (d560ceb5…, Krüger 60 m², Berger 70 m²): jeder Schlüssel
-- einmal, Verwaltung nicht umlagefähig, Wasser mit Rest beim Vermieter, CO₂ für das Gebäude
-- (4.000 kg, 220 € → 30,8 kg/m² → 40 % Vermieter = 88 €, verteilt nach Heizkostenanteil 640/760).
-- Idempotent; enthält keine Löschbefehle.

create table if not exists demo_seed.nk_objekt_jahr as select * from public.nk_objekt_jahr where false;
create table if not exists demo_seed.nk_objekt_kosten as select * from public.nk_objekt_kosten where false;

insert into demo_seed.nk_objekt_jahr (id, user_id, prop_id, jahr, flaeche_gesamt, einheiten, mea_gesamt, mieter, co2_kg, co2_kosten, co2_gewerbe, created_at, updated_at)
select gen_random_uuid(), u.id, 'd560ceb5-9dc2-4869-a0c8-41833c061a2c', 2025, 130, 2, null,
       '{"381fd68f-2229-4ada-8174-3027dbe2e91f": {"personen": 1}, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": {"personen": 2}}'::jsonb,
       4000, 220, false, now(), now()
  from auth.users u
 where u.email = 'demo.vermieter@myimmo.test'
   and not exists (select 1 from demo_seed.nk_objekt_jahr s where s.prop_id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c');

insert into demo_seed.nk_objekt_kosten (id, user_id, prop_id, jahr, bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, quelle, sort, created_at, updated_at)
select gen_random_uuid(), u.id, 'd560ceb5-9dc2-4869-a0c8-41833c061a2c', 2025, k.bezeichnung, k.betrag, k.schluessel, k.umlagefaehig,
       k.lohnanteil, k.art_35a, k.nenner, k.werte, 'manuell', k.sort, now(), now()
  from auth.users u
 cross join (values
  ('Grundsteuer',          280.00, 'flaeche',   true,  null::numeric, null::text,     null::numeric, '{}'::jsonb, 1),
  ('Gebäudeversicherung',  325.00, 'flaeche',   true,  null,          null,           null,          '{}'::jsonb, 2),
  ('Wasser / Abwasser',    780.00, 'verbrauch', true,  null,          null,           130,           '{"381fd68f-2229-4ada-8174-3027dbe2e91f": 58, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": 68}'::jsonb, 3),
  ('Heizung / Warmwasser', 1400.00, 'direkt',   true,  null,          null,           null,          '{"381fd68f-2229-4ada-8174-3027dbe2e91f": 640, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": 760}'::jsonb, 4),
  ('Müllabfuhr',           252.00, 'personen',  true,  null,          null,           null,          '{}'::jsonb, 5),
  ('Allgemeinstrom',       120.00, 'einheiten', true,  null,          null,           null,          '{}'::jsonb, 6),
  ('Gartenpflege',         180.00, 'flaeche',   true,  150,           'haushaltsnah', null,          '{}'::jsonb, 7),
  ('Verwaltungskosten',    150.00, 'flaeche',   false, null,          null,           null,          '{}'::jsonb, 8)
 ) as k(bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, sort)
 where u.email = 'demo.vermieter@myimmo.test'
   and not exists (select 1 from demo_seed.nk_objekt_kosten s where s.prop_id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c');

create or replace function public.demo_nk_nachfuellen(p_heute date default current_date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'demo_seed'
as $function$
declare
  demo_id uuid;
  -- Gleiche Jahresverschiebung wie demo_zuruecksetzen() (Anker = jüngster Buchungsmonat des Schnappschusses).
  anker date := date '2026-06-01';
  monat_heute date := date_trunc('month', p_heute)::date;
  jahre int;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then return; end if;
  jahre := ((extract(year from monat_heute) - extract(year from anker)) * 12
            + extract(month from monat_heute) - extract(month from anker))::int / 12;
  if jahre < 0 then jahre := 0; end if;

  insert into public.nk_objekt_jahr (id, user_id, prop_id, jahr, flaeche_gesamt, einheiten, mea_gesamt, mieter, co2_kg, co2_kosten, co2_gewerbe, created_at, updated_at)
  select s.id, demo_id, s.prop_id, s.jahr + jahre, s.flaeche_gesamt, s.einheiten, s.mea_gesamt, s.mieter,
         s.co2_kg, s.co2_kosten, coalesce(s.co2_gewerbe, false), s.created_at, s.updated_at
    from demo_seed.nk_objekt_jahr s
   where exists (select 1 from public.properties p where p.id = s.prop_id and p.user_id = demo_id)
  on conflict do nothing;

  insert into public.nk_objekt_kosten (id, user_id, prop_id, jahr, bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, quelle, sort, created_at, updated_at)
  select s.id, demo_id, s.prop_id, s.jahr + jahre, s.bezeichnung, s.betrag, s.schluessel, s.umlagefaehig,
         s.lohnanteil, s.art_35a, s.nenner, s.werte, s.quelle, s.sort, s.created_at, s.updated_at
    from demo_seed.nk_objekt_kosten s
   where exists (select 1 from public.properties p where p.id = s.prop_id and p.user_id = demo_id)
     and not exists (select 1 from public.nk_objekt_kosten k where k.id = s.id)
     and not exists (select 1 from public.nk_objekt_kosten k where k.prop_id = s.prop_id and k.jahr = s.jahr + jahre and k.bezeichnung = s.bezeichnung);
end $function$;

-- Nur die Service-Role (/api/demo). PUBLIC ausdrücklich, sonst erben anon/authenticated das Recht.
revoke execute on function public.demo_nk_nachfuellen(date) from public, anon, authenticated;
grant execute on function public.demo_nk_nachfuellen(date) to service_role;

-- Den aktuellen Demo-Bestand sofort auffüllen.
select public.demo_nk_nachfuellen();
