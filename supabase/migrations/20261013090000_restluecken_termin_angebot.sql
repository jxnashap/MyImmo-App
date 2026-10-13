-- Restlücken aus dem Prüfstand-Bericht (13.10.2026): Termin-Bezüge und „Angebot beauftragen“ in einem Zug.
--
-- BEFUND 1 (Termine): `termine.prop_id` und `termine.mieter_id` sind Fremdschlüssel — und ein Fremdschlüssel
-- prüft NICHT, wem die Zeile gehört. `createTermin`/`updateTermin` (und ein direkter REST-Aufruf) konnten einen
-- Termin an Objekt oder Mieter eines FREMDEN Kontos hängen. Daten flossen dabei nicht ab (alles, was einen Termin
-- anzeigt, liest Mieter und Objekte über die eigenen RLS-Regeln), aber es ist dieselbe Lücke wie bei den Aufträgen
-- (Ablauf C) und verletzt die Regel „eine Spalte, die auf eine Konto-Zeile zeigt, prüft das Eigentum“.
-- JETZT: Trigger `termine_bezug_pruefen` (INSERT + UPDATE der Bezüge). Live vorher lesend geprüft: 0 Termine mit
-- fremdem Objekt oder Mieter.
--
-- BEFUND 2 (Angebot beauftragen): `beauftrageAngebot` schrieb in VIER Schritten (Anfrage beanspruchen → Auftrag
-- anlegen → Auftrag an die Anfrage hängen → übrige Anfragen ablehnen). Brach der Lauf zwischen dem ersten und dem
-- zweiten Schritt ab (Funktion beendet, Verbindung weg), stand die Anfrage auf „beauftragt“ OHNE Auftrag — die
-- Oberfläche bot kein „Beauftragen“ mehr an, und der Handwerker wusste von nichts. Zwei GLEICHZEITIGE
-- Beauftragungen verschiedener Firmen desselben Vorgangs ergaben zwei Aufträge.
-- JETZT: RPC `angebot_beauftragen` — alles in EINER Transaktion (scheitert ein Schritt, bleibt nichts zurück),
-- je Vorgang nacheinander (Sperre auf den Vorgang): genau EIN Auftrag je Vorgang aus Angeboten. Läuft mit den
-- Rechten des Aufrufers (security invoker): dieselben RLS-Regeln und Trigger wie vorher über die REST-Schnittstelle.
-- Live vorher lesend geprüft: 0 Anfragen „beauftragt“ ohne Auftrag.
--
-- Kein Löschbefehl, keine Fremdschlüssel → per apply_migration. VOR dem Code-Deploy (der Code ruft die RPC);
-- der alte Code läuft mit dieser Datei unverändert weiter.

-- ---- Befund 1: Bezüge eines Termins gehören demselben Konto --------------------------------------
create or replace function public.termin_bezug_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if new.prop_id is not null and not exists (
       select 1 from public.properties p where p.id = new.prop_id and p.user_id = new.user_id) then
    raise exception 'Das Objekt gehört nicht zu diesem Konto.' using errcode = '42501', hint = 'termin_bezug';
  end if;
  if new.mieter_id is not null and not exists (
       select 1 from public.mieter m where m.id = new.mieter_id and m.user_id = new.user_id) then
    raise exception 'Der Mieter gehört nicht zu diesem Konto.' using errcode = '42501', hint = 'termin_bezug';
  end if;
  return new;
end
$$;
revoke all on function public.termin_bezug_pruefen() from public, anon, authenticated;

create or replace trigger termine_bezug_pruefen
  before insert or update of prop_id, mieter_id, user_id on public.termine
  for each row execute function public.termin_bezug_pruefen();

-- ---- Befund 2: Angebot beauftragen in einer Transaktion ------------------------------------------
create or replace function public.angebot_beauftragen(p_angebot_id uuid, p_mieter_kontakt boolean, p_vermieter_name text)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  q record;
  anl record;
  neu record;
begin
  if uid is null then
    return jsonb_build_object('error', 'Nicht angemeldet.');
  end if;
  select a.id, a.anfrage_id, a.betrag, a.termin into g from public.angebote a where a.id = p_angebot_id;
  if not found then
    return jsonb_build_object('error', 'Angebot nicht gefunden.');
  end if;
  select x.id, x.anliegen_id, x.firma_id, x.titel, x.beschreibung, x.objekt, x.absender into q
    from public.angebotsanfragen x where x.id = g.anfrage_id and x.vermieter_id = uid;
  if not found then
    return jsonb_build_object('error', 'Anfrage nicht gefunden.');
  end if;
  -- Ein Vorgang wird nacheinander entschieden: Zwei gleichzeitige Beauftragungen (auch verschiedener Firmen)
  -- warten aufeinander; die zweite findet ihre Anfrage dann abgelehnt.
  perform pg_advisory_xact_lock(hashtextextended('angebot_beauftragen:' || q.anliegen_id::text, 0));
  select an.prop_id, an.mieter_id into anl
    from public.anliegen an where an.id = q.anliegen_id and an.vermieter_id = uid;
  if not found then
    return jsonb_build_object('error', 'Vorgang nicht gefunden.');
  end if;

  update public.angebotsanfragen set status = 'beauftragt'
   where id = q.id and vermieter_id = uid and status = 'angefragt';
  if not found then
    return jsonb_build_object('error', 'Für diese Anfrage wurde schon entschieden.');
  end if;

  insert into public.auftraege (vermieter_id, service_user_id, firma_id, anliegen_id, prop_id, objekt_name,
                                vermieter_name, titel, beschreibung, termin, status, erstellt_von, kosten_schaetzung,
                                mieter_id)
  values (uid, null, q.firma_id, q.anliegen_id, anl.prop_id, q.objekt,
          coalesce(nullif(btrim(coalesce(q.absender, '')), ''), nullif(btrim(coalesce(p_vermieter_name, '')), '')),
          q.titel, q.beschreibung, g.termin, 'offen', 'vermieter', g.betrag,
          case when p_mieter_kontakt then anl.mieter_id end)
  returning id, public_token into neu;

  update public.angebotsanfragen set auftrag_id = neu.id where id = q.id and vermieter_id = uid;
  update public.angebotsanfragen set status = 'abgelehnt'
   where anliegen_id = q.anliegen_id and vermieter_id = uid and status = 'angefragt';

  return jsonb_build_object('ok', true, 'token', neu.public_token, 'auftrag_id', neu.id);
end
$$;
comment on function public.angebot_beauftragen(uuid, boolean, text) is
  'Angebot beauftragen in EINER Transaktion: Anfrage beauftragt, Auftrag an die Firma, übrige Anfragen des Vorgangs abgelehnt (13.10.2026).';
revoke all on function public.angebot_beauftragen(uuid, boolean, text) from public, anon;
grant execute on function public.angebot_beauftragen(uuid, boolean, text) to authenticated;
