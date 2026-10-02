-- Vorgänge mit Verlauf (02.10.2026) — Fundament 2 aus docs/zukunft/MIETERPORTAL-AUSBAU.md § 9.
--
-- Vorher hatte ein Anliegen EIN Feld `antwort`: Jede neue Antwort des Vermieters
-- überschrieb die alte, der Mieter konnte gar nicht antworten, und Statuswechsel,
-- Terminvorschläge und Aufträge hinterließen keine Spur. Jetzt hat jedes Anliegen eine
-- Ereignisliste, die Mieter und Vermieter gleich sehen.
--
-- Nachrichten schreiben die Beteiligten selbst (Regeln unten). Statuswechsel, Termine und
-- Aufträge schreibt die DATENBANK per Trigger mit — so entsteht der Eintrag auf jedem Weg,
-- auch auf einem, den die App später dazubekommt. Ohne angemeldeten Nutzer (Service-Role:
-- Demo-Reset, Cron) entsteht kein Eintrag, sonst häufte jeder Demo-Reset Einträge an.
--
-- Kein Ändern, kein Entfernen: Der Verlauf ist das Gedächtnis des Vorgangs.
-- Ohne Fremdschlüssel (wie `zustellungen`): `on …`-Klauseln lösen den Bestätigungsdialog
-- von apply_migration aus; ein Eintrag ohne sichtbares Anliegen ist ohnehin unlesbar,
-- weil die Leseregel über `anliegen` und dessen Regeln geht.

create table if not exists public.anliegen_ereignisse (
  id uuid primary key default gen_random_uuid(),
  anliegen_id uuid not null,
  autor_id uuid default auth.uid(),
  autor_rolle text not null check (autor_rolle in ('mieter', 'vermieter', 'system')),
  art text not null check (art in ('nachricht', 'status', 'termin', 'auftrag')),
  text text check (char_length(text) <= 4000),
  status_neu text,
  created_at timestamptz not null default now(),
  constraint ereignis_nachricht_hat_text check (art <> 'nachricht' or char_length(btrim(coalesce(text, ''))) > 0)
);
create index if not exists anliegen_ereignisse_anliegen on public.anliegen_ereignisse (anliegen_id, created_at);

alter table public.anliegen_ereignisse enable row level security;

-- Lesen: wer das Anliegen sehen darf (Regeln von `anliegen`), sieht den Verlauf.
create policy ereignis_select_beteiligte on public.anliegen_ereignisse
  for select to authenticated
  using (exists (select 1 from public.anliegen a where a.id = anliegen_ereignisse.anliegen_id));

-- Schreiben: nur Nachrichten, nur als man selbst, nur „jetzt“.
create policy ereignis_insert_vermieter on public.anliegen_ereignisse
  for insert to authenticated
  with check (
    art = 'nachricht' and autor_rolle = 'vermieter'
    and autor_id = (select auth.uid())
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and exists (select 1 from public.anliegen a
                 where a.id = anliegen_ereignisse.anliegen_id
                   and a.vermieter_id = (select auth.uid())));

create policy ereignis_insert_mieter on public.anliegen_ereignisse
  for insert to authenticated
  with check (
    art = 'nachricht' and autor_rolle = 'mieter'
    and autor_id = (select auth.uid())
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and exists (select 1 from public.anliegen a
                 where a.id = anliegen_ereignisse.anliegen_id
                   and a.mieter_user_id = (select auth.uid())
                   and public.mieter_zugang_aktiv(a.mieter_id)));

create policy demo_kein_insert on public.anliegen_ereignisse
  as restrictive for insert to authenticated, anon
  with check (not public.ist_demo_nutzer());

create trigger demo_schreibsperre
  before insert or update on public.anliegen_ereignisse
  for each statement execute function public.demo_schreibsperre();

