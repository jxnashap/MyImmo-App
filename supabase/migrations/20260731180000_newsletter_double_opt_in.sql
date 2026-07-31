-- Verteiler für Vorlagen/Ratgeber mit Double-Opt-in (Brevo als Versanddienst).
--
-- Die Tabelle ist der Einwilligungsnachweis: Ohne sie ließe sich im Streitfall
-- nicht belegen, wann wer welchem Text zugestimmt hat. Brevo allein reicht dafür
-- nicht — dort steht der Kontakt, nicht die Herkunft der Einwilligung.
create table if not exists public.newsletter_anmeldungen (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Nur der Hash des Bestätigungs-Tokens. Wer die Tabelle liest, kann damit
  -- keine fremde Anmeldung bestätigen.
  token_hash text not null,
  token_ablauf timestamptz not null,
  quelle text,
  -- Wortlaut der Einwilligung zum Zeitpunkt des Klicks (Art. 7 Abs. 1 DSGVO).
  einwilligungstext text not null,
  angefordert_am timestamptz not null default now(),
  angefordert_ip text,
  bestaetigt_am timestamptz,
  bestaetigt_ip text,
  abgemeldet_am timestamptz,
  brevo_synchron_am timestamptz
);

-- Eine Zeile je Adresse; erneutes Anmelden aktualisiert Token und Zeitstempel,
-- statt Dubletten anzulegen.
create unique index if not exists newsletter_email_uniq
  on public.newsletter_anmeldungen (lower(email));
create index if not exists newsletter_token_idx
  on public.newsletter_anmeldungen (token_hash);

alter table public.newsletter_anmeldungen enable row level security;

-- Bewusst OHNE Policy: Der Zugriff läuft ausschließlich über den
-- Service-Role-Key in /api/newsletter/*. Ohne Policy sperrt RLS jeden Zugriff
-- über den anon- oder authenticated-Schlüssel — auch den lesenden.
revoke all on public.newsletter_anmeldungen from anon, authenticated;
