-- Verortung merkt sich ihr Ergebnis (01.10.2026).
--
-- Nur 7 von 23 echten Objekten standen auf der Karte. Nominatim antwortet unter
-- Last mit 429; die App hielt das für „nicht gefunden" und schickte dieselbe
-- Anfrage bei jedem Kartenaufruf erneut — laut Nominatim-Nutzungsregeln ein
-- Sperrgrund („Clients sending repeatedly the same query may be classified as
-- faulty and blocked"). Jetzt steht das Ergebnis in der Zeile:
--   ok              — Koordinaten in lat/lng
--   nicht_gefunden  — erst nach einer Adressänderung erneut (das Speichern setzt zurück)
--   gedrosselt      — frühestens nach einer Pause erneut (lib/geocode.ts)
-- Kein delete, keine Datenänderung am Bestand.

alter table public.properties
  add column if not exists geo_status text,
  add column if not exists geo_versucht_am timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_geo_status_check') then
    alter table public.properties
      add constraint properties_geo_status_check
      check (geo_status is null or geo_status in ('ok', 'nicht_gefunden', 'gedrosselt'));
  end if;
end $$;

comment on column public.properties.geo_status is
  'Ergebnis der letzten Verortung (lib/geocode.ts): ok | nicht_gefunden | gedrosselt. Beim Ändern der Adresse auf null.';
comment on column public.properties.geo_versucht_am is
  'Zeitpunkt der letzten Verortung — steuert die Pause nach einer Drosselung.';
