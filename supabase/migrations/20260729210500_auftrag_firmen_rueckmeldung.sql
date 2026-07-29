-- Die oeffentliche Auftragsseite (/auftrag/<token>) war eine Einbahnstrasse:
-- Die Handwerksfirma sieht Auftrag und Mieter-Kontakt, kann aber nichts
-- zurueckmelden. Weder „wir uebernehmen das, Termin am 12.", noch „passt
-- zeitlich nicht" — der Vermieter erfaehrt nichts und muss hinterhertelefonieren.
-- Genau die Reibung, die der Link abschaffen sollte.
--
-- Die Beleihungs-Freigabe hat dafuer laengst ein Muster
-- (beleihung_rueckmeldungen); hier fehlte das Gegenstueck.

create table if not exists public.auftrag_rueckmeldungen (
  id          uuid primary key default gen_random_uuid(),
  auftrag_id  uuid not null references public.auftraege(id) on delete cascade,
  -- Was die Firma meldet. Bewusst schlicht: zusagen, ablehnen, Rueckfrage.
  art         text not null check (art in ('zusage','absage','rueckfrage')),
  firma       text,
  kontakt     text,
  termin      date,
  nachricht   text,
  created_at  timestamptz not null default now(),
  -- Vom Vermieter zur Kenntnis genommen (fuer die Neuigkeiten-Anzeige).
  gelesen     boolean not null default false
);

create index if not exists idx_auftrag_rueckmeldung on public.auftrag_rueckmeldungen (auftrag_id, created_at desc);

alter table public.auftrag_rueckmeldungen enable row level security;

-- Lesen darf nur, wem der Auftrag gehoert (Vermieter) bzw. wer ihn betreut
-- (Service-Konto). Die Firma selbst hat KEIN Konto — sie schreibt ueber die
-- SECURITY-DEFINER-Funktion unten und liest nie aus der Tabelle.
create policy "Auftrags-Rueckmeldungen lesen"
  on public.auftrag_rueckmeldungen for select
  using (exists (
    select 1 from public.auftraege a
    where a.id = auftrag_id
      and (a.vermieter_id = auth.uid() or a.service_user_id = auth.uid())
  ));

create policy "Auftrags-Rueckmeldungen als gelesen markieren"
  on public.auftrag_rueckmeldungen for update
  using (exists (
    select 1 from public.auftraege a
    where a.id = auftrag_id
      and (a.vermieter_id = auth.uid() or a.service_user_id = auth.uid())
  ));

comment on table public.auftrag_rueckmeldungen is
  'Rueckmeldungen der Handwerksfirma ueber den oeffentlichen Auftrags-Link. Schreibzugriff nur ueber auftrag_public_rueckmeldung().';

-- Schreiben ueber den Token — mit denselben Schutzmechanismen wie beim
-- oeffentlichen Auftrags-Abruf: Link muss gueltig UND unabgelaufen sein.
create or replace function public.auftrag_public_rueckmeldung(
  p_token uuid,
  p_art text,
  p_firma text,
  p_kontakt text,
  p_termin date,
  p_nachricht text
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  a record;
  cnt int;
begin
  if p_art not in ('zusage','absage','rueckfrage') then
    return jsonb_build_object('error','Unbekannte Rueckmeldung.');
  end if;

  select au.id, au.status into a
  from auftraege au
  where au.public_token = p_token
    and au.status in ('offen','angenommen')
    and au.public_token_ablauf > now();
  if not found then
    return jsonb_build_object('error','Dieser Link ist nicht mehr gültig.');
  end if;

  -- Mengenbremse je Auftrag (wie bei den Beleihungs-Rueckmeldungen).
  select count(*) into cnt from auftrag_rueckmeldungen
   where auftrag_id = a.id and created_at > now() - interval '1 hour';
  if cnt >= 10 then
    return jsonb_build_object('error','Zu viele Rückmeldungen — bitte später erneut versuchen.');
  end if;

  insert into auftrag_rueckmeldungen (auftrag_id, art, firma, kontakt, termin, nachricht)
  values (a.id, p_art, left(p_firma, 200), left(p_kontakt, 300), p_termin, left(p_nachricht, 4000));

  -- Eine Zusage mit Termin traegt den Termin gleich am Auftrag nach; der
  -- Vermieter sieht ihn dann ohne Umweg in seiner Liste. Der Status bleibt
  -- unangetastet — das ist die Entscheidung des Vermieters, nicht der Firma.
  if p_art = 'zusage' and p_termin is not null then
    update auftraege set termin = p_termin, updated_at = now() where id = a.id;
  end if;

  return jsonb_build_object('ok', true);
end $function$;

revoke all on function public.auftrag_public_rueckmeldung(uuid, text, text, text, date, text) from public;
grant execute on function public.auftrag_public_rueckmeldung(uuid, text, text, text, date, text) to anon, authenticated;
