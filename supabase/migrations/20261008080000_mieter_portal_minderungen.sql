-- Mieterportal sieht die erfasste Mietminderung (Gesamtprüfung P7, B11/B15): Ohne sie zeigte das
-- Portal einen geminderten Monat als „teilweise bestätigt“, der Vermieter als bezahlt.
-- Spalte am ENDE angehängt (create or replace erlaubt nur das), Optionen wie bisher.
create or replace view public.mieter_portal with (security_barrier = true) as
 select id, prop_id, vorname, nachname, einheit, flaeche, mietbeginn, mietende, kuendigung, kaltmiete,
        nk_vorauszahlung, stellplatz, stellplatz_miete, kaution, kaution_status, mietart, minderungen
   from mieter m
  where mieter_zugang_aktiv(id);
