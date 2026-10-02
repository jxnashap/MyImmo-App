-- Demo: Service-Partner, Firmenverzeichnis und Aufträge (01.10.2026).
--
-- Bis hierher war der Reiter „Service-Partner" im Demo-Mieterportal leer:
-- kein Partner, keine Firma, kein Auftrag. Der Besucher sah drei Leerzustände
-- und keine einzige der Funktionen, um die es dort geht.
--
-- Jetzt:
--   * drei verknüpfte Service-Konten (Hausmeister, Sanitär, Garten/Winter),
--     angelegt von /api/demo per Service-Role, verknüpft über
--     demo_service_verknuepfen();
--   * fünf Firmen im Verzeichnis;
--   * sechs Aufträge in allen relevanten Zuständen (Freigabe angefragt,
--     offen, angenommen, zweimal erledigt mit Betrag, eine Firmen-Zusage).
--
-- Alles gehört ausschließlich dem Demo-Vermieter; kein echtes Konto sieht
-- davon etwas.
--
-- Telefonnummern: alle aus dem Berliner Block 030 23125 xxx, den die
-- Bundesnetzagentur nach unserem Kenntnisstand für Film- und
-- Fernsehproduktionen freihält (vor einer Verwendung außerhalb der Demo
-- nochmals prüfen). E-Mails unter
-- der reservierten Domain .test. Keine Website — ein Link auf eine echte
-- Seite wäre Werbung für einen Fremden.

-- ---------------------------------------------------------------------------
-- 1. Schreibsperre erkennt auch die Service-Konten (signierter E-Mail-Claim).
create or replace function public.ist_demo_nutzer()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(auth.uid() = 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4'::uuid, false)
      or coalesce((auth.jwt() ->> 'email') in (
           'demo.vermieter@myimmo.test', 'demo.mieter@myimmo.test',
           'demo.hausmeister@myimmo.test', 'demo.sanitaer@myimmo.test', 'demo.garten@myimmo.test'
         ), false);
$function$;

-- ---------------------------------------------------------------------------
-- 3. Verknüpfung der Service-Konten (vor dem Reset aufgerufen).
--    Gibt die E-Mails zurück, deren Konto noch fehlt — /api/demo legt sie an
--    und ruft erneut. Leeres Array = alles verknüpft. Nur Service-Role.
create or replace function public.demo_service_verknuepfen()
 returns text[]
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  demo_v uuid;
  p record;
  uid uuid;
  fehlt text[] := '{}';
begin
  select id into demo_v from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_v is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  for p in
    select * from (values
      ('demo.hausmeister@myimmo.test', 'Hausmeisterservice Krause', 120),
      ('demo.sanitaer@myimmo.test',    'Sanitär Lindner GmbH',       75),
      ('demo.garten@myimmo.test',      'Garten- & Winterdienst Petersen', 40)
    ) as t(email, firma, seit_tagen)
  loop
    select id into uid from auth.users where email = p.email;
    if uid is null then
      fehlt := fehlt || p.email;
      continue;
    end if;
    insert into public.nutzer_rollen (user_id, rolle) values (uid, 'service')
      on conflict (user_id) do update set rolle = 'service';
    insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
      values (uid, true, true, 'demo') on conflict (user_id) do nothing;
    insert into public.service_zugaenge (user_id, vermieter_id, firma, email, created_at)
      values (uid, demo_v, p.firma, p.email, now() - make_interval(days => p.seit_tagen))
      on conflict (user_id, vermieter_id) do update set firma = excluded.firma;
  end loop;
  return fehlt;
end
$function$;

revoke execute on function public.demo_service_verknuepfen() from public, anon, authenticated;

