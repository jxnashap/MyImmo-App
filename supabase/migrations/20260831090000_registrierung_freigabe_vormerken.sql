-- Registrierung: Zugangscode nur noch EINMAL abfragen
--
-- Problem (gemeldet 31.08.2026): Wer sich mit Zugangscode registrierte, wurde
-- beim ersten Login erneut nach dem Code gefragt — und bekam ihn dann als
-- falsch zurueck. Zwei Ursachen, hier geht es um die zweite:
--
--   1. `schalteKontoFrei` schrieb den Code vor der Pruefung in Grossbuchstaben.
--      Ein Code mit Kleinbuchstaben und Sonderzeichen ueberlebt das nicht.
--      (Behoben in lib/actions/freischaltung.ts, ohne Datenbankaenderung.)
--   2. Bei der Registrierung wurde der Code nur GEPRUEFT, nie gespeichert. Die
--      Freischaltung braucht `auth.uid()` — die gibt es vor der
--      E-Mail-Bestaetigung nicht. Also fragte das Willkommens-Gate erneut.
--
-- Loesung fuer (2): Die bestandene Code-Pruefung wird bei der Registrierung
-- serverseitig vorgemerkt und beim ersten Login automatisch eingeloest.
--
-- WARUM NICHT ueber `signUp`-Metadaten: `raw_user_meta_data` kommt vom Client
-- und laesst sich frei setzen. Ein Trigger, der darauf vertraut, waere eine
-- Hintertuer am Zugangscode vorbei — jeder koennte sich selbst freischalten.
-- Diese Tabelle wird ausschliesslich nach bestandener Pruefung geschrieben,
-- und zwar serverseitig mit dem Service-Role-Key.

create table if not exists public.registrierung_freigaben (
  email        text primary key,
  consent      boolean     not null default false,
  quelle       text        not null default 'registrierung',
  erstellt_am  timestamptz not null default now(),
  -- Bewusst begrenzt: Eine Vormerkung, die nie verfaellt, ist ein dauerhaft
  -- offener Zugang fuer eine Adresse, die vielleicht nie bestaetigt wird.
  ablauf_am    timestamptz not null default now() + interval '14 days'
);

comment on table public.registrierung_freigaben is
  'Vorgemerkte Freischaltungen: bei der Registrierung serverseitig nach bestandener Code-Pruefung geschrieben, beim ersten Login von freischaltung_nachholen() eingeloest.';

-- RLS an, aber KEINE Policy: Damit kommt weder `anon` noch `authenticated`
-- heran — nur die Service-Role und SECURITY-DEFINER-Funktionen. Ohne das
-- koennte ein angemeldeter Nutzer fremde Adressen vormerken.
alter table public.registrierung_freigaben enable row level security;
revoke all on table public.registrierung_freigaben from anon, authenticated;

create index if not exists registrierung_freigaben_ablauf_idx
  on public.registrierung_freigaben (ablauf_am);

/**
 * Loest eine vorgemerkte Freischaltung fuer den angemeldeten Nutzer ein.
 * Gibt true zurueck, wenn dadurch freigeschaltet wurde.
 *
 * Wird im Layout-Gate aufgerufen, BEVOR nach /willkommen umgeleitet wird.
 * Bewusst dort und nicht im Auth-Callback: Der Bestaetigungslink aus der
 * E-Mail laeuft je nach Supabase-Konfiguration nicht zwingend ueber
 * /auth/callback. Im Gate greift es auf jedem Weg — Callback, Passwort-Login,
 * Magic Link.
 */
create or replace function public.freischaltung_nachholen()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_zeile public.registrierung_freigaben%rowtype;
begin
  if auth.uid() is null then return false; end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return false; end if;

  -- Gross-/Kleinschreibung ignorieren: Wer sich mit "Max@..." registriert und
  -- spaeter "max@..." eintippt, ist derselbe Mensch. Genau diese Art von
  -- stiller Nichtuebereinstimmung war der urspruengliche Fehler.
  select * into v_zeile
    from public.registrierung_freigaben
   where lower(email) = lower(v_email)
     and ablauf_am > now();
  if not found then return false; end if;

  -- Ohne Zustimmung wird NICHT freigeschaltet. Der Nutzer landet dann wie
  -- bisher auf /willkommen und setzt das Haekchen dort.
  if not v_zeile.consent then return false; end if;

  insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (auth.uid(), true, true, coalesce(v_zeile.quelle, 'registrierung'))
    on conflict (user_id) do nothing;

  delete from public.registrierung_freigaben where email = v_zeile.email;
  return true;
end $$;

revoke all on function public.freischaltung_nachholen() from public, anon;
grant execute on function public.freischaltung_nachholen() to authenticated;
