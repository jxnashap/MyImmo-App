-- Ablauf B (Prüfstand 11.10.2026, Phase 5): Belege und Kosten.
--
-- VORHER: Ein Beleg kam nur als Anhang an eine Buchung, die der Vermieter vorher selbst ausgefüllt
-- hatte. Es gab keinen Vorschlag aus dem Beleg, keinen Abgleich mit schon gebuchten Kosten (eine
-- wiederkehrende Grundsteuer-Buchung ohne Beleg ließ sich nur doppelt buchen oder von Hand suchen),
-- keine Dublettenprüfung und keine Prüfliste. Umlagefähig galt allein, was die KATEGORIE sagt —
-- steuerliche Kostenart und mietrechtliche Umlagefähigkeit (§ 2 BetrKV) waren dasselbe Feld.
--
-- JETZT:
--   · `beleg_eingang` — hochgeladene Belege warten hier, bis der Vermieter sie bucht oder verwirft.
--     Zugleich der dauerhafte Auftrag für den KI-Vorschlag (Ablauf F): Zustand, Versuche, letzter
--     Versuch, Fehlergrund. Ein Vorschlag ist nie eine Buchung.
--   · `beleg_eingang_beanspruchen(id)` — nimmt einen Eintrag GENAU EINMAL in Arbeit (bedingtes
--     Update): zwei gleichzeitige Aufrufe → einer bekommt ihn, höchstens drei Versuche, ein
--     abgebrochener Lauf ist nach fünf Minuten wieder frei.
--   · `kosten.beleg_eingang_id` (eindeutig) — eine Buchung je Beleg, auch bei Wiederholung.
--   · `kosten.umlagefaehig` — Umlagefähigkeit je Buchung, GETRENNT von der Kostenart. NULL = wie
--     bisher aus der Kategorie abgeleitet (Altbestand unverändert).
--
-- AUSFÜHREN: im SQL-Editor (enthält `on delete cascade` und einen Trigger für alle Schreibarten —
-- die Schnittstelle fragt bei diesem Wort nach und läuft in den Zeitüberlauf). VOR dem Code-Deploy:
-- Die NK-Seiten lesen `kosten.umlagefaehig`.

alter table public.kosten add column if not exists umlagefaehig text;
alter table public.kosten add column if not exists beleg_eingang_id uuid;
comment on column public.kosten.umlagefaehig is
  'Umlagefähig nach § 2 BetrKV (ja/nein/unklar), je Buchung bestätigt (Ablauf B). NULL = aus der Kategorie abgeleitet. Unabhängig von der steuerlichen Kostenart.';
comment on column public.kosten.beleg_eingang_id is
  'Eintrag im Belegeingang, aus dem diese Buchung entstand bzw. dessen Beleg angehängt wurde (Ablauf B). Eindeutig.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kosten_umlagefaehig_wert') then
    alter table public.kosten add constraint kosten_umlagefaehig_wert check (umlagefaehig is null or umlagefaehig in ('ja', 'nein', 'unklar'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kosten_beleg_eingang_eindeutig') then
    alter table public.kosten add constraint kosten_beleg_eingang_eindeutig unique (beleg_eingang_id);
  end if;
end $$;

create table if not exists public.beleg_eingang (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Datei im privaten Bucket „belege“, flach unter `<uid>/` (die Kontolöschung leert genau diesen
  -- Ordner, ohne Unterordner).
  datei_pfad text not null,
  datei_name text not null,
  datei_mime text not null,
  datei_groesse integer not null check (datei_groesse > 0),
  -- SHA-256 des Inhalts: dieselbe Datei zweimal hochgeladen → Hinweis „Dublette“.
  datei_hash text not null check (datei_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'neu',
  versuche integer not null default 0 check (versuche between 0 and 3),
  letzter_versuch timestamptz,
  fehler text,
  vorschlag jsonb,
  kosten_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beleg_eingang_status_wert check (status in ('neu', 'in_arbeit', 'vorschlag', 'fehler', 'gebucht')),
  constraint beleg_eingang_gebucht_mit_kosten check ((status = 'gebucht') = (kosten_id is not null))
);
comment on table public.beleg_eingang is
  'Belegeingang (Ablauf B): hochgeladene Belege bis zur Buchung. Zugleich der Auftrag für den KI-Vorschlag (Zustand, Versuche, Fehler).';

create index if not exists beleg_eingang_user_status on public.beleg_eingang (user_id, status);
create index if not exists beleg_eingang_user_hash on public.beleg_eingang (user_id, datei_hash);

alter table public.beleg_eingang enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'beleg_eingang' and policyname = 'beleg_eingang_eigen_lesen') then
    create policy beleg_eingang_eigen_lesen on public.beleg_eingang for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'beleg_eingang' and policyname = 'beleg_eingang_eigen_anlegen') then
    create policy beleg_eingang_eigen_anlegen on public.beleg_eingang for insert to authenticated
      with check (auth.uid() = user_id and status = 'neu' and versuche = 0 and kosten_id is null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'beleg_eingang' and policyname = 'beleg_eingang_eigen_aendern') then
    create policy beleg_eingang_eigen_aendern on public.beleg_eingang for update to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'beleg_eingang' and policyname = 'beleg_eingang_eigen_entfernen') then
    create policy beleg_eingang_eigen_entfernen on public.beleg_eingang for delete to authenticated
      using (auth.uid() = user_id and status <> 'gebucht');
  end if;
end $$;

-- Demo-Konto: Schreiben wirft (wie auf jeder anderen RLS-Tabelle, Migration 20260930150643).
create or replace trigger demo_schreibsperre
  before insert or update or delete on public.beleg_eingang
  for each statement execute function public.demo_schreibsperre();

-- Einen Eintrag für den KI-Vorschlag in Arbeit nehmen — genau einmal, höchstens drei Versuche.
-- Läuft mit den Rechten des Aufrufers (RLS gilt): nur eigene Einträge.
create or replace function public.beleg_eingang_beanspruchen(p_id uuid)
returns setof public.beleg_eingang
language sql
security invoker
set search_path = ''
as $$
  update public.beleg_eingang
     set status = 'in_arbeit', versuche = versuche + 1, letzter_versuch = now(), fehler = null, updated_at = now()
   where id = p_id
     and user_id = auth.uid()
     and versuche < 3
     and (status in ('neu', 'fehler') or (status = 'in_arbeit' and letzter_versuch < now() - interval '5 minutes'))
  returning *;
$$;
comment on function public.beleg_eingang_beanspruchen(uuid) is
  'Ablauf B/F: nimmt einen Belegeingang genau einmal in Arbeit (höchstens 3 Versuche; abgebrochene Läufe nach 5 min wieder frei).';
revoke all on function public.beleg_eingang_beanspruchen(uuid) from public, anon;
grant execute on function public.beleg_eingang_beanspruchen(uuid) to authenticated;
