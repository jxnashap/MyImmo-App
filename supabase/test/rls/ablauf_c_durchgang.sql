-- Ablauf C – Anliegen → Hausmeister → Fachbetrieb-Vorschlag → Freigabe → Erledigung → Kosten → Rückmeldung
-- (11.10.2026). Durchgang mit echten Rollen: jede Station als die Person, die sie im Alltag tut.
-- Dazu die Sicherheitslücke aus Befund 1: Bezüge eines Auftrags müssen demselben Vermieter gehören.
begin;
select pruef.konto('v'); select pruef.konto('m'); select pruef.konto('h'); select pruef.konto('w');
insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
  values (pruef.id('v'), true, true, 'registrierung'), (pruef.id('w'), true, true, 'registrierung');
insert into public.nutzer_rollen (user_id, rolle) values (pruef.id('m'), 'mieter'), (pruef.id('h'), 'service');
insert into public.properties (id, user_id, bezeichnung) values
  ('c0c0c0c0-0000-0000-0000-0000000000a1', pruef.id('v'), 'Haus V'),
  ('c0c0c0c0-0000-0000-0000-0000000000a2', pruef.id('w'), 'Haus W');
insert into public.mieter (id, user_id, prop_id, vorname, nachname, telefon, email, mietbeginn) values
  ('c0c0c0c0-0000-0000-0000-0000000000b1', pruef.id('v'), 'c0c0c0c0-0000-0000-0000-0000000000a1', 'Mia', 'Muster', '0170 1', 'mia@example.org', '2024-01-01'),
  ('c0c0c0c0-0000-0000-0000-0000000000b2', pruef.id('w'), 'c0c0c0c0-0000-0000-0000-0000000000a2', 'Wim', 'Fremd', '0170 2', 'wim@example.org', '2024-01-01');
insert into public.mieter_zugaenge (user_id, vermieter_id, mieter_id, prop_id, email)
  values (pruef.id('m'), pruef.id('v'), 'c0c0c0c0-0000-0000-0000-0000000000b1', 'c0c0c0c0-0000-0000-0000-0000000000a1', 'mia@example.org');
insert into public.service_zugaenge (user_id, vermieter_id, rolle) values (pruef.id('h'), pruef.id('v'), 'hausmeister');
insert into public.service_objekte (vermieter_id, service_user_id, prop_id) values (pruef.id('v'), pruef.id('h'), 'c0c0c0c0-0000-0000-0000-0000000000a1');
insert into public.firmen (id, user_id, name) values
  ('c0c0c0c0-0000-0000-0000-0000000000f1', pruef.id('v'), 'Heizung Böhm'),
  ('c0c0c0c0-0000-0000-0000-0000000000f2', pruef.id('w'), 'Fremdfirma');

-- 1. Mieterin meldet.
select pruef.als('m');
insert into public.anliegen (id, vermieter_id, mieter_id, mieter_user_id, prop_id, typ, titel, beschreibung)
  values ('c0c0c0c0-0000-0000-0000-0000000000c1', pruef.id('v'), 'c0c0c0c0-0000-0000-0000-0000000000b1', pruef.id('m'),
          'c0c0c0c0-0000-0000-0000-0000000000a1', 'schaden', 'Heizung kalt', 'Seit gestern');
select pruef.zurueck();

-- 2. Vermieter sieht es und gibt es dem Hausmeister.
select pruef.als('v');
select pruef.ja(pruef.zeilen($$select 1 from public.anliegen where id = 'c0c0c0c0-0000-0000-0000-0000000000c1'$$) = 1, 'Vermieter sieht das Anliegen');
insert into public.auftraege (id, vermieter_id, service_user_id, anliegen_id, prop_id, mieter_id, titel, status, erstellt_von)
  values ('c0c0c0c0-0000-0000-0000-0000000000d1', pruef.id('v'), pruef.id('h'), 'c0c0c0c0-0000-0000-0000-0000000000c1',
          'c0c0c0c0-0000-0000-0000-0000000000a1', 'c0c0c0c0-0000-0000-0000-0000000000b1', 'Heizung prüfen', 'offen', 'vermieter');
update public.anliegen set status = 'in_arbeit' where id = 'c0c0c0c0-0000-0000-0000-0000000000c1';
select pruef.zurueck();

-- 3. Mieterin sieht: zuständig ist der Hausmeister — nicht, wer genau, und keine Beträge.
select pruef.als('m');
select pruef.ja((select zustaendig from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1' and art = 'auftrag'
                  order by created_at desc limit 1) = 'hausmeister', 'Mieterin sieht: Hausmeister zuständig');
