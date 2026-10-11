-- Ablauf C (Prüfstand 11.10.2026, Phase 5): Anliegen → Service → Angebot → Auftrag → Kosten → Rückmeldung.
--
-- BEFUND 1 (Sicherheit, beim Bau von Ablauf C gefunden): Die Schreibregel auf `auftraege` prüft nur
-- `vermieter_id = auth.uid()`. `anliegen_id`, `mieter_id`, `prop_id`, `firma_id` und
-- `vorgeschlagene_firma_id` sind Fremdschlüssel — und ein Fremdschlüssel prüft NICHT, wem die Zeile
-- gehört (er läuft ohne RLS). Ein angemeldeter Vermieter konnte so einen Auftrag an die ID eines
-- FREMDEN Mieters hängen; `auftrag_public_info` lieferte über den eigenen Auftrags-Link dann dessen
-- Name, Telefon und E-Mail. Und eine fremde `anliegen_id` ließ den Verlaufs-Trigger einen Eintrag in
-- den Vorgang eines anderen Kontos schreiben. Voraussetzung jeweils: Man kennt die fremde UUID —
-- ausgenutzt wurde es nachweislich nicht (kein Protokoll), möglich war es.
-- JETZT: Trigger `auftraege_bezug_pruefen` — jeder Bezug muss demselben Vermieter gehören (beim
-- Anlegen UND beim Ändern, auch für Anträge des Hausmeisters). `auftrag_public_info` verbindet den
-- Mieter zusätzlich nur, wenn er dem Vermieter des Auftrags gehört (Altbestand).
--
-- BEFUND 2 (Ablauf): Der Mieter sah im Verlauf nur „Ein Handwerker wurde beauftragt.“ — nicht, wer
-- zuständig ist (Hausmeister oder Fachbetrieb). JETZT trägt jeder Auftrags-Eintrag `zustaendig`
-- (`hausmeister` | `handwerker`) — die ROLLE, nie den Namen (Geschäftsdaten des Vermieters, wie bisher).
-- Ein vom Vermieter abgeschlossener Firmenauftrag heißt „Der Auftrag ist erledigt.“
--
-- Kein Löschbefehl, keine `on …`-Klausel → per apply_migration möglich. VOR dem Code-Deploy (der Code
-- liest `anliegen_ereignisse.zustaendig`). Vorher lesend prüfen, ob es Altbestand mit fremdem Bezug gibt
-- (Abfrage am Ende als Kommentar) — der Trigger greift nur bei neuen Zeilen und geänderten Bezügen.

alter table public.anliegen_ereignisse add column if not exists zustaendig text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ereignis_zustaendig_wert') then
    alter table public.anliegen_ereignisse add constraint ereignis_zustaendig_wert
      check (zustaendig is null or zustaendig in ('vermieter', 'hausmeister', 'handwerker'));
  end if;
end $$;
comment on column public.anliegen_ereignisse.zustaendig is
  'Wer den Auftrag bearbeitet (Ablauf C): hausmeister | handwerker (Rolle, nie Name). Nur bei art = auftrag.';

-- ---- Befund 1: Bezüge eines Auftrags gehören demselben Vermieter -------------------------------
create or replace function public.auftrag_bezug_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if new.anliegen_id is not null and not exists (
       select 1 from public.anliegen a where a.id = new.anliegen_id and a.vermieter_id = new.vermieter_id) then
    raise exception 'Das Anliegen gehört nicht zu diesem Vermieter.' using errcode = '42501', hint = 'auftrag_bezug';
  end if;
  if new.mieter_id is not null and not exists (
       select 1 from public.mieter m where m.id = new.mieter_id and m.user_id = new.vermieter_id) then
    raise exception 'Der Mieter gehört nicht zu diesem Vermieter.' using errcode = '42501', hint = 'auftrag_bezug';
  end if;
  if new.prop_id is not null and not exists (
       select 1 from public.properties p where p.id = new.prop_id and p.user_id = new.vermieter_id) then
    raise exception 'Das Objekt gehört nicht zu diesem Vermieter.' using errcode = '42501', hint = 'auftrag_bezug';
  end if;
  if new.firma_id is not null and not exists (
       select 1 from public.firmen f where f.id = new.firma_id and f.user_id = new.vermieter_id) then
    raise exception 'Die Firma gehört nicht zu diesem Vermieter.' using errcode = '42501', hint = 'auftrag_bezug';
  end if;
  if new.vorgeschlagene_firma_id is not null and not exists (
       select 1 from public.firmen f where f.id = new.vorgeschlagene_firma_id and f.user_id = new.vermieter_id) then
    raise exception 'Die vorgeschlagene Firma gehört nicht zu diesem Vermieter.' using errcode = '42501', hint = 'auftrag_bezug';
  end if;
  return new;
