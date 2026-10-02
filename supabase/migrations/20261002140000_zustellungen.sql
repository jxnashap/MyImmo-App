-- Zustellung an eine PERSON, nicht an eine Mieter-Zeile (02.10.2026).
-- docs/zukunft/MIETERPORTAL-AUSBAU.md, S1/S6/S8/S9 und Abschnitt 9.
--
-- Vorher entschied `notizen.mieter_freigabe` allein: Wer gerade an der Mieter-Zeile hing,
-- sah das Dokument — auch ein Nachmieter, der in dieselbe Zeile eingetragen wurde, und
-- auch nach einem Umhängen im Archiv. Jetzt hält jede Zustellung fest, an WELCHES Konto
-- (und welche Adresse) sie ging, wann, von wem, wann sie abgerufen und ggf. bestätigt
-- oder zurückgezogen wurde. Der Mieter sieht ein Dokument nur noch über eine eigene,
-- nicht zurückgezogene Zustellung.
--
-- Allgemein gebaut (art): heute 'dokument', als Nächstes 'mitteilung' und 'bestaetigung'.
--
-- Bewusst OHNE Fremdschlüssel auf notizen/mieter: (1) Das Protokoll soll das Dokument
-- überleben — es ist der Nachweis. (2) Der Demo-Reset legt Dokumente mit denselben IDs neu
-- an; die Zustellung bleibt gültig, ohne Aufräumen. Die Herkunft prüft die Einfüge-Regel.
-- Kein Ändern, kein Entfernen über die REST-Schnittstelle: Abruf, Bestätigung und
-- Zurückziehen laufen über drei Funktionen, die je genau eine Spalte setzen.

create table if not exists public.zustellungen (
  id uuid primary key default gen_random_uuid(),
  vermieter_id uuid not null,
  art text not null default 'dokument' check (art in ('dokument', 'mitteilung', 'bestaetigung')),
  notiz_id uuid,
  titel text,
  nachricht text,
  mieter_id uuid not null,
  empfaenger_user_id uuid not null,
  empfaenger_email text,
  bestaetigung_noetig boolean not null default false,
  zugestellt_am timestamptz not null default now(),
  zugestellt_von uuid default auth.uid(),
  gelesen_am timestamptz,
  bestaetigt_am timestamptz,
  zurueckgezogen_am timestamptz,
  constraint zustellung_dokument_hat_notiz check (art <> 'dokument' or notiz_id is not null)
);

create unique index if not exists zustellungen_einmal_aktiv
  on public.zustellungen (notiz_id, empfaenger_user_id)
  where zurueckgezogen_am is null and notiz_id is not null;
create index if not exists zustellungen_empfaenger on public.zustellungen (empfaenger_user_id);
create index if not exists zustellungen_vermieter_mieter on public.zustellungen (vermieter_id, mieter_id);

alter table public.zustellungen enable row level security;

create policy zust_select_vermieter on public.zustellungen
  for select to authenticated
  using ((select auth.uid()) = vermieter_id);

create policy zust_select_empfaenger on public.zustellungen
  for select to authenticated
  using ((select auth.uid()) = empfaenger_user_id
         and zurueckgezogen_am is null
         and public.mieter_zugang_aktiv(mieter_id));

-- Einfügen nur durch den Vermieter, nur an ein Konto, das JETZT mit diesem eigenen Mieter
-- verknüpft ist und dessen Zugang nicht abgelaufen ist, nur ein eigenes Dokument desselben
-- Mieters, mit dem Zeitpunkt „jetzt“ (keine Rückdatierung — es geht um Fristen).
create policy zust_insert_vermieter on public.zustellungen
  for insert to authenticated
  with check (
    (select auth.uid()) = vermieter_id
    and zugestellt_von = (select auth.uid())
    and gelesen_am is null and bestaetigt_am is null and zurueckgezogen_am is null
    and zugestellt_am between now() - interval '5 minutes' and now() + interval '5 minutes'
    and exists (
      select 1 from public.mieter m
       where m.id = zustellungen.mieter_id
         and m.user_id = (select auth.uid())
         and (m.mietende is null
              or (now() at time zone 'Europe/Berlin')::date <= public.mieter_zugang_endet(m.mietende)))
    and exists (
      select 1 from public.mieter_zugaenge z
       where z.mieter_id = zustellungen.mieter_id
         and z.user_id = zustellungen.empfaenger_user_id
         and z.vermieter_id = (select auth.uid()))
    and (notiz_id is null or exists (
      select 1 from public.notizen n
       where n.id = zustellungen.notiz_id
         and n.user_id = (select auth.uid())
         and n.mieter_id = zustellungen.mieter_id))
  );

create policy demo_kein_insert on public.zustellungen
  as restrictive for insert to authenticated, anon
  with check (not public.ist_demo_nutzer());

create trigger demo_schreibsperre
  before insert or update on public.zustellungen
  for each statement execute function public.demo_schreibsperre();

