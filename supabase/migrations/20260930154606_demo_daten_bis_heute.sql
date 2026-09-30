-- Demo-Daten laufen mit der Zeit mit — statt am 01.06.2026 stehen zu bleiben
--
-- Anlass (externes Review, 30.09.2026): Die letzten Buchungen der Demo stammten
-- vom 01.06.2026. Ende September standen deshalb alle Mieter mit „Mieteingang
-- September offen" auf dem Dashboard, „als würde niemand zahlen" — und seit
-- Phase 2 zeigt das freigegebene Mietkonto Juni bis September für JEDEN Mieter
-- als unbezahlt. Nebenbei schönte sich die Cashflow-Kennzahl selbst: Sie
-- mittelt die Kosten der letzten 12 Monate, und jeder leere Monat senkte den
-- Schnitt (629 €/Monat statt 1.006 € — gemessen).
--
-- WARUM FORTSCHREIBEN STATT VERSCHIEBEN: Alle Daten um N Monate zu verschieben,
-- macht aus Januar–Dezember 2025 etwa April 2025–März 2026. Die Anlage V für
-- 2025 — Standard auf der Steuerseite — zeigte dann neun Monate Miete. Deshalb:
--   1. Ganze JAHRE verschieben, sobald eines vergangen ist (Kalenderjahre und
--      Anlage V bleiben vollständig; alle Datumswerte wandern gemeinsam, damit
--      Mietbeginn, Auszug, Zinsbindung und Buchungen zueinander passen).
--   2. Die Monate danach bis HEUTE fortschreiben:
--        Mieten aus dem VORMONAT — nur für Verträge, die an dem Tag laufen
--          (sonst bekäme eine geräumte Wohnung wieder Miete);
--        Kosten aus dem VORJAHRESMONAT — sie sind saisonal (Grundsteuer
--          quartalsweise, Versicherung jährlich).
--   3. Im laufenden Monat bleibt GENAU EINE Miete offen. Sonst hätte die
--      Aufgabenliste nichts zu zeigen, und „Miete bestätigen" — die häufigste
--      Handlung eines Vermieters — bliebe unsichtbar.
--   4. „Laufendes" (Mieter-Anliegen, Zählermeldung) liegt im Schnappschuss
--      relativ zum 30.06.2026 und wird tagesgenau auf heute gezogen.
--
-- DATENFEHLER IM SCHNAPPSCHUSS, mitbehoben: Das „Reihenhaus Halle" stand als
-- vermietet mit 1.150 € Miete, der Mieter war aber zum 30.09.2025 ausgezogen.
-- Das Dashboard rechnete die 1.150 € jeden Monat als Soll-Miete ein, die
-- niemand zahlte. Jetzt: Nachmieterin ab 01.11.2025 (ein Monat Leerstand, wie
-- bei einem echten Mieterwechsel). „Leer" wäre die Alternative gewesen — dann
-- stünden zwei von sechs Objekten leer, 33 % Leerstand in Rot.
--
-- NEU IM SCHNAPPSCHUSS: Mieter-Anliegen, Archiv-Einträge und eine
-- Zählermeldung. Ohne sie waren Mieterportal und Archiv leer und blieben in der
-- Demo gesperrt. Kein Scheinkonto: Alle drei Tabellen hängen an der
-- Mieter-ZEILE (`public.mieter`), nicht an einem Anmeldekonto.
--
-- ROBUSTER RESET, zwei Schwächen der alten Funktion:
--   * Sie löschte nur über `user_id`. `anliegen` und `zaehlerstand_meldungen`
--     gehören über `vermieter_id` zum Konto — jeder Reset hätte Duplikate
--     angehäuft.
--   * `insert … select *` verlangt dieselbe Spaltenfolge in Live-Tabelle und
--     Schnappschuss. Die erste Migration, die einer dieser Tabellen eine
--     Spalte hinzufügt, hätte die Demo lahmgelegt. Jetzt werden nur die
--     GEMEINSAMEN Spalten übertragen.
--
-- `p_heute` gibt es für den Test (simulierte Daten), `/api/demo` ruft ohne
-- Argument auf.