-- Statuswechsel und Termine eines Anliegens mitschreiben.
create or replace function public.anliegen_verlauf_mitschreiben()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  rolle text;
begin
  if uid is null then
    return new;
  end if;
  rolle := case when uid = new.vermieter_id then 'vermieter'
                when uid = new.mieter_user_id then 'mieter'
                else 'system' end;
  if new.status is distinct from old.status then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, status_neu)
      values (new.id, uid, rolle, 'status', new.status);
  end if;
  if new.termin_vorschlaege is distinct from old.termin_vorschlaege
     and new.termin_vorschlaege is not null
     and jsonb_typeof(new.termin_vorschlaege) = 'array'
     and jsonb_array_length(new.termin_vorschlaege) > 0 then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text)
      values (new.id, uid, rolle, 'termin',
              'Terminvorschläge: ' || (select string_agg(replace(x, 'T', ' '), ' · ')
                                         from jsonb_array_elements_text(new.termin_vorschlaege) as t(x)));
  end if;
  if new.termin_bestaetigt is distinct from old.termin_bestaetigt and new.termin_bestaetigt is not null then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text)
      values (new.id, uid, rolle, 'termin', 'Termin bestätigt: ' || replace(new.termin_bestaetigt, 'T', ' '));
  end if;
  return new;
end
$$;
revoke execute on function public.anliegen_verlauf_mitschreiben() from public, anon, authenticated;

create trigger anliegen_verlauf
  after update on public.anliegen
  for each row execute function public.anliegen_verlauf_mitschreiben();

-- Aufträge zu einem Anliegen mitschreiben. Bewusst ohne Firma, Betrag und Lohnanteil:
-- Der Mieter sieht DASSELBE wie der Vermieter, und das sind Geschäftsdaten des Vermieters.
create or replace function public.auftrag_verlauf_mitschreiben()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  rolle text;
begin
  if uid is null or new.anliegen_id is null then
    return new;
  end if;
  rolle := case when uid = new.vermieter_id then 'vermieter' else 'system' end;
  if tg_op = 'INSERT' then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text, status_neu)
      values (new.anliegen_id, uid, rolle, 'auftrag', 'Ein Handwerker wurde beauftragt.', new.status);
  elsif new.status is distinct from old.status then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text, status_neu)
      values (new.anliegen_id, uid, rolle, 'auftrag',
              case new.status
                when 'angenommen' then 'Der Handwerker hat den Auftrag angenommen.'
                when 'erledigt' then 'Der Handwerker meldet den Auftrag als erledigt.'
                when 'freigabe' then 'Der Auftrag wartet auf die Freigabe des Vermieters.'
                else 'Auftrag: neuer Stand.' end,
              new.status);
  end if;
  return new;
end
$$;
revoke execute on function public.auftrag_verlauf_mitschreiben() from public, anon, authenticated;

create trigger auftrag_verlauf
  after insert or update on public.auftraege
  for each row execute function public.auftrag_verlauf_mitschreiben();

-- Bestand: jede bisherige Antwort wird die erste Nachricht des Vermieters im Verlauf.
-- Zeitpunkt = letzte Änderung des Anliegens (genauer ist er nicht gespeichert).
-- Feste ID aus der Anliegen-ID, damit ein zweiter Lauf nichts doppelt anlegt.
insert into public.anliegen_ereignisse (id, anliegen_id, autor_id, autor_rolle, art, text, created_at)
select md5(a.id::text || ':antwort')::uuid, a.id, a.vermieter_id, 'vermieter', 'nachricht',
       left(a.antwort, 4000), a.updated_at
  from public.anliegen a
 where a.antwort is not null and btrim(a.antwort) <> ''
on conflict (id) do nothing;

-- Demo: Nach jedem Reset steht die Antwort aus dem Schnappschuss wieder im Verlauf —
-- mit derselben festen ID und dem verschobenen Datum (der Reset zieht Anliegen auf heute).
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
  insert into public.anliegen_ereignisse (id, anliegen_id, autor_id, autor_rolle, art, text, created_at)
  select md5(a.id::text || ':antwort')::uuid, a.id, demo_v, 'vermieter', 'nachricht',
         left(a.antwort, 4000), a.updated_at
    from public.anliegen a
   where a.vermieter_id = demo_v and a.antwort is not null and btrim(a.antwort) <> ''
  on conflict (id) do update set created_at = excluded.created_at, text = excluded.text;
  return true;
end
$function$;
