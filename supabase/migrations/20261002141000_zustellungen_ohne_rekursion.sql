-- Nachtrag zu 20261002140000_zustellungen: Die Einfüge-Regel las `notizen` direkt. Die
-- Mieter-Regel auf `notizen` liest seit derselben Migration `zustellungen` — Postgres
-- erkennt den Kreis und bricht JEDES Einfügen mit 42P17 („infinite recursion“) ab.
-- Gefunden im Nachweis (zurückgerollte Transaktion), bevor die App die Tabelle nutzte.
-- Die Herkunftsprüfung läuft jetzt über eine Funktion mit Eigentümerrechten, die die
-- Regeln von `notizen` nicht auslöst; sie prüft selbst auf auth.uid().

create or replace function public.zustellung_notiz_passt(p_notiz uuid, p_mieter uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select exists (
    select 1 from public.notizen n
     where n.id = p_notiz
       and n.user_id = auth.uid()
       and n.mieter_id = p_mieter)
$$;
revoke execute on function public.zustellung_notiz_passt(uuid, uuid) from public, anon;
grant execute on function public.zustellung_notiz_passt(uuid, uuid) to authenticated;

alter policy zust_insert_vermieter on public.zustellungen
  with check (
    (select auth.uid()) = vermieter_id
    and zugestellt_von = (select auth.uid())
    and gelesen_am is null and bestaetigt_am is null and zurueckgezogen_am is null
    and zugestellt_am between now() - interval '5 minutes' and now() + interval '5 minutes'
    and exists (
      select 1 from public.mieter m
       where m.id = zustellungen.mieter_id
         and m.user_id = (select auth.uid())
         and (m.mietende is null
              or (now() at time zone 'Europe/Berlin')::date <= public.mieter_zugang_endet(m.mietende)))
    and exists (
      select 1 from public.mieter_zugaenge z
       where z.mieter_id = zustellungen.mieter_id
         and z.user_id = zustellungen.empfaenger_user_id
         and z.vermieter_id = (select auth.uid()))
    and (notiz_id is null or public.zustellung_notiz_passt(notiz_id, mieter_id))
  );