end
$$;
revoke all on function public.auftrag_bezug_pruefen() from public, anon, authenticated;

create or replace trigger auftraege_bezug_pruefen
  before insert or update of anliegen_id, mieter_id, prop_id, firma_id, vorgeschlagene_firma_id, vermieter_id
  on public.auftraege
  for each row execute function public.auftrag_bezug_pruefen();

-- Öffentlicher Auftrags-Link: Mieterkontakt nur, wenn der Mieter dem Vermieter des Auftrags gehört.
-- (Fassung aus 20261008100000, nur die Verbindung zum Mieter geschärft.)
create or replace function public.auftrag_public_info(p_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a record;
begin
  select au.titel, au.beschreibung, au.objekt_name, au.vermieter_name, au.termin, au.status, au.vermieter_id,
         m.vorname, m.nachname, m.telefon, m.email
    into a
  from auftraege au
  left join mieter m on m.id = au.mieter_id and m.user_id = au.vermieter_id
  where au.public_token = p_token
    and au.status in ('offen','angenommen')
    and au.public_token_ablauf > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'titel', a.titel,
    'beschreibung', a.beschreibung,
    'objekt', a.objekt_name,
    'vermieter', a.vermieter_name,
    'termin', a.termin,
    'mieter_name', nullif(trim(coalesce(a.vorname,'') || ' ' || coalesce(a.nachname,'')), ''),
    'mieter_telefon', a.telefon,
    'mieter_email', a.email,
    -- Beispiel-Auftrag der Demo: die Seite zeigt den Hinweis und sendet nichts (P5, B53).
    'demo', public.gehoert_demo(a.vermieter_id)
  );
end $function$;

-- ---- Befund 2: Verlauf nennt die zuständige Rolle --------------------------------------------
create or replace function public.auftrag_verlauf_mitschreiben()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  rolle text;
  zust text;
begin
  if uid is null or new.anliegen_id is null then
    return new;
  end if;
  rolle := case when uid = new.vermieter_id then 'vermieter' else 'system' end;
  -- Zuständig: der Hausmeister, wenn ein Partner mit dieser Rolle am Auftrag hängt; sonst ein Handwerker
  -- (Dienstleister mit Konto oder Firma über den Auftrags-Link).
  zust := case
    when new.service_user_id is not null and exists (
      select 1 from public.service_zugaenge z
       where z.user_id = new.service_user_id and z.vermieter_id = new.vermieter_id and z.rolle = 'hausmeister')
      and new.firma_id is null
      then 'hausmeister'
    else 'handwerker' end;
  if tg_op = 'INSERT' then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text, status_neu, zustaendig)
      values (new.anliegen_id, uid, rolle, 'auftrag',
              case when zust = 'hausmeister' then 'Der Hausmeister kümmert sich darum.' else 'Ein Handwerker wurde beauftragt.' end,
              new.status, zust);
  elsif new.status is distinct from old.status then
    insert into public.anliegen_ereignisse (anliegen_id, autor_id, autor_rolle, art, text, status_neu, zustaendig)
      values (new.anliegen_id, uid, rolle, 'auftrag',
              case new.status
                when 'angenommen' then case when zust = 'hausmeister' then 'Der Hausmeister hat den Auftrag angenommen.' else 'Der Handwerker hat den Auftrag angenommen.' end
                when 'erledigt' then case when rolle = 'vermieter' then 'Der Auftrag ist erledigt.'
                                          when zust = 'hausmeister' then 'Der Hausmeister meldet den Auftrag als erledigt.'
                                          else 'Der Handwerker meldet den Auftrag als erledigt.' end
                when 'freigabe' then 'Der Auftrag wartet auf die Freigabe des Vermieters.'
                when 'offen' then 'Der Auftrag ist freigegeben.'
                when 'nicht_freigegeben' then 'Der Auftrag wurde nicht freigegeben.'
                when 'abgelehnt' then 'Der Auftrag wurde abgelehnt — dein Vermieter kümmert sich um einen anderen Weg.'
                else 'Auftrag: neuer Stand.' end,
              new.status, zust);
  end if;
  return new;
end
$$;
revoke execute on function public.auftrag_verlauf_mitschreiben() from public, anon, authenticated;

-- Altbestand mit fremdem Bezug finden (nur lesen, vor dem Ausrollen ausführen; erwartet: 0 Zeilen):
--   select au.id from public.auftraege au
--    left join public.anliegen a on a.id = au.anliegen_id
--    left join public.mieter m on m.id = au.mieter_id
--    left join public.properties p on p.id = au.prop_id
--   where (au.anliegen_id is not null and a.vermieter_id is distinct from au.vermieter_id)
--      or (au.mieter_id is not null and m.user_id is distinct from au.vermieter_id)
--      or (au.prop_id is not null and p.user_id is distinct from au.vermieter_id);
