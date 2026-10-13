-- Restlücken (13.10.2026): Termin-Bezüge nur eigene; „Angebot beauftragen“ in EINER Transaktion.
begin;
select pruef.konto('v'); select pruef.konto('w'); select pruef.konto('m');
insert into public.properties (id, user_id, bezeichnung) values
  ('e1e1e1e1-0000-0000-0000-0000000000a1', pruef.id('v'), 'Haus V'),
  ('e1e1e1e1-0000-0000-0000-0000000000a3', pruef.id('v'), 'Garage V (wird gelöscht)'),
  ('e1e1e1e1-0000-0000-0000-0000000000a2', pruef.id('w'), 'Haus W');
insert into public.mieter (id, user_id, prop_id, vorname, nachname, mietbeginn) values
  ('e1e1e1e1-0000-0000-0000-0000000000b1', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000a1', 'Mia', 'Muster', '2024-01-01'),
  ('e1e1e1e1-0000-0000-0000-0000000000b2', pruef.id('w'), 'e1e1e1e1-0000-0000-0000-0000000000a2', 'Wim', 'Fremd', '2024-01-01');

-- ---- Termine: Bezüge nur aus dem eigenen Konto ------------------------------------------------
select pruef.als('v');
insert into public.termine (id, user_id, titel, datum, prop_id, mieter_id) values
  ('e1e1e1e1-0000-0000-0000-000000000011', pruef.id('v'), 'Rauchmelder', '2026-11-01', 'e1e1e1e1-0000-0000-0000-0000000000a1', 'e1e1e1e1-0000-0000-0000-0000000000b1'),
  ('e1e1e1e1-0000-0000-0000-000000000012', pruef.id('v'), 'Garage prüfen', '2026-11-02', 'e1e1e1e1-0000-0000-0000-0000000000a3', null);
select pruef.ja(pruef.zeilen($$select 1 from public.termine where user_id = pruef.id('v')$$) = 2, 'eigene Bezüge: Termin angelegt');
select pruef.wirft($$insert into public.termine (user_id, titel, datum, prop_id) values (pruef.id('v'), 'x', '2026-11-03', 'e1e1e1e1-0000-0000-0000-0000000000a2')$$, 'fremdes Objekt wird abgelehnt');
select pruef.wirft($$insert into public.termine (user_id, titel, datum, mieter_id) values (pruef.id('v'), 'x', '2026-11-03', 'e1e1e1e1-0000-0000-0000-0000000000b2')$$, 'fremder Mieter wird abgelehnt');
select pruef.wirft($$update public.termine set mieter_id = 'e1e1e1e1-0000-0000-0000-0000000000b2' where id = 'e1e1e1e1-0000-0000-0000-000000000011'$$, 'Umhängen auf fremden Mieter wird abgelehnt');
select pruef.wirft($$update public.termine set prop_id = 'e1e1e1e1-0000-0000-0000-0000000000a2' where id = 'e1e1e1e1-0000-0000-0000-000000000011'$$, 'Umhängen auf fremdes Objekt wird abgelehnt');
select pruef.ja(pruef.betroffen($$update public.termine set titel = 'Rauchmelder prüfen' where id = 'e1e1e1e1-0000-0000-0000-000000000011'$$) = 1, 'Ändern ohne Bezugswechsel geht weiter');
select pruef.zurueck();
-- Löschen des eigenen Objekts setzt den Bezug auf NULL (Fremdschlüssel) — der Trigger stört dabei nicht.
delete from public.properties where id = 'e1e1e1e1-0000-0000-0000-0000000000a3';
select pruef.ja((select prop_id is null from public.termine where id = 'e1e1e1e1-0000-0000-0000-000000000012'), 'Objekt gelöscht: Termin bleibt ohne Objekt');

-- ---- Angebot beauftragen -----------------------------------------------------------------------
insert into public.firmen (id, user_id, name) values
  ('e1e1e1e1-0000-0000-0000-0000000000f1', pruef.id('v'), 'Dach Böhm'),
  ('e1e1e1e1-0000-0000-0000-0000000000f2', pruef.id('v'), 'Dach Krause');
insert into public.anliegen (id, vermieter_id, mieter_id, mieter_user_id, prop_id, typ, titel) values
  ('e1e1e1e1-0000-0000-0000-0000000000c1', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000b1', pruef.id('m'), 'e1e1e1e1-0000-0000-0000-0000000000a1', 'schaden', 'Dach undicht'),
  ('e1e1e1e1-0000-0000-0000-0000000000c2', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000b1', pruef.id('m'), 'e1e1e1e1-0000-0000-0000-0000000000a1', 'schaden', 'Rinne');
insert into public.angebotsanfragen (id, vermieter_id, anliegen_id, firma_id, titel, objekt, absender) values
  ('e1e1e1e1-0000-0000-0000-0000000000d1', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000c1', 'e1e1e1e1-0000-0000-0000-0000000000f1', 'Dach undicht', 'Haus V', 'Vera Vermieter'),
  ('e1e1e1e1-0000-0000-0000-0000000000d2', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000c1', 'e1e1e1e1-0000-0000-0000-0000000000f2', 'Dach undicht', 'Haus V', 'Vera Vermieter'),
  ('e1e1e1e1-0000-0000-0000-0000000000d3', pruef.id('v'), 'e1e1e1e1-0000-0000-0000-0000000000c2', 'e1e1e1e1-0000-0000-0000-0000000000f1', 'SCHEITERT', 'Haus V', '');
insert into public.angebote (id, anfrage_id, firma, betrag, termin) values
  ('e1e1e1e1-0000-0000-0000-0000000000e1', 'e1e1e1e1-0000-0000-0000-0000000000d1', 'Dach Böhm', 480.50, '2026-11-10'),
  ('e1e1e1e1-0000-0000-0000-0000000000e2', 'e1e1e1e1-0000-0000-0000-0000000000d2', 'Dach Krause', 520, null),
  ('e1e1e1e1-0000-0000-0000-0000000000e3', 'e1e1e1e1-0000-0000-0000-0000000000d3', 'Dach Böhm', 90, null);

select pruef.als_anon();
select pruef.wirft($$select public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e1', false, null)$$, 'anon darf nicht beauftragen');
select pruef.zurueck();

select pruef.als('w');
select pruef.ja(public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e1', true, null) ->> 'error' = 'Angebot nicht gefunden.', 'fremdes Konto: Angebot unsichtbar');
select pruef.zurueck();
select pruef.ja((select status from public.angebotsanfragen where id = 'e1e1e1e1-0000-0000-0000-0000000000d1') = 'angefragt', 'fremder Versuch ändert nichts');

select pruef.als('v');
select pruef.ja((public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e1', true, 'vera@example.org') ->> 'ok')::boolean, 'Vermieter beauftragt Angebot 1');
select pruef.ja((select count(*) from public.auftraege where anliegen_id = 'e1e1e1e1-0000-0000-0000-0000000000c1') = 1, 'genau ein Auftrag');
select pruef.ja((select firma_id = 'e1e1e1e1-0000-0000-0000-0000000000f1' and status = 'offen' and erstellt_von = 'vermieter'
                        and kosten_schaetzung = 480.50 and termin = '2026-11-10' and mieter_id = 'e1e1e1e1-0000-0000-0000-0000000000b1'
                        and prop_id = 'e1e1e1e1-0000-0000-0000-0000000000a1' and vermieter_name = 'Vera Vermieter' and service_user_id is null
                   from public.auftraege where anliegen_id = 'e1e1e1e1-0000-0000-0000-0000000000c1'), 'Auftrag trägt Firma, Betrag, Termin, Objekt, Mieter (Haken), Absender');
select pruef.ja((select status = 'beauftragt' and auftrag_id is not null from public.angebotsanfragen where id = 'e1e1e1e1-0000-0000-0000-0000000000d1'), 'Anfrage beauftragt und verknüpft');
select pruef.ja((select status from public.angebotsanfragen where id = 'e1e1e1e1-0000-0000-0000-0000000000d2') = 'abgelehnt', 'übrige Anfrage des Vorgangs abgelehnt');
select pruef.ja(public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e1', true, null) ->> 'error' = 'Für diese Anfrage wurde schon entschieden.', 'zweiter Klick: schon entschieden');
select pruef.ja(public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e2', true, null) ->> 'error' = 'Für diese Anfrage wurde schon entschieden.', 'zweite Firma desselben Vorgangs: schon entschieden');
select pruef.ja((select count(*) from public.auftraege where anliegen_id = 'e1e1e1e1-0000-0000-0000-0000000000c1') = 1, 'weiterhin genau ein Auftrag');
select pruef.zurueck();

-- Scheitert das Anlegen des Auftrags, bleibt NICHTS zurück (vorher: Anfrage „beauftragt“ ohne Auftrag).
alter table public.auftraege add constraint pruef_scheitert check (titel <> 'SCHEITERT');
select pruef.als('v');
select pruef.wirft($$select public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e3', false, null)$$, 'Auftrag scheitert → Fehler');
select pruef.ja((select status = 'angefragt' and auftrag_id is null from public.angebotsanfragen where id = 'e1e1e1e1-0000-0000-0000-0000000000d3'), 'Anfrage bleibt offen, nicht „beauftragt“ ohne Auftrag');
select pruef.ja((select count(*) from public.auftraege where anliegen_id = 'e1e1e1e1-0000-0000-0000-0000000000c2') = 0, 'kein halber Auftrag');
select pruef.zurueck();
alter table public.auftraege drop constraint pruef_scheitert;
select pruef.als('v');
select pruef.ja((public.angebot_beauftragen('e1e1e1e1-0000-0000-0000-0000000000e3', false, 'vera@example.org') ->> 'ok')::boolean, 'zweiter Versuch gelingt');
select pruef.ja((select mieter_id is null and vermieter_name = 'vera@example.org' from public.auftraege where anliegen_id = 'e1e1e1e1-0000-0000-0000-0000000000c2'),
                'ohne Haken kein Mieter am Auftrag; ohne Absender die Konto-Adresse');
select pruef.zurueck();
rollback;
