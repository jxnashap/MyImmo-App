-- Mitteilungen an ein Haus / alle Mieter und Gebäude-Infos (02.10.2026, Schritt 6 aus
-- docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
--
-- MITTEILUNGEN laufen über das Fundament `zustellungen` (art = 'mitteilung', Titel + Text,
-- je verbundenem Konto eine Zeile) — dieselben Schranken wie bei Dokumenten: nur an ein
-- jetzt verknüpftes Konto des eigenen Mieters, Zeitpunkt „jetzt“, Rückzug statt Löschen.
-- Neu ist nur `gruppe`: Eine Mitteilung an zwölf Mieter sind zwölf Zeilen, die der Vermieter
-- als EINE sieht und als eine zurückzieht.
--
-- GEBÄUDE-INFOS: je Objekt ein Datensatz (Hausmeister, Notdienste, Müll, Hausordnung …),
-- den die Mieter dieses Objekts mit aktivem Zugang lesen. Ohne Fremdschlüssel und ohne
-- Lösch-Regel (Muster wie oben: `on …`-Klauseln lösen den Bestätigungsdialog aus; leeren
-- statt entfernen).

alter table public.zustellungen add column if not exists gruppe uuid;
create index if not exists zustellungen_gruppe on public.zustellungen (gruppe) where gruppe is not null;

alter table public.zustellungen
  add constraint zustellung_mitteilung_hat_text
  check (art <> 'mitteilung' or (char_length(btrim(coalesce(titel, ''))) > 0
                                 and char_length(btrim(coalesce(nachricht, ''))) > 0
                                 and char_length(titel) <= 120 and char_length(nachricht) <= 4000)) not valid;

-- Rückzug einer ganzen Mitteilung (alle Empfänger einer Gruppe) — nur eigene, nur einmal.
create or replace function public.mitteilung_zurueckziehen(p_gruppe uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n integer;
begin
  update public.zustellungen
     set zurueckgezogen_am = now()
   where gruppe = p_gruppe
     and vermieter_id = auth.uid()
     and zurueckgezogen_am is null;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function public.mitteilung_zurueckziehen(uuid) from public, anon;
grant execute on function public.mitteilung_zurueckziehen(uuid) to authenticated;

create table if not exists public.gebaeude_infos (
  prop_id uuid primary key,
  vermieter_id uuid not null,
  hausmeister text check (char_length(hausmeister) <= 500),
  notdienst text check (char_length(notdienst) <= 500),
  muell text check (char_length(muell) <= 1000),
  hausordnung text check (char_length(hausordnung) <= 4000),
  sonstiges text check (char_length(sonstiges) <= 2000),
  updated_at timestamptz not null default now()
);

alter table public.gebaeude_infos enable row level security;

create policy gebaeude_select_vermieter on public.gebaeude_infos
  for select to authenticated
  using ((select auth.uid()) = vermieter_id);

create policy gebaeude_select_mieter on public.gebaeude_infos
  for select to authenticated
  using (exists (
    select 1 from public.mieter_zugaenge z
     where z.prop_id = gebaeude_infos.prop_id
       and z.vermieter_id = gebaeude_infos.vermieter_id
       and z.user_id = (select auth.uid())
       and public.mieter_zugang_aktiv(z.mieter_id)));

create policy gebaeude_insert_vermieter on public.gebaeude_infos
  for insert to authenticated
  with check (
    (select auth.uid()) = vermieter_id
    and exists (select 1 from public.properties p
                 where p.id = gebaeude_infos.prop_id and p.user_id = (select auth.uid())));

create policy gebaeude_update_vermieter on public.gebaeude_infos
  for update to authenticated
  using ((select auth.uid()) = vermieter_id)
  with check (
    (select auth.uid()) = vermieter_id
    and exists (select 1 from public.properties p
                 where p.id = gebaeude_infos.prop_id and p.user_id = (select auth.uid())));

create policy demo_kein_insert on public.gebaeude_infos
  as restrictive for insert to authenticated, anon
  with check (not public.ist_demo_nutzer());
create policy demo_kein_update on public.gebaeude_infos
  as restrictive for update to authenticated, anon
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());

create trigger demo_schreibsperre
  before insert or update on public.gebaeude_infos
  for each statement execute function public.demo_schreibsperre();
