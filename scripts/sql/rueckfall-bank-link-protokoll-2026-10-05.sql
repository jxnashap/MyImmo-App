-- Rückfall für Migration 20261005160000: stellt die Bank-Datei-Funktion OHNE Abruf-Protokoll
-- wieder her (Fassung vor dem 05.10.2026, live ausgelesen per pg_get_functiondef).
-- Nur nötig, wenn Bank-Links nach dem Livegang keine Dateien mehr ausliefern. Die neuen
-- Tabellen und Makler-Funktionen bleiben davon unberührt (rein hinzugefügt).
create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text)
 returns table(datei_name text, datei_type text, datei_data text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select d.datei_name, d.datei_type, d.datei_data
  from beleihung_freigaben f
  join beleihung_dokumente d
    on d.prop_id = f.prop_id and d.user_id = f.user_id and d.item_key = p_item_key
  where f.token = p_token and f.aktiv and f.ablauf > now()
    and p_item_key = any(f.item_keys) and d.datei_data is not null
  limit 1
$function$;
