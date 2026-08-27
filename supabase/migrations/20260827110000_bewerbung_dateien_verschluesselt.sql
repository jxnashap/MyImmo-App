-- Bewerbungs-Dokumente werden ab jetzt App-seitig verschlüsselt gespeichert
-- (AES-256-GCM, Format "enc:v1:<base64>", Schlüssel = Vercel-Env
-- DATA_ENCRYPTION_KEY — wie IBANs/Darlehensnummern). Die Anhänge-RPC prüfte
-- bisher auf das Data-URL-Format und hätte Chiffretext abgelehnt; außerdem ist
-- Chiffretext ~33 % größer als die Data-URL (base64 über base64) — das Limit
-- steigt von 8 auf 12 MB Text (entspricht weiterhin ~6 MB Datei).
create or replace function public.bewerbung_datei_anhaengen(p_token uuid, p_bewerbung uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  b record;
  v_name text := left(coalesce(nullif(trim(p->>'name'),''), 'Dokument'), 200);
  v_typ text := p->>'typ';
  v_data text := p->>'data';
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
  -- Erlaubt: App-Chiffretext (Regelfall) oder Klartext-Data-URL (Dev ohne Key)
  if v_data is null
     or (v_data not like 'enc:v1:%' and v_data not like 'data:%;base64,%')
     or length(v_data) > 12000000 then
    return jsonb_build_object('error','Datei zu groß (max. 6 MB) oder ungültig.');
  end if;

  select count(*) into anzahl from bewerbung_dateien where bewerbung_id = p_bewerbung;
  if anzahl >= 5 then
    return jsonb_build_object('error','Maximal 5 Dokumente je Bewerbung.');
  end if;

  insert into bewerbung_dateien (bewerbung_id, user_id, name, typ, groesse, data)
  values (p_bewerbung, l.user_id, v_name, v_typ,
          greatest(0, least(coalesce(nullif(p->>'groesse','')::int, 0), 100000000)), v_data);
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('error','Dokument konnte nicht gespeichert werden.');
end $function$;
