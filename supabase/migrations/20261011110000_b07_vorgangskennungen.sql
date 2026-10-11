-- B07 – Mehrstufige Buchungen: je Geschäftsvorgang höchstens EINE Buchung (11.10.2026).
--
-- BEFUND: Mietbuchungen, wiederkehrende Buchungen, die Übernahme eines Service-Auftrags als
-- Kosten, Angebotsanfragen und die Zählerübernahme prüften „schon gebucht?“ per LESEN und schrieben
-- danach. Zwei gleichzeitige Aufrufe (Doppelklick, Wiederholung nach Zeitüberlauf, zwei Tabs) sahen
-- beide „noch nicht gebucht“ und legten den Vorgang zweimal an — direkt in Cashflow und Anlage V.
--
-- JETZT: Die Datenbank hält die fachliche Einheit fest; die Actions fügen über `upsert …
-- ignoreDuplicates` bzw. mit Abfangen von 23505 ein. Teilzahlungen bleiben erlaubt — sie haben
-- verschiedene Zahlungskennungen.
--   · einnahmen.zahlung_ref  — eindeutig je Konto („a:<mieter>|<monat>“ = Ausgleich eines offenen Monats,
--                              „m:<vorgang>“ = Teilzahlung, „ka:<hash>[#YYYY-MM]“ = Kontoauszug,
--                              „n:<mieter>|<monat>“ = Nacherfassung unter Soll)
--   · (wiederkehr_id, buchungsdatum) — je Vorlage und Termin eine Buchung (einnahmen und kosten)
--   · kosten.auftrag_id      — je Service-Auftrag eine Kostenbuchung (Bestand aus auftraege.kosten_id übernommen)
--   · verbrauch.meldung_id   — je Zählermeldung ein Verbrauch
--   · angebotsanfragen: je Vorgang und Firma höchstens EINE laufende Anfrage
--   · angebot_public_abgeben: die Anfrage wird beim Zählen gesperrt (`for update`) — die Grenze von
--     3 Angeboten hält auch bei gleichzeitigen Aufrufen
--
-- Live vor dem Schreiben geprüft (11.10.2026, nur lesend): keine bestehenden Dubletten bei
-- (wiederkehr_id, buchungsdatum) in einnahmen/kosten, keine doppelte auftraege.kosten_id, keine
-- doppelte laufende Anfrage je (anliegen, firma). NULL-Werte sind in UNIQUE-Regeln verschieden —
-- Buchungen ohne Kennung bleiben unberührt. Kein Löschbefehl, keine Fremdschlüssel.

alter table public.einnahmen add column if not exists zahlung_ref text;
alter table public.kosten add column if not exists auftrag_id uuid;
alter table public.verbrauch add column if not exists meldung_id uuid;

comment on column public.einnahmen.zahlung_ref is
  'Kennung des Zahlungsvorgangs (B07): a:<mieter>|<monat> | m:<vorgang> | ka:<hash>[#YYYY-MM] | n:<mieter>|<monat>. Eindeutig je Konto.';
comment on column public.kosten.auftrag_id is 'Service-Auftrag, aus dem diese Kosten übernommen wurden (B07, eindeutig).';
comment on column public.verbrauch.meldung_id is 'Zählermeldung, aus der dieser Verbrauch stammt (B07, eindeutig).';

update public.kosten k
   set auftrag_id = a.id
  from public.auftraege a
 where a.kosten_id = k.id and k.auftrag_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'einnahmen_zahlung_ref_eindeutig') then
    alter table public.einnahmen add constraint einnahmen_zahlung_ref_eindeutig unique (user_id, zahlung_ref);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'einnahmen_wiederkehr_termin_eindeutig') then
    alter table public.einnahmen add constraint einnahmen_wiederkehr_termin_eindeutig unique (wiederkehr_id, buchungsdatum);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kosten_wiederkehr_termin_eindeutig') then
    alter table public.kosten add constraint kosten_wiederkehr_termin_eindeutig unique (wiederkehr_id, buchungsdatum);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kosten_auftrag_eindeutig') then
    alter table public.kosten add constraint kosten_auftrag_eindeutig unique (auftrag_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verbrauch_meldung_eindeutig') then
    alter table public.verbrauch add constraint verbrauch_meldung_eindeutig unique (meldung_id);
  end if;
end $$;

create unique index if not exists angebotsanfragen_laufend_eindeutig
  on public.angebotsanfragen (anliegen_id, firma_id) where status = 'angefragt';

create or replace function public.angebot_public_abgeben(p_token uuid, p_firma text, p_kontakt text, p_betrag numeric, p_termin date, p_nachricht text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare q record; cnt int;
begin
  -- `for update`: Zwei gleichzeitige Abgaben zählen nacheinander — die Grenze hält (B07).
  select a.id into q
    from public.angebotsanfragen a
   where a.public_token = p_token and a.status = 'angefragt' and a.token_ablauf > now()
   for update;
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
$function$;