-- ---------------------------------------------------------------------------
-- 1) Schnappschuss ergänzen
-- ---------------------------------------------------------------------------
do $$
declare
  demo_id uuid;
  halle uuid;
  hoffmann demo_seed.mieter;
  neumann uuid := gen_random_uuid();
  vorlage demo_seed.einnahmen;
  m int;
  mid_weber uuid; mid_yilmaz uuid; mid_berger uuid; mid_krueger uuid;
  pid_sued uuid; pid_wedding uuid; pid_dresden uuid; pid_halle uuid;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — Schnappschuss unverändert.';
    return;
  end if;

  -- Nachmieterin fürs Reihenhaus (idempotent: nur, wenn noch keine da ist).
  select id into halle from demo_seed.properties where user_id = demo_id and bezeichnung = 'Reihenhaus Halle';
  if halle is not null and not exists (
    select 1 from demo_seed.mieter where prop_id = halle and mietende is null
  ) then
    select * into hoffmann from demo_seed.mieter where prop_id = halle and nachname = 'Hoffmann';
    insert into demo_seed.mieter
    select (jsonb_populate_record(null::demo_seed.mieter, to_jsonb(hoffmann) || jsonb_build_object(
      'id', neumann, 'vorname', 'Julia', 'nachname', 'Neumann',
      'email', null, 'telefon', null, 'iban', null, 'kaution_bank', null, 'mieter_adresse', null,
      'mietbeginn', '2025-11-01', 'mietende', null,
      'kaltmiete', 1250, 'nk_vorauszahlung', 210, 'kaution', 3750,
      'letzte_erhoehung', null, 'miethistorie', null,
      'notiz', 'Nachmieterin nach Auszug Hoffmann (30.09.2025). Neuvermietung zur ortsüblichen Miete.',
      'created_at', '2025-10-20T10:00:00Z'
    ))).*;

    update demo_seed.properties set miete = 1250, obj_status = 'Vermietet' where id = halle;

    -- Mieteingänge 11/2025–06/2026, Form von einer bestehenden Buchung.
    select * into vorlage from demo_seed.einnahmen where user_id = demo_id and kategorie = 'Miete' limit 1;
    for m in 0 .. 7 loop
      insert into demo_seed.einnahmen
      select (jsonb_populate_record(null::demo_seed.einnahmen, to_jsonb(vorlage) || jsonb_build_object(
        'id', gen_random_uuid(), 'prop_id', halle, 'mieter_id', neumann, 'betrag', 1250,
        'buchungsdatum', (date '2025-11-01' + make_interval(months => m))::date,
        'beschreibung', 'Miete Neumann', 'created_at', now()
      ))).*;
    end loop;
  end if;

  -- Neue Schnappschuss-Tabellen, gleiche Spalten wie live.
  create table if not exists demo_seed.anliegen as select * from public.anliegen where false;
  create table if not exists demo_seed.notizen as select * from public.notizen where false;
  create table if not exists demo_seed.zaehlerstand_meldungen as select * from public.zaehlerstand_meldungen where false;

  if exists (select 1 from demo_seed.anliegen) then
    return; -- schon befüllt
  end if;

  select id into mid_weber   from demo_seed.mieter where user_id = demo_id and nachname = 'Weber';
  select id into mid_yilmaz  from demo_seed.mieter where user_id = demo_id and nachname = 'Yılmaz';
  select id into mid_berger  from demo_seed.mieter where user_id = demo_id and nachname = 'Berger';
  select id into mid_krueger from demo_seed.mieter where user_id = demo_id and nachname = 'Krüger';
  select id into pid_sued    from demo_seed.properties where user_id = demo_id and bezeichnung = 'Altbau-ETW Leipzig Süd';
  select id into pid_wedding from demo_seed.properties where user_id = demo_id and bezeichnung = 'ETW Berlin Wedding';
  select id into pid_dresden from demo_seed.properties where user_id = demo_id and bezeichnung = 'Zweifamilienhaus Dresden';
  pid_halle := halle;

  -- Anliegen: Zeitstempel relativ zum 30.06.2026 (dem „Heute" des Schnappschusses).
  insert into demo_seed.anliegen (id, vermieter_id, mieter_id, prop_id, typ, titel, beschreibung, status, antwort, created_at, updated_at) values
    (gen_random_uuid(), demo_id, mid_weber, pid_sued, 'schaden', 'Heizkörper im Bad wird nicht warm',
     'Seit gestern bleibt der Heizkörper im Bad kalt, die anderen Räume sind warm. Entlüften habe ich schon versucht.',
     'offen', null, '2026-06-28T08:40:00Z', '2026-06-28T08:40:00Z'),
    (gen_random_uuid(), demo_id, mid_yilmaz, pid_wedding, 'schaden', 'Wasserhahn in der Küche tropft',
     'Der Hahn tropft auch zugedreht, etwa ein Tropfen pro Sekunde.',
     'in_arbeit', 'Danke für die Meldung. Der Installateur ist beauftragt und meldet sich wegen eines Termins bei Ihnen.',
     '2026-06-19T17:05:00Z', '2026-06-20T09:12:00Z'),
    (gen_random_uuid(), demo_id, mid_berger, pid_dresden, 'dokument', 'Nebenkostenabrechnung 2025 als PDF',
     'Könnten Sie mir die Abrechnung noch einmal als PDF schicken? Ich brauche sie für die Steuererklärung.',
     'erledigt', 'Gern — die Abrechnung liegt jetzt im Portal unter „Dokumente".',
     '2026-05-22T12:30:00Z', '2026-05-23T07:45:00Z');

  -- Zählermeldung eines Mieters, noch nicht übernommen (erscheint in „Termine & Aufgaben").
  insert into demo_seed.zaehlerstand_meldungen (id, vermieter_id, mieter_id, prop_id, art, zaehlernummer, stand, einheit, ablesedatum, notiz, created_at) values
    (gen_random_uuid(), demo_id, mid_krueger, pid_dresden, 'Wasser', 'WZ-4471', 412.370, 'm³', '2026-06-27',
     'Zwischenablesung wegen Austausch des Wasserzählers.', '2026-06-27T18:20:00Z');

  -- Archiv: Einträge ohne Datei (nur Titel, Art, Inhalt).
  insert into demo_seed.notizen (id, user_id, prop_id, mieter_id, titel, kategorie, inhalt, created_at, mieter_freigabe) values
    (gen_random_uuid(), demo_id, pid_sued, mid_weber, 'Mietvertrag Weber', 'Mietvertrag',
     'Unbefristet ab 01.04.2021, Kaltmiete 880 €, NK-Vorauszahlung 160 €, Kaution 2.640 € (Mietkautionskonto).', '2021-03-15T10:00:00Z', false),
    (gen_random_uuid(), demo_id, pid_halle, null, 'Übergabeprotokoll Auszug Hoffmann', 'Übergabeprotokoll',
     'Übergabe am 30.09.2025, Zählerstände erfasst, 3 Schlüssel zurück. Kleinere Gebrauchsspuren im Flur, keine Schäden.', '2025-09-30T15:00:00Z', false),
    (gen_random_uuid(), demo_id, pid_dresden, null, 'Wohngebäudeversicherung 2026', 'Versicherung',
     'Police Nr. 44-1187-2, Beitrag 612 € jährlich, fällig zum 01.02.; Leitungswasser und Sturm eingeschlossen.', '2026-01-12T09:00:00Z', false),
    (gen_random_uuid(), demo_id, pid_halle, null, 'Energieausweis Reihenhaus Halle', 'Energieausweis',
     'Verbrauchsausweis, 128 kWh/(m²·a), Klasse D, gültig bis 2033.', '2023-05-08T11:00:00Z', false),
    (gen_random_uuid(), demo_id, pid_dresden, mid_berger, 'Nebenkostenabrechnung 2025 — Berger', 'Nebenkostenabrechnung',
     'Abrechnungszeitraum 01.01.–31.12.2025. Für die Mieterin im Portal freigegeben.', '2026-05-23T07:40:00Z', true),
    (gen_random_uuid(), demo_id, pid_wedding, null, 'Grundsteuerbescheid 2026', 'Sonstiges',
     'Grundsteuer B, 312 € jährlich, vierteljährlich fällig zum 15.02., 15.05., 15.08., 15.11.', '2026-01-20T08:30:00Z', false);
end $$;

-- ---------------------------------------------------------------------------
-- 2) Reset-Funktion
-- ---------------------------------------------------------------------------
drop function if exists public.demo_zuruecksetzen();

create or replace function public.demo_zuruecksetzen(p_heute date default current_date)
returns void
language plpgsql
security definer
set search_path = public, demo_seed
as $$
declare
  demo_id uuid;
  -- Anlagereihenfolge: Eltern vor Kindern. Gelöscht wird rückwärts.
  tabellen text[] := array[
    'properties', 'mieter', 'einnahmen', 'kosten', 'mieter_positionen',
    'verbrauch', 'kredite', 'vermieter_profil', 'ibans',
    'anliegen', 'notizen', 'zaehlerstand_meldungen'
  ];
  -- Diese Tabellen gehören über `vermieter_id` zum Konto, nicht über `user_id`.
  besitz_vermieter text[] := array['anliegen', 'zaehlerstand_meldungen'];
  -- „Laufendes" wird tagesgenau gezogen, nicht jahresweise verschoben.
  laufend text[] := array['anliegen', 'zaehlerstand_meldungen'];
  -- Jüngster Buchungsmonat und „Heute" des Schnappschusses.
  anker date := date '2026-06-01';
  anker_heute date := date '2026-06-30';
  monat_heute date := date_trunc('month', p_heute)::date;
  jahre int;
  monat date;
  t text; spalten text; besitz text; c record;
  i int;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  -- (a) Löschen, rückwärts.
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
end $$;

comment on function public.demo_zuruecksetzen(date) is
  'Setzt den Demo-Bestand zurück und schreibt ihn bis zum laufenden Monat fort. Siehe Migration 20260930170000.';

revoke all on function public.demo_zuruecksetzen(date) from public, anon, authenticated;
grant execute on function public.demo_zuruecksetzen(date) to service_role;
