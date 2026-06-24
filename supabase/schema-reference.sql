-- =====================================================================
-- MyImmo — REFERENZ des BESTEHENDEN Supabase-Schemas
-- =====================================================================
-- ⚠️  NICHT AUSFÜHREN. Diese Datei dokumentiert nur, was bereits in der
--     produktiven Datenbank existiert (mit echten Daten). Sie dient als
--     Nachschlagewerk für die App-Entwicklung.
--
-- Projekt: kozhxrvyilkchjpcuwcm (eu-central-1)
-- Besitzspalte überall: user_id -> auth.users(id), RLS aktiv.
-- =====================================================================

-- properties (9 Zeilen) — Immobilien/Objekte
--   id uuid pk, user_id uuid, bezeichnung text, typ text, adresse text,
--   kaufpreis numeric, wert numeric, flaeche numeric, baujahr int,
--   miete numeric, hausgeld numeric, obj_status text ('Leer'),
--   zimmer numeric, energieklasse text, notiz_import text,
--   created_at timestamptz, updated_at timestamptz

-- mieter (6 Zeilen) — Mieter, prop_id -> properties.id
--   id, user_id, prop_id, vorname, nachname, email, telefon,
--   mieter_adresse, einheit, mietbeginn date, mietende date,
--   kuendigung int (3), kaltmiete numeric, nk_vorauszahlung numeric,
--   kaution numeric, kaution_status text ('nein'), kaution_bank text,
--   mietspiegel numeric, flaeche numeric, notiz text, miethistorie text,
--   letzte_erhoehung date, mietart text, staffel_datum date,
--   staffel_betrag numeric, staffel_intervall text, created_at

-- einnahmen (337) — prop_id, buchungsdatum, kategorie, betrag,
--   beschreibung, wiederkehrend bool

-- kosten (329) — prop_id, mieter_id, buchungsdatum, kategorie, betrag,
--   beschreibung, notiz, wiederkehrend, rechnung_* (Datei als base64)

-- verbrauch (1) — prop_id, buchungsdatum, art, menge, einheit, verbrauchkosten

-- kredite (1) — prop_id, bezeichnung, bank, darlnr, betrag, restschuld,
--   grundschuld, beleihung, zinssatz, tilgungssatz, monatsrate,
--   zinsbindung date, laufzeit int

-- notizen (1) — prop_id, titel, kategorie, inhalt, datei_* (base64)

-- termine (0) — prop_id text, titel, datum date, notiz

-- ibans (1) — kontoname, inhaber, iban

-- dokument_vorlagen — gespeicherte Standardtexte für den Dokument-Generator
--   id uuid pk, user_id uuid, art text (Dokumentart-Key), text text (Vorlage
--   mit {{platzhalter}}), created_at, updated_at; unique(user_id, art),
--   RLS: auth.uid() = user_id (analog ibans).

-- =====================================================================
-- Beobachtungen / mögliche Verbesserungen (für später, nicht jetzt):
--  * kosten.mieter_id ist text, mieter.id ist uuid -> Typ-Mismatch,
--    keine FK. Bei Gelegenheit angleichen.
--  * termine.prop_id ist text statt uuid (keine FK).
--  * Dateien liegen als base64-Text in kosten.rechnung_data /
--    notizen.datei_data. Für große Dateien besser Supabase Storage.
-- =====================================================================
