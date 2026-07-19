-- Portfolio-Karte: einmalig geocodete Koordinaten je Objekt (Cache — wird
-- geleert, wenn sich die Adresse ändert, und beim nächsten Kartenaufruf neu
-- befüllt).
alter table public.properties
  add column if not exists lat double precision,
  add column if not exists lng double precision;
