-- Demo: Nebenkosten am Objekt überleben den Reset (Audit 07.10.2026, B5).
--
-- WIRD IM SQL-EDITOR AUSGEFÜHRT (enthält delete; apply_migration liefe in den Bestätigungsdialog).
-- Idempotent.
--
-- Befund: `demo_zuruecksetzen()` löscht die Demo-Objekte und legt sie neu an; die Kaskade von
-- `properties` nahm `nk_objekt_kosten`/`nk_objekt_jahr` mit (0 Zeilen nach jedem Demo-Start). Die
-- frühere Migration 20261007113957 behauptete „nicht im Reset“ — das stimmte nicht.
-- Jetzt: beide Tabellen in `demo_seed` und in `tabellen` der Reset-Funktion. Der Reset verschiebt
-- `jahr` mit den übrigen Daten jahresweise — das Beispiel bleibt damit „letztes Jahr“.
--
-- Beispiel „Zweifamilienhaus Dresden“ (d560ceb5…, Krüger 60 m², Berger 70 m²): jeder Schlüssel
-- einmal, Verwaltung nicht umlagefähig, Wasser mit Rest beim Vermieter, CO₂ für das Gebäude
-- (4.000 kg, 220 € → 30,8 kg/m² → 40 % Vermieter = 88 €, verteilt nach Heizkostenanteil 640/760).

-- ---- Schnappschuss-Tabellen ---------------------------------------------------------------------
create table if not exists demo_seed.nk_objekt_jahr as select * from public.nk_objekt_jahr where false;
create table if not exists demo_seed.nk_objekt_kosten as select * from public.nk_objekt_kosten where false;
-- Spalten, die nach dem ersten Lauf in public dazukamen, nachziehen (der Reset kopiert nur gemeinsame).
alter table demo_seed.nk_objekt_jahr add column if not exists co2_kg numeric(12,2);
alter table demo_seed.nk_objekt_jahr add column if not exists co2_kosten numeric(12,2);
alter table demo_seed.nk_objekt_jahr add column if not exists co2_gewerbe boolean;

delete from demo_seed.nk_objekt_kosten where prop_id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c';
delete from demo_seed.nk_objekt_jahr where prop_id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c';

insert into demo_seed.nk_objekt_jahr (id, user_id, prop_id, jahr, flaeche_gesamt, einheiten, mea_gesamt, mieter, co2_kg, co2_kosten, co2_gewerbe, created_at, updated_at)
select gen_random_uuid(), u.id, 'd560ceb5-9dc2-4869-a0c8-41833c061a2c', 2025, 130, 2, null,
       '{"381fd68f-2229-4ada-8174-3027dbe2e91f": {"personen": 1}, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": {"personen": 2}}'::jsonb,
       4000, 220, false, now(), now()
  from auth.users u where u.email = 'demo.vermieter@myimmo.test';

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
 where u.email = 'demo.vermieter@myimmo.test';

