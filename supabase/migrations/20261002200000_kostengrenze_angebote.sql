-- Kostengrenze und „Angebote einholen“ (02.10.2026, Schritt 7 aus
-- docs/zukunft/MIETERPORTAL-AUSBAU.md § 9 und docs/zukunft/HANDWERKER-ANFRAGEN.md Stufe 1).
--
-- (A) KOSTENGRENZE: Der Vermieter legt einen Betrag fest. Beantragt sein Hausmeister einen
-- Auftrag mit geschätzten Kosten bis zu diesem Betrag, ist er sofort freigegeben (status
-- 'offen', auto_freigegeben = true); darüber bleibt es bei der Freigabe durch den Vermieter.
-- Die Regel prüft das in der DATENBANK (Einfüge-Regel des Hausmeisters), nicht nur in der App.
-- Bekannte Grenze: Die Schätzung kommt vom Hausmeister. Die App zeigt sie dem Vermieter an.
--
-- (B) ANGEBOTE: Eigene Tabellen statt neuer Status in `auftraege` — dessen Status-Prüfung zu
-- erweitern hieße, sie zu entfernen und neu anzulegen (Bestätigungsdialog). Eine Anfrage je
-- Firma mit eigenem Link; die Firma antwortet ohne Login mit Betrag, Termin, Text. Wählt der
-- Vermieter ein Angebot, entsteht ein normaler Auftrag (der Verlauf schreibt „Ein Handwerker
-- wurde beauftragt“ wie bisher mit). Name und Kontakt des Mieters gehen bei der Anfrage NICHT
-- mit — die Anfrage-Seite kennt keinen Mieter.

-- (A) -----------------------------------------------------------------------------------
alter table public.vermieter_profil
  add column if not exists kostengrenze numeric check (kostengrenze >= 0 and kostengrenze <= 100000);
alter table public.auftraege
  add column if not exists kosten_schaetzung numeric check (kosten_schaetzung >= 0 and kosten_schaetzung <= 10000000),
  add column if not exists auto_freigegeben boolean not null default false;

-- Die Grenze eines Vermieters — nur für ihn selbst und für seine verknüpften Service-Partner.
create or replace function public.auftrag_kostengrenze(p_vermieter uuid)
 returns numeric
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select p.kostengrenze
    from public.vermieter_profil p
   where p.user_id = p_vermieter
     and (p_vermieter = auth.uid()
          or exists (select 1 from public.service_zugaenge z
                      where z.vermieter_id = p_vermieter and z.user_id = auth.uid()))
$$;
revoke execute on function public.auftrag_kostengrenze(uuid) from public, anon;
grant execute on function public.auftrag_kostengrenze(uuid) to authenticated;

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