select pruef.ja((select text from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1' and art = 'auftrag'
                  order by created_at desc limit 1) = 'Der Hausmeister kümmert sich darum.', 'Text nennt die Rolle');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege$$) = 0, 'Mieterin liest keine Aufträge (Firma, Betrag bleiben beim Vermieter)');
select pruef.zurueck();

-- 4. Hausmeister: angenommen, dann „Fachbetrieb nötig“ mit Vorschlag aus dem Verzeichnis.
select pruef.als('h');
update public.auftraege set status = 'angenommen' where id = 'c0c0c0c0-0000-0000-0000-0000000000d1';
select pruef.ja(public.auftrag_fachbetrieb_vorschlagen('c0c0c0c0-0000-0000-0000-0000000000d1', 'c0c0c0c0-0000-0000-0000-0000000000f1', 450, 'Brenner defekt, Gas'), 'Hausmeister schlägt Fachbetrieb vor');
select pruef.ja(pruef.betroffen($$update public.auftraege set firma_id = 'c0c0c0c0-0000-0000-0000-0000000000f1', status = 'offen' where id = 'c0c0c0c0-0000-0000-0000-0000000000d1'$$) = 0, 'Hausmeister gibt nicht selbst frei');
select pruef.zurueck();
select pruef.ja((select status from public.auftraege where id = 'c0c0c0c0-0000-0000-0000-0000000000d1') = 'freigabe', 'Auftrag wartet auf Freigabe');

-- 5. Vermieter gibt frei (Firma aus dem Vorschlag) und schließt nach der Rechnung ab; Kosten genau einmal.
select pruef.als('v');
update public.auftraege set status = 'offen', firma_id = vorgeschlagene_firma_id where id = 'c0c0c0c0-0000-0000-0000-0000000000d1' and status = 'freigabe';
update public.auftraege set status = 'erledigt', betrag = 480 where id = 'c0c0c0c0-0000-0000-0000-0000000000d1';
insert into public.kosten (user_id, prop_id, buchungsdatum, kategorie, betrag, auftrag_id)
  values (pruef.id('v'), 'c0c0c0c0-0000-0000-0000-0000000000a1', '2026-10-11', 'Reparatur', 480, 'c0c0c0c0-0000-0000-0000-0000000000d1');
select pruef.wirft($$insert into public.kosten (user_id, prop_id, buchungsdatum, kategorie, betrag, auftrag_id)
  values (pruef.id('v'), 'c0c0c0c0-0000-0000-0000-0000000000a1', '2026-10-11', 'Reparatur', 480, 'c0c0c0c0-0000-0000-0000-0000000000d1')$$, 'Kosten je Auftrag nur einmal');
update public.anliegen set status = 'erledigt' where id = 'c0c0c0c0-0000-0000-0000-0000000000c1';
select pruef.zurueck();

