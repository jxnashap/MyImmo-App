-- Demo: Mietbuchungen = Warmmiete laut Vertrag, Kaufdaten, Kredit-Auszahlungen
--
-- Anlass (zweite Review-Runde, 30.09.2026):
--
-- 1. MIETBUCHUNGEN WAREN IN SICH WIDERSPRÜCHLICH. Sie hießen „Warmmiete Thomas
--    Krüger", trugen einen Nebenkosten-Anteil von 150 €, der Betrag war aber
--    ungefähr die KALTmiete (840 € bei 860 € kalt + 150 € NK). Rechnerisch
--    ergab das 690 € Kaltmiete. Folgen über das Mietkonto hinaus: Die Anlage V
--    trennt Miete und Umlagen falsch, und die NK-Abrechnung rechnet mit den
--    gebuchten Vorauszahlungen. Am 30.09. in CLAUDE.md noch als
--    „Schönheitsfehler" eingeordnet — das war falsch.
--    Jetzt: Betrag = Kaltmiete + NK-Vorauszahlung + Stellplatz des Vertrags,
--    NK-Anteil = NK-Vorauszahlung. Historische Mieterhöhungen bildet die Demo
--    damit nicht ab; alle Monate tragen den heutigen Vertragsstand.
--
-- 2. KEIN OBJEKT HATTE EIN KAUFDATUM. Die Steuerseite warnte deshalb bei jedem
--    Objekt „Kein Anschaffungsdatum hinterlegt" — auf der Seite, die seit
--    Phase 2 als Kaufgrund freigeschaltet ist.
--
-- 3. KEIN KREDIT HATTE EINE AUSZAHLUNG, und `laufzeit` enthielt Jahre (30),
--    während das Formular damals ein Endjahr verlangte. Das Formular fragt
--    jetzt nach Jahren (so, wie ALLE echten Nutzer es ausgefüllt hatten);
--    mit Auszahlung zeigt die Liste „30 Jahre · bis 2051".
--
-- Die Daten sind aufeinander abgestimmt: Auszahlung = Zinsbindung minus 10
-- bzw. 15 Jahre, Kauf kurz davor, Mietbeginne passen (Dresden: Kauf 06/2019,
-- Auszahlung 07/2019, Krüger ab 08/2019). Bezug über Namen, keine erzeugten IDs.

do $$
declare
  demo_id uuid;
  o record;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — nichts geändert.';
    return;
  end if;

  -- (1) Mietbuchungen auf den Vertrag bringen.
  update demo_seed.einnahmen e
     set betrag = coalesce(m.kaltmiete, 0) + coalesce(m.nk_vorauszahlung, 0) + coalesce(m.stellplatz_miete, 0),
         nk_anteil = m.nk_vorauszahlung,
         beschreibung = 'Warmmiete ' || m.vorname || ' ' || m.nachname
    from demo_seed.mieter m
   where m.id = e.mieter_id
     and e.user_id = demo_id
     and e.kategorie = 'Miete';

  -- (2) Kaufdaten.
  for o in
    select * from (values
      ('Altbau-ETW Leipzig Süd',      date '2021-03-15'),
      ('ETW Berlin Wedding',          date '2020-12-01'),
      ('ETW Leipzig Zentrum',         date '2025-02-01'),
      ('Neubau-ETW Leipzig Plagwitz', date '2023-08-15'),
      ('Zweifamilienhaus Dresden',    date '2019-06-01'),
      ('Reihenhaus Halle',            date '2017-10-01')
    ) as v(bezeichnung, kaufdatum)
  loop
    update demo_seed.properties set kaufdatum = o.kaufdatum
     where user_id = demo_id and bezeichnung = o.bezeichnung;
  end loop;

  -- (3) Kredit-Auszahlungen (Zinsbindung − 10 bzw. 15 Jahre).
  for o in
    select * from (values
      ('Altbau-ETW Leipzig Süd',      date '2021-04-01'),
      ('ETW Berlin Wedding',          date '2021-01-01'),
      ('Neubau-ETW Leipzig Plagwitz', date '2023-10-01'),
      ('Zweifamilienhaus Dresden',    date '2019-07-01')
    ) as v(bezeichnung, auszahlung)
  loop
    update demo_seed.kredite k set auszahlung_datum = o.auszahlung
      from demo_seed.properties p
     where p.id = k.prop_id and p.user_id = demo_id and p.bezeichnung = o.bezeichnung;
  end loop;
end $$;

-- Live-Bestand sofort angleichen, nicht erst beim nächsten Demo-Start.
select public.demo_zuruecksetzen();