-- (B) -----------------------------------------------------------------------------------
create table if not exists public.angebotsanfragen (
  id uuid primary key default gen_random_uuid(),
  vermieter_id uuid not null default auth.uid(),
  anliegen_id uuid not null,
  firma_id uuid not null,
  titel text not null check (char_length(titel) between 1 and 200),
  beschreibung text check (char_length(beschreibung) <= 4000),
  objekt text check (char_length(objekt) <= 300),
  absender text check (char_length(absender) <= 200),
  status text not null default 'angefragt' check (status in ('angefragt', 'beauftragt', 'abgelehnt', 'zurueckgezogen')),
  public_token uuid not null default gen_random_uuid() unique,
  token_ablauf timestamptz not null default now() + interval '30 days',
  auftrag_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists angebotsanfragen_anliegen on public.angebotsanfragen (anliegen_id);

create table if not exists public.angebote (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid not null,
  firma text not null check (char_length(firma) between 1 and 200),
  kontakt text check (char_length(kontakt) <= 300),
  betrag numeric not null check (betrag >= 0 and betrag <= 10000000),
  termin date,
  nachricht text check (char_length(nachricht) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists angebote_anfrage on public.angebote (anfrage_id);

alter table public.angebotsanfragen enable row level security;
alter table public.angebote enable row level security;

create policy anfrage_select_vermieter on public.angebotsanfragen
  for select to authenticated using ((select auth.uid()) = vermieter_id);
create policy anfrage_insert_vermieter on public.angebotsanfragen
  for insert to authenticated
  with check (
    (select auth.uid()) = vermieter_id
    and status = 'angefragt' and auftrag_id is null
    and exists (select 1 from public.firmen f where f.id = angebotsanfragen.firma_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.anliegen a where a.id = angebotsanfragen.anliegen_id and a.vermieter_id = (select auth.uid())));
create policy anfrage_update_vermieter on public.angebotsanfragen
  for update to authenticated
  using ((select auth.uid()) = vermieter_id)
  with check ((select auth.uid()) = vermieter_id);

create policy angebot_select_vermieter on public.angebote
  for select to authenticated
  using (exists (select 1 from public.angebotsanfragen q
                  where q.id = angebote.anfrage_id and q.vermieter_id = (select auth.uid())));

create policy demo_kein_insert on public.angebotsanfragen as restrictive for insert to authenticated, anon with check (not public.ist_demo_nutzer());
create policy demo_kein_update on public.angebotsanfragen as restrictive for update to authenticated, anon using (not public.ist_demo_nutzer()) with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.angebotsanfragen for each statement execute function public.demo_schreibsperre();
create trigger demo_schreibsperre before insert or update on public.angebote for each statement execute function public.demo_schreibsperre();

-- Öffentliche Anfrage-Seite (ohne Login): nur mit gültigem Link, nur solange angefragt.
create or replace function public.angebot_public_info(p_token uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $$
declare q record;
begin
  select a.titel, a.beschreibung, a.objekt, a.absender, a.token_ablauf
    into q
    from public.angebotsanfragen a
   where a.public_token = p_token and a.status = 'angefragt' and a.token_ablauf > now();
  if not found then return null; end if;
  return jsonb_build_object('titel', q.titel, 'beschreibung', q.beschreibung, 'objekt', q.objekt,
                            'absender', q.absender, 'gueltig_bis', q.token_ablauf,
                            'schon_abgegeben', exists (select 1 from public.angebote g
                                                         join public.angebotsanfragen a2 on a2.id = g.anfrage_id
                                                        where a2.public_token = p_token));
end
$$;

create or replace function public.angebot_public_abgeben(
  p_token uuid, p_firma text, p_kontakt text, p_betrag numeric, p_termin date, p_nachricht text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare q record; cnt int;
begin
  select a.id into q
    from public.angebotsanfragen a
   where a.public_token = p_token and a.status = 'angefragt' and a.token_ablauf > now();
  if not found then return jsonb_build_object('error', 'Dieser Link ist nicht mehr gültig.'); end if;
  if coalesce(btrim(p_firma), '') = '' then return jsonb_build_object('error', 'Bitte den Betrieb angeben.'); end if;
  if p_betrag is null or p_betrag < 0 or p_betrag > 10000000 then
    return jsonb_build_object('error', 'Bitte einen gültigen Betrag angeben.');
  end if;
  -- Mengenbremse je Anfrage: höchstens 3 Angebote (Korrekturen), nie mehr.
  select count(*) into cnt from public.angebote where anfrage_id = q.id;
  if cnt >= 3 then return jsonb_build_object('error', 'Für diese Anfrage liegen schon Angebote vor.'); end if;
  insert into public.angebote (anfrage_id, firma, kontakt, betrag, termin, nachricht)
  values (q.id, left(btrim(p_firma), 200), left(p_kontakt, 300), round(p_betrag, 2), p_termin, left(p_nachricht, 4000));
  return jsonb_build_object('ok', true);
end
$$;
revoke execute on function public.angebot_public_info(uuid) from public;
revoke execute on function public.angebot_public_abgeben(uuid, text, text, numeric, date, text) from public;
grant execute on function public.angebot_public_info(uuid) to anon, authenticated;
grant execute on function public.angebot_public_abgeben(uuid, text, text, numeric, date, text) to anon, authenticated;
