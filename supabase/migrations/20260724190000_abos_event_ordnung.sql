-- Security-Review-Fix (Webhook-Härtung): Paddle garantiert keine Event-
-- Reihenfolge. Wir speichern den occurred_at-Zeitstempel des zuletzt
-- angewendeten Events; der Webhook verwirft Events, die älter sind als der
-- gespeicherte Stand (sonst könnte ein verspätetes "updated" ein späteres
-- "canceled" überschreiben und ein gekündigtes Abo wieder aktiv erscheinen).

alter table public.abos
  add column letztes_event_am timestamptz;
