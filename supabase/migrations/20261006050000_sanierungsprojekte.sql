-- Sanierungs-Guide, Stufe C (06.10.2026, Entscheidung des Betreibers): Projekte und Vorlagen
-- speichern — Besichtigung am Handy, Auswertung am Rechner. Dazu die Verknüpfung „Kaufprüfung →
-- übernommenes Objekt“ für den nächsten Schritt (gekauftes Objekt nach MyImmo übernehmen,
-- docs/zukunft/SANIERUNGS-GUIDE.md, Abschnitt 11), damit nur EINE Datei im SQL-Editor läuft.
--
-- WIRD IM SQL-EDITOR AUSGEFÜHRT, nicht über apply_migration: Die Kaskade auf auth.users und die
-- Lösch-Regel lösen sonst den Bestätigungsdialog der Schnittstelle aus (README, Demo-Service-Reset).
-- Die Datei ist idempotent — ein zweiter Lauf ändert nichts.
--
-- Was der Inhalt ist: `daten` ist der Entwurf aus lib/sanierung/eingabe.ts (Projekt) bzw. die
-- Vorlage aus lib/sanierung/projekte.ts — die App prüft beides beim Lesen (`entwurfAus`,
-- `vorlageAus`), die Datenbank nur Form und Größe.
--
-- Kontolöschung: Kaskade auf auth.users (tests/kontoloeschung.test.ts, KASKADE).
-- Demo: weder lesen noch schreiben (das Demo-Konto speichert nichts).

-- ---- Tabelle -----------------------------------------------------------------------------------

create table if not exists public.sanierungsprojekte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  art text not null default 'projekt' check (art in ('projekt', 'vorlage')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- 256 KB reichen für ein großes Haus mit vielen Räumen um ein Vielfaches; die App bremst bei 200 KB.
  daten jsonb not null check (jsonb_typeof(daten) = 'object' and pg_column_size(daten) <= 262144),
  -- Stufe D (Gesamtauswertung) und Abschnitt 11 (übernommenes Objekt) — vorerst leer.
  kalk_id uuid references public.kalkulationen (id) on delete set null,
  prop_id uuid references public.properties (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sanierungsprojekte_liste
  on public.sanierungsprojekte (user_id, art, updated_at desc);

drop trigger if exists sanierungsprojekte_updated_at on public.sanierungsprojekte;
create trigger sanierungsprojekte_updated_at before update on public.sanierungsprojekte
  for each row execute function public.update_updated_at();

-- ---- Grenze je Konto ---------------------------------------------------------------------------
-- Ohne sie könnte ein Konto beliebig viele 256-KB-Zeilen anlegen. 200 ist weit über jedem
-- echten Bedarf (Projekte + Vorlagen zusammen).

create or replace function public.sanierungsprojekte_grenze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.sanierungsprojekte s where s.user_id = new.user_id) >= 200 then
    raise exception 'Höchstens 200 Sanierungsprojekte und Vorlagen je Konto — lösche alte, bevor du neue speicherst.'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.sanierungsprojekte_grenze() from public, anon, authenticated;

drop trigger if exists sanierungsprojekte_grenze on public.sanierungsprojekte;
create trigger sanierungsprojekte_grenze before insert on public.sanierungsprojekte
  for each row execute function public.sanierungsprojekte_grenze();

-- ---- Zugriff -----------------------------------------------------------------------------------

alter table public.sanierungsprojekte enable row level security;

-- Nur eigene Zeilen. Eine Verknüpfung (kalk_id, prop_id) darf nur auf EIGENE Kaufprüfungen und
-- Objekte zeigen — der Fremdschlüssel allein prüft nur, dass die Zeile existiert.
drop policy if exists sanierungsprojekte_eigene on public.sanierungsprojekte;
create policy sanierungsprojekte_eigene on public.sanierungsprojekte
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (kalk_id is null or exists (select 1 from public.kalkulationen k where k.id = kalk_id and k.user_id = (select auth.uid())))
    and (prop_id is null or exists (select 1 from public.properties p where p.id = prop_id and p.user_id = (select auth.uid())))
  );

-- Demo: weder lesen noch schreiben.
drop policy if exists demo_gesperrt on public.sanierungsprojekte;
create policy demo_gesperrt on public.sanierungsprojekte
  as restrictive for all to authenticated, anon
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());

drop trigger if exists demo_schreibsperre on public.sanierungsprojekte;
create trigger demo_schreibsperre before insert or update or delete on public.sanierungsprojekte
  for each statement execute function public.demo_schreibsperre();

-- ---- Kaufprüfung → übernommenes Objekt (Abschnitt 11, Code folgt) --------------------------------
-- Eine Kaufprüfung wird höchstens einmal übernommen, und nur auf ein eigenes Objekt.

alter table public.kalkulationen
  add column if not exists uebernommen_prop_id uuid references public.properties (id) on delete set null;

create unique index if not exists kalkulationen_uebernommen
  on public.kalkulationen (uebernommen_prop_id) where uebernommen_prop_id is not null;

create or replace function public.kalkulation_uebernahme_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.uebernommen_prop_id is not null
     and not exists (select 1 from public.properties p where p.id = new.uebernommen_prop_id and p.user_id = new.user_id) then
    raise exception 'Das Objekt gehört nicht zu diesem Konto.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.kalkulation_uebernahme_pruefen() from public, anon, authenticated;

drop trigger if exists kalkulation_uebernahme_pruefen on public.kalkulationen;
create trigger kalkulation_uebernahme_pruefen before insert or update of uebernommen_prop_id on public.kalkulationen
  for each row execute function public.kalkulation_uebernahme_pruefen();
