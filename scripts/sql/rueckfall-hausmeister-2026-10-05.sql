-- RÜCKFALL für „Hausmeister & Servicepartner“ (Migrationen 20261005100000 … 20261005130000).
-- NUR ausführen, wenn der Code nach dem Merge zurückgerollt werden muss (Vercel Instant Rollback)
-- und sich die alte App mit den neuen Regeln falsch verhält.
--
-- WAS DIE MIGRATIONEN GEÄNDERT HABEN — und was davon hier zurückgestellt wird:
--   * Neue Spalten (`service_zugaenge.rolle`, `auftraege.vorgeschlagene_firma_id`,
--     `auftrag_notizen.rueckfrage`), neue Tabellen (`service_objekte`, `auftrag_notizen`), Sicht,
--     RPCs: rein HINZUGEFÜGT. Die alte App kennt sie nicht und stört sich nicht daran → BLEIBEN.
--     (Am 05.10.2026 geprüft: Die Live-App lief mit den neuen Spalten unverändert weiter.)
--   * `delete_own_account()` (20261005130000): löscht MEHR als vorher — für die alte App
--     unschädlich und rechtlich nötig → BLEIBT.
--   * ZWEI Regeln mit geändertem VERHALTEN → werden hier auf den Stand vom 02.10.2026 gesetzt:
--       1. `auftraege_service_insert`: Antrag nur als Hausmeister und nur für zugewiesene Objekte.
--          Alte App: setzt keine prop_id, alle Partner hatten Rolle 'hausmeister' (Standard) —
--          ändert sich also nur für Partner, die inzwischen 'dienstleister' sind.
--       2. `firmen_service_select`: Firmenverzeichnis nur für Hausmeister.
-- Kein Lösch-Schlüsselwort — darf über apply_migration oder den SQL-Editor laufen.

alter policy auftraege_service_insert on public.auftraege
  with check (
    (select auth.uid()) = service_user_id
    and erstellt_von = 'service'
    and exists (select 1 from public.service_zugaenge z
                 where z.vermieter_id = auftraege.vermieter_id and z.user_id = (select auth.uid()))
    and (
      (status = 'freigabe' and not auto_freigegeben)
      or (status = 'offen' and auto_freigegeben
          and kosten_schaetzung is not null
          and kosten_schaetzung <= coalesce(public.auftrag_kostengrenze(vermieter_id), -1))
    ));

alter policy firmen_service_select on public.firmen
  using (exists (select 1 from public.service_zugaenge z
                 where z.vermieter_id = firmen.user_id and z.user_id = (select auth.uid())));