-- Mieter ruft ein Dokument ab → erster Abruf wird festgehalten (nur der eigene, nur einmal).
create or replace function public.zustellung_abgerufen(p_notiz uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n integer;
begin
  update public.zustellungen
     set gelesen_am = now()
   where notiz_id = p_notiz
     and empfaenger_user_id = auth.uid()
     and gelesen_am is null
     and zurueckgezogen_am is null
     and public.mieter_zugang_aktiv(mieter_id);
  get diagnostics n = row_count;
  return n;
end
$$;

-- Mieter bestätigt „gelesen und zur Kenntnis genommen“ — keine Unterschrift.
create or replace function public.zustellung_bestaetigen(p_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n integer;
begin
  update public.zustellungen
     set bestaetigt_am = now(),
         gelesen_am = coalesce(gelesen_am, now())
   where id = p_id
     and empfaenger_user_id = auth.uid()
     and bestaetigung_noetig
     and bestaetigt_am is null
     and zurueckgezogen_am is null
     and public.mieter_zugang_aktiv(mieter_id);
  get diagnostics n = row_count;
  return n = 1;
end
$$;

-- Vermieter zieht eine Zustellung zurück: sofort unsichtbar, die Zeile bleibt als Protokoll.
create or replace function public.zustellung_zurueckziehen(p_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n integer;
begin
  update public.zustellungen
     set zurueckgezogen_am = now()
   where id = p_id
     and vermieter_id = auth.uid()
     and zurueckgezogen_am is null;
  get diagnostics n = row_count;
  return n = 1;
end
$$;

revoke execute on function public.zustellung_abgerufen(uuid) from public, anon;
revoke execute on function public.zustellung_bestaetigen(uuid) from public, anon;
revoke execute on function public.zustellung_zurueckziehen(uuid) from public, anon;
grant execute on function public.zustellung_abgerufen(uuid) to authenticated;
grant execute on function public.zustellung_bestaetigen(uuid) to authenticated;
grant execute on function public.zustellung_zurueckziehen(uuid) to authenticated;

-- Ein zugestelltes Dokument bleibt, was zugestellt wurde (S6): Datei, Mieter und Objekt
-- sind nicht mehr änderbar, solange eine Zustellung aktiv ist. Erst zurückziehen.
create or replace function public.notizen_zugestellt_unveraendert()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if (new.datei_data is distinct from old.datei_data
      or new.mieter_id is distinct from old.mieter_id
      or new.prop_id is distinct from old.prop_id)
     and exists (select 1 from public.zustellungen z
                  where z.notiz_id = old.id and z.zurueckgezogen_am is null) then
    raise exception 'Dieses Dokument ist im Mieterportal zugestellt. Datei, Mieter und Objekt bleiben unverändert — erst die Zustellung zurückziehen.'
      using errcode = '42501', hint = 'zugestellt';
  end if;
  return new;
end
$$;
revoke execute on function public.notizen_zugestellt_unveraendert() from public, anon, authenticated;

create trigger notizen_zugestellt_unveraendert
  before update on public.notizen
  for each row execute function public.notizen_zugestellt_unveraendert();

-- Der Mieter sieht ein Archiv-Dokument nur noch über eine eigene, aktive Zustellung
-- vom eigenen Vermieter (F7: Herkunft geprüft). `mieter_freigabe` entscheidet nichts mehr.
alter policy notizen_select_mieter_freigabe on public.notizen
  using (exists (
    select 1 from public.zustellungen z
     where z.notiz_id = notizen.id
       and z.vermieter_id = notizen.user_id
       and z.empfaenger_user_id = (select auth.uid())
       and z.zurueckgezogen_am is null
       and public.mieter_zugang_aktiv(z.mieter_id)));

-- Bestand übernehmen: jede bisherige Freigabe an das Konto, das HEUTE verknüpft ist.
-- Zeitpunkt = Anlage des Dokuments (der wahre Freigabezeitpunkt ist nicht gespeichert).
-- Freigaben ohne verknüpftes Konto werden nicht übernommen — sie sah ohnehin niemand.
insert into public.zustellungen
  (vermieter_id, art, notiz_id, titel, mieter_id, empfaenger_user_id, empfaenger_email,
   zugestellt_am, zugestellt_von)
select n.user_id, 'dokument', n.id, n.titel, n.mieter_id, z.user_id, z.email,
       coalesce(n.created_at, now()), n.user_id
  from public.notizen n
  join public.mieter_zugaenge z on z.mieter_id = n.mieter_id and z.vermieter_id = n.user_id
 where n.mieter_freigabe
   and not exists (select 1 from public.zustellungen x
                    where x.notiz_id = n.id and x.empfaenger_user_id = z.user_id);

-- Demo: die freigegebenen Beispiel-Dokumente der Demo-Mieterin nach jedem Reset zustellen.
create or replace function public.demo_mieter_verknuepfen()
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  demo_v uuid;
  demo_m uuid;
  berger uuid := 'f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2';
  wohnung uuid := 'd560ceb5-9dc2-4869-a0c8-41833c061a2c';
begin
  select id into demo_v from auth.users where email = 'demo.vermieter@myimmo.test';
  select id into demo_m from auth.users where email = 'demo.mieter@myimmo.test';
  if demo_v is null or demo_m is null then
    return false;
  end if;

  insert into public.nutzer_rollen (user_id, rolle)
    values (demo_m, 'mieter') on conflict (user_id) do nothing;
  insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (demo_m, true, true, 'demo') on conflict (user_id) do nothing;
  insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id, email)
    values (demo_m, demo_v, berger, wohnung, 'demo.mieter@myimmo.test') on conflict do nothing;
  update public.anliegen set mieter_user_id = demo_m
   where vermieter_id = demo_v and mieter_id = berger and mieter_user_id is distinct from demo_m;
  insert into public.zustellungen
    (vermieter_id, art, notiz_id, titel, mieter_id, empfaenger_user_id, empfaenger_email,
     zugestellt_am, zugestellt_von)
  select demo_v, 'dokument', n.id, n.titel, berger, demo_m, 'demo.mieter@myimmo.test',
         coalesce(n.created_at, now()), demo_v
    from public.notizen n
   where n.user_id = demo_v and n.mieter_id = berger and n.mieter_freigabe
     and not exists (select 1 from public.zustellungen x
                      where x.notiz_id = n.id and x.empfaenger_user_id = demo_m
                        and x.zurueckgezogen_am is null);
  return true;
end
$function$;
