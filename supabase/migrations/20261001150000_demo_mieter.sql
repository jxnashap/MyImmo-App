-- Demo-Mieter (01.10.2026): Das Mieterportal war der einzige Nutzerbereich
-- ohne jede automatische Prüfung — kein Mieter-Testkonto, der Rauchtest kam
-- nie dorthin, Paket 5 (Sichten statt Tabellen) hat es umgebaut, ohne dass
-- jemand /portal danach gesehen hat.
--
-- Jetzt: ein zweites Demo-Konto `demo.mieter@myimmo.test` (angelegt von
-- /api/demo per Service-Role, Passwort = DEMO_PASSWORT), verknüpft mit der
-- Demo-Mieterin Sophie Berger. Der Rauchtest meldet sich zusätzlich als
-- Mieter an und prüft /portal mit allen fünf Reitern und /konto.

-- 1. Die Demo-Schreibsperre (Trigger + restriktive Policies über
--    ist_demo_nutzer()) gilt auch für das Mieter-Konto. Der Vermieter bleibt
--    an der festen uid erkannt; der Mieter über den signierten E-Mail-Claim —
--    seine uid entsteht erst beim ersten Demo-Start auf Vercel.
create or replace function public.ist_demo_nutzer()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(auth.uid() = 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4'::uuid, false)
      or coalesce((auth.jwt() ->> 'email') in ('demo.vermieter@myimmo.test', 'demo.mieter@myimmo.test'), false);
$function$;

-- 2. Verknüpfung nach jedem Demo-Reset (der Reset leert anliegen und schreibt
--    sie ohne mieter_user_id neu; mieter_zugaenge gehört nicht zum Reset).
--    Idempotent; gibt false zurück, solange das Mieter-Konto noch nicht
--    existiert. Nur Service-Role.
create or replace function public.demo_mieter_verknuepfen()
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  demo_v uuid;
  demo_m uuid;
  berger uuid := 'f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2';
  wohnung uuid := 'd560ceb5-9dc2-4869-a0c8-41833c061a2c';
begin
  select id into demo_v from auth.users where email = 'demo.vermieter@myimmo.test';
  select id into demo_m from auth.users where email = 'demo.mieter@myimmo.test';
  if demo_v is null or demo_m is null then
    return false;
  end if;

  insert into public.nutzer_rollen (user_id, rolle)
    values (demo_m, 'mieter') on conflict (user_id) do nothing;
  insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (demo_m, true, true, 'demo') on conflict (user_id) do nothing;
  insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id)
    values (demo_m, demo_v, berger, wohnung) on conflict do nothing;
  -- Das Beispiel-Anliegen der Mieterin gehört dem Mieter-Konto, damit das
  -- Portal es unter „Anliegen" zeigt.
  update public.anliegen set mieter_user_id = demo_m
   where vermieter_id = demo_v and mieter_id = berger and mieter_user_id is distinct from demo_m;
  return true;
end
$function$;

revoke execute on function public.demo_mieter_verknuepfen() from public, anon, authenticated;