-- ---- Reset-Funktion: unverändert bis auf die zwei Tabellen in `tabellen` -------------------------
CREATE OR REPLACE FUNCTION public.demo_zuruecksetzen(p_heute date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'demo_seed'
AS $function$
declare
  demo_id uuid;
  -- Anlagereihenfolge: Eltern vor Kindern. Gelöscht wird rückwärts.
  tabellen text[] := array[
    'properties', 'mieter', 'einnahmen', 'kosten', 'mieter_positionen',
    'nk_objekt_jahr', 'nk_objekt_kosten',
    'verbrauch', 'kredite', 'vermieter_profil', 'ibans',
    'anliegen', 'notizen', 'zaehlerstand_meldungen', 'firmen'
  ];
  -- Diese Tabellen gehören über `vermieter_id` zum Konto, nicht über `user_id`.
  besitz_vermieter text[] := array['anliegen', 'zaehlerstand_meldungen'];
  -- „Laufendes" wird tagesgenau gezogen, nicht jahresweise verschoben.
  laufend text[] := array['anliegen', 'zaehlerstand_meldungen'];
  -- Jüngster Buchungsmonat und „Heute" des Schnappschusses.
  anker date := date '2026-06-01';
  anker_heute date := date '2026-06-30';
  monat_heute date := date_trunc('month', p_heute)::date;
  tage int := p_heute - date '2026-06-30';
  jahre int;
  monat date;
  t text; spalten text; besitz text; c record;
  i int;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  -- (a) Löschen, rückwärts. Aufträge zuerst (Rückmeldungen gehen per Cascade).
  delete from public.auftraege where vermieter_id = demo_id;
  for i in reverse array_length(tabellen, 1) .. 1 loop
    besitz := case when tabellen[i] = any(besitz_vermieter) then 'vermieter_id' else 'user_id' end;
    execute format('delete from public.%I where %I = %L', tabellen[i], besitz, demo_id);
  end loop;

  -- (b) Einfügen — nur gemeinsame Spalten.
  for i in 1 .. array_length(tabellen, 1) loop
    t := tabellen[i];
    select string_agg(format('%I', l.column_name), ', ' order by l.ordinal_position) into spalten
      from information_schema.columns l
      join information_schema.columns s
        on s.table_schema = 'demo_seed' and s.table_name = t and s.column_name = l.column_name
     where l.table_schema = 'public' and l.table_name = t;
    if spalten is null then continue; end if; -- Schnappschuss-Tabelle fehlt
    execute format('insert into public.%I (%s) select %s from demo_seed.%I', t, spalten, spalten, t);
  end loop;

  -- (b2) Aufträge: Partner über die E-Mail, Daten tagesgenau verschoben.
  insert into public.auftraege
    (id, vermieter_id, service_user_id, prop_id, anliegen_id, mieter_id, firma_id, objekt_name, vermieter_name,
     service_name, titel, beschreibung, termin, status, antwort, erstellt_von, public_token, public_token_ablauf,
     betrag, lohnanteil, created_at, updated_at)
  select a.id, demo_id, u.id, a.prop_id, a.anliegen_id, a.mieter_id, a.firma_id, a.objekt_name, a.vermieter_name,
         a.service_name, a.titel, a.beschreibung, a.termin + tage, a.status, a.antwort, a.erstellt_von, a.public_token,
         a.public_token_ablauf + make_interval(days => tage),
         a.betrag, a.lohnanteil, a.created_at + make_interval(days => tage), a.updated_at + make_interval(days => tage)
    from demo_seed.auftraege a
    left join auth.users u on u.email = a.service_email;
  insert into public.auftrag_rueckmeldungen (id, auftrag_id, art, firma, kontakt, termin, nachricht, created_at, gelesen)
  select r.id, r.auftrag_id, r.art, r.firma, r.kontakt, r.termin + tage, r.nachricht,
         r.created_at + make_interval(days => tage), r.gelesen
    from demo_seed.auftrag_rueckmeldungen r;

  -- (c) Ganze Jahre verschieben, sobald seit dem Anker eines vergangen ist.
  jahre := ((extract(year from monat_heute) - extract(year from anker)) * 12
            + extract(month from monat_heute) - extract(month from anker))::int / 12;
  if jahre > 0 then
    foreach t in array tabellen loop
      if t = any(laufend) then continue; end if;
      besitz := case when t = any(besitz_vermieter) then 'vermieter_id' else 'user_id' end;
      for c in
        select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = t
           and (data_type in ('date', 'timestamp with time zone', 'timestamp without time zone')
                or column_name in ('jahr', 'afa_start_jahr'))
      loop
        if c.data_type in ('integer', 'smallint', 'bigint') then
          execute format('update public.%I set %I = %I + %s where %I = %L', t, c.column_name, c.column_name, jahre, besitz, demo_id);
        elsif c.data_type = 'date' then
          execute format('update public.%I set %I = (%I + make_interval(years => %s))::date where %I = %L', t, c.column_name, c.column_name, jahre, besitz, demo_id);
        else
          execute format('update public.%I set %I = %I + make_interval(years => %s) where %I = %L', t, c.column_name, c.column_name, jahre, besitz, demo_id);
        end if;
      end loop;
    end loop;
  end if;

  -- (d) Laufendes auf heute ziehen.
  update public.anliegen
     set created_at = created_at + (p_heute - anker_heute) * interval '1 day',
         updated_at = updated_at + (p_heute - anker_heute) * interval '1 day'
   where vermieter_id = demo_id;
  update public.zaehlerstand_meldungen
     set created_at = created_at + (p_heute - anker_heute) * interval '1 day',
         ablesedatum = ablesedatum + (p_heute - anker_heute)
   where vermieter_id = demo_id;

  -- (e) Fortschreiben bis zum laufenden Monat.
  monat := (anker + make_interval(years => jahre, months => 1))::date;
  while monat <= monat_heute loop
    -- Mieten aus dem Vormonat, nur für laufende Verträge.
    insert into public.einnahmen
    select (jsonb_populate_record(null::public.einnahmen, to_jsonb(e) || jsonb_build_object(
      'id', gen_random_uuid(),
      'buchungsdatum', (e.buchungsdatum + interval '1 month')::date,
      'soll_monat', null,
      'created_at', now()
    ))).*
      from public.einnahmen e
      left join public.mieter m on m.id = e.mieter_id
     where e.user_id = demo_id
       and e.buchungsdatum >= (monat - interval '1 month')::date
       and e.buchungsdatum < monat
       and (e.mieter_id is null or (
             (m.mietbeginn is null or m.mietbeginn <= (e.buchungsdatum + interval '1 month')::date)
         and (m.mietende is null or m.mietende >= (e.buchungsdatum + interval '1 month')::date)));

    -- Kosten aus dem Vorjahresmonat.
    insert into public.kosten
    select (jsonb_populate_record(null::public.kosten, to_jsonb(k) || jsonb_build_object(
      'id', gen_random_uuid(),
      'buchungsdatum', (k.buchungsdatum + interval '1 year')::date,
      'created_at', now()
    ))).*
      from public.kosten k
     where k.user_id = demo_id
       and k.buchungsdatum >= (monat - interval '1 year')::date
       and k.buchungsdatum < (monat - interval '1 year' + interval '1 month')::date;

    monat := (monat + interval '1 month')::date;
  end loop;

  -- (f) Im laufenden Monat bleibt genau eine Miete offen.
  delete from public.einnahmen
   where id = (
     select e.id from public.einnahmen e
       join public.mieter m on m.id = e.mieter_id
      where e.user_id = demo_id and e.kategorie = 'Miete'
        and e.buchungsdatum >= monat_heute
        and e.buchungsdatum < (monat_heute + interval '1 month')::date
      order by m.nachname
      limit 1);
end $function$;

-- ---- Den aktuellen Demo-Bestand sofort auffüllen (sonst erst nach dem nächsten Demo-Start) ----------
insert into public.nk_objekt_jahr (id, user_id, prop_id, jahr, flaeche_gesamt, einheiten, mea_gesamt, mieter, co2_kg, co2_kosten, co2_gewerbe, created_at, updated_at)
select s.id, s.user_id, s.prop_id, s.jahr, s.flaeche_gesamt, s.einheiten, s.mea_gesamt, s.mieter, s.co2_kg, s.co2_kosten, coalesce(s.co2_gewerbe, false), s.created_at, s.updated_at
  from demo_seed.nk_objekt_jahr s
 where exists (select 1 from public.properties p where p.id = s.prop_id)
on conflict (prop_id, jahr) do nothing;
insert into public.nk_objekt_kosten (id, user_id, prop_id, jahr, bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, quelle, sort, created_at, updated_at)
select s.id, s.user_id, s.prop_id, s.jahr, s.bezeichnung, s.betrag, s.schluessel, s.umlagefaehig, s.lohnanteil, s.art_35a, s.nenner, s.werte, s.quelle, s.sort, s.created_at, s.updated_at
  from demo_seed.nk_objekt_kosten s
 where exists (select 1 from public.properties p where p.id = s.prop_id)
   and not exists (select 1 from public.nk_objekt_kosten x where x.prop_id = s.prop_id and x.jahr = s.jahr and x.bezeichnung = s.bezeichnung);
