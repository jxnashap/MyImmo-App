-- Eindeutigkeit auf der Spalte statt auf lower(email).
--
-- Grund: Ein Ausdrucks-Index taugt nicht als Ziel für ON CONFLICT (email) —
-- PostgREST/Supabase-Upserts scheitern daran mit „no unique or exclusion
-- constraint matching the ON CONFLICT specification". Die Anwendung schreibt
-- ausschließlich kleingeschriebene Adressen (normalisiereEmail in
-- lib/newsletter.ts), deshalb ist der einfache Index gleichwertig und
-- funktioniert mit dem Upsert.
drop index if exists public.newsletter_email_uniq;

-- Falls durch den früheren Ausdrucks-Index Dubletten möglich waren, die sich
-- nur in der Schreibweise unterscheiden: vereinheitlichen, bevor der neue
-- Index greift.
update public.newsletter_anmeldungen set email = lower(email) where email <> lower(email);

create unique index if not exists newsletter_email_uniq
  on public.newsletter_anmeldungen (email);
