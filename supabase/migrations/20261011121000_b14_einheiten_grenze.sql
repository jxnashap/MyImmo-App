-- B14 – Einheitengrenze des Tarifs auf JEDEM Schreibweg (11.10.2026).
--
-- BEFUND: Die Grenze (lib/plan.ts, EINHEITEN_LIMIT) prüfte nur `createProperty`. „Objekt bearbeiten“
-- (Einheiten 1 → 30), der CSV-Import und ein direkter REST-Aufruf an `properties` liefen daran vorbei;
-- ein Lesefehler beim Zählen ergab 0 belegte Einheiten → durch. Zwei gleichzeitige Anlagen sahen beide
-- denselben Stand.
--
-- JETZT zusätzlich an der Datenbank — mit eigenem Schalter, AUS bis zum Scharfschalten des Bezahlsystems:
--   · billing_einstellungen.einheiten_durchsetzen (Standard false) — gemeinsam mit BILLING_ENFORCED=true
--     einschalten (docs/BEZAHLSYSTEM.md). Solange er aus ist, ändert diese Datei NICHTS.
--   · Trigger vor INSERT/UPDATE auf properties: Summe der Einheiten des Kontos (mind. 1 je Objekt, wie
--     in der App) darf das Tariflimit nicht überschreiten. Weniger Einheiten sind IMMER erlaubt (auch
--     über dem Limit nach einem Tarifwechsel), Service-Role (Demo-Reset, Cron) ist ausgenommen.
--   · Sperre je Konto (pg_advisory_xact_lock): zwei gleichzeitige Anlagen zählen nacheinander.
-- Limits wie lib/plan.ts: kostenlos 1 · privat 5 · plus 24 · business unbegrenzt; zahlend = aktiv,
-- testphase, ueberfaellig. `tests/einheitenGrenze.test.ts` hält beide Listen gleich.
-- Kein Löschbefehl → per apply_migration möglich.

alter table public.billing_einstellungen add column if not exists einheiten_durchsetzen boolean not null default false;
comment on column public.billing_einstellungen.einheiten_durchsetzen is
  'B14: Einheitengrenze des Tarifs an der Datenbank durchsetzen. Zusammen mit BILLING_ENFORCED=true einschalten.';

create or replace function public.einheiten_limit_fuer(p_user uuid)
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case
    when a.plan is null or a.status not in ('aktiv', 'testphase', 'ueberfaellig') then 1
    when a.plan = 'kostenlos' then 1
    when a.plan = 'privat' then 5
    when a.plan = 'plus' then 24
    else null -- business: unbegrenzt
  end
  from (select 1) x
  left join public.abos a on a.user_id = p_user
$function$;
revoke all on function public.einheiten_limit_fuer(uuid) from public, anon, authenticated;
grant execute on function public.einheiten_limit_fuer(uuid) to service_role;

create or replace function public.properties_einheiten_grenze()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  an boolean;
  lim integer;
  belegt integer;
  neu integer := greatest(1, coalesce(new.einheiten_anzahl, 1));
begin
  select einheiten_durchsetzen into an from public.billing_einstellungen limit 1;
  if not coalesce(an, false) then return new; end if;
  if auth.uid() is null then return new; end if; -- Service-Role: Demo-Reset, Cron
  if tg_op = 'UPDATE' and new.user_id = old.user_id
     and neu <= greatest(1, coalesce(old.einheiten_anzahl, 1)) then
    return new; -- weniger oder gleich viele Einheiten: immer erlaubt
  end if;
  perform pg_advisory_xact_lock(hashtextextended('einheiten:' || new.user_id::text, 0));
  lim := public.einheiten_limit_fuer(new.user_id);
  if lim is null then return new; end if;
  select coalesce(sum(greatest(1, coalesce(p.einheiten_anzahl, 1))), 0) into belegt
    from public.properties p where p.user_id = new.user_id and p.id <> new.id;
  if belegt + neu > lim then
    raise exception 'Der Tarif umfasst % Einheit(en); belegt sind %.', lim, belegt
      using errcode = 'P0001', hint = 'einheiten_grenze';
  end if;
  return new;
end
$function$;
revoke all on function public.properties_einheiten_grenze() from public, anon, authenticated;

create or replace trigger properties_einheiten_grenze
  before insert or update of einheiten_anzahl, user_id on public.properties
  for each row execute function public.properties_einheiten_grenze();
