-- =============================================================================
-- Einladungscode nachträglich einlösen — Ausweg aus dem Freischaltungs-Gate
-- =============================================================================
--
-- Das Problem: `app/layout.tsx` leitet jedes Konto ohne Zeile in
-- `konto_freischaltung` nach `/willkommen`. Dort wurde bisher ausschließlich
-- der VERMIETER-Beta-Code akzeptiert.
--
-- Für Mieter und Service-Partner legt normalerweise der Trigger
-- `handle_new_user_rolle` die Freischaltung beim Registrieren mit an. Der
-- Trigger schluckt aber jeden Fehler (`exception when others then null`) und
-- greift beim Mieter zudem nur, wenn `v_e.mieter_id is not null`. Geht dabei
-- etwas schief — Code zwischen Client-Prüfung und `signUp` widerrufen oder
-- gelöscht, Code ohne verknüpften Mieter, Trigger-Fehler —, entsteht ein Konto
-- ohne Freischaltung und ohne Zugang. Der Nutzer landet dauerhaft auf
-- `/willkommen` und liest „Ungültiger Zugangscode" zu einem Beta-Code, den er
-- als Mieter nie bekommen kann. Aussperrung ohne Ausweg.
--
-- Diese Funktion holt die Einlösung nach: Sie prüft den Code, legt den
-- passenden Zugang an und schaltet das Konto frei — dieselbe Logik wie im
-- Trigger, nur nachträglich aufrufbar und mit ehrlichem Rückgabewert statt
-- verschlucktem Fehler.
--
-- SECURITY DEFINER, weil ein Mieter naturgemäß keine Schreibrechte auf
-- `einladungscodes` (gehört dem Vermieter) und `mieter_zugaenge` hat. Der Code
-- selbst ist das Geheimnis; ohne gültigen, unbenutzten und nicht abgelaufenen
-- Code passiert nichts.
-- =============================================================================

create or replace function public.einladungscode_einloesen(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  v_e public.einladungscodes;
  v_rolle text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'fehler', 'Nicht angemeldet.');
  end if;

  select * into v_e from public.einladungscodes
   where code = p_code
     and eingeloest_am is null
     and gueltig_bis > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'fehler', 'Code ungueltig, bereits benutzt oder abgelaufen.');
  end if;

  if v_e.rolle = 'mieter' then
    if v_e.mieter_id is null then
      -- Kommt vor, wenn der Vermieter den Code ohne Mieterzuordnung erzeugt hat.
      -- Genau dieser Fall lief im Trigger stillschweigend ins Leere.
      return jsonb_build_object(
        'ok', false,
        'fehler', 'Dieser Code ist keinem Mietverhaeltnis zugeordnet. Bitte den Vermieter um einen neuen Code bitten.');
    end if;
    insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id)
      values (uid, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id)
      on conflict do nothing;
    v_rolle := 'mieter';
  elsif v_e.rolle = 'service' then
    insert into public.service_zugaenge (user_id, vermieter_id, email)
      values (uid, v_e.vermieter_id, (select email from auth.users where id = uid))
      on conflict do nothing;
    v_rolle := 'service';
  else
    return jsonb_build_object('ok', false, 'fehler', 'Unbekannte Code-Art.');
  end if;

  -- Rolle nachtragen, falls sie beim Registrieren nicht gesetzt wurde.
  insert into public.nutzer_rollen (user_id, rolle)
    values (uid, v_rolle) on conflict (user_id) do nothing;

  update public.einladungscodes
     set eingeloest_von = uid, eingeloest_am = now()
   where id = v_e.id;

  insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (uid, true, true, 'einladung')
    on conflict (user_id) do update set
      consent_agb = true, consent_datenschutz = true, freigeschaltet_am = now();

  return jsonb_build_object('ok', true, 'rolle', v_rolle);
end;
$function$;
