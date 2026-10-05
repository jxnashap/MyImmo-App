-- Hausmeister & Servicepartner, Schritt 2 (05.10.2026):
-- (A) Verlauf am Auftrag: Notizen und Fotos von Vermieter und Partner (`auftrag_notizen`).
--     Nur Einfügen, kein Ändern/Entfernen — es ist das Protokoll („Schaden geprüft, Foto“).
-- (B) „Fachbetrieb nötig“: Der Hausmeister SCHLÄGT eine Firma vor (Entscheidung des Betreibers:
--     nie selbst beauftragen). Die RPC setzt den Auftrag auf „Freigabe“ und merkt sich den
--     Vorschlag in einer EIGENEN Spalte `vorgeschlagene_firma_id` — `firma_id` bleibt durch den
--     Spaltenschutz-Trigger dem Vermieter vorbehalten; erst seine Freigabe übernimmt den Vorschlag.
--     Die Kostengrenze gilt hier bewusst NICHT: Ein Fachbetrieb-Vorschlag entscheidet immer der
--     Vermieter.
-- Kein Lösch-Schlüsselwort (Bestätigungsdialog).

alter table public.auftraege
  add column if not exists vorgeschlagene_firma_id uuid;

create table if not exists public.auftrag_notizen (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null,
  vermieter_id uuid not null,
  autor_id uuid not null default auth.uid(),
  autor_rolle text not null check (autor_rolle in ('vermieter', 'service')),
  art text not null default 'notiz' check (art in ('notiz', 'foto', 'fachbetrieb')),
  text text check (char_length(text) <= 2000),
  datei_name text check (char_length(datei_name) <= 200),
  datei_type text check (datei_type is null or datei_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  datei_size integer check (datei_size between 0 and 4194304),
  datei_data text,
  created_at timestamptz not null default now(),
  check (text is not null or datei_data is not null)
);
create index if not exists auftrag_notizen_auftrag on public.auftrag_notizen (auftrag_id, created_at);
alter table public.auftrag_notizen enable row level security;

-- Lesen: der Vermieter des Auftrags und der Partner, dem der Auftrag JETZT gehört.
create policy auftrag_notizen_lesen on public.auftrag_notizen
  for select to authenticated
  using (
    exists (select 1 from public.auftraege a
             where a.id = auftrag_notizen.auftrag_id
               and a.vermieter_id = auftrag_notizen.vermieter_id
               and ((select auth.uid()) = a.vermieter_id or (select auth.uid()) = a.service_user_id))
  );

-- Schreiben: als man selbst, in der eigenen Rolle, „jetzt“ (keine Rückdatierung).
create policy auftrag_notizen_schreiben on public.auftrag_notizen
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and exists (select 1 from public.auftraege a
                 where a.id = auftrag_notizen.auftrag_id
                   and a.vermieter_id = auftrag_notizen.vermieter_id
                   and ((autor_rolle = 'vermieter' and a.vermieter_id = (select auth.uid()))
                     or (autor_rolle = 'service' and a.service_user_id = (select auth.uid()))))
  );

create policy demo_kein_insert on public.auftrag_notizen
  as restrictive for insert to authenticated
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.auftrag_notizen
  for each statement execute function public.demo_schreibsperre();

-- „Fachbetrieb nötig“ — nur der Hausmeister des Auftrags, nur solange er offen/angenommen ist.
create or replace function public.auftrag_fachbetrieb_vorschlagen(
  p_auftrag uuid, p_firma uuid, p_schaetzung numeric, p_text text
) returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare a record; n int;
begin
  if public.ist_demo_nutzer() then
    raise exception 'Demo: nur Ansicht' using errcode = '42501';
  end if;
  if p_text is null or char_length(btrim(p_text)) < 3 or char_length(p_text) > 2000 then
    raise exception 'Bitte kurz begründen, warum ein Fachbetrieb nötig ist' using errcode = '22023';
  end if;
  if p_schaetzung is not null and (p_schaetzung < 0 or p_schaetzung > 1000000) then
    raise exception 'Unplausible Schätzung' using errcode = '22023';
  end if;

  select * into a from public.auftraege
   where id = p_auftrag and service_user_id = (select auth.uid()) and status in ('offen', 'angenommen');
  if not found then return false; end if;

  if not exists (select 1 from public.service_zugaenge z
                  where z.user_id = (select auth.uid()) and z.vermieter_id = a.vermieter_id and z.rolle = 'hausmeister') then
    return false;
  end if;
  if p_firma is not null and not exists (select 1 from public.firmen f where f.id = p_firma and f.user_id = a.vermieter_id) then
    raise exception 'Firma gehört nicht zu diesem Auftraggeber' using errcode = '22023';
  end if;

  update public.auftraege
     set status = 'freigabe', auto_freigegeben = false,
         vorgeschlagene_firma_id = p_firma, kosten_schaetzung = p_schaetzung, updated_at = now()
   where id = p_auftrag;
  get diagnostics n = row_count;

  insert into public.auftrag_notizen (auftrag_id, vermieter_id, autor_id, autor_rolle, art, text)
  values (p_auftrag, a.vermieter_id, (select auth.uid()), 'service', 'fachbetrieb', btrim(p_text));
  return n = 1;
end $$;
revoke all on function public.auftrag_fachbetrieb_vorschlagen(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.auftrag_fachbetrieb_vorschlagen(uuid, uuid, numeric, text) to authenticated;
