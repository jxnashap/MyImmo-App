-- Herkunftsmessung (03.10.2026, docs/MARKETINGPLAN.md §6): Marke aus dem Link
-- (?von=instagram), nur zum Zählen. Die Route normalisiert; der CHECK hält
-- dieselbe Regel in der Datenbank fest (lib/herkunft.ts, MUSTER).
alter table public.newsletter_anmeldungen
  add column if not exists herkunft text;

alter table public.newsletter_anmeldungen
  drop constraint if exists newsletter_anmeldungen_herkunft_format;
alter table public.newsletter_anmeldungen
  add constraint newsletter_anmeldungen_herkunft_format
  check (herkunft is null or herkunft ~ '^[a-z0-9._-]{1,40}$');

comment on column public.newsletter_anmeldungen.herkunft is
  'Herkunftsmarke aus dem Link (?von= / utm_source), normalisiert. Nur Zählhilfe, entscheidet über nichts.';
