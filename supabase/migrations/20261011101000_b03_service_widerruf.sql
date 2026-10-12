-- B03 – Widerruf eines Servicepartners wirkt sofort und überall (11.10.2026).
--
-- BEFUND (supabase/test/rls/b03_service_widerruf.sql): Die Regeln auf `auftraege`,
-- `auftrag_notizen` und `auftrag_rueckmeldungen` sowie `verlaengere_auftrag_link` prüften nur
-- `service_user_id = auth.uid()`. Nach „Verknüpfung lösen“ (Zeile in `service_zugaenge` gelöscht)
-- blieb `service_user_id` am Auftrag stehen — der Partner las, bearbeitete und kommentierte alte
-- Aufträge weiter, las Fotos und Firmen-Rückmeldungen und konnte den Auftrags-Link verlängern.
--
-- ENTSCHEIDUNG zum Umfang: Nach dem Widerruf hat der Partner KEINEN Zugriff mehr auf Aufträge dieses
-- Vermieters — auch nicht lesend auf erledigte. Die Historie bleibt beim Vermieter (mit Partnername).
-- Wer neu eingeladen wird, sieht seine früheren Aufträge wieder. Keine stillen Ausnahmen.
-- Der öffentliche Auftrags-Link, den der Partner kannte, wird in der Server-Action
-- `entferneServicePartner` erneuert (lib/actions/service.ts) — das ist Vermieter-Recht, keine Regel.
--
-- Jede Partner-Regel verlangt jetzt zusätzlich eine bestehende Verknüpfung zum Vermieter des
-- Auftrags. Nur ALTER POLICY / CREATE OR REPLACE — kein Löschbefehl.

alter policy auftraege_service_select on public.auftraege
  using (
    ((select auth.uid()) = service_user_id)
    and exists (select 1 from public.service_zugaenge z
                 where z.user_id = (select auth.uid()) and z.vermieter_id = auftraege.vermieter_id)
  );

alter policy auftraege_service_update on public.auftraege
  using (
    ((select auth.uid()) = service_user_id)
    and (status = any (array['offen'::text, 'angenommen'::text]))
    and exists (select 1 from public.service_zugaenge z
                 where z.user_id = (select auth.uid()) and z.vermieter_id = auftraege.vermieter_id)
  )
  with check (status = any (array['angenommen'::text, 'erledigt'::text, 'abgelehnt'::text]));

alter policy auftrag_notizen_lesen on public.auftrag_notizen
  using (exists (
    select 1 from public.auftraege a
     where a.id = auftrag_notizen.auftrag_id and a.vermieter_id = auftrag_notizen.vermieter_id
       and (((select auth.uid()) = a.vermieter_id)
            or (((select auth.uid()) = a.service_user_id)
                and exists (select 1 from public.service_zugaenge z
                             where z.user_id = (select auth.uid()) and z.vermieter_id = a.vermieter_id)))
  ));

alter policy auftrag_notizen_schreiben on public.auftrag_notizen
  with check (
    (autor_id = (select auth.uid()))
    and ((created_at >= (now() - '00:05:00'::interval)) and (created_at <= (now() + '00:05:00'::interval)))
    and ((not rueckfrage) or (autor_rolle = 'vermieter'::text))
    and exists (
      select 1 from public.auftraege a
       where a.id = auftrag_notizen.auftrag_id and a.vermieter_id = auftrag_notizen.vermieter_id
         and (((auftrag_notizen.autor_rolle = 'vermieter'::text) and (a.vermieter_id = (select auth.uid())))
              or ((auftrag_notizen.autor_rolle = 'service'::text) and (a.service_user_id = (select auth.uid()))
                  and exists (select 1 from public.service_zugaenge z
                               where z.user_id = (select auth.uid()) and z.vermieter_id = a.vermieter_id)))
    )
  );

alter policy "Auftrags-Rueckmeldungen lesen" on public.auftrag_rueckmeldungen
  using (exists (
    select 1 from public.auftraege a
     where a.id = auftrag_rueckmeldungen.auftrag_id
       and ((a.vermieter_id = (select auth.uid()))
            or ((a.service_user_id = (select auth.uid()))
                and exists (select 1 from public.service_zugaenge z
                             where z.user_id = (select auth.uid()) and z.vermieter_id = a.vermieter_id)))
  ));

alter policy "Auftrags-Rueckmeldungen als gelesen markieren" on public.auftrag_rueckmeldungen
  using (exists (
    select 1 from public.auftraege a
     where a.id = auftrag_rueckmeldungen.auftrag_id
       and ((a.vermieter_id = (select auth.uid()))
            or ((a.service_user_id = (select auth.uid()))
                and exists (select 1 from public.service_zugaenge z
                             where z.user_id = (select auth.uid()) and z.vermieter_id = a.vermieter_id)))
  ));

create or replace function public.verlaengere_auftrag_link(p_auftrag_id uuid, p_tage integer default 90)
returns timestamp with time zone
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  neu timestamptz;
begin
  if p_tage < 1 or p_tage > 365 then
    raise exception 'Verlaengerung nur zwischen 1 und 365 Tagen moeglich.';
  end if;
  update auftraege
     set public_token_ablauf = now() + make_interval(days => p_tage)
   where id = p_auftrag_id
     and (vermieter_id = auth.uid()
          or (service_user_id = auth.uid()
              and exists (select 1 from service_zugaenge z
                           where z.user_id = auth.uid() and z.vermieter_id = auftraege.vermieter_id)))
  returning public_token_ablauf into neu;
  if neu is null then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung.';
  end if;
  return neu;
end $function$;
