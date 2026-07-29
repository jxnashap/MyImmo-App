-- ============================================================================
-- 1) Zugriffsbremse je IP fuer die oeffentlichen Code-Pruefungen
-- ============================================================================
-- Es gab bereits Mengenbremsen — aber je TOKEN (bewerbung_einreichen,
-- beleihung_public_rueckmeldung). Gegen das Durchprobieren von CODES hilft das
-- nicht: Dort variiert der Angreifer genau den Wert, an dem gezaehlt wird.
-- `einladungscode_pruefen` war deshalb unbegrenzt aufrufbar.

create table if not exists public.zugriff_limit (
  schluessel   text primary key,
  fenster_start timestamptz not null default now(),
  anzahl       int not null default 0
);

alter table public.zugriff_limit enable row level security;
-- Keine Policy: nur SECURITY-DEFINER-Funktionen schreiben hier, niemand liest
-- die Tabelle ueber die API.
revoke all on table public.zugriff_limit from anon, authenticated;

comment on table public.zugriff_limit is
  'Zaehler der Zugriffsbremse (rate_limit_pruefen). Kein direkter API-Zugriff.';

-- IP des Aufrufers aus den PostgREST-Request-Headern. Hinter dem Proxy steht
-- die echte Adresse als erster Eintrag in x-forwarded-for.
create or replace function public.anfrage_ip()
returns text language plpgsql stable set search_path to 'public' as $function$
declare
  roh text;
begin
  roh := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
  if roh is null or roh = '' then return 'unbekannt'; end if;
  return split_part(roh, ',', 1);
exception when others then
  return 'unbekannt';
end $function$;

/*
  Zaehlt einen Zugriff und wirft, wenn im Zeitfenster zu viele kamen.

  p_aktion    — Name der geschuetzten Aktion (Teil des Zaehler-Schluessels)
  p_max       — erlaubte Versuche je Fenster
  p_sekunden  — Laenge des Fensters
  p_kennung   — optional eine eigene Kennung statt der IP. Server-Actions rufen
                aus der Vercel-Function auf; dort waere die IP die des Servers,
                nicht die des Besuchers.
*/
create or replace function public.rate_limit_pruefen(
  p_aktion text,
  p_max int,
  p_sekunden int,
  p_kennung text default null
) returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  s text := p_aktion || '|' || coalesce(nullif(p_kennung, ''), anfrage_ip());
  jetzt timestamptz := now();
  neu int;
begin
  insert into zugriff_limit (schluessel, fenster_start, anzahl)
  values (s, jetzt, 1)
  on conflict (schluessel) do update
    set anzahl = case
          when zugriff_limit.fenster_start < jetzt - make_interval(secs => p_sekunden) then 1
          else zugriff_limit.anzahl + 1
        end,
        fenster_start = case
          when zugriff_limit.fenster_start < jetzt - make_interval(secs => p_sekunden) then jetzt
          else zugriff_limit.fenster_start
        end
  returning anzahl into neu;

  if neu > p_max then
    raise exception 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.'
      using errcode = 'P0001';
  end if;
end $function$;

revoke all on function public.rate_limit_pruefen(text, int, int, text) from public, anon;
grant execute on function public.rate_limit_pruefen(text, int, int, text) to authenticated, service_role;

-- Aufraeumen: alte Zaehler verfallen ohnehin, sollen aber nicht ewig liegen.
create or replace function public.zugriff_limit_aufraeumen()
returns int language plpgsql security definer set search_path to 'public' as $function$
declare geloescht int;
begin
  delete from zugriff_limit where fenster_start < now() - interval '1 day';
  get diagnostics geloescht = row_count;
  return geloescht;
end $function$;
revoke all on function public.zugriff_limit_aufraeumen() from public, anon, authenticated;

-- ============================================================================
-- 2) Code-Pruefungen bremsen
-- ============================================================================
-- Codeformat MI-XXXX-XXXX: rund 10^12 Moeglichkeiten, also nicht in einem Zug
-- zu raten — aber ohne Bremse auch nicht messbar teuer. 10 Versuche je 10
-- Minuten reichen fuer jeden ehrlichen Vertipper.

create or replace function public.einladungscode_pruefen(p_code text, p_rolle text default null)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
begin
  perform rate_limit_pruefen('einladungscode', 10, 600);
  return exists (
    select 1 from public.einladungscodes
    where code = p_code and eingeloest_am is null and gueltig_bis > now()
      and (p_rolle is null or rolle = p_rolle)
  );
end $function$;

-- `einladungscode_pruefen` existierte zusaetzlich mit nur (p_code). Weil die
-- Variante oben ein Default hat, ist JEDER Aufruf mit einem Argument mehrdeutig
-- und scheitert mit „function is not unique" — die einarmige Variante war also
-- nicht nur ueberfluessig, sie machte sich selbst unbenutzbar. Die App ruft
-- ueber PostgREST immer mit beiden benannten Argumenten auf und war nie
-- betroffen; trotzdem raus damit.
drop function if exists public.einladungscode_pruefen(text);

-- ============================================================================
-- 3) Trigger-Funktionen aus der oeffentlichen API nehmen
-- ============================================================================
-- Diese drei sind Trigger, keine Endpunkte — sie hingen aber unter
-- /rest/v1/rpc/ und waren fuer anon bzw. authenticated aufrufbar. Trigger
-- laufen unabhaengig von EXECUTE-Rechten weiter.
revoke all on function public.anliegen_mieter_spaltenschutz() from public, anon, authenticated;
revoke all on function public.auftraege_service_spaltenschutz() from public, anon, authenticated;
revoke all on function public.handle_new_user_rolle() from public, anon, authenticated;
