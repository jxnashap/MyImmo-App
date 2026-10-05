-- Rückfall für das Abruf-Protokoll am Bank-Link: liefert die Datei wie Migration 20261005180000
-- (MIT Zugangscode), nur OHNE den Protokoll-Eintrag. Nur nötig, wenn Bank-Links Dateien nicht
-- mehr ausliefern und das Protokoll als Ursache vermutet wird.
--
-- ⚠️ Bis 05.10.2026 stand hier die Fassung ohne Code (`p_token, p_item_key`). Seit der
-- Code-Pflicht (20261005180000) ist diese Fassung stillgelegt — sie wiederherzustellen hieße,
-- die Unterlagen wieder für jeden mit dem Link zu öffnen. Deshalb hier nur die Code-Fassung.
create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text, p_code_hash text)
 returns table(datei_name text, datei_type text, datei_data text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select d.datei_name, d.datei_type, d.datei_data
  from public.beleihung_freigaben f
  join public.beleihung_dokumente d
    on d.prop_id = f.prop_id and d.user_id = f.user_id and d.item_key = p_item_key
  where f.token = p_token and f.aktiv and f.ablauf > now()
    and p_item_key = any(f.item_keys) and d.datei_data is not null
    and f.code_hash is not null and f.code_hash = p_code_hash
  limit 1
$function$;
