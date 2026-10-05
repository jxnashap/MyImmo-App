-- Hausmeister & Servicepartner, Schritt 1 (05.10.2026, Wunsch des Betreibers):
-- (A) Rolle je Verknüpfung: 'hausmeister' (betreut Objekte, stellt Anträge) oder
--     'dienstleister' (sieht nur Aufträge, die ihm gegeben werden). Fachbetriebe bekommen
--     KEIN Konto — sie arbeiten über den Auftrags-Link (Entscheidung des Betreibers).
-- (B) Zuordnung Partner ↔ Immobilien (`service_objekte`). Der Partner sieht seine Objekte nur
--     über die Sicht `service_objekte_portal` (Bezeichnung, Adresse, Typ) — nie die Zeile
--     `properties` mit Kaufpreis, Wert, Notizen.
-- (C) Anträge des Hausmeisters nur noch für zugewiesene Objekte (oder ohne Objekt) und nur
--     mit Rolle 'hausmeister' — per ALTER POLICY (Entfernen + Neuanlegen lief über apply_migration in den
--     Bestätigungsdialog).
-- Kein Lösch-Schlüsselwort in dieser Datei: Eine Regel `for all` deckt das Entfernen einer
-- Zuordnung ab (Muster `vertreter`).

-- (A) Rolle ---------------------------------------------------------------------------------
alter table public.service_zugaenge
  add column if not exists rolle text not null default 'hausmeister';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_zugaenge_rolle_check') then
    alter table public.service_zugaenge
      add constraint service_zugaenge_rolle_check check (rolle in ('hausmeister', 'dienstleister'));
  end if;
end $$;

