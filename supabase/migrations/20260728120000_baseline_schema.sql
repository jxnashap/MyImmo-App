-- =============================================================================
-- MyImmo — Baseline des Kernschemas (Stand 28.07.2026)
-- =============================================================================
--
-- WARUM DIESE DATEI EXISTIERT
--
-- Bis hierher lagen nur fünf Migrationen im Repo (selbstauskunft, geo_coords,
-- makler_dokumente, abos ×2). Das eigentliche Fundament — properties, mieter,
-- einnahmen, kosten, sämtliche RLS-Policies und die SECURITY-DEFINER-Funktionen
-- hinter den öffentlichen Seiten — existierte ausschließlich in der Live-
-- Datenbank. Damit war die komplette Autorisierung der App weder reviewbar noch
-- reproduzierbar noch rollbackfähig: Eine im Dashboard versehentlich gelockerte
-- Policy hätte niemand bemerkt, und aus dem Repo allein ließ sich die Datenbank
-- nicht neu aufbauen. Alle Server-Actions verlassen sich auf RLS (z. B.
-- `lib/actions/buchungen.ts` updated per `.eq("id", id)` ohne user_id) — die
-- Policies SIND die Zugriffskontrolle.
--
-- WAS DIESE DATEI IST
--
-- Ein SNAPSHOT des Live-Schemas, kein nachgespieltes Änderungsprotokoll. Sie
-- bildet den Stand ab, wie er am 28.07.2026 in `kozhxrvyilkchjpcuwcm` lief —
-- inklusive der Objekte aus den fünf älteren Migrationsdateien. Ab hier gilt
-- wieder die normale Regel aus `supabase/migrations/README.md`: jede weitere
-- Schemaänderung als eigene, datierte Datei.
--
-- Die Datei ist durchgängig idempotent (`if not exists`, `drop policy if
-- exists` vor jedem `create policy`, `create or replace function`). Auf der
-- bestehenden Datenbank angewendet ist sie ein No-op; auf einer leeren
-- Datenbank baut sie das Schema auf.
--
-- NICHT ENTHALTEN: Daten, Auth-/Storage-Schema (verwaltet Supabase), Extensions
-- und Rollen-Grants (Supabase-Standard).
-- =============================================================================


-- =============================================================================
-- 1. Tabellen
-- =============================================================================

create table if not exists public.properties (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  bezeichnung text not null,
  typ text,
  adresse text,
  kaufpreis numeric,
  wert numeric,
  flaeche numeric,
  baujahr integer,
  miete numeric,
  hausgeld numeric,
  obj_status text default 'Leer'::text,
  zimmer numeric,
  energieklasse text,
  notiz_import text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  energieausweis_datum date,
  afa_methode text default 'auto'::text,
  afa_start_jahr integer,
  afa_betrag numeric,
  afa_gebaeudeanteil numeric,
  einheiten_anzahl integer,
  grundstuecksflaeche numeric,
  latitude double precision,
  longitude double precision,
  bodenrichtwert numeric,
  bodenrichtwert_stichtag date,
  liegenschaftszins numeric,
  restnutzungsdauer integer,
  vergleichspreis_m2 numeric,
  vergleichsmiete_m2 numeric,
  marktwert_aktuell numeric,
  marktwert_stand timestamp with time zone,
  bewertungsverfahren text,
  bewertung_quelleninfo jsonb,
  kaufdatum date,
  lat double precision,
  lng double precision
);

create table if not exists public.mieter (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  vorname text,
  nachname text,
  email text,
  telefon text,
  mieter_adresse text,
  mietbeginn date,
  mietende date,
  kuendigung integer default 3,
  kaltmiete numeric,
  nk_vorauszahlung numeric,
  kaution numeric,
  kaution_status text default 'nein'::text,
  kaution_bank text,
  mietspiegel numeric,
  flaeche numeric,
  notiz text,
  created_at timestamp with time zone default now(),
  miethistorie text,
  einheit text,
  letzte_erhoehung date,
  mietart text,
  staffel_datum date,
  staffel_betrag numeric,
  staffel_intervall text,
  iban text,
  stellplatz text,
  stellplatz_miete numeric,
  staffel_typ text default 'betrag'::text,
  staffel_prozent numeric,
  staffel_stufen integer
);

create table if not exists public.miet_zeitraeume (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mieter_id uuid not null,
  prop_id uuid,
  von date not null,
  bis date,
  kaltmiete numeric,
  nk_vorauszahlung numeric,
  stellplatz_miete numeric,
  created_at timestamp with time zone default now()
);

create table if not exists public.einnahmen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  buchungsdatum date,
  kategorie text,
  betrag numeric,
  beschreibung text,
  wiederkehrend boolean default false,
  created_at timestamp with time zone default now(),
  mieter_id uuid,
  nk_anteil numeric,
  wiederkehr_id uuid,
  soll_monat text
);

create table if not exists public.kosten (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  buchungsdatum date,
  kategorie text,
  betrag numeric,
  beschreibung text,
  notiz text,
  wiederkehrend boolean default false,
  rechnung_name text,
  rechnung_type text,
  rechnung_size text,
  rechnung_data text,
  created_at timestamp with time zone default now(),
  mieter_id uuid,
  rechnung_path text,
  wiederkehr_id uuid,
  mieter_freigabe boolean not null default false
);

create table if not exists public.kredite (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  bezeichnung text,
  bank text,
  darlnr text,
  betrag numeric,
  restschuld numeric,
  grundschuld numeric,
  beleihung numeric,
  zinssatz numeric,
  tilgungssatz numeric,
  monatsrate numeric,
  sonder text,
  zinsbindung date,
  laufzeit integer,
  created_at timestamp with time zone default now(),
  auszahlung_datum date
);

create table if not exists public.mieter_positionen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mieter_id uuid not null,
  bezeichnung text not null,
  betrag numeric(12,2),
  umlageschluessel text,
  jahr integer,
  umlagefaehig boolean default true,
  created_at timestamp with time zone not null default now(),
  quelle text,
  aufteilung text not null default 'voll'::text,
  verbrauch_mieter numeric,
  verbrauch_gesamt numeric,
  gesamt_betrag numeric,
  basis_text text,
  anteil_text text,
  lohnanteil numeric,
  art_35a text,
  grundkosten_prozent numeric,
  flaeche_gesamt numeric
);

create table if not exists public.nk_co2 (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mieter_id uuid not null,
  jahr integer not null,
  co2_kg numeric,
  co2_kosten numeric,
  flaeche numeric,
  gewerbe boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.verbrauch (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  buchungsdatum date,
  art text,
  menge numeric,
  einheit text,
  verbrauchkosten numeric,
  created_at timestamp with time zone default now()
);

create table if not exists public.termine (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  titel text not null,
  datum date not null,
  notiz text,
  created_at timestamp with time zone default now(),
  kategorie text,
  erledigt boolean not null default false,
  wiederkehrung text,
  mieter_id uuid,
  vorlauf_tage integer
);

create table if not exists public.notizen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  titel text,
  kategorie text,
  inhalt text,
  created_at timestamp with time zone default now(),
  datei_name text,
  datei_type text,
  datei_size integer,
  datei_data text,
  mieter_id uuid,
  mieter_freigabe boolean not null default false
);

create table if not exists public.wiederkehrende_buchungen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  art text not null,
  prop_id uuid,
  mieter_id uuid,
  kategorie text not null,
  betrag numeric not null,
  beschreibung text,
  zyklus text not null,
  start_datum date not null,
  ende_datum date,
  aktiv boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.ibans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  kontoname text not null,
  inhaber text,
  iban text not null,
  created_at timestamp with time zone default now(),
  standard boolean not null default false,
  iban_bidx text
);

