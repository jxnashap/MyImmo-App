-- „Neu seit deinem letzten Besuch“ im Service-Portal (05.10.2026, Prüfung vor dem Livegang):
-- Solange Brevo nicht versendet, erfährt der Hausmeister von neuen Aufträgen, Freigaben und
-- Rückfragen nur in der App. Der letzte Besuch steht in der Datenbank (geräteübergreifend),
-- nicht im Browser.
alter table public.service_zugaenge add column if not exists zuletzt_gesehen_am timestamptz;

-- Der Partner darf seine Verknüpfung sonst nicht ändern (nur lesen) — diese Funktion setzt
-- ausschließlich den Zeitpunkt, und nur auf seinen eigenen Zeilen.
create or replace function public.service_gesehen()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if public.ist_demo_nutzer() then return; end if;  -- geteiltes Demo-Konto: nichts merken
  update public.service_zugaenge set zuletzt_gesehen_am = now() where user_id = (select auth.uid());
end $$;
revoke all on function public.service_gesehen() from public, anon;
grant execute on function public.service_gesehen() to authenticated;
