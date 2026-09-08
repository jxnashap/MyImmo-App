-- BESTANDSSCHUTZ ALS AUTOMATISMUS (08.09.2026) — Punkt A9 der Start-Checkliste.
--
-- Vorher: ein Skript, das UNMITTELBAR vor `BILLING_ENFORCED=true` von Hand
-- auszuführen war, weil es nur die Konten versorgt, die es vorfindet. Ein
-- Termin-Skript ist ein Termin-Fehler in Wartestellung. Jetzt:
--   1. Alle heutigen Konten bekommen eine Bestandsschutz-Zeile (plus/testphase).
--   2. Jedes NEUE Konto bekommt sie per Trigger — solange der Schalter
--      `billing_einstellungen.bestandsschutz_offen` auf true steht.
--   3. Beim Scharfschalten legt der Betreiber EINEN Schalter um:
--      update public.billing_einstellungen set bestandsschutz_offen = false;
--      Vergisst er es, ist der Fehler großzügig (neue Konten bekommen Plus),
--      nicht ausschließend. Das ist die richtige Richtung für einen Fehler.
--
-- Ohne BILLING_ENFORCED=true haben die Zeilen KEINE Wirkung: Die Schranken in
-- lib/planGate.ts kehren vorher zurück, und der Abo-Tab zeigt im Early Access
-- die Early-Access-Karte, nicht den Tarif (components/SettingsView.tsx).
--
-- Ausgeführt am 08.09.2026 (apply_migration): 22 Konten versorgt, 0 ohne Zeile.

create table if not exists public.billing_einstellungen (
  id smallint primary key default 1 check (id = 1),
  bestandsschutz_offen boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.billing_einstellungen is
  'Ein-Zeilen-Tabelle. bestandsschutz_offen = neue Konten bekommen automatisch plus/testphase (Early Access). Beim Scharfschalten von BILLING_ENFORCED auf false setzen.';
alter table public.billing_einstellungen enable row level security;
revoke all on table public.billing_einstellungen from anon, authenticated;
insert into public.billing_einstellungen (id) values (1) on conflict (id) do nothing;

create or replace function public.bestandsschutz_anlegen()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  begin
    if exists (select 1 from public.billing_einstellungen where id = 1 and bestandsschutz_offen) then
      insert into public.abos (user_id, plan, status, zyklus, provider, gueltig_bis)
      values (new.id, 'plus', 'testphase', null, 'bestandsschutz', now() + interval '12 months')
      on conflict (user_id) do nothing;
    end if;
  exception when others then
    -- Eine Registrierung darf hieran nie scheitern.
    raise warning 'bestandsschutz_anlegen: %', sqlerrm;
  end;
  return new;
end $function$;

drop trigger if exists on_auth_user_created_bestandsschutz on auth.users;
create trigger on_auth_user_created_bestandsschutz
  after insert on auth.users
  for each row execute function public.bestandsschutz_anlegen();

-- Bestand versorgen (Abschnitt B des bisherigen Skripts, jetzt hier).
insert into public.abos (user_id, plan, status, zyklus, provider, gueltig_bis)
select u.id, 'plus', 'testphase', null, 'bestandsschutz', now() + interval '12 months'
from auth.users u
on conflict (user_id) do nothing;
