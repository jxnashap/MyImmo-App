-- Firmenverzeichnis nur für Hausmeister (05.10.2026). Bisher las JEDER verknüpfte Service-Partner
-- das ganze Verzeichnis des Vermieters — ein Dienstleister (z. B. Sanitärbetrieb) sah damit die
-- Konkurrenz samt Kontaktdaten. Der Hausmeister braucht es, um eine Firma vorzuschlagen.
alter policy firmen_service_select on public.firmen
  using (
    exists (select 1 from public.service_zugaenge z
             where z.vermieter_id = firmen.user_id
               and z.user_id = (select auth.uid())
               and z.rolle = 'hausmeister')
  );
