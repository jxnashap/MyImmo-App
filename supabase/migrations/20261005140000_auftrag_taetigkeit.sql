-- Tätigkeit je Auftrag (05.10.2026, Prüfung vor dem Livegang): Die Sperre „Selbst erledigt“ für
-- den Hausmeister hängt an einer Liste ERLAUBTER Tätigkeiten statt nur an Stichworten
-- (lib/taetigkeiten.ts — die Schlüssel müssen übereinstimmen, tests/taetigkeiten.test.ts).
-- Alte Aufträge bleiben ohne Tätigkeit (NULL); dort entscheiden weiter die Stichworte.
alter table public.auftraege add column if not exists taetigkeit text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'auftraege_taetigkeit_check') then
    alter table public.auftraege add constraint auftraege_taetigkeit_check check (
      taetigkeit is null or taetigkeit in (
        'kontrolle', 'leuchtmittel', 'reinigung', 'garten', 'rinne', 'tuer', 'kleinreparatur', 'muell',
        'heizung', 'gas', 'elektro', 'wasser', 'schornstein', 'dach', 'sonstiges'));
  end if;
end $$;

-- Der Partner darf die Tätigkeit NICHT nachträglich ändern (sonst wählte er „Leuchtmittel“, um
-- die Sperre zu umgehen): Der Spaltenschutz setzt sie wie Titel und Firma zurück.
-- Unverändert übernommen bis auf die neue Zeile `new.taetigkeit := old.taetigkeit;`.
create or replace function public.auftraege_service_spaltenschutz()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.service_user_id is null and old.service_user_id is not null
     and not exists (select 1 from auth.users u where u.id = old.service_user_id) then
    return new;
  end if;

  if (select auth.uid()) is distinct from old.vermieter_id then
    new.vermieter_id    := old.vermieter_id;
    new.service_user_id := old.service_user_id;
    new.prop_id         := old.prop_id;
    new.anliegen_id     := old.anliegen_id;
    new.mieter_id       := old.mieter_id;
    new.firma_id        := old.firma_id;
    new.objekt_name     := old.objekt_name;
    new.vermieter_name  := old.vermieter_name;
    new.titel           := old.titel;
    new.beschreibung    := old.beschreibung;
    new.termin          := old.termin;
    new.erstellt_von    := old.erstellt_von;
    new.public_token    := old.public_token;
    new.created_at      := old.created_at;
    new.kosten_id       := old.kosten_id;
    new.taetigkeit      := old.taetigkeit;
  end if;
  return new;
end $function$;