create table if not exists public.vermieter_profil (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text,
  strasse text,
  plz text,
  ort text,
  email text,
  telefon text,
  bankname text,
  iban text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.unterschriften (
  user_id uuid not null,
  data text not null,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.dokument_vorlagen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  art text not null,
  text text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.kalkulationen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  data jsonb not null,
  summary jsonb not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.selbstauskunft (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  daten_enc text,
  updated_at timestamp with time zone not null default now()
);

-- ---- Bewertung / Marktdaten ----

create table if not exists public.bewertung_historie (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  immobilie_id uuid not null,
  datum timestamp with time zone not null default now(),
  verfahren text,
  marktwert numeric,
  mietwert numeric,
  eingangsdaten jsonb,
  quelle text
);

create table if not exists public.vergleichsangebote (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  immobilie_id uuid not null,
  quelle text,
  externe_id text,
  art text,
  flaeche numeric,
  zimmer numeric,
  preis numeric,
  preis_pro_qm numeric,
  distanz_km numeric,
  angebots_datum date,
  abgerufen_am timestamp with time zone not null default now()
);

create table if not exists public.regional_kennzahlen (
  id uuid not null default gen_random_uuid(),
  region_key text not null,
  art text not null,
  kennzahl text not null,
  wert numeric,
  einheit text,
  stichtag date,
  quelle text,
  version_hash text,
  abgerufen_am timestamp with time zone not null default now()
);

-- ---- Rollen, Zugänge, Freischaltung ----

create table if not exists public.nutzer_rollen (
  user_id uuid not null,
  rolle text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.konto_freischaltung (
  user_id uuid not null,
  freigeschaltet_am timestamp with time zone not null default now(),
  consent_agb boolean not null default false,
  consent_datenschutz boolean not null default false,
  quelle text
);

create table if not exists public.einladungscodes (
  id uuid not null default gen_random_uuid(),
  vermieter_id uuid not null,
  code text not null,
  rolle text not null default 'mieter'::text,
  mieter_id uuid,
  prop_id uuid,
  gueltig_bis timestamp with time zone not null default (now() + '14 days'::interval),
  eingeloest_von uuid,
  eingeloest_am timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.mieter_zugaenge (
  user_id uuid not null,
  vermieter_id uuid not null,
  mieter_id uuid not null,
  prop_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.service_zugaenge (
  user_id uuid not null,
  vermieter_id uuid not null,
  firma text,
  created_at timestamp with time zone not null default now(),
  email text
);

-- ---- Mieterportal ----

create table if not exists public.anliegen (
  id uuid not null default gen_random_uuid(),
  mieter_user_id uuid not null,
  vermieter_id uuid not null,
  mieter_id uuid not null,
  prop_id uuid,
  typ text not null default 'frage'::text,
  titel text not null,
  beschreibung text,
  status text not null default 'offen'::text,
  antwort text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  termin_vorschlaege jsonb,
  termin_bestaetigt text
);

create table if not exists public.anliegen_dateien (
  id uuid not null default gen_random_uuid(),
  anliegen_id uuid not null,
  name text not null,
  mime text not null,
  groesse integer not null default 0,
  daten text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.vermieter_anfragen (
  id uuid not null default gen_random_uuid(),
  vermieter_id uuid not null,
  mieter_id uuid not null,
  prop_id uuid,
  typ text not null default 'sonstiges'::text,
  titel text not null,
  beschreibung text,
  termin date,
  faellig_bis date,
  status text not null default 'offen'::text,
  antwort text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.zaehlerstand_meldungen (
  id uuid not null default gen_random_uuid(),
  mieter_user_id uuid not null,
  vermieter_id uuid not null,
  mieter_id uuid not null,
  prop_id uuid,
  art text not null default 'Strom'::text,
  zaehlernummer text,
  stand numeric not null,
  einheit text not null default 'kWh'::text,
  ablesedatum date not null default CURRENT_DATE,
  notiz text,
  foto_name text,
  foto_type text,
  foto_data text,
  uebernommen_am timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- ---- Service-Partner / Aufträge ----

create table if not exists public.firmen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  gewerk text,
  telefon text,
  email text,
  website text,
  notiz text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.auftraege (
  id uuid not null default gen_random_uuid(),
  vermieter_id uuid not null,
  service_user_id uuid not null,
  prop_id uuid,
  anliegen_id uuid,
  objekt_name text,
  vermieter_name text,
  titel text not null,
  beschreibung text,
  termin date,
  status text not null default 'offen'::text,
  antwort text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  firma_id uuid,
  erstellt_von text not null default 'vermieter'::text,
  mieter_id uuid,
  public_token uuid not null default gen_random_uuid(),
  betrag numeric,
  lohnanteil numeric,
  rechnung_name text,
  rechnung_type text,
  rechnung_data text,
  kosten_id uuid
);

-- ---- Bewerbungen ----

create table if not exists public.bewerber_links (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid not null,
  token uuid not null default gen_random_uuid(),
  titel text,
  aktiv boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bewerbungen (
  id uuid not null default gen_random_uuid(),
  link_id uuid not null,
  user_id uuid not null,
  prop_id uuid,
  name text not null,
  email text,
  telefon text,
  einzug_ab date,
  personen integer,
  beruf text,
  arbeitgeber text,
  netto_einkommen numeric,
  raucher boolean,
  haustiere text,
  schufa boolean,
  nachricht text,
  unterschrift_data text,
  status text not null default 'neu'::text,
  created_at timestamp with time zone not null default now()
);

-- ---- Beleihung / Makler ----

create table if not exists public.beleihung_dokumente (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  prop_id uuid not null,
  item_key text not null,
  status text not null default 'offen'::text,
  notiz text,
  datum date,
  datei_name text,
  datei_type text,
  datei_size integer,
  datei_data text,
  updated_at timestamp with time zone default now()
);

create table if not exists public.beleihung_freigaben (
  token uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  prop_id uuid not null,
  item_keys text[] not null default '{}'::text[],
  angaben jsonb,
  ablauf timestamp with time zone not null default (now() + '14 days'::interval),
  aktiv boolean not null default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.beleihung_rueckmeldungen (
  id uuid not null default gen_random_uuid(),
  token uuid not null,
  name text,
  bank text,
  kontakt text,
  nachricht text,
  fehlend text[],
  created_at timestamp with time zone default now()
);

create table if not exists public.makler_dokumente (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  item_key text not null,
  status text not null default 'offen'::text,
  notiz text,
  datum date,
  datei_name text,
  datei_type text,
  datei_size integer,
  datei_data text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- ---- Open Banking ----

create table if not exists public.bankverbindungen (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  prop_id uuid,
  session_id text not null,
  account_uid text not null,
  aspsp_name text,
  aspsp_country text,
  iban text,
  konto_name text,
  waehrung text,
  gueltig_bis timestamp with time zone,
  letzter_abruf timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bank_umsaetze (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  verbindung_id uuid not null,
  transaktions_ref text not null,
  buchungsdatum date,
  betrag numeric not null,
  waehrung text,
  gegenpartei text,
  verwendungszweck text,
  status text not null default 'neu'::text,
  einnahme_id uuid,
  kosten_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bank_auth_anfragen (
  state uuid not null default gen_random_uuid(),
  user_id uuid not null,
  aspsp_name text not null,
  aspsp_country text not null,
  prop_id uuid,
  created_at timestamp with time zone not null default now()
);

-- ---- Abo / Bezahlsystem (inaktiv bis BILLING_ENFORCED=true) ----

create table if not exists public.abos (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  plan text not null default 'kostenlos'::text,
  status text not null default 'aktiv'::text,
  zyklus text,
  banking_addon boolean not null default false,
  provider text not null default 'paddle'::text,
  provider_customer_id text,
  provider_subscription_id text,
  gueltig_bis timestamp with time zone,
  storniert_zum timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  letztes_event_am timestamp with time zone
);


-- =============================================================================
-- 2. Primärschlüssel
-- =============================================================================

do $$
declare
  s text;
begin
  foreach s in array array[
    'abos_pkey|abos|id', 'anliegen_pkey|anliegen|id', 'anliegen_dateien_pkey|anliegen_dateien|id',
    'auftraege_pkey|auftraege|id', 'bank_auth_anfragen_pkey|bank_auth_anfragen|state',
    'bank_umsaetze_pkey|bank_umsaetze|id', 'bankverbindungen_pkey|bankverbindungen|id',
    'beleihung_dokumente_pkey|beleihung_dokumente|id', 'beleihung_freigaben_pkey|beleihung_freigaben|token',
    'beleihung_rueckmeldungen_pkey|beleihung_rueckmeldungen|id', 'bewerber_links_pkey|bewerber_links|id',
    'bewerbungen_pkey|bewerbungen|id', 'bewertung_historie_pkey|bewertung_historie|id',
    'dokument_vorlagen_pkey|dokument_vorlagen|id', 'einladungscodes_pkey|einladungscodes|id',
    'einnahmen_pkey|einnahmen|id', 'firmen_pkey|firmen|id', 'ibans_pkey|ibans|id',
    'kalkulationen_pkey|kalkulationen|id', 'konto_freischaltung_pkey|konto_freischaltung|user_id',
    'kosten_pkey|kosten|id', 'kredite_pkey|kredite|id', 'makler_dokumente_pkey|makler_dokumente|id',
    'miet_zeitraeume_pkey|miet_zeitraeume|id', 'mieter_pkey|mieter|id',
    'mieter_positionen_pkey|mieter_positionen|id', 'mieter_zugaenge_pkey|mieter_zugaenge|user_id, mieter_id',
    'nk_co2_pkey|nk_co2|id', 'notizen_pkey|notizen|id', 'nutzer_rollen_pkey|nutzer_rollen|user_id',
    'properties_pkey|properties|id', 'regional_kennzahlen_pkey|regional_kennzahlen|id',
    'selbstauskunft_pkey|selbstauskunft|id', 'service_zugaenge_pkey|service_zugaenge|user_id, vermieter_id',
    'termine_pkey|termine|id', 'unterschriften_pkey|unterschriften|user_id',
    'verbrauch_pkey|verbrauch|id', 'vergleichsangebote_pkey|vergleichsangebote|id',
    'vermieter_anfragen_pkey|vermieter_anfragen|id', 'vermieter_profil_pkey|vermieter_profil|id',
    'wiederkehrende_buchungen_pkey|wiederkehrende_buchungen|id',
    'zaehlerstand_meldungen_pkey|zaehlerstand_meldungen|id'
  ] loop
    if not exists (select 1 from pg_constraint where conname = split_part(s,'|',1)) then
      execute format('alter table public.%I add constraint %I primary key (%s)',
                     split_part(s,'|',2), split_part(s,'|',1), split_part(s,'|',3));
    end if;
  end loop;
end $$;


-- =============================================================================
-- 3. Eindeutigkeits- und Prüf-Constraints
-- =============================================================================

do $$
declare
  s text;
begin
  foreach s in array array[
    -- UNIQUE
    'abos_user_id_key|abos|unique (user_id)',
    'auftraege_public_token_key|auftraege|unique (public_token)',
    'bank_umsaetze_verbindung_id_transaktions_ref_key|bank_umsaetze|unique (verbindung_id, transaktions_ref)',
    'bankverbindungen_user_id_account_uid_key|bankverbindungen|unique (user_id, account_uid)',
    'beleihung_dokumente_user_id_prop_id_item_key_key|beleihung_dokumente|unique (user_id, prop_id, item_key)',
    'bewerber_links_token_key|bewerber_links|unique (token)',
    'dokument_vorlagen_user_id_art_key|dokument_vorlagen|unique (user_id, art)',
    'einladungscodes_code_key|einladungscodes|unique (code)',
    'makler_dokumente_user_id_item_key_key|makler_dokumente|unique (user_id, item_key)',
    'nk_co2_mieter_id_jahr_key|nk_co2|unique (mieter_id, jahr)',
    'regional_kennzahlen_region_key_art_kennzahl_stichtag_key|regional_kennzahlen|unique (region_key, art, kennzahl, stichtag)',
    'selbstauskunft_user_unique|selbstauskunft|unique (user_id)',
    'vermieter_profil_user_id_key|vermieter_profil|unique (user_id)',
    -- CHECK
    'abos_plan_check|abos|check (plan = any (array[''kostenlos'',''privat'',''plus'',''business'']))',
    'abos_status_check|abos|check (status = any (array[''aktiv'',''testphase'',''ueberfaellig'',''pausiert'',''gekuendigt'']))',
    'abos_zyklus_check|abos|check (zyklus = any (array[''monat'',''jahr'']))',
    'anliegen_status_check|anliegen|check (status = any (array[''offen'',''in_arbeit'',''erledigt'']))',
    'anliegen_typ_check|anliegen|check (typ = any (array[''schaden'',''dokument'',''frage'']))',
    'auftraege_status_check|auftraege|check (status = any (array[''freigabe'',''offen'',''angenommen'',''erledigt'',''abgelehnt'',''nicht_freigegeben'']))',
    'bank_umsaetze_status_check|bank_umsaetze|check (status = any (array[''neu'',''bestaetigt'',''ausgeblendet'']))',
    'bewerbungen_status_check|bewerbungen|check (status = any (array[''neu'',''favorit'',''abgelehnt'']))',
    'einladungscodes_rolle_check|einladungscodes|check (rolle = any (array[''mieter'',''service'']))',
    'einnahmen_soll_monat_check|einnahmen|check (soll_monat is null or soll_monat ~ ''^\d{4}-\d{2}$'')',
    'mieter_positionen_art_35a_check|mieter_positionen|check (art_35a is null or art_35a = any (array[''haushaltsnah'',''handwerker'']))',
    'mieter_positionen_grundkosten_prozent_check|mieter_positionen|check (grundkosten_prozent is null or (grundkosten_prozent >= 0 and grundkosten_prozent <= 100))',
    'nutzer_rollen_rolle_check|nutzer_rollen|check (rolle = any (array[''vermieter'',''mieter'',''service'',''hausverwaltung'']))',
    'properties_bewertungsverfahren_check|properties|check (bewertungsverfahren = any (array[''vergleich'',''ertrag'',''sach'']))',
    'vermieter_anfragen_status_check|vermieter_anfragen|check (status = any (array[''offen'',''erledigt'',''abgelehnt'']))',
    'vermieter_anfragen_typ_check|vermieter_anfragen|check (typ = any (array[''zaehlerstand'',''zutritt'',''mieterhoehung'',''personenzahl'',''kontaktdaten'',''kaution'',''dokument'',''uebergabe'',''sonstiges'']))',
    'wiederkehrende_buchungen_art_check|wiederkehrende_buchungen|check (art = any (array[''einnahme'',''kosten'']))',
    'wiederkehrende_buchungen_betrag_check|wiederkehrende_buchungen|check (betrag > 0)',
    'wiederkehrende_buchungen_zyklus_check|wiederkehrende_buchungen|check (zyklus = any (array[''monatlich'',''quartalsweise'',''halbjaehrlich'',''jaehrlich'',''alle_2_jahre'',''alle_3_jahre'']))',
    'zaehlerstand_meldungen_art_check|zaehlerstand_meldungen|check (art = any (array[''Strom'',''Gas'',''Wasser'',''Warmwasser'',''Fernwärme'',''Öl'',''Sonstiges'']))'
  ] loop
    if not exists (select 1 from pg_constraint where conname = split_part(s,'|',1)) then
      execute format('alter table public.%I add constraint %I %s',
                     split_part(s,'|',2), split_part(s,'|',1), split_part(s,'|',3));
    end if;
  end loop;
end $$;


-- =============================================================================
-- 4. Fremdschlüssel
-- =============================================================================

do $$
declare
  s text;
begin
  foreach s in array array[
    'abos_user_id_fkey|abos|foreign key (user_id) references auth.users(id) on delete cascade',
    'anliegen_mieter_id_fkey|anliegen|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'anliegen_mieter_user_id_fkey|anliegen|foreign key (mieter_user_id) references auth.users(id) on delete cascade',
    'anliegen_prop_id_fkey|anliegen|foreign key (prop_id) references public.properties(id) on delete set null',
    'anliegen_vermieter_id_fkey|anliegen|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'anliegen_dateien_anliegen_id_fkey|anliegen_dateien|foreign key (anliegen_id) references public.anliegen(id) on delete cascade',
    'auftraege_anliegen_id_fkey|auftraege|foreign key (anliegen_id) references public.anliegen(id) on delete set null',
    'auftraege_firma_id_fkey|auftraege|foreign key (firma_id) references public.firmen(id) on delete set null',
    'auftraege_kosten_id_fkey|auftraege|foreign key (kosten_id) references public.kosten(id) on delete set null',
    'auftraege_mieter_id_fkey|auftraege|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'auftraege_prop_id_fkey|auftraege|foreign key (prop_id) references public.properties(id) on delete set null',
    'auftraege_service_user_id_fkey|auftraege|foreign key (service_user_id) references auth.users(id) on delete cascade',
    'auftraege_vermieter_id_fkey|auftraege|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'bank_auth_anfragen_prop_id_fkey|bank_auth_anfragen|foreign key (prop_id) references public.properties(id) on delete set null',
    'bank_auth_anfragen_user_id_fkey|bank_auth_anfragen|foreign key (user_id) references auth.users(id) on delete cascade',
    'bank_umsaetze_einnahme_id_fkey|bank_umsaetze|foreign key (einnahme_id) references public.einnahmen(id) on delete set null',
    'bank_umsaetze_kosten_id_fkey|bank_umsaetze|foreign key (kosten_id) references public.kosten(id) on delete set null',
    'bank_umsaetze_user_id_fkey|bank_umsaetze|foreign key (user_id) references auth.users(id) on delete cascade',
    'bank_umsaetze_verbindung_id_fkey|bank_umsaetze|foreign key (verbindung_id) references public.bankverbindungen(id) on delete cascade',
    'bankverbindungen_prop_id_fkey|bankverbindungen|foreign key (prop_id) references public.properties(id) on delete set null',
    'bankverbindungen_user_id_fkey|bankverbindungen|foreign key (user_id) references auth.users(id) on delete cascade',
    'beleihung_dokumente_prop_id_fkey|beleihung_dokumente|foreign key (prop_id) references public.properties(id) on delete cascade',
    'beleihung_dokumente_user_id_fkey|beleihung_dokumente|foreign key (user_id) references auth.users(id) on delete cascade',
    'beleihung_freigaben_prop_id_fkey|beleihung_freigaben|foreign key (prop_id) references public.properties(id) on delete cascade',
    'beleihung_freigaben_user_id_fkey|beleihung_freigaben|foreign key (user_id) references auth.users(id) on delete cascade',
    'beleihung_rueckmeldungen_token_fkey|beleihung_rueckmeldungen|foreign key (token) references public.beleihung_freigaben(token) on delete cascade',
    'bewerber_links_prop_id_fkey|bewerber_links|foreign key (prop_id) references public.properties(id) on delete cascade',
    'bewerber_links_user_id_fkey|bewerber_links|foreign key (user_id) references auth.users(id) on delete cascade',
    'bewerbungen_link_id_fkey|bewerbungen|foreign key (link_id) references public.bewerber_links(id) on delete cascade',
    'bewerbungen_prop_id_fkey|bewerbungen|foreign key (prop_id) references public.properties(id) on delete set null',
    'bewerbungen_user_id_fkey|bewerbungen|foreign key (user_id) references auth.users(id) on delete cascade',
    'bewertung_historie_immobilie_id_fkey|bewertung_historie|foreign key (immobilie_id) references public.properties(id) on delete cascade',
    'einladungscodes_mieter_id_fkey|einladungscodes|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'einladungscodes_prop_id_fkey|einladungscodes|foreign key (prop_id) references public.properties(id) on delete cascade',
    'einladungscodes_vermieter_id_fkey|einladungscodes|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'einnahmen_mieter_id_fkey|einnahmen|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'einnahmen_prop_id_fkey|einnahmen|foreign key (prop_id) references public.properties(id) on delete cascade',
    'einnahmen_user_id_fkey|einnahmen|foreign key (user_id) references auth.users(id) on delete cascade',
    'einnahmen_wiederkehr_id_fkey|einnahmen|foreign key (wiederkehr_id) references public.wiederkehrende_buchungen(id) on delete set null',
    'firmen_user_id_fkey|firmen|foreign key (user_id) references auth.users(id) on delete cascade',
    'kalkulationen_user_id_fkey|kalkulationen|foreign key (user_id) references auth.users(id) on delete cascade',
    'konto_freischaltung_user_id_fkey|konto_freischaltung|foreign key (user_id) references auth.users(id) on delete cascade',
    'kosten_mieter_id_fkey|kosten|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'kosten_prop_id_fkey|kosten|foreign key (prop_id) references public.properties(id) on delete cascade',
    'kosten_user_id_fkey|kosten|foreign key (user_id) references auth.users(id) on delete cascade',
    'kosten_wiederkehr_id_fkey|kosten|foreign key (wiederkehr_id) references public.wiederkehrende_buchungen(id) on delete set null',
    'kredite_prop_id_fkey|kredite|foreign key (prop_id) references public.properties(id) on delete cascade',
    'kredite_user_id_fkey|kredite|foreign key (user_id) references auth.users(id) on delete cascade',
    'makler_dokumente_user_id_fkey|makler_dokumente|foreign key (user_id) references auth.users(id) on delete cascade',
    'miet_zeitraeume_mieter_id_fkey|miet_zeitraeume|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'mieter_prop_id_fkey|mieter|foreign key (prop_id) references public.properties(id) on delete set null',
    'mieter_user_id_fkey|mieter|foreign key (user_id) references auth.users(id) on delete cascade',
    'mieter_positionen_mieter_id_fkey|mieter_positionen|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'mieter_positionen_user_id_fkey|mieter_positionen|foreign key (user_id) references auth.users(id) on delete cascade',
    'mieter_zugaenge_mieter_id_fkey|mieter_zugaenge|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'mieter_zugaenge_prop_id_fkey|mieter_zugaenge|foreign key (prop_id) references public.properties(id) on delete cascade',
    'mieter_zugaenge_user_id_fkey|mieter_zugaenge|foreign key (user_id) references auth.users(id) on delete cascade',
    'mieter_zugaenge_vermieter_id_fkey|mieter_zugaenge|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'nk_co2_mieter_id_fkey|nk_co2|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'nk_co2_user_id_fkey|nk_co2|foreign key (user_id) references auth.users(id) on delete cascade',
    'notizen_mieter_id_fkey|notizen|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'notizen_prop_id_fkey|notizen|foreign key (prop_id) references public.properties(id) on delete cascade',
    'notizen_user_id_fkey|notizen|foreign key (user_id) references auth.users(id) on delete cascade',
    'nutzer_rollen_user_id_fkey|nutzer_rollen|foreign key (user_id) references auth.users(id) on delete cascade',
    'properties_user_id_fkey|properties|foreign key (user_id) references auth.users(id) on delete cascade',
    'selbstauskunft_user_id_fkey|selbstauskunft|foreign key (user_id) references auth.users(id) on delete cascade',
    'service_zugaenge_user_id_fkey|service_zugaenge|foreign key (user_id) references auth.users(id) on delete cascade',
    'service_zugaenge_vermieter_id_fkey|service_zugaenge|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'termine_mieter_id_fkey|termine|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'termine_prop_id_fkey|termine|foreign key (prop_id) references public.properties(id) on delete set null',
    'unterschriften_user_id_fkey|unterschriften|foreign key (user_id) references auth.users(id) on delete cascade',
    'verbrauch_prop_id_fkey|verbrauch|foreign key (prop_id) references public.properties(id) on delete cascade',
    'verbrauch_user_id_fkey|verbrauch|foreign key (user_id) references auth.users(id) on delete cascade',
    'vergleichsangebote_immobilie_id_fkey|vergleichsangebote|foreign key (immobilie_id) references public.properties(id) on delete cascade',
    'vermieter_anfragen_mieter_id_fkey|vermieter_anfragen|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'vermieter_anfragen_prop_id_fkey|vermieter_anfragen|foreign key (prop_id) references public.properties(id) on delete set null',
    'vermieter_anfragen_vermieter_id_fkey|vermieter_anfragen|foreign key (vermieter_id) references auth.users(id) on delete cascade',
    'vermieter_profil_user_id_fkey|vermieter_profil|foreign key (user_id) references auth.users(id) on delete cascade',
    'wiederkehrende_buchungen_mieter_id_fkey|wiederkehrende_buchungen|foreign key (mieter_id) references public.mieter(id) on delete set null',
    'wiederkehrende_buchungen_prop_id_fkey|wiederkehrende_buchungen|foreign key (prop_id) references public.properties(id) on delete set null',
    'wiederkehrende_buchungen_user_id_fkey|wiederkehrende_buchungen|foreign key (user_id) references auth.users(id) on delete cascade',
    'zaehlerstand_meldungen_mieter_id_fkey|zaehlerstand_meldungen|foreign key (mieter_id) references public.mieter(id) on delete cascade',
    'zaehlerstand_meldungen_mieter_user_id_fkey|zaehlerstand_meldungen|foreign key (mieter_user_id) references auth.users(id) on delete cascade',
    'zaehlerstand_meldungen_prop_id_fkey|zaehlerstand_meldungen|foreign key (prop_id) references public.properties(id) on delete set null',
    'zaehlerstand_meldungen_vermieter_id_fkey|zaehlerstand_meldungen|foreign key (vermieter_id) references auth.users(id) on delete cascade'
  ] loop
    if not exists (select 1 from pg_constraint where conname = split_part(s,'|',1)) then
      execute format('alter table public.%I add constraint %I %s',
                     split_part(s,'|',2), split_part(s,'|',1), split_part(s,'|',3));
    end if;
  end loop;
end $$;

-- einladungscodes.eingeloest_von hat bewusst KEINE ON-DELETE-Regel — so war der
-- Stand am 28.07.2026. Korrigiert wird das in der Folgemigration
-- 20260728130000_kontoloeschung_vollstaendig.sql.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'einladungscodes_eingeloest_von_fkey') then
    alter table public.einladungscodes
      add constraint einladungscodes_eingeloest_von_fkey
      foreign key (eingeloest_von) references auth.users(id);
  end if;
end $$;


-- =============================================================================
-- 5. Indizes
-- =============================================================================

create index if not exists abos_provider_subscription_idx on public.abos using btree (provider_subscription_id);
create index if not exists anliegen_mieter_user_idx on public.anliegen using btree (mieter_user_id);
create index if not exists anliegen_vermieter_idx on public.anliegen using btree (vermieter_id, status);
create index if not exists anliegen_dateien_anliegen_idx on public.anliegen_dateien using btree (anliegen_id);
create index if not exists auftraege_service_idx on public.auftraege using btree (service_user_id);
create index if not exists auftraege_vermieter_idx on public.auftraege using btree (vermieter_id);
create index if not exists bank_umsaetze_user_idx on public.bank_umsaetze using btree (user_id);
create index if not exists bank_umsaetze_verbindung_idx on public.bank_umsaetze using btree (verbindung_id);
create index if not exists bankverbindungen_user_idx on public.bankverbindungen using btree (user_id);
create index if not exists idx_beleihung_dok_prop on public.beleihung_dokumente using btree (prop_id);
create index if not exists idx_freigaben_prop on public.beleihung_freigaben using btree (prop_id);
create index if not exists idx_rueckmeldung_token on public.beleihung_rueckmeldungen using btree (token);
create index if not exists bewerber_links_user_idx on public.bewerber_links using btree (user_id);
create index if not exists bewerbungen_link_idx on public.bewerbungen using btree (link_id);
create index if not exists bewerbungen_user_idx on public.bewerbungen using btree (user_id);
create index if not exists idx_bewertung_historie_immo on public.bewertung_historie using btree (immobilie_id, datum desc);
create index if not exists einladungscodes_mieter_idx on public.einladungscodes using btree (mieter_id);
create index if not exists einladungscodes_vermieter_idx on public.einladungscodes using btree (vermieter_id);
create index if not exists einnahmen_wkb_idx on public.einnahmen using btree (wiederkehr_id);
create index if not exists idx_einnahmen_mieter on public.einnahmen using btree (mieter_id);
create index if not exists idx_einnahmen_prop on public.einnahmen using btree (prop_id);
create index if not exists idx_einnahmen_user on public.einnahmen using btree (user_id);
create index if not exists firmen_user_idx on public.firmen using btree (user_id);
-- Nur EINE Standard-IBAN je Nutzer; Blind-Index für die Dublettenprüfung
-- verschlüsselter IBANs (lib/crypto/secure.ts).
create unique index if not exists ibans_one_standard_per_user on public.ibans using btree (user_id) where standard;
create unique index if not exists ibans_user_bidx_unique on public.ibans using btree (user_id, iban_bidx);
create index if not exists idx_kalkulationen_user on public.kalkulationen using btree (user_id);
create index if not exists idx_kosten_mieter on public.kosten using btree (mieter_id);
create index if not exists idx_kosten_prop on public.kosten using btree (prop_id);
create index if not exists idx_kosten_user on public.kosten using btree (user_id);
create index if not exists kosten_wkb_idx on public.kosten using btree (wiederkehr_id);
create index if not exists idx_kredite_prop on public.kredite using btree (prop_id);
create index if not exists idx_kredite_user on public.kredite using btree (user_id);
create index if not exists miet_zeitraeume_mieter_idx on public.miet_zeitraeume using btree (mieter_id);
create index if not exists miet_zeitraeume_user_idx on public.miet_zeitraeume using btree (user_id);
create index if not exists idx_mieter_prop on public.mieter using btree (prop_id);
create index if not exists idx_mieter_user on public.mieter using btree (user_id);
create index if not exists idx_mieter_positionen_mieter on public.mieter_positionen using btree (mieter_id);
create index if not exists idx_mieter_positionen_user on public.mieter_positionen using btree (user_id);
create index if not exists mieter_zugaenge_mieter_idx on public.mieter_zugaenge using btree (mieter_id);
create index if not exists mieter_zugaenge_vermieter_idx on public.mieter_zugaenge using btree (vermieter_id);
create index if not exists nk_co2_mieter_idx on public.nk_co2 using btree (mieter_id);
create index if not exists nk_co2_user_idx on public.nk_co2 using btree (user_id);
create index if not exists idx_notizen_prop on public.notizen using btree (prop_id);
create index if not exists idx_notizen_user on public.notizen using btree (user_id);
create index if not exists notizen_mieter_id_idx on public.notizen using btree (mieter_id);
create index if not exists idx_properties_user on public.properties using btree (user_id);
create index if not exists idx_regional_kennzahlen_region on public.regional_kennzahlen using btree (region_key, art);
create index if not exists idx_termine_mieter on public.termine using btree (mieter_id);
create index if not exists idx_termine_prop on public.termine using btree (prop_id);
create index if not exists idx_verbrauch_prop on public.verbrauch using btree (prop_id);
create index if not exists idx_verbrauch_user on public.verbrauch using btree (user_id);
create index if not exists idx_vergleichsangebote_immo on public.vergleichsangebote using btree (immobilie_id, abgerufen_am desc);
create index if not exists vermieter_anfragen_mieter_idx on public.vermieter_anfragen using btree (mieter_id);
create index if not exists vermieter_anfragen_vermieter_idx on public.vermieter_anfragen using btree (vermieter_id, status);
create index if not exists wkb_prop_idx on public.wiederkehrende_buchungen using btree (prop_id);
create index if not exists wkb_user_idx on public.wiederkehrende_buchungen using btree (user_id);
create index if not exists zaehlerstand_mieter_user_idx on public.zaehlerstand_meldungen using btree (mieter_user_id);
create index if not exists zaehlerstand_vermieter_idx on public.zaehlerstand_meldungen using btree (vermieter_id, uebernommen_am);


-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
--
-- RLS ist auf ALLEN 42 Tabellen aktiv. Sie ist die einzige Zugriffskontrolle:
-- Die Server-Actions filtern überwiegend nur nach `id`, nicht nach `user_id` —
-- fällt eine Policy weg, ist die Mandantentrennung weg. Deshalb steht sie ab
-- jetzt hier im Repo und nicht nur im Dashboard.

do $$
declare
  t text;
begin
  foreach t in array array[
    'abos','anliegen','anliegen_dateien','auftraege','bank_auth_anfragen','bank_umsaetze',
    'bankverbindungen','beleihung_dokumente','beleihung_freigaben','beleihung_rueckmeldungen',
    'bewerber_links','bewerbungen','bewertung_historie','dokument_vorlagen','einladungscodes',
    'einnahmen','firmen','ibans','kalkulationen','konto_freischaltung','kosten','kredite',
    'makler_dokumente','miet_zeitraeume','mieter','mieter_positionen','mieter_zugaenge','nk_co2',
    'notizen','nutzer_rollen','properties','regional_kennzahlen','selbstauskunft','service_zugaenge',
    'termine','unterschriften','verbrauch','vergleichsangebote','vermieter_anfragen',
    'vermieter_profil','wiederkehrende_buchungen','zaehlerstand_meldungen'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- =============================================================================
-- 7. Policies
-- =============================================================================
-- Grundmuster: „own_*" / „*_owner" = der Eigentümer darf alles mit seinen
-- eigenen Zeilen. Zusätzliche SELECT-Policies öffnen einzelne Zeilen für Mieter
-- (über `mieter_zugaenge`) bzw. Service-Partner (über `service_zugaenge`).

-- ---- Eigentümer-Vollzugriff (alle Operationen) ----
do $$
declare
  s text;
begin
  foreach s in array array[
    'own_properties|properties', 'own_mieter|mieter', 'own_einnahmen|einnahmen',
    'own_kosten|kosten', 'own_kredite|kredite', 'own_notizen|notizen',
    'own_verbrauch|verbrauch', 'own_mieter_positionen|mieter_positionen',
    'own_kalkulationen|kalkulationen', 'termine_policy|termine', 'ibans_policy|ibans',
    'dokument_vorlagen_policy|dokument_vorlagen', 'unterschriften_owner|unterschriften',
    'firmen_owner|firmen', 'bewerber_links_owner|bewerber_links',
    'own_beleihung_dok|beleihung_dokumente', 'own_freigaben|beleihung_freigaben',
    'bankverbindungen_owner|bankverbindungen', 'bank_umsaetze_owner|bank_umsaetze',
    'bank_auth_owner|bank_auth_anfragen'
  ] loop
    execute format('drop policy if exists %I on public.%I', split_part(s,'|',1), split_part(s,'|',2));
    execute format(
      'create policy %I on public.%I for all to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      split_part(s,'|',1), split_part(s,'|',2));
  end loop;
end $$;

drop policy if exists "makler_dokumente_own" on public.makler_dokumente;
create policy "makler_dokumente_own" on public.makler_dokumente for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bewertung_historie_all" on public.bewertung_historie;
create policy "bewertung_historie_all" on public.bewertung_historie for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "vergleichsangebote_all" on public.vergleichsangebote;
create policy "vergleichsangebote_all" on public.vergleichsangebote for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---- Nur lesbar / je Operation getrennt ----

drop policy if exists "abos_select_own" on public.abos;
create policy "abos_select_own" on public.abos for select to authenticated
  using ((select auth.uid()) = user_id);
-- Kein INSERT/UPDATE für Nutzer: `abos` schreibt ausschließlich der
-- Paddle-Webhook mit der Service-Role (umgeht RLS).

drop policy if exists "regional_kennzahlen_read" on public.regional_kennzahlen;
create policy "regional_kennzahlen_read" on public.regional_kennzahlen for select to authenticated
  using (true);

drop policy if exists "rolle_select_own" on public.nutzer_rollen;
create policy "rolle_select_own" on public.nutzer_rollen for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "freischaltung_select_self" on public.konto_freischaltung;
create policy "freischaltung_select_self" on public.konto_freischaltung for select to public
  using ((select auth.uid()) = user_id);
-- Geschrieben wird nur über konto_freischalten() / handle_new_user_rolle().

do $$
declare
  s text;
begin
  foreach s in array array[
    'miet_zeitraeume_select|miet_zeitraeume|select', 'miet_zeitraeume_insert|miet_zeitraeume|insert',
    'miet_zeitraeume_update|miet_zeitraeume|update', 'miet_zeitraeume_delete|miet_zeitraeume|delete',
    'nk_co2_select|nk_co2|select', 'nk_co2_insert|nk_co2|insert',
    'nk_co2_update|nk_co2|update', 'nk_co2_delete|nk_co2|delete',
    'wkb_select|wiederkehrende_buchungen|select', 'wkb_insert|wiederkehrende_buchungen|insert',
    'wkb_update|wiederkehrende_buchungen|update', 'wkb_delete|wiederkehrende_buchungen|delete',
    'vermieter_profil_select_own|vermieter_profil|select', 'vermieter_profil_insert_own|vermieter_profil|insert',
    'vermieter_profil_delete_own|vermieter_profil|delete'
  ] loop
    execute format('drop policy if exists %I on public.%I', split_part(s,'|',1), split_part(s,'|',2));
    if split_part(s,'|',3) = 'insert' then
      execute format('create policy %I on public.%I for insert to public with check ((select auth.uid()) = user_id)',
                     split_part(s,'|',1), split_part(s,'|',2));
    else
      execute format('create policy %I on public.%I for %s to public using ((select auth.uid()) = user_id)',
                     split_part(s,'|',1), split_part(s,'|',2), split_part(s,'|',3));
    end if;
  end loop;
end $$;

drop policy if exists "vermieter_profil_update_own" on public.vermieter_profil;
create policy "vermieter_profil_update_own" on public.vermieter_profil for update to public
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

do $$
declare
  s text;
begin
  foreach s in array array[
    'selbstauskunft_select_own|select', 'selbstauskunft_insert_own|insert', 'selbstauskunft_delete_own|delete'
  ] loop
    execute format('drop policy if exists %I on public.selbstauskunft', split_part(s,'|',1));
    if split_part(s,'|',2) = 'insert' then
      execute format('create policy %I on public.selbstauskunft for insert to public with check (auth.uid() = user_id)',
                     split_part(s,'|',1));
    else
      execute format('create policy %I on public.selbstauskunft for %s to public using (auth.uid() = user_id)',
                     split_part(s,'|',1), split_part(s,'|',2));
    end if;
  end loop;
end $$;

drop policy if exists "selbstauskunft_update_own" on public.selbstauskunft;
create policy "selbstauskunft_update_own" on public.selbstauskunft for update to public
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Mieter-Lesezugriff über mieter_zugaenge ----

drop policy if exists "mieter_select_zugang" on public.mieter;
create policy "mieter_select_zugang" on public.mieter for select to public
  using (exists (select 1 from public.mieter_zugaenge z
                 where z.mieter_id = mieter.id and z.user_id = (select auth.uid())));

drop policy if exists "properties_select_zugang" on public.properties;
create policy "properties_select_zugang" on public.properties for select to public
  using (exists (select 1 from public.mieter_zugaenge z
                 where z.prop_id = properties.id and z.user_id = (select auth.uid())));

-- Der Mieter sieht NUR seine eigenen Miet-/Nebenkosten-Buchungen.
drop policy if exists "einnahmen_select_mieter_zugang" on public.einnahmen;
create policy "einnahmen_select_mieter_zugang" on public.einnahmen for select to public
  using ((kategorie = 'Miete' or kategorie = 'Nebenkosten')
         and mieter_id is not null
         and exists (select 1 from public.mieter_zugaenge z
                     where z.mieter_id = einnahmen.mieter_id and z.user_id = (select auth.uid())));

-- Kosten/Notizen nur, wenn der Vermieter sie ausdrücklich freigegeben hat.
drop policy if exists "kosten_select_mieter_freigabe" on public.kosten;
create policy "kosten_select_mieter_freigabe" on public.kosten for select to public
  using (mieter_freigabe
         and exists (select 1 from public.mieter_zugaenge z
                     where z.user_id = (select auth.uid()) and z.prop_id = kosten.prop_id));

drop policy if exists "notizen_select_mieter_freigabe" on public.notizen;
create policy "notizen_select_mieter_freigabe" on public.notizen for select to public
  using (mieter_freigabe and mieter_id is not null
         and exists (select 1 from public.mieter_zugaenge z
                     where z.mieter_id = notizen.mieter_id and z.user_id = (select auth.uid())));

drop policy if exists "zugang_select_beteiligte" on public.mieter_zugaenge;
create policy "zugang_select_beteiligte" on public.mieter_zugaenge for select to public
  using ((select auth.uid()) = user_id or (select auth.uid()) = vermieter_id);

drop policy if exists "zugang_delete_vermieter" on public.mieter_zugaenge;
create policy "zugang_delete_vermieter" on public.mieter_zugaenge for delete to public
  using ((select auth.uid()) = vermieter_id);

drop policy if exists "einladung_vermieter_all" on public.einladungscodes;
create policy "einladung_vermieter_all" on public.einladungscodes for all to public
  using ((select auth.uid()) = vermieter_id) with check ((select auth.uid()) = vermieter_id);

-- ---- Anliegen (Mieterportal) ----

drop policy if exists "anliegen_select_beteiligte" on public.anliegen;
create policy "anliegen_select_beteiligte" on public.anliegen for select to public
  using ((select auth.uid()) = mieter_user_id or (select auth.uid()) = vermieter_id);

drop policy if exists "anliegen_insert_mieter" on public.anliegen;
create policy "anliegen_insert_mieter" on public.anliegen for insert to public
  with check ((select auth.uid()) = mieter_user_id
              and exists (select 1 from public.mieter_zugaenge z
                          where z.user_id = (select auth.uid())
                            and z.mieter_id = anliegen.mieter_id
                            and z.vermieter_id = anliegen.vermieter_id));

drop policy if exists "anliegen_update_mieter" on public.anliegen;
create policy "anliegen_update_mieter" on public.anliegen for update to public
  using ((select auth.uid()) = mieter_user_id) with check ((select auth.uid()) = mieter_user_id);

drop policy if exists "anliegen_update_vermieter" on public.anliegen;
create policy "anliegen_update_vermieter" on public.anliegen for update to public
  using ((select auth.uid()) = vermieter_id) with check ((select auth.uid()) = vermieter_id);

drop policy if exists "anliegen_dateien_select" on public.anliegen_dateien;
create policy "anliegen_dateien_select" on public.anliegen_dateien for select to public
  using (exists (select 1 from public.anliegen a
                 where a.id = anliegen_dateien.anliegen_id
                   and ((select auth.uid()) = a.mieter_user_id or (select auth.uid()) = a.vermieter_id)));

drop policy if exists "anliegen_dateien_insert" on public.anliegen_dateien;
create policy "anliegen_dateien_insert" on public.anliegen_dateien for insert to public
  with check (exists (select 1 from public.anliegen a
                      where a.id = anliegen_dateien.anliegen_id
                        and a.mieter_user_id = (select auth.uid())));

-- ---- Vermieter-Anfragen an den Mieter ----

drop policy if exists "vanfrage_vermieter_all" on public.vermieter_anfragen;
create policy "vanfrage_vermieter_all" on public.vermieter_anfragen for all to public
  using ((select auth.uid()) = vermieter_id)
  with check ((select auth.uid()) = vermieter_id
              and exists (select 1 from public.mieter m
                          where m.id = vermieter_anfragen.mieter_id and m.user_id = (select auth.uid())));

drop policy if exists "vanfrage_select_mieter" on public.vermieter_anfragen;
create policy "vanfrage_select_mieter" on public.vermieter_anfragen for select to public
  using (exists (select 1 from public.mieter_zugaenge z
                 where z.mieter_id = vermieter_anfragen.mieter_id and z.user_id = (select auth.uid())));

drop policy if exists "vanfrage_update_mieter" on public.vermieter_anfragen;
create policy "vanfrage_update_mieter" on public.vermieter_anfragen for update to public
  using (exists (select 1 from public.mieter_zugaenge z
                 where z.mieter_id = vermieter_anfragen.mieter_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.mieter_zugaenge z
                      where z.mieter_id = vermieter_anfragen.mieter_id and z.user_id = (select auth.uid())));

-- ---- Zählerstände ----

drop policy if exists "zaehler_select_beteiligte" on public.zaehlerstand_meldungen;
create policy "zaehler_select_beteiligte" on public.zaehlerstand_meldungen for select to public
  using ((select auth.uid()) = mieter_user_id or (select auth.uid()) = vermieter_id);

drop policy if exists "zaehler_insert_mieter" on public.zaehlerstand_meldungen;
create policy "zaehler_insert_mieter" on public.zaehlerstand_meldungen for insert to public
  with check ((select auth.uid()) = mieter_user_id
              and exists (select 1 from public.mieter_zugaenge z
                          where z.user_id = (select auth.uid())
                            and z.mieter_id = zaehlerstand_meldungen.mieter_id
                            and z.vermieter_id = zaehlerstand_meldungen.vermieter_id));

drop policy if exists "zaehler_update_vermieter" on public.zaehlerstand_meldungen;
create policy "zaehler_update_vermieter" on public.zaehlerstand_meldungen for update to public
  using ((select auth.uid()) = vermieter_id) with check ((select auth.uid()) = vermieter_id);

-- ---- Service-Partner / Aufträge ----

drop policy if exists "auftraege_vermieter" on public.auftraege;
create policy "auftraege_vermieter" on public.auftraege for all to public
  using ((select auth.uid()) = vermieter_id) with check ((select auth.uid()) = vermieter_id);

drop policy if exists "auftraege_service_select" on public.auftraege;
create policy "auftraege_service_select" on public.auftraege for select to public
  using ((select auth.uid()) = service_user_id);

-- Der Service-Partner darf nur Aufträge zur FREIGABE einreichen …
drop policy if exists "auftraege_service_insert" on public.auftraege;
create policy "auftraege_service_insert" on public.auftraege for insert to public
  with check ((select auth.uid()) = service_user_id
              and status = 'freigabe' and erstellt_von = 'service'
              and exists (select 1 from public.service_zugaenge z
                          where z.vermieter_id = auftraege.vermieter_id and z.user_id = (select auth.uid())));

-- … und nur offene/angenommene Aufträge weiterbewegen. Welche SPALTEN er dabei
-- ändern darf, erzwingt zusätzlich der Trigger auftraege_service_spaltenschutz.
drop policy if exists "auftraege_service_update" on public.auftraege;
create policy "auftraege_service_update" on public.auftraege for update to public
  using ((select auth.uid()) = service_user_id and status = any (array['offen','angenommen']))
  with check (status = any (array['angenommen','erledigt','abgelehnt']));

drop policy if exists "firmen_service_select" on public.firmen;
create policy "firmen_service_select" on public.firmen for select to public
  using (exists (select 1 from public.service_zugaenge z
                 where z.vermieter_id = firmen.user_id and z.user_id = (select auth.uid())));

drop policy if exists "service_zugaenge_vermieter" on public.service_zugaenge;
create policy "service_zugaenge_vermieter" on public.service_zugaenge for all to public
  using ((select auth.uid()) = vermieter_id) with check ((select auth.uid()) = vermieter_id);

drop policy if exists "service_zugaenge_service" on public.service_zugaenge;
create policy "service_zugaenge_service" on public.service_zugaenge for select to public
  using ((select auth.uid()) = user_id);

-- ---- Bewerbungen ----
-- KEIN öffentliches INSERT: Bewerbungen kommen ausschließlich über die
-- SECURITY-DEFINER-Funktion bewerbung_einreichen() herein. Der Vermieter ist
-- der Einzige, der sie danach sieht.

drop policy if exists "bewerbungen_owner_select" on public.bewerbungen;
create policy "bewerbungen_owner_select" on public.bewerbungen for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "bewerbungen_owner_update" on public.bewerbungen;
create policy "bewerbungen_owner_update" on public.bewerbungen for update to public
  using ((select auth.uid()) = user_id);

drop policy if exists "bewerbungen_owner_delete" on public.bewerbungen;
create policy "bewerbungen_owner_delete" on public.bewerbungen for delete to public
  using ((select auth.uid()) = user_id);

-- ---- Beleihungs-Rückmeldungen ----

drop policy if exists "owner_liest_rueckmeldungen" on public.beleihung_rueckmeldungen;
create policy "owner_liest_rueckmeldungen" on public.beleihung_rueckmeldungen for select to public
  using (exists (select 1 from public.beleihung_freigaben f
                 where f.token = beleihung_rueckmeldungen.token and f.user_id = (select auth.uid())));


-- =============================================================================
-- 8. Funktionen
-- =============================================================================

-- ---- Hilfsfunktionen / Trigger ----

create or replace function public.update_updated_at()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin new.updated_at = now(); return new; end;
$function$;

-- Der Mieter darf an einem Anliegen NUR den Termin bestätigen — und nur einen
-- Slot, den der Vermieter tatsächlich vorgeschlagen hat.
create or replace function public.anliegen_mieter_spaltenschutz()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if (select auth.uid()) = old.mieter_user_id
     and (select auth.uid()) is distinct from old.vermieter_id then
    if new.id is distinct from old.id
       or new.mieter_user_id is distinct from old.mieter_user_id
       or new.vermieter_id is distinct from old.vermieter_id
       or new.mieter_id is distinct from old.mieter_id
       or new.prop_id is distinct from old.prop_id
       or new.typ is distinct from old.typ
       or new.titel is distinct from old.titel
       or new.beschreibung is distinct from old.beschreibung
       or new.status is distinct from old.status
       or new.antwort is distinct from old.antwort
       or new.termin_vorschlaege is distinct from old.termin_vorschlaege
       or new.created_at is distinct from old.created_at then
      raise exception 'Mieter duerfen nur den Termin bestaetigen';
    end if;
    if new.termin_bestaetigt is not null
       and not (coalesce(old.termin_vorschlaege, '[]'::jsonb) ? new.termin_bestaetigt) then
      raise exception 'Termin ist kein gueltiger Vorschlag';
    end if;
  end if;
  return new;
end;
$function$;

-- Der Service-Partner darf nur status/antwort/betrag/lohnanteil/rechnung_*
-- ändern; alles andere wird auf den alten Stand zurückgesetzt.
create or replace function public.auftraege_service_spaltenschutz()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if (select auth.uid()) is distinct from old.vermieter_id then
    new.vermieter_id    := old.vermieter_id;
    new.service_user_id := old.service_user_id;
    new.prop_id         := old.prop_id;
    new.anliegen_id     := old.anliegen_id;
    new.mieter_id       := old.mieter_id;
    new.firma_id        := old.firma_id;
    new.objekt_name     := old.objekt_name;
    new.vermieter_name  := old.vermieter_name;
    new.titel           := old.titel;
    new.beschreibung    := old.beschreibung;
    new.termin          := old.termin;
    new.erstellt_von    := old.erstellt_von;
    new.public_token    := old.public_token;
    new.created_at      := old.created_at;
    new.kosten_id       := old.kosten_id;
  end if;
  return new;
end $function$;

-- ---- Registrierung / Freischaltung ----

create or replace function public.handle_new_user_rolle()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_rolle text := new.raw_user_meta_data->>'rolle';
  v_code  text := new.raw_user_meta_data->>'einladungscode';
  v_firma text := new.raw_user_meta_data->>'firma';
  v_e     public.einladungscodes;
begin
  begin
    if v_rolle in ('mieter','service','hausverwaltung') then
      insert into public.nutzer_rollen (user_id, rolle)
        values (new.id, v_rolle) on conflict do nothing;
    end if;

    if v_rolle = 'mieter' and v_code is not null then
      select * into v_e from public.einladungscodes
        where code = v_code and rolle = 'mieter'
          and eingeloest_am is null and gueltig_bis > now()
        for update;
      if found and v_e.mieter_id is not null then
        insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id)
          values (new.id, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id)
          on conflict do nothing;
        update public.einladungscodes
          set eingeloest_von = new.id, eingeloest_am = now() where id = v_e.id;
        insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
          values (new.id, true, true, 'einladung') on conflict (user_id) do nothing;
      end if;
    elsif v_rolle = 'service' and v_code is not null then
      select * into v_e from public.einladungscodes
        where code = v_code and rolle = 'service'
          and eingeloest_am is null and gueltig_bis > now()
        for update;
      if found then
        insert into public.service_zugaenge (user_id, vermieter_id, firma, email)
          values (new.id, v_e.vermieter_id, nullif(trim(coalesce(v_firma,'')), ''), new.email)
          on conflict do nothing;
        update public.einladungscodes
          set eingeloest_von = new.id, eingeloest_am = now() where id = v_e.id;
        insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
          values (new.id, true, true, 'einladung') on conflict (user_id) do nothing;
      end if;
    end if;
  exception when others then
    -- Bewusst geschluckt: Ein Fehler hier darf die Registrierung nicht
    -- abbrechen. Folge ist allerdings ein Konto ohne Zugang — siehe
    -- Merkliste „Freischaltungs-Gate".
    null;
  end;
  return new;
end $function$;

create or replace function public.konto_freischalten(p_quelle text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then return; end if;
  insert into konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
    values (auth.uid(), true, true, coalesce(p_quelle, 'code'))
    on conflict (user_id) do update set
      consent_agb = true, consent_datenschutz = true,
      freigeschaltet_am = now(), quelle = excluded.quelle;
end $function$;

create or replace function public.einladungscode_pruefen(p_code text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.einladungscodes
    where code = p_code and eingeloest_am is null and gueltig_bis > now()
  );
$function$;

create or replace function public.einladungscode_pruefen(p_code text, p_rolle text default null)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.einladungscodes
    where code = p_code and eingeloest_am is null and gueltig_bis > now()
      and (p_rolle is null or rolle = p_rolle)
  );
$function$;

-- ---- Kontolöschung (Art. 17 DSGVO) ----

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Kind-Tabellen zuerst (FK-Reihenfolge), dann Eltern.
  -- Stand 28.07.2026 — die Lücken (verwaiste Zeilen, blockierender FK) behebt
  -- die Folgemigration 20260728130000_kontoloeschung_vollstaendig.sql.
  delete from public.mieter_positionen where user_id = uid;
  delete from public.notizen          where user_id = uid;
  delete from public.kosten           where user_id = uid;
  delete from public.einnahmen        where user_id = uid;
  delete from public.verbrauch        where user_id = uid;
  delete from public.kredite          where user_id = uid;
  delete from public.termine          where user_id = uid;
  delete from public.mieter           where user_id = uid;
  delete from public.properties       where user_id = uid;
  delete from public.ibans            where user_id = uid;
  delete from public.dokument_vorlagen where user_id = uid;
  delete from public.vermieter_profil where user_id = uid;

  -- Zuletzt der Auth-User selbst.
  delete from auth.users where id = uid;
end;
$function$;

-- ---- Öffentliche Token-Endpunkte (SECURITY DEFINER) ----
-- Diese Funktionen sind der EINZIGE Weg, auf dem Nicht-Angemeldete Daten sehen
-- oder schreiben. Jede prüft das Token selbst und gibt nur die dafür
-- freigegebenen Felder heraus.

create or replace function public.bewerber_link_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
begin
  select bl.id, bl.titel, p.bezeichnung, p.adresse, p.flaeche, p.zimmer
    into l
  from bewerber_links bl
  join properties p on p.id = bl.prop_id
  where bl.token = p_token and bl.aktiv;
  if not found then return null; end if;
  return jsonb_build_object(
    'titel', l.titel, 'objekt', l.bezeichnung, 'adresse', l.adresse,
    'flaeche', l.flaeche, 'zimmer', l.zimmer);
end $function$;

create or replace function public.bewerbung_einreichen(p_token uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  neue_id uuid;
  v_sig text := nullif(p->>'unterschrift_data','');
  v_personen int;
  v_einkommen numeric;
  anzahl int;
begin
  select bl.id, bl.user_id, bl.prop_id into l
  from bewerber_links bl where bl.token = p_token and bl.aktiv;
  if not found then return jsonb_build_object('error','Link ungültig oder deaktiviert.'); end if;
  if coalesce(trim(p->>'name'),'') = '' then return jsonb_build_object('error','Name fehlt.'); end if;

  -- Unterschrift: nur PNG-Data-URL, max. 200 kB
  if v_sig is not null and (v_sig not like 'data:image/png;base64,%' or length(v_sig) > 200000) then
    return jsonb_build_object('error','Ungültige Unterschrift.');
  end if;

  -- Wertebereiche (Client-Grenzen serverseitig durchsetzen)
  v_personen := nullif(p->>'personen','')::int;
  if v_personen is not null and (v_personen < 1 or v_personen > 20) then
    return jsonb_build_object('error','Ungültige Personenzahl.');
  end if;
  v_einkommen := nullif(p->>'netto_einkommen','')::numeric;
  if v_einkommen is not null and (v_einkommen < 0 or v_einkommen > 1000000) then
    return jsonb_build_object('error','Ungültiges Einkommen.');
  end if;

  -- Mengenbremse je Link: max. 30 Bewerbungen pro Stunde (Flood-Schutz)
  select count(*) into anzahl from bewerbungen
    where link_id = l.id and created_at > now() - interval '1 hour';
  if anzahl >= 30 then
    return jsonb_build_object('error','Zu viele Bewerbungen — bitte später erneut versuchen.');
  end if;

  insert into bewerbungen (link_id, user_id, prop_id, name, email, telefon, einzug_ab, personen,
    beruf, arbeitgeber, netto_einkommen, raucher, haustiere, schufa, nachricht, unterschrift_data)
  values (
    l.id, l.user_id, l.prop_id,
    left(trim(p->>'name'), 200),
    left(nullif(trim(p->>'email'),''), 200),
    left(nullif(trim(p->>'telefon'),''), 50),
    nullif(p->>'einzug_ab','')::date,
    v_personen,
    left(nullif(trim(p->>'beruf'),''), 200),
    left(nullif(trim(p->>'arbeitgeber'),''), 200),
    v_einkommen,
    nullif(p->>'raucher','')::boolean,
    left(nullif(trim(p->>'haustiere'),''), 200),
    nullif(p->>'schufa','')::boolean,
    left(nullif(trim(p->>'nachricht'),''), 2000),
    v_sig
  ) returning id into neue_id;
  return jsonb_build_object('ok', true, 'id', neue_id);
exception when others then
  return jsonb_build_object('error','Bewerbung konnte nicht gespeichert werden.');
end $function$;

create or replace function public.auftrag_public_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  a record;
begin
  select au.titel, au.beschreibung, au.objekt_name, au.vermieter_name, au.termin, au.status,
         m.vorname, m.nachname, m.telefon, m.email
    into a
  from auftraege au
  left join mieter m on m.id = au.mieter_id
  where au.public_token = p_token
    and au.status in ('offen','angenommen');
  if not found then return null; end if;
  return jsonb_build_object(
    'titel', a.titel,
    'beschreibung', a.beschreibung,
    'objekt', a.objekt_name,
    'vermieter', a.vermieter_name,
    'termin', a.termin,
    'mieter_name', nullif(trim(coalesce(a.vorname,'') || ' ' || coalesce(a.nachname,'')), ''),
    'mieter_telefon', a.telefon,
    'mieter_email', a.email
  );
end $function$;

create or replace function public.beleihung_public_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  f record;
  prop jsonb;
  dokliste jsonb;
  v_miete numeric;
  v_restschuld numeric;
  v_absender text;
begin
  select * into f from beleihung_freigaben
    where token = p_token and aktiv and ablauf > now();
  if not found then return null; end if;

  select to_jsonb(p) into prop from (
    select bezeichnung, adresse, typ, baujahr, flaeche, zimmer, energieklasse, kaufpreis, wert, miete
    from properties where id = f.prop_id
  ) p;

  select coalesce(sum(kaltmiete), 0) into v_miete
    from mieter where prop_id = f.prop_id and (mietende is null or mietende >= current_date);
  select coalesce(sum(coalesce(restschuld, betrag, 0)), 0) into v_restschuld
    from kredite where prop_id = f.prop_id;
  select name into v_absender from vermieter_profil where user_id = f.user_id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_key', d.item_key, 'datei_name', d.datei_name,
           'datei_type', d.datei_type, 'datei_size', d.datei_size)
           order by d.item_key), '[]'::jsonb)
    into dokliste
    from beleihung_dokumente d
    where d.prop_id = f.prop_id and d.user_id = f.user_id
      and d.item_key = any(f.item_keys) and d.datei_data is not null;

  return jsonb_build_object(
    'objekt', prop, 'miete_mo', v_miete, 'restschuld', v_restschuld,
    'absender', v_absender, 'angaben', f.angaben, 'ablauf', f.ablauf,
    'dokumente', dokliste);
end $function$;

create or replace function public.beleihung_public_datei(p_token uuid, p_item_key text)
returns table(datei_name text, datei_type text, datei_data text)
language sql security definer set search_path to 'public' as $function$
  select d.datei_name, d.datei_type, d.datei_data
  from beleihung_freigaben f
  join beleihung_dokumente d
    on d.prop_id = f.prop_id and d.user_id = f.user_id and d.item_key = p_item_key
  where f.token = p_token and f.aktiv and f.ablauf > now()
    and p_item_key = any(f.item_keys) and d.datei_data is not null
  limit 1
$function$;

create or replace function public.beleihung_public_rueckmeldung(
  p_token uuid, p_name text, p_bank text, p_kontakt text, p_nachricht text, p_fehlend text[])
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare
  f record;
  cnt_hour int;
  cnt_total int;
begin
  select * into f from beleihung_freigaben
    where token = p_token and aktiv and ablauf > now();
  if not found then return false; end if;

  select count(*) into cnt_hour from beleihung_rueckmeldungen
    where token = p_token and created_at > now() - interval '1 hour';
  select count(*) into cnt_total from beleihung_rueckmeldungen where token = p_token;
  if cnt_hour >= 5 or cnt_total >= 50 then
    raise exception 'Zu viele Rückmeldungen — bitte später erneut versuchen.';
  end if;

  insert into beleihung_rueckmeldungen (token, name, bank, kontakt, nachricht, fehlend)
  values (p_token, left(p_name, 200), left(p_bank, 200), left(p_kontakt, 300),
          left(p_nachricht, 4000), (select array_agg(left(x, 100)) from unnest(coalesce(p_fehlend, '{}')) x));
  return true;
end $function$;


-- =============================================================================
-- 9. Trigger
-- =============================================================================

drop trigger if exists trg_anliegen_mieter_spaltenschutz on public.anliegen;
create trigger trg_anliegen_mieter_spaltenschutz
  before update on public.anliegen
  for each row execute function public.anliegen_mieter_spaltenschutz();

drop trigger if exists auftraege_spaltenschutz on public.auftraege;
create trigger auftraege_spaltenschutz
  before update on public.auftraege
  for each row execute function public.auftraege_service_spaltenschutz();

drop trigger if exists on_auth_user_created_rolle on auth.users;
create trigger on_auth_user_created_rolle
  after insert on auth.users
  for each row execute function public.handle_new_user_rolle();
