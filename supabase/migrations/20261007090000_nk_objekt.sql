-- Nebenkosten je OBJEKT und Jahr (Stufe 1, 07.10.2026, docs/zukunft/NK-NEU.md; Entscheidung des
-- Betreibers: „Umlagepositionen pro Objekt“). Jede Kostenart steht einmal mit dem Gesamtbetrag des
-- Hauses; verteilt wird in der App (lib/nkObjekt.ts). mieter_positionen bleibt als Altbestand.
--
-- WIRD IM SQL-EDITOR AUSGEFÜHRT, nicht über apply_migration: Die Kaskaden lösen sonst den
-- Bestätigungsdialog der Schnittstelle aus (README, Demo-Service-Reset). Idempotent.
-- Solange die Datei nicht lief, rechnet die App weiter mit dem Altbestand (lib/nkPositionen.ts).
--
-- Kontolöschung: Kaskade auf auth.users UND auf properties (tests/kontoloeschung.test.ts, KASKADE).
-- Demo: lesen ja (falls später Beispieldaten kommen), schreiben nein.

-- ---- Grundlagen des Hauses je Jahr -------------------------------------------------------------

create table if not exists public.nk_objekt_jahr (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prop_id uuid not null references public.properties (id) on delete cascade,
  jahr integer not null check (jahr between 2000 and 2100),
  flaeche_gesamt numeric(10,2) check (flaeche_gesamt is null or flaeche_gesamt > 0),
  einheiten integer check (einheiten is null or einheiten between 1 and 999),
  mea_gesamt numeric(12,3) check (mea_gesamt is null or mea_gesamt > 0),
  -- Je Mieter-ID: {"personen": 2, "mea": 125}. Die App liest es über lib/nkPositionen.ts.
  mieter jsonb not null default '{}'::jsonb check (jsonb_typeof(mieter) = 'object' and pg_column_size(mieter) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prop_id, jahr)
);

-- ---- Kostenarten des Hauses je Jahr ------------------------------------------------------------

create table if not exists public.nk_objekt_kosten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prop_id uuid not null references public.properties (id) on delete cascade,
  jahr integer not null check (jahr between 2000 and 2100),
  bezeichnung text not null check (char_length(btrim(bezeichnung)) between 1 and 120),
  betrag numeric(12,2) not null check (betrag >= 0 and betrag < 10000000),
  schluessel text not null default 'flaeche'
    check (schluessel in ('flaeche', 'personen', 'einheiten', 'mea', 'verbrauch', 'direkt')),
  umlagefaehig boolean not null default true,
  lohnanteil numeric(12,2) check (lohnanteil is null or lohnanteil >= 0),
  art_35a text check (art_35a is null or art_35a in ('haushaltsnah', 'handwerker')),
  -- Nur „verbrauch“: Gesamtverbrauch laut Hauptzähler.
  nenner numeric(14,3) check (nenner is null or nenner > 0),
  -- „verbrauch“: Verbrauch je Mieter-ID · „direkt“: Betrag je Mieter-ID.
  werte jsonb not null default '{}'::jsonb check (jsonb_typeof(werte) = 'object' and pg_column_size(werte) <= 65536),
  quelle text check (quelle is null or quelle in ('manuell', 'buchungen', 'vorjahr', 'ki')),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nk_objekt_kosten_objekt_jahr on public.nk_objekt_kosten (prop_id, jahr, sort);
create index if not exists nk_objekt_kosten_user on public.nk_objekt_kosten (user_id);

drop trigger if exists nk_objekt_jahr_updated_at on public.nk_objekt_jahr;
create trigger nk_objekt_jahr_updated_at before update on public.nk_objekt_jahr
  for each row execute function public.update_updated_at();
drop trigger if exists nk_objekt_kosten_updated_at on public.nk_objekt_kosten;
create trigger nk_objekt_kosten_updated_at before update on public.nk_objekt_kosten
  for each row execute function public.update_updated_at();

-- ---- Grenze je Objekt und Jahr -----------------------------------------------------------------
-- Die BetrKV kennt 17 Kostenarten; 100 Zeilen reichen für jede Aufschlüsselung.

create or replace function public.nk_objekt_kosten_grenze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.nk_objekt_kosten k where k.prop_id = new.prop_id and k.jahr = new.jahr) >= 100 then
    raise exception 'Höchstens 100 Kostenarten je Objekt und Jahr.' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.nk_objekt_kosten_grenze() from public, anon, authenticated;

drop trigger if exists nk_objekt_kosten_grenze on public.nk_objekt_kosten;
create trigger nk_objekt_kosten_grenze before insert on public.nk_objekt_kosten
  for each row execute function public.nk_objekt_kosten_grenze();

-- ---- Zugriff -----------------------------------------------------------------------------------
-- Nur eigene Zeilen, und das Objekt muss dem Konto gehören (der Fremdschlüssel prüft nur, dass es
-- existiert).

alter table public.nk_objekt_jahr enable row level security;
alter table public.nk_objekt_kosten enable row level security;

drop policy if exists nk_objekt_jahr_eigene on public.nk_objekt_jahr;
create policy nk_objekt_jahr_eigene on public.nk_objekt_jahr
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.properties p where p.id = prop_id and p.user_id = (select auth.uid()))
  );

drop policy if exists nk_objekt_kosten_eigene on public.nk_objekt_kosten;
create policy nk_objekt_kosten_eigene on public.nk_objekt_kosten
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.properties p where p.id = prop_id and p.user_id = (select auth.uid()))
  );

-- Demo: lesen erlaubt, schreiben nie (Trigger wirft, restriktive Policies als zweite Linie).
-- Bewusst NICHT „for all“ — das sperrte auch das Lesen (CLAUDE.md, Hausmeister Schritt 1).
do $$
declare t text;
begin
  foreach t in array array['nk_objekt_jahr', 'nk_objekt_kosten'] loop
    execute format('drop policy if exists demo_kein_insert on public.%I', t);
    execute format('create policy demo_kein_insert on public.%I as restrictive for insert to authenticated, anon with check (not public.ist_demo_nutzer())', t);
    execute format('drop policy if exists demo_kein_update on public.%I', t);
    execute format('create policy demo_kein_update on public.%I as restrictive for update to authenticated, anon using (not public.ist_demo_nutzer()) with check (not public.ist_demo_nutzer())', t);
    execute format('drop policy if exists demo_kein_delete on public.%I', t);
    execute format('create policy demo_kein_delete on public.%I as restrictive for delete to authenticated, anon using (not public.ist_demo_nutzer())', t);
    execute format('drop trigger if exists demo_schreibsperre on public.%I', t);
    execute format('create trigger demo_schreibsperre before insert or update or delete on public.%I for each statement execute function public.demo_schreibsperre()', t);
  end loop;
end $$;