-- 6. Rückmeldung im Portal: der ganze Weg, in der richtigen Reihenfolge, mit Zuständigkeit.
select pruef.als('m');
select pruef.ja(
  (select string_agg(coalesce(text, 'Status ' || status_neu) || coalesce(' [' || zustaendig || ']', ''), ' → ' order by created_at, id)
     from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1' and art in ('auftrag', 'status'))
  is not null, 'Verlauf lesbar');
select pruef.ja(pruef.zeilen($$select 1 from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1'
  and art = 'auftrag' and text = 'Der Auftrag ist erledigt.' and zustaendig = 'handwerker'$$) = 1, 'Erledigung (Fachbetrieb) im Verlauf');
select pruef.ja(pruef.zeilen($$select 1 from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1'
  and art = 'auftrag' and text = 'Der Auftrag wartet auf die Freigabe des Vermieters.'$$) = 1, 'Freigabe-Schritt im Verlauf');
select pruef.ja(pruef.zeilen($$select 1 from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1'
  and art = 'status' and status_neu = 'erledigt'$$) = 1, 'Anliegen erledigt im Verlauf');
select pruef.ja(pruef.zeilen($$select 1 from public.kosten$$) = 0, 'Mieterin sieht keine Kosten');
select pruef.zurueck();

-- 7. Befund 1: Ein FREMDER Vermieter kann keinen Auftrag an fremde Bezüge hängen.
select pruef.als('w');
select pruef.wirft($$insert into public.auftraege (vermieter_id, titel, anliegen_id) values (pruef.id('w'), 'X', 'c0c0c0c0-0000-0000-0000-0000000000c1')$$, 'fremdes Anliegen');
select pruef.wirft($$insert into public.auftraege (vermieter_id, titel, mieter_id) values (pruef.id('w'), 'X', 'c0c0c0c0-0000-0000-0000-0000000000b1')$$, 'fremder Mieter');
select pruef.wirft($$insert into public.auftraege (vermieter_id, titel, prop_id) values (pruef.id('w'), 'X', 'c0c0c0c0-0000-0000-0000-0000000000a1')$$, 'fremdes Objekt');
select pruef.wirft($$insert into public.auftraege (vermieter_id, titel, firma_id) values (pruef.id('w'), 'X', 'c0c0c0c0-0000-0000-0000-0000000000f1')$$, 'fremde Firma');
insert into public.auftraege (id, vermieter_id, titel, mieter_id, prop_id, firma_id, status)
  values ('c0c0c0c0-0000-0000-0000-0000000000d2', pruef.id('w'), 'Eigener Auftrag', 'c0c0c0c0-0000-0000-0000-0000000000b2',
          'c0c0c0c0-0000-0000-0000-0000000000a2', 'c0c0c0c0-0000-0000-0000-0000000000f2', 'offen');
select pruef.ja(true, 'eigene Bezüge gehen');
select pruef.wirft($$update public.auftraege set mieter_id = 'c0c0c0c0-0000-0000-0000-0000000000b1' where id = 'c0c0c0c0-0000-0000-0000-0000000000d2'$$, 'auch nicht nachträglich umhängen');
select pruef.zurueck();
select pruef.ja(pruef.zeilen($$select 1 from public.anliegen_ereignisse where anliegen_id = 'c0c0c0c0-0000-0000-0000-0000000000c1' and autor_id = pruef.id('w')$$) = 0,
  'kein fremder Eintrag im Verlauf der Mieterin');

-- 8. Öffentlicher Link: Mieterkontakt nur vom EIGENEN Mieter (Altbestand mit fremdem Bezug simuliert).
-- Altbestand simulieren: ALLE Trigger aus (auch der Spaltenschutz, der mieter_id sonst zurücksetzt).
set local session_replication_role = replica;
update public.auftraege set mieter_id = 'c0c0c0c0-0000-0000-0000-0000000000b1', public_token_ablauf = now() + interval '30 days'
 where id = 'c0c0c0c0-0000-0000-0000-0000000000d2';
set local session_replication_role = origin;
select pruef.ja((select mieter_id from public.auftraege where id = 'c0c0c0c0-0000-0000-0000-0000000000d2') = 'c0c0c0c0-0000-0000-0000-0000000000b1', 'Altbestand mit fremdem Mieter steht (Probe sieht hin)');
update public.auftraege set public_token_ablauf = now() + interval '30 days', status = 'offen' where id = 'c0c0c0c0-0000-0000-0000-0000000000d1';
-- Token VOR dem Rollenwechsel holen (als anon wäre die Abfrage leer und die Probe blind).
select set_config('pruef.token_fremd', (select public_token::text from public.auftraege where id = 'c0c0c0c0-0000-0000-0000-0000000000d2'), true);
select set_config('pruef.token_eigen', (select public_token::text from public.auftraege where id = 'c0c0c0c0-0000-0000-0000-0000000000d1'), true);
select pruef.als_anon();
select pruef.ja(public.auftrag_public_info(current_setting('pruef.token_fremd')::uuid) is not null, 'Link mit fremdem Bezug liefert Auftragsdaten (Probe sieht hin)');
select pruef.ja((public.auftrag_public_info(current_setting('pruef.token_fremd')::uuid) ->> 'mieter_telefon') is null,
  'kein fremder Mieterkontakt über den Auftrags-Link');
select pruef.ja((public.auftrag_public_info(current_setting('pruef.token_eigen')::uuid) ->> 'mieter_telefon') = '0170 1',
  'Gegenprobe: eigener Mieterkontakt kommt an');
select pruef.zurueck();

-- 9. Berechtigung entzogen: Der Hausmeister sieht und bearbeitet nichts mehr.
select pruef.als('v');
delete from public.service_zugaenge where vermieter_id = pruef.id('v') and user_id = pruef.id('h');
select pruef.zurueck();
select pruef.als('h');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege$$) = 0, 'nach Entzug: keine Aufträge sichtbar');
select pruef.ja(not public.auftrag_fachbetrieb_vorschlagen('c0c0c0c0-0000-0000-0000-0000000000d1', null, null, 'nochmal'), 'nach Entzug: kein Vorschlag mehr');
select pruef.zurueck();
rollback;