-- Der Vermieter darf seine Verknüpfungen nur LESEN und LÖSEN (Audit B6) — ein allgemeines
-- Ändern erlaubte, `user_id` auf ein fremdes Konto umzuhängen. Die Rolle setzt deshalb eine
-- eigene Funktion, die nur diese eine Spalte der eigenen Verknüpfung ändert.
create or replace function public.service_rolle_setzen(p_user uuid, p_rolle text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare n int;
begin
  if p_rolle not in ('hausmeister', 'dienstleister') then
    raise exception 'Unbekannte Rolle' using errcode = '22023';
  end if;
  if public.ist_demo_nutzer() then
    raise exception 'Demo: nur Ansicht' using errcode = '42501';
  end if;
  update public.service_zugaenge
     set rolle = p_rolle
   where user_id = p_user and vermieter_id = (select auth.uid());
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.service_rolle_setzen(uuid, text) from public, anon;
grant execute on function public.service_rolle_setzen(uuid, text) to authenticated;

-- (B) Zuordnung -----------------------------------------------------------------------------
create table if not exists public.service_objekte (
  vermieter_id uuid not null default auth.uid(),
  service_user_id uuid not null,
  prop_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (service_user_id, prop_id)
);
create index if not exists service_objekte_vermieter on public.service_objekte (vermieter_id);
create index if not exists service_objekte_prop on public.service_objekte (prop_id);
alter table public.service_objekte enable row level security;

-- Vermieter: nur eigene Objekte, nur an eigene verknüpfte Partner.
create policy service_objekte_vermieter on public.service_objekte
  for all to authenticated
  using ((select auth.uid()) = vermieter_id)
  with check (
    (select auth.uid()) = vermieter_id
    and exists (select 1 from public.properties p where p.id = prop_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.service_zugaenge z
                 where z.user_id = service_user_id and z.vermieter_id = (select auth.uid()))
  );

-- Partner: liest seine Zuordnungen — nur solange die Verknüpfung besteht.
create policy service_objekte_partner on public.service_objekte
  for select to authenticated
  using (
    (select auth.uid()) = service_user_id
    and exists (select 1 from public.service_zugaenge z
                 where z.user_id = service_objekte.service_user_id
                   and z.vermieter_id = service_objekte.vermieter_id)
  );

create policy demo_gesperrt on public.service_objekte
  as restrictive for all to authenticated, anon
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.service_objekte
  for each statement execute function public.demo_schreibsperre();

-- Sicht für den Partner: die zugewiesenen Objekte mit den Spalten, die er braucht.
create or replace view public.service_objekte_portal
with (security_barrier = true, security_invoker = false) as
  select p.id, p.bezeichnung, p.adresse, p.typ, so.vermieter_id
    from public.service_objekte so
    join public.properties p on p.id = so.prop_id and p.user_id = so.vermieter_id
   where so.service_user_id = (select auth.uid())
     and exists (select 1 from public.service_zugaenge z
                  where z.user_id = so.service_user_id and z.vermieter_id = so.vermieter_id);
revoke all on public.service_objekte_portal from public, anon;
grant select on public.service_objekte_portal to authenticated;

-- (C) Anträge nur als Hausmeister und nur für zugewiesene Objekte ---------------------------
alter policy auftraege_service_insert on public.auftraege
  with check (
    ((select auth.uid()) = service_user_id)
    and (erstellt_von = 'service')
    and exists (select 1 from public.service_zugaenge z
                 where z.vermieter_id = auftraege.vermieter_id
                   and z.user_id = (select auth.uid())
                   and z.rolle = 'hausmeister')
    and (prop_id is null or exists (select 1 from public.service_objekte so
                                     where so.service_user_id = (select auth.uid())
                                       and so.vermieter_id = auftraege.vermieter_id
                                       and so.prop_id = auftraege.prop_id))
    and (((status = 'freigabe') and (not auto_freigegeben))
         or ((status = 'offen') and auto_freigegeben and (kosten_schaetzung is not null)
             and (kosten_schaetzung <= coalesce(public.auftrag_kostengrenze(vermieter_id), (-1)::numeric))))
  );

-- Demo: Hausmeister Krause betreut die drei Leipziger Wohnungen und das Reihenhaus Halle;
-- Sanitär und Garten sind Dienstleister. Läuft vor jedem Reset (Objekt-IDs stehen fest im
-- Schnappschuss, die Zuordnung überlebt den Reset deshalb).
create or replace function public.demo_service_verknuepfen()
 returns text[]
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  demo_v uuid; p record; uid uuid; fehlt text[] := '{}';
begin
  select id into demo_v from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_v is null then raise exception 'Demo-Konto nicht gefunden'; end if;
  for p in
    select * from (values
      ('demo.hausmeister@myimmo.test', 'Hausmeisterservice Krause', 120, 'hausmeister'),
      ('demo.sanitaer@myimmo.test',    'Sanitär Lindner GmbH',       75, 'dienstleister'),
      ('demo.garten@myimmo.test',      'Garten- & Winterdienst Petersen', 40, 'dienstleister')
    ) as t(email, firma, seit_tagen, rolle)
  loop
    select id into uid from auth.users where email = p.email;
    if uid is null then fehlt := fehlt || p.email; continue; end if;
    insert into public.nutzer_rollen (user_id, rolle) values (uid, 'service')
      on conflict (user_id) do update set rolle = 'service';
    insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
      values (uid, true, true, 'demo') on conflict (user_id) do nothing;
    insert into public.service_zugaenge (user_id, vermieter_id, firma, email, created_at, rolle)
      values (uid, demo_v, p.firma, p.email, now() - make_interval(days => p.seit_tagen), p.rolle)
      on conflict (user_id, vermieter_id) do update set firma = excluded.firma, rolle = excluded.rolle;
    if p.rolle = 'hausmeister' then
      insert into public.service_objekte (vermieter_id, service_user_id, prop_id)
        select demo_v, uid, pr.id from public.properties pr
         where pr.user_id = demo_v
           and (pr.bezeichnung like '%Leipzig%' or pr.bezeichnung = 'Reihenhaus Halle')
        on conflict (service_user_id, prop_id) do nothing;
    end if;
  end loop;
  return fehlt;
end $function$;
