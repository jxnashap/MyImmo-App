-- Demo-Daten: Jahreskosten 2026, keine Kosten vor dem Kauf, fallende Zinsen
-- (Gesamtprüfung 07.10.2026, B27; umgesetzt in Paket P8 am 09.10.2026).
--
-- Drei Fehler im Demo-Bestand, alle mit Wirkung auf Dashboard, /cashflow und Objektseiten:
--
-- 1. JAHRESKOSTEN 2026 FEHLTEN. Der Schnappschuss reicht bis Juni 2026, enthielt für 2026 aber nur
--    Hausgeld, Zinsen und eine Grundsteuer — keine Versicherung (1.214 €), Grundsteuer der übrigen
--    Objekte (845 €), Müll (420 €), Straßenreinigung (96 €), Garten (180 €) und kein Hausgeld der
--    ETW Leipzig Zentrum (840 €). Der Kostenschnitt der letzten 12 Monate war dadurch zu niedrig,
--    der Demo-Cashflow zu gut. Jetzt: dieselben Posten wie Januar–Juni 2025, je einmal.
--
-- 2. KOSTEN VOR DEM KAUF. Die ETW Leipzig Zentrum hatte Hausgeld und Versicherung im Januar 2025,
--    gekauft war sie laut Stammdaten aber erst am 01.02.2025. Statt die zwei Buchungen zu entfernen
--    (das ginge nur über den SQL-Editor), rückt das Kaufdatum auf den 01.12.2024 — die Wohnung steht
--    leer, hat weder Mieter noch Darlehen, nichts sonst hängt am Datum.
--
-- 3. ZINSEN SPRANGEN NACH OBEN. `demo_zuruecksetzen()` schreibt Kosten aus dem VORJAHRESMONAT fort —
--    für Schuldzinsen falsch: Juli 2026 bekam den Zins von Juli 2025, höher als Juni 2026
--    (Leipzig Süd 311,50 € → 322,64 €). Die Reset-Funktion bleibt unangetastet (sie enthält
--    Löschbefehle → Bestätigungsdialog). Stattdessen setzt `demo_zinsen_fortschreiben()` direkt
--    nach dem Reset die fortgeschriebenen Zinsen neu: letzter Zins des Schnappschusses minus die
--    mittlere monatliche Abnahme des Jahres davor, je Folgemonat. So fällt die Reihe gleichmäßig
--    weiter, wie im Schnappschuss (dort −1,01 € je Monat bei Leipzig Süd).
--
-- Enthält keine Lösch- oder Entfernen-Befehle. Idempotent.

do $$
declare
  demo_id uuid;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — Schnappschuss unverändert.';
    return;
  end if;

  -- 1) Jahreskosten Januar–Juni 2026 wie im Vorjahr. Hausgeld je Monat, die übrigen je Jahr einmal.
  insert into demo_seed.kosten
  select (jsonb_populate_record(null::demo_seed.kosten, to_jsonb(k) || jsonb_build_object(
    'id', gen_random_uuid(),
    'buchungsdatum', (k.buchungsdatum + interval '1 year')::date,
    'rechnung_data', null, 'rechnung_name', null, 'rechnung_type', null, 'rechnung_size', null, 'rechnung_path', null,
    'created_at', now()
  ))).*
    from demo_seed.kosten k
   where k.user_id = demo_id
     and k.buchungsdatum >= date '2025-01-01' and k.buchungsdatum < date '2025-07-01'
     and k.kategorie in ('Versicherung', 'Grundsteuer', 'Müll', 'Straßenreinigung', 'Gartenpflege', 'Hausgeld / WEG')
     and not exists (
       select 1 from demo_seed.kosten n
        where n.user_id = k.user_id
          and n.prop_id is not distinct from k.prop_id
          and n.kategorie = k.kategorie
          and case when k.kategorie = 'Hausgeld / WEG'
                   then date_trunc('month', n.buchungsdatum) = date_trunc('month', k.buchungsdatum + interval '1 year')
                   else n.buchungsdatum >= date '2026-01-01' and n.buchungsdatum < date '2027-01-01' end
     );

  -- 2) Kaufdatum der ETW Leipzig Zentrum vor die erste Kostenbuchung.
  update demo_seed.properties
     set kaufdatum = date '2024-12-01'
   where user_id = demo_id and bezeichnung = 'ETW Leipzig Zentrum' and kaufdatum = date '2025-02-01';
end $$;

-- 3) Fortgeschriebene Zinsen nach dem Reset neu setzen.
create or replace function public.demo_zinsen_fortschreiben(p_heute date default current_date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  demo_id uuid;
  -- Gleiche Jahresverschiebung wie demo_zuruecksetzen() und demo_nk_nachfuellen().
  anker date := date '2026-06-01';
  monat_heute date := date_trunc('month', p_heute)::date;
  jahre int;
  grenze date;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then return; end if;
  jahre := ((extract(year from monat_heute) - extract(year from anker)) * 12
            + extract(month from monat_heute) - extract(month from anker))::int / 12;
  if jahre < 0 then jahre := 0; end if;
  -- Letzter Monat des (verschobenen) Schnappschusses; alles danach ist fortgeschrieben.
  grenze := (anker + make_interval(years => jahre))::date;

  update public.kosten k
     set betrag = round(b.letzter - greatest(b.vorjahr - b.letzter, 0) / 12.0
                        * ((extract(year from k.buchungsdatum) - extract(year from grenze)) * 12
                           + extract(month from k.buchungsdatum) - extract(month from grenze)), 2)
    from (
      select l.prop_id, l.betrag as letzter, v.betrag as vorjahr
        from public.kosten l
        join public.kosten v
          on v.user_id = l.user_id and v.prop_id = l.prop_id and v.kategorie = 'Schuldzinsen'
         and date_trunc('month', v.buchungsdatum) = (grenze - interval '12 months')
       where l.user_id = demo_id and l.kategorie = 'Schuldzinsen'
         and date_trunc('month', l.buchungsdatum) = grenze
    ) b
   where k.user_id = demo_id
     and k.kategorie = 'Schuldzinsen'
     and k.prop_id = b.prop_id
     and k.buchungsdatum >= (grenze + interval '1 month');
end $function$;

-- Nur die Service-Role (/api/demo). PUBLIC ausdrücklich, sonst erben anon/authenticated das Recht.
revoke execute on function public.demo_zinsen_fortschreiben(date) from public, anon, authenticated;
grant execute on function public.demo_zinsen_fortschreiben(date) to service_role;

-- Den aktuellen Demo-Bestand sofort korrigieren (die Jahreskosten und das Kaufdatum kommen mit dem
-- nächsten Demo-Start aus dem Schnappschuss).
select public.demo_zinsen_fortschreiben();
