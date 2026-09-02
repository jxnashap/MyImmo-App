-- Bewerbungs-Link: Objekt-Steckbrief + gewünschte Dokument-Slots.
--
-- (1) Steckbrief: Der Vermieter kann je Link die Eckdaten seiner Anzeige
--     hinterlegen (Kaltmiete, NK, Kaution, bezugsfrei ab, Ausstattung,
--     Beschreibung ...). Die öffentliche Bewerbungsseite zeigt sie dem
--     Interessenten — alle Infos an einem Ort, wie im Inserat.
-- (2) Dokument-Slots: Der Vermieter wählt je Link, welche Unterlagen er sich
--     wünscht (z. B. letzte 3 Gehaltsabrechnungen, SCHUFA, Mietschulden-
--     freiheitsbescheinigung). Die Slots sind für Bewerber IMMER freiwillig
--     (DSK-Orientierungshilfe: erzwungene Nachweise vor Vertragsanbahnung
--     wären keine wirksame Einwilligung).

alter table public.bewerber_links
  add column if not exists anzeige jsonb,
  add column if not exists dokumente_gewuenscht text[] not null default '{}';

alter table public.bewerbung_dateien
  add column if not exists slot text;

-- Link-Info um Steckbrief + gewünschte Dokumente erweitern.
create or replace function public.bewerber_link_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  v record;
begin
  select bl.id, bl.titel, bl.user_id, bl.anzeige, bl.dokumente_gewuenscht,
         p.bezeichnung, p.adresse, p.flaeche, p.zimmer
    into l
  from bewerber_links bl
  join properties p on p.id = bl.prop_id
  where bl.token = p_token and bl.aktiv;
  if not found then return null; end if;
  select name, email, telefon into v
  from vermieter_profil where user_id = l.user_id limit 1;
  return jsonb_build_object(
    'titel', l.titel, 'objekt', l.bezeichnung, 'adresse', l.adresse,
    'flaeche', l.flaeche, 'zimmer', l.zimmer,
    'anzeige', l.anzeige,
    'dokumente_gewuenscht', to_jsonb(coalesce(l.dokumente_gewuenscht, '{}'::text[])),
    'verantwortlicher', nullif(trim(coalesce(v.name, '')), ''),
    'verantwortlicher_email', nullif(trim(coalesce(v.email, '')), ''),
    'verantwortlicher_telefon', nullif(trim(coalesce(v.telefon, '')), ''));
end $function$;

-- Anhänge-RPC: Slot-Zuordnung + höheres Datei-Limit (die Slots decken bis zu
-- 3 Gehaltsabrechnungen plus weitere Nachweise ab → 12 statt 5 Dateien).
create or replace function public.bewerbung_datei_anhaengen(p_token uuid, p_bewerbung uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  b record;
  v_name text := left(coalesce(nullif(trim(p->>'name'),''), 'Dokument'), 200);
  v_typ text := p->>'typ';
  v_data text := p->>'data';
  v_slot text := nullif(trim(p->>'slot'),'');
  anzahl int;
begin
  select bl.id, bl.user_id into l
  from bewerber_links bl where bl.token = p_token and bl.aktiv;
  if not found then return jsonb_build_object('error','Link ungültig oder deaktiviert.'); end if;

  select bw.id into b from bewerbungen bw
  where bw.id = p_bewerbung and bw.link_id = l.id
    and bw.created_at > now() - interval '1 hour';
  if not found then return jsonb_build_object('error','Bewerbung nicht gefunden.'); end if;

  if v_typ is null or v_typ not in ('application/pdf','image/jpeg','image/png','image/webp') then
    return jsonb_build_object('error','Nur PDF-, JPG-, PNG- oder WebP-Dateien.');
  end if;
  if v_data is null
     or (v_data not like 'enc:v1:%' and v_data not like 'data:%;base64,%')
     or length(v_data) > 12000000 then
    return jsonb_build_object('error','Datei zu groß (max. 6 MB) oder ungültig.');
  end if;
  if v_slot is not null and v_slot not in
     ('gehalt','schufa','mietschuldenfrei','arbeitsvertrag','einkommen_selbst',
      'buergschaft','einkommen_sonstig','wbs','sonstiges') then
    return jsonb_build_object('error','Unbekannte Dokument-Kategorie.');
  end if;

  select count(*) into anzahl from bewerbung_dateien where bewerbung_id = p_bewerbung;
  if anzahl >= 12 then
    return jsonb_build_object('error','Maximal 12 Dokumente je Bewerbung.');
  end if;

  insert into bewerbung_dateien (bewerbung_id, user_id, name, typ, groesse, data, slot)
  values (p_bewerbung, l.user_id, v_name, v_typ,
          greatest(0, least(coalesce(nullif(p->>'groesse','')::int, 0), 100000000)), v_data, v_slot);
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('error','Dokument konnte nicht gespeichert werden.');
end $function$;
