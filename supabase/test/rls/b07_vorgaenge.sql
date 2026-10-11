-- B07 – je Geschäftsvorgang höchstens eine Buchung (11.10.2026). Geprüft wird an der Datenbank, was
-- auch bei zwei gleichzeitigen Anfragen gilt — die Actions verlassen sich darauf.
begin;
select pruef.konto('v'); select pruef.konto('w');
insert into public.properties (id, user_id, bezeichnung) values ('44444444-0000-0000-0000-000000000001', pruef.id('v'), 'Haus');
insert into public.mieter (id, user_id, prop_id, nachname) values ('55555555-0000-0000-0000-000000000001', pruef.id('v'), '44444444-0000-0000-0000-000000000001', 'Muster');
-- Anliegen legt der Mieter an (Regel) — hier als Aufbau.
insert into public.anliegen (id, vermieter_id, mieter_id, titel) values ('99999999-0000-0000-0000-000000000001', pruef.id('v'), '55555555-0000-0000-0000-000000000001', 'Heizung');

select pruef.als('v');
-- Zahlungskennung: derselbe Vorgang nur einmal, verschiedene Teilzahlungen im selben Monat erlaubt.
insert into public.einnahmen (user_id, mieter_id, buchungsdatum, kategorie, betrag, soll_monat, zahlung_ref)
  values (pruef.id('v'), '55555555-0000-0000-0000-000000000001', '2026-10-02', 'Miete', 400, '2026-10', 'ka:abc');
select pruef.wirft($$insert into public.einnahmen (user_id, mieter_id, buchungsdatum, kategorie, betrag, soll_monat, zahlung_ref)
  values (pruef.id('v'), '55555555-0000-0000-0000-000000000001', '2026-10-02', 'Miete', 400, '2026-10', 'ka:abc')$$, 'derselbe Zahlungsvorgang kein zweites Mal');
select pruef.ja(pruef.betroffen($$insert into public.einnahmen (user_id, mieter_id, buchungsdatum, kategorie, betrag, soll_monat, zahlung_ref)
  values (pruef.id('v'), '55555555-0000-0000-0000-000000000001', '2026-10-02', 'Miete', 400, '2026-10', 'ka:abc')
  on conflict (user_id, zahlung_ref) do nothing$$) = 0, 'upsert/ignoreDuplicates überspringt still');
insert into public.einnahmen (user_id, mieter_id, buchungsdatum, kategorie, betrag, soll_monat, zahlung_ref)
  values (pruef.id('v'), '55555555-0000-0000-0000-000000000001', '2026-10-15', 'Miete', 500, '2026-10', 'ka:def');
select pruef.ja(pruef.zeilen($$select 1 from public.einnahmen where soll_monat = '2026-10'$$) = 2, 'zweite Teilzahlung im selben Monat ist erlaubt');
-- Buchungen ohne Kennung (Altbestand, manuell) sind nicht betroffen.
insert into public.einnahmen (user_id, buchungsdatum, kategorie, betrag) values (pruef.id('v'), '2026-10-01', 'Sonstiges', 10), (pruef.id('v'), '2026-10-01', 'Sonstiges', 10);
select pruef.ja(true, 'zwei Buchungen ohne Kennung bleiben möglich (NULL ist verschieden)');

-- Wiederkehrende Buchung: je Vorlage und Termin eine.
insert into public.wiederkehrende_buchungen (id, user_id, art, kategorie, betrag, zyklus, start_datum)
  values ('66666666-0000-0000-0000-000000000001', pruef.id('v'), 'kosten', 'Versicherung', 50, 'monatlich', '2026-01-01');
insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, wiederkehr_id) values (pruef.id('v'), '2026-01-01', 'Versicherung', 50, '66666666-0000-0000-0000-000000000001');
select pruef.wirft($$insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, wiederkehr_id) values (pruef.id('v'), '2026-01-01', 'Versicherung', 50, '66666666-0000-0000-0000-000000000001')$$, 'derselbe Termin einer Vorlage kein zweites Mal');

-- Auftrag → Kosten: je Auftrag eine Buchung.
insert into public.auftraege (id, vermieter_id, titel, status, erstellt_von) values ('77777777-0000-0000-0000-000000000001', pruef.id('v'), 'Rinne', 'erledigt', 'vermieter');
insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, auftrag_id) values (pruef.id('v'), '2026-02-01', 'Reparatur', 120, '77777777-0000-0000-0000-000000000001');
select pruef.wirft($$insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, auftrag_id) values (pruef.id('v'), '2026-02-01', 'Reparatur', 120, '77777777-0000-0000-0000-000000000001')$$, 'derselbe Auftrag kein zweites Mal als Kosten');

-- Zählermeldung → Verbrauch: je Meldung einer.
insert into public.verbrauch (user_id, buchungsdatum, art, menge, meldung_id) values (pruef.id('v'), '2026-03-01', 'Strom', 10, '88888888-0000-0000-0000-000000000001');
select pruef.wirft($$insert into public.verbrauch (user_id, buchungsdatum, art, menge, meldung_id) values (pruef.id('v'), '2026-03-01', 'Strom', 10, '88888888-0000-0000-0000-000000000001')$$, 'dieselbe Zählermeldung kein zweites Mal');

-- Angebotsanfrage: je Vorgang und Firma eine LAUFENDE; nach Abschluss wieder möglich.
insert into public.firmen (id, user_id, name) values ('aaaaaaaa-1111-0000-0000-000000000001', pruef.id('v'), 'Firma');
insert into public.angebotsanfragen (id, vermieter_id, anliegen_id, firma_id, titel)
  values ('bbbbbbbb-1111-0000-0000-000000000001', pruef.id('v'), '99999999-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'Heizung');
select pruef.wirft($$insert into public.angebotsanfragen (vermieter_id, anliegen_id, firma_id, titel)
  values (pruef.id('v'), '99999999-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'Heizung')$$, 'keine zweite laufende Anfrage an dieselbe Firma');
update public.angebotsanfragen set status = 'zurueckgezogen' where id = 'bbbbbbbb-1111-0000-0000-000000000001';
insert into public.angebotsanfragen (vermieter_id, anliegen_id, firma_id, titel)
  values (pruef.id('v'), '99999999-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'Heizung');
select pruef.ja(true, 'nach Zurückziehen ist eine neue Anfrage möglich');
select pruef.zurueck();

-- Mandanten getrennt: Dieselbe Kennung bei einem ANDEREN Konto ist kein Konflikt.
select pruef.als('w');
insert into public.einnahmen (user_id, buchungsdatum, kategorie, betrag, zahlung_ref) values (pruef.id('w'), '2026-10-02', 'Miete', 1, 'ka:abc');
select pruef.ja(true, 'gleiche Kennung bei einem anderen Konto erlaubt');
select pruef.zurueck();

-- Die Angebotsgrenze bei GLEICHZEITIGEN Abgaben prüft scripts/db/nebenlaeufig.sh mit zwei Sitzungen.

rollback;
