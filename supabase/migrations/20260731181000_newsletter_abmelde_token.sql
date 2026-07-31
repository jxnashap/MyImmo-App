-- Eigener Abmelde-Schlüssel je Adresse.
--
-- Das Bestätigungs-Token wird beim Bestätigen verbraucht und taugt danach
-- nicht mehr als Abmeldelink. Ohne eigenen Schlüssel bliebe nur der
-- Abmeldelink von Brevo — dann wüsste Brevo von der Abmeldung, die eigene
-- Einwilligungstabelle aber nicht, und beide Stände liefen auseinander.
--
-- Der Wert wird beim Bestätigen erzeugt und als Kontaktattribut an Brevo
-- übergeben, damit Kampagnen ihn einsetzen können.
alter table public.newsletter_anmeldungen
  add column if not exists abmelde_token_hash text;

create index if not exists newsletter_abmelde_idx
  on public.newsletter_anmeldungen (abmelde_token_hash);
