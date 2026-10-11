-- Ablauf F (Prüfstand 11.10.2026, Phase 5): dauerhafte Auftragsverwaltung für Schritte nach außen.
--
-- VORHER:
--   · Hinweis-Mails gingen direkt an Brevo. Schlug der Versand fehl (Brevo sperrt derzeit fremde IPs), war
--     die Mail verloren — kein Zustand, kein Grund, kein zweiter Versuch. Die 10-Minuten-Bremse zählte auch
--     den Fehlschlag: Ein erneuter Versuch derselben Handlung meldete „gebremst“.
--   · „Speichern & zustellen“ zweimal ausgelöst (Doppelklick, Zeitüberlauf, Neustart des Browsers) legte
--     das Schreiben zweimal ins Archiv, stellte es zweimal ins Portal und schickte zwei Hinweis-Mails.
--   · Einen Auftrag an einen Servicepartner (oder einen Antrag des Hausmeisters) zweimal abgeschickt → zwei
--     Aufträge.
-- JETZT:
--   · `aussen_auftraege`: je Schritt EINE Zeile mit stabilem Schlüssel (unique je Konto), Zustand
--     (offen → in_arbeit → erledigt | fehler → … → aufgegeben), Versuchen, letztem Versuch, nächstem
--     Versuch und Fehlergrund. Schreiben NUR der Server (Service-Role); lesen darf, wen es betrifft.
--     `aussen_auftrag_beanspruchen()` nimmt einen Schritt genau einmal in Arbeit (bedingtes Update);
--     ein abgebrochener Lauf ist nach fünf Minuten wieder frei.
--   · `notizen.vorgang` und `auftraege.vorgang`: Kennung des Formulars (eine je Öffnen) — eindeutig je
--     Konto; ein zweites Absenden findet die erste Zeile statt eine neue anzulegen.
--
-- Enthält `on delete cascade` → im SQL-Editor ausführen (Bestätigungsdialog von apply_migration), VOR dem
-- Code-Deploy (der Code schreibt die neuen Spalten und die Tabelle).

create table if not exists public.aussen_auftraege (
  id uuid primary key default gen_random_uuid(),
  -- Wem der Schritt gilt (bei der Hinweis-Mail: der Empfänger). Kontolöschung nimmt die Zeilen mit.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Wessen Handlung ihn auslöste (zur Anzeige „Mail an den Mieter fehlgeschlagen“).
  ausgeloest_von uuid,
  schluessel text not null check (length(schluessel) between 3 and 300),
  art text not null check (art in ('hinweis_mail')),
  -- Nur, was zum Wiederholen nötig ist — keine Adresse, kein Inhalt (die Mail nennt nie einen Inhalt).
  nutzlast jsonb not null default '{}'::jsonb,
  status text not null default 'offen' check (status in ('offen', 'in_arbeit', 'erledigt', 'fehler', 'aufgegeben')),
  versuche integer not null default 0 check (versuche between 0 and 10),
  max_versuche integer not null default 3 check (max_versuche between 1 and 10),
  letzter_versuch timestamptz,
  naechster_versuch timestamptz not null default now(),
  fehler text check (fehler is null or length(fehler) <= 300),
  ergebnis text check (ergebnis is null or length(ergebnis) <= 100),
  created_at timestamptz not null default now(),
  erledigt_am timestamptz,
  constraint aussen_auftraege_schluessel_eindeutig unique (user_id, schluessel),
  constraint aussen_auftraege_erledigt_vollstaendig check ((status = 'erledigt') = (erledigt_am is not null))
);
comment on table public.aussen_auftraege is
  'Ablauf F: dauerhafte Schritte nach außen (Hinweis-Mail). Schreiben nur die Service-Role; beanspruchen über aussen_auftrag_beanspruchen().';

create index if not exists aussen_auftraege_faellig on public.aussen_auftraege (naechster_versuch)
  where status in ('offen', 'fehler', 'in_arbeit');

alter table public.aussen_auftraege enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'aussen_auftraege' and policyname = 'eigene Aussenauftraege lesen') then
    create policy "eigene Aussenauftraege lesen" on public.aussen_auftraege for select to authenticated
      using (user_id = auth.uid() or ausgeloest_von = auth.uid());
  end if;
end $$;
-- Keine Schreibregel für Nutzer — und die Rechte entzogen (eine Policy allein schützt nicht, wenn eine
-- spätere Regel versehentlich `for all` öffnet).
revoke insert, update, delete on public.aussen_auftraege from public, anon, authenticated;
revoke all on public.aussen_auftraege from anon;

create or replace function public.aussen_auftrag_beanspruchen(p_id uuid)
 returns setof public.aussen_auftraege
 language sql
 security invoker
 set search_path to ''
as $$
  update public.aussen_auftraege a
     set status = 'in_arbeit', versuche = a.versuche + 1, letzter_versuch = now(), fehler = null
   where a.id = p_id
     and a.versuche < a.max_versuche
     and a.naechster_versuch <= now()
     and (a.status in ('offen', 'fehler')
          or (a.status = 'in_arbeit' and a.letzter_versuch < now() - interval '5 minutes'))
  returning a.*;
$$;
revoke all on function public.aussen_auftrag_beanspruchen(uuid) from public, anon, authenticated;
grant execute on function public.aussen_auftrag_beanspruchen(uuid) to service_role;

-- ---- Vorgangskennung am Archiv-Eintrag und am Auftrag --------------------------------------------
alter table public.notizen add column if not exists vorgang uuid;
create unique index if not exists notizen_vorgang_eindeutig on public.notizen (user_id, vorgang) where vorgang is not null;
comment on column public.notizen.vorgang is 'Ablauf F: Kennung des Formulars — ein zweites Absenden legt kein zweites Schreiben an.';

alter table public.auftraege add column if not exists vorgang uuid;
create unique index if not exists auftraege_vorgang_eindeutig on public.auftraege (vermieter_id, vorgang) where vorgang is not null;
comment on column public.auftraege.vorgang is 'Ablauf F: Kennung des Formulars — ein zweites Absenden legt keinen zweiten Auftrag an.';
