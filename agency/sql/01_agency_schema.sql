-- =====================================================================
-- AI Agency OS — Zustandsschicht
-- =====================================================================
-- Gehört in ein EIGENES Supabase-Projekt („myimmo-agency"), NICHT in das
-- Produktionsprojekt von MyImmo. Grund: n8n braucht einen Service-Role-Key,
-- und der umgeht RLS. Läge das Schema im Produktionsprojekt, hätte ein
-- kompromittierter n8n-Server Zugriff auf sämtliche Vermieter- und
-- Mieterdaten. Die MyImmo-Kennzahlen kommen deshalb über die geschützte
-- Route /api/intern/kennzahlen, die nur Aggregate herausgibt.
--
-- Aufbau:
--   Tabellen liegen im Schema `agency` — das ist in Supabase NICHT über
--   PostgREST erreichbar. Zugriff nur über die `public.agency_*`-Funktionen
--   (security definer), die ausschließlich `service_role` ausführen darf.
--   Das ist die technische Umsetzung von „kein Agent eskaliert seine
--   Rechte selbst": n8n kann genau die Vorgänge auslösen, die hier
--   definiert sind, und sonst nichts.
--
-- Anwenden: Supabase → SQL Editor → einfügen → Run. Idempotent.
-- =====================================================================

create schema if not exists agency;
revoke all on schema agency from public;

-- ---------------------------------------------------------------------
-- Einstellungen (ein Ort für Deckel und Schalter)
-- ---------------------------------------------------------------------
create table if not exists agency.einstellungen (
  schluessel text primary key,
  wert text not null,
  notiz text
);

insert into agency.einstellungen (schluessel, wert, notiz) values
  ('monatsdeckel_usd', '0', 'Ausgabendeckel je Monat in USD. 0 = alles gesperrt — bewusst, damit nichts läuft, bevor eine Zahl entschieden ist.'),
  ('auditpflicht_ab', 'hoch', 'Ab dieser Risikostufe ist das Audit Pflicht: niedrig|mittel|hoch|kritisch'),
  ('freigabepflicht_ab', 'hoch', 'Ab dieser Risikostufe braucht es eine Freigabe durch den Betreiber')
on conflict (schluessel) do nothing;

-- ---------------------------------------------------------------------
-- Modellpreise (USD je 1 Mio. Token) — eine Stelle zum Pflegen
-- ---------------------------------------------------------------------
create table if not exists agency.preise (
  modell text primary key,
  usd_ein_pro_mtok numeric(10,4) not null,
  usd_aus_pro_mtok numeric(10,4) not null,
  stand date not null default current_date
);

-- Stand 09/2026. Cache-Lese-Token werden hier zum vollen Eingangspreis
-- gebucht — bewusst zu hoch statt zu niedrig: ein Budgetdeckel, der die
-- Kosten unterschätzt, ist kein Deckel.
insert into agency.preise (modell, usd_ein_pro_mtok, usd_aus_pro_mtok) values
  ('claude-opus-5',    5.00, 25.00),
  ('claude-sonnet-5',  2.00, 10.00),
  ('claude-haiku-4-5', 1.00,  5.00)
on conflict (modell) do update
  set usd_ein_pro_mtok = excluded.usd_ein_pro_mtok,
      usd_aus_pro_mtok = excluded.usd_aus_pro_mtok,
      stand = current_date;

-- ---------------------------------------------------------------------
-- Rollen (Systemprompts; gepflegt im Repo unter agency/rollen/,
-- eingespielt mit agency/scripts/rollen-laden.mjs)
-- ---------------------------------------------------------------------
create table if not exists agency.rollen (
  schluessel text primary key,
  name text not null,
  modell text not null default 'claude-opus-5' references agency.preise(modell),
  effort text not null default 'high' check (effort in ('low','medium','high','xhigh','max')),
  max_tokens int not null default 16000 check (max_tokens between 1024 and 64000),
  prompt text not null,
  aktualisiert timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Vorgänge
-- ---------------------------------------------------------------------
create table if not exists agency.vorgaenge (
  id uuid primary key default gen_random_uuid(),
  nr bigint generated always as identity,
  titel text not null,
  ziel text not null,
  kontext text,
  rolle text not null references agency.rollen(schluessel),
  risiko text not null check (risiko in ('niedrig','mittel','hoch','kritisch')),
  status text not null default 'neu'
    check (status in ('neu','laeuft','wartet_auf_freigabe','fertig','verworfen','gestoppt')),
  ergebnis text,
  notiz text,
  freigabe_token text not null default encode(gen_random_bytes(24), 'hex'),
  freigabe_am timestamptz,
  freigabe_entscheidung text check (freigabe_entscheidung in ('ja','nein')),
  quelle text,
  erstellt timestamptz not null default now(),
  beendet timestamptz
);

create index if not exists vorgaenge_status_idx on agency.vorgaenge (status, erstellt desc);

-- ---------------------------------------------------------------------
-- Läufe — jeder Modellaufruf mit seinen Kosten
-- ---------------------------------------------------------------------
create table if not exists agency.laeufe (
  id uuid primary key default gen_random_uuid(),
  vorgang uuid references agency.vorgaenge(id) on delete cascade,
  rolle text not null,
  modell text not null,
  tokens_ein int not null default 0,
  tokens_aus int not null default 0,
  tokens_cache int not null default 0,
  kosten_usd numeric(12,6) not null default 0,
  erstellt timestamptz not null default now()
);

create index if not exists laeufe_monat_idx on agency.laeufe (erstellt);

-- ---------------------------------------------------------------------
-- Audits (A29) — Urteil ohne Weisungsrecht
-- ---------------------------------------------------------------------
create table if not exists agency.audits (
  id uuid primary key default gen_random_uuid(),
  vorgang uuid references agency.vorgaenge(id) on delete cascade,
  urteil text not null check (urteil in ('PASS','REVISE','FAIL')),
  befund text,
  fehlende_evidenz text,
  billigstes_experiment text,
  erstellt timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gedächtnis — Entscheidungen, Lektionen, Annahmen mit Vertrauensgrad
-- ---------------------------------------------------------------------
create table if not exists agency.gedaechtnis (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('entscheidung','lektion','annahme','risiko','beleg','kennzahl')),
  titel text not null,
  inhalt text not null,
  vertrauen text check (vertrauen in ('hoch','mittel','niedrig')),
  quelle text,
  vorgang uuid references agency.vorgaenge(id) on delete set null,
  -- Alterndes Wissen (Preise, Marktzahlen, Rechtsstand) bekommt ein
  -- Ablaufdatum, statt still falsch zu werden.
  gilt_bis date,
  erstellt timestamptz not null default now()
);

create index if not exists gedaechtnis_typ_idx on agency.gedaechtnis (typ, erstellt desc);

-- ---------------------------------------------------------------------
-- Wochenberichte
-- ---------------------------------------------------------------------
create table if not exists agency.berichte (
  id uuid primary key default gen_random_uuid(),
  woche date not null,
  kennzahlen jsonb not null,
  text text,
  erstellt timestamptz not null default now()
);

-- =====================================================================
-- Hilfsfunktionen (intern)
-- =====================================================================

create or replace function agency.monatsdeckel_usd()
returns numeric language sql stable as $$
  select coalesce((select wert::numeric from agency.einstellungen
                   where schluessel = 'monatsdeckel_usd'), 0);
$$;

create or replace function agency.ausgaben_monat_usd()
returns numeric language sql stable as $$
  select coalesce(sum(kosten_usd), 0)
  from agency.laeufe
  where erstellt >= date_trunc('month', now());
$$;

-- Risikostufen als Zahl, damit „ab hoch" vergleichbar ist
create or replace function agency.stufe(p text)
returns int language sql immutable as $$
  select case p when 'niedrig' then 1 when 'mittel' then 2
                when 'hoch' then 3 when 'kritisch' then 4 else 0 end;
$$;

create or replace function agency.schwelle(p_schluessel text)
returns int language sql stable as $$
  select agency.stufe(coalesce((select wert from agency.einstellungen
                                where schluessel = p_schluessel), 'hoch'));
$$;

-- =====================================================================
-- Öffentliche RPC-Schnittstelle (nur service_role)
-- =====================================================================

-- Vorgang anlegen. Prüft in einem Zug: Budget, Rolle, Pflichten.
-- Gibt alles zurück, was der Workflow für den Modellaufruf braucht —
-- ein Aufruf statt vier.
create or replace function public.agency_vorgang_neu(
  p_titel text,
  p_ziel text,
  p_rolle text,
  p_risiko text default 'niedrig',
  p_kontext text default null,
  p_quelle text default 'n8n'
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
declare
  v_rolle agency.rollen%rowtype;
  v_deckel numeric;
  v_aus numeric;
  v_id uuid;
  v_nr bigint;
  v_token text;
begin
  select * into v_rolle from agency.rollen where schluessel = p_rolle;
  if not found then
    return jsonb_build_object('ok', false, 'fehler',
      format('Unbekannte Rolle "%s". Bekannt: %s', p_rolle,
             (select string_agg(schluessel, ', ' order by schluessel) from agency.rollen)));
  end if;

  if agency.stufe(p_risiko) = 0 then
    return jsonb_build_object('ok', false, 'fehler',
      'Risiko muss niedrig|mittel|hoch|kritisch sein');
  end if;

  v_deckel := agency.monatsdeckel_usd();
  v_aus := agency.ausgaben_monat_usd();

  -- Budget zuerst. Ein überschrittener Deckel stoppt, er warnt nicht.
  if v_aus >= v_deckel then
    return jsonb_build_object(
      'ok', false,
      'budget_ok', false,
      'fehler', format('Monatsdeckel erreicht: %s von %s USD verbraucht.', round(v_aus,2), round(v_deckel,2)),
      'ausgaben_usd', round(v_aus,2),
      'deckel_usd', round(v_deckel,2));
  end if;

  insert into agency.vorgaenge (titel, ziel, kontext, rolle, risiko, status, quelle)
  values (p_titel, p_ziel, p_kontext, p_rolle, p_risiko, 'laeuft', p_quelle)
  returning id, nr, freigabe_token into v_id, v_nr, v_token;

  return jsonb_build_object(
    'ok', true,
    'budget_ok', true,
    'vorgang_id', v_id,
    'nr', v_nr,
    'freigabe_token', v_token,
    'risiko', p_risiko,
    'audit_pflicht', agency.stufe(p_risiko) >= agency.schwelle('auditpflicht_ab'),
    'freigabe_pflicht', agency.stufe(p_risiko) >= agency.schwelle('freigabepflicht_ab'),
    'budget_rest_usd', round(v_deckel - v_aus, 2),
    'rolle', jsonb_build_object(
      'schluessel', v_rolle.schluessel,
      'name', v_rolle.name,
      'modell', v_rolle.modell,
      'effort', v_rolle.effort,
      'max_tokens', v_rolle.max_tokens,
      'prompt', v_rolle.prompt));
end;
$$;

-- Lauf buchen: Kosten aus den Token berechnen, Ergebnis sichern,
-- Budgetstand zurückgeben.
create or replace function public.agency_lauf_buchen(
  p_vorgang uuid,
  p_rolle text,
  p_modell text,
  p_tokens_ein int,
  p_tokens_aus int,
  p_tokens_cache int default 0,
  p_ergebnis text default null
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
declare
  v_preis agency.preise%rowtype;
  v_kosten numeric;
  v_aus numeric;
  v_deckel numeric;
begin
  select * into v_preis from agency.preise where modell = p_modell;
  if not found then
    -- Unbekanntes Modell nicht stillschweigend mit 0 buchen.
    return jsonb_build_object('ok', false, 'fehler',
      format('Kein Preis für Modell "%s" hinterlegt — in agency.preise eintragen.', p_modell));
  end if;

  v_kosten :=
      (coalesce(p_tokens_ein,0) + coalesce(p_tokens_cache,0)) / 1000000.0 * v_preis.usd_ein_pro_mtok
    +  coalesce(p_tokens_aus,0) / 1000000.0 * v_preis.usd_aus_pro_mtok;

  insert into agency.laeufe (vorgang, rolle, modell, tokens_ein, tokens_aus, tokens_cache, kosten_usd)
  values (p_vorgang, p_rolle, p_modell, coalesce(p_tokens_ein,0), coalesce(p_tokens_aus,0),
          coalesce(p_tokens_cache,0), v_kosten);

  if p_ergebnis is not null then
    update agency.vorgaenge set ergebnis = p_ergebnis where id = p_vorgang;
  end if;

  v_aus := agency.ausgaben_monat_usd();
  v_deckel := agency.monatsdeckel_usd();

  return jsonb_build_object(
    'ok', true,
    'kosten_usd', round(v_kosten, 4),
    'ausgaben_monat_usd', round(v_aus, 2),
    'deckel_usd', round(v_deckel, 2),
    'budget_rest_usd', round(v_deckel - v_aus, 2),
    'budget_ok', v_aus < v_deckel);
end;
$$;

create or replace function public.agency_audit_buchen(
  p_vorgang uuid,
  p_urteil text,
  p_befund text default null,
  p_fehlende_evidenz text default null,
  p_billigstes_experiment text default null
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
begin
  if p_urteil not in ('PASS','REVISE','FAIL') then
    return jsonb_build_object('ok', false, 'fehler', 'Urteil muss PASS, REVISE oder FAIL sein');
  end if;

  insert into agency.audits (vorgang, urteil, befund, fehlende_evidenz, billigstes_experiment)
  values (p_vorgang, p_urteil, p_befund, p_fehlende_evidenz, p_billigstes_experiment);

  -- Ein FAIL beendet den Vorgang. Der CEO darf das Urteil nicht umdeuten —
  -- deshalb steht die Folge hier in der Datenbank, nicht im Workflow.
  if p_urteil = 'FAIL' then
    update agency.vorgaenge
      set status = 'gestoppt', beendet = now(),
          notiz = coalesce(notiz || E'\n', '') || 'Audit FAIL: ' || coalesce(p_befund, '')
      where id = p_vorgang;
  end if;

  return jsonb_build_object('ok', true, 'urteil', p_urteil);
end;
$$;

create or replace function public.agency_status_setzen(
  p_vorgang uuid,
  p_status text,
  p_notiz text default null
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
begin
  update agency.vorgaenge
    set status = p_status,
        notiz = case when p_notiz is null then notiz
                     else coalesce(notiz || E'\n', '') || p_notiz end,
        beendet = case when p_status in ('fertig','verworfen','gestoppt') then now() else beendet end
    where id = p_vorgang;
  if not found then
    return jsonb_build_object('ok', false, 'fehler', 'Vorgang nicht gefunden');
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- Freigabe. Der Token kommt aus dem Link in der E-Mail an den Betreiber;
-- ohne gültigen Token keine Freigabe — sonst genügt das Erraten einer UUID.
create or replace function public.agency_freigabe(
  p_vorgang uuid,
  p_token text,
  p_entscheidung text
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
declare v_v agency.vorgaenge%rowtype;
begin
  select * into v_v from agency.vorgaenge where id = p_vorgang;
  if not found then
    return jsonb_build_object('ok', false, 'fehler', 'Vorgang nicht gefunden');
  end if;
  if v_v.freigabe_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'fehler', 'Token ungültig');
  end if;
  if v_v.freigabe_am is not null then
    return jsonb_build_object('ok', false, 'fehler', 'Bereits entschieden',
                              'entscheidung', v_v.freigabe_entscheidung);
  end if;
  if p_entscheidung not in ('ja','nein') then
    return jsonb_build_object('ok', false, 'fehler', 'Entscheidung muss ja oder nein sein');
  end if;

  update agency.vorgaenge
    set freigabe_am = now(),
        freigabe_entscheidung = p_entscheidung,
        status = case when p_entscheidung = 'ja' then 'fertig' else 'verworfen' end,
        beendet = now()
    where id = p_vorgang;

  return jsonb_build_object('ok', true, 'entscheidung', p_entscheidung,
                            'titel', v_v.titel, 'nr', v_v.nr, 'ergebnis', v_v.ergebnis);
end;
$$;

create or replace function public.agency_rolle(p_schluessel text)
returns jsonb
language sql security definer set search_path = agency, public as $$
  select jsonb_build_object(
    'ok', true, 'schluessel', schluessel, 'name', name, 'modell', modell,
    'effort', effort, 'max_tokens', max_tokens, 'prompt', prompt)
  from agency.rollen where schluessel = p_schluessel;
$$;

-- Rolle einspielen (vom Loader-Skript benutzt)
create or replace function public.agency_rolle_setzen(
  p_schluessel text, p_name text, p_prompt text,
  p_modell text default 'claude-opus-5',
  p_effort text default 'high',
  p_max_tokens int default 16000
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
begin
  insert into agency.rollen (schluessel, name, modell, effort, max_tokens, prompt)
  values (p_schluessel, p_name, p_modell, p_effort, p_max_tokens, p_prompt)
  on conflict (schluessel) do update
    set name = excluded.name, modell = excluded.modell, effort = excluded.effort,
        max_tokens = excluded.max_tokens, prompt = excluded.prompt, aktualisiert = now();
  return jsonb_build_object('ok', true, 'schluessel', p_schluessel);
end;
$$;

create or replace function public.agency_budget()
returns jsonb
language sql security definer set search_path = agency, public as $$
  select jsonb_build_object(
    'ok', true,
    'deckel_usd', round(agency.monatsdeckel_usd(), 2),
    'ausgaben_monat_usd', round(agency.ausgaben_monat_usd(), 2),
    'rest_usd', round(agency.monatsdeckel_usd() - agency.ausgaben_monat_usd(), 2),
    'budget_ok', agency.ausgaben_monat_usd() < agency.monatsdeckel_usd(),
    'laeufe_monat', (select count(*) from agency.laeufe where erstellt >= date_trunc('month', now())));
$$;

create or replace function public.agency_merken(
  p_typ text, p_titel text, p_inhalt text,
  p_vertrauen text default null, p_quelle text default null,
  p_vorgang uuid default null, p_gilt_bis date default null
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
declare v_id uuid;
begin
  insert into agency.gedaechtnis (typ, titel, inhalt, vertrauen, quelle, vorgang, gilt_bis)
  values (p_typ, p_titel, p_inhalt, p_vertrauen, p_quelle, p_vorgang, p_gilt_bis)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Kontext für einen neuen Vorgang: offene Punkte, letzte Entscheidungen,
-- abgelaufenes Wissen. Ersetzt das „Memory System" aus dem Entwurf durch
-- einen Aufruf.
create or replace function public.agency_kontext()
returns jsonb
language sql security definer set search_path = agency, public as $$
  select jsonb_build_object(
    'ok', true,
    'budget', public.agency_budget(),
    'offene_vorgaenge', coalesce((
      select jsonb_agg(jsonb_build_object('nr', nr, 'titel', titel, 'status', status,
                                          'risiko', risiko, 'erstellt', erstellt)
             order by erstellt desc)
      from agency.vorgaenge where status in ('laeuft','wartet_auf_freigabe')), '[]'::jsonb),
    'letzte_entscheidungen', coalesce((
      select jsonb_agg(jsonb_build_object('titel', titel, 'inhalt', inhalt, 'erstellt', erstellt)
             order by erstellt desc)
      from (select * from agency.gedaechtnis where typ = 'entscheidung'
            order by erstellt desc limit 10) e), '[]'::jsonb),
    'abgelaufenes_wissen', coalesce((
      select jsonb_agg(jsonb_build_object('typ', typ, 'titel', titel, 'gilt_bis', gilt_bis))
      from agency.gedaechtnis where gilt_bis is not null and gilt_bis < current_date), '[]'::jsonb));
$$;

create or replace function public.agency_bericht_speichern(
  p_kennzahlen jsonb, p_text text default null
) returns jsonb
language plpgsql security definer set search_path = agency, public as $$
declare v_id uuid;
begin
  insert into agency.berichte (woche, kennzahlen, text)
  values (date_trunc('week', now())::date, p_kennzahlen, p_text)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- =====================================================================
-- Rechte: alles zu, dann gezielt öffnen
-- =====================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'agency\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

revoke all on all tables in schema agency from anon, authenticated;
