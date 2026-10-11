-- B03 – Service-Widerruf (11.10.2026). Nach dem Lösen der Verknüpfung (service_zugaenge) hat der
-- Partner KEINEN Zugriff mehr auf Aufträge dieses Vermieters — auch nicht auf erledigte.
-- Entschieden: Historische Aufträge bleiben beim VERMIETER sichtbar (mit Partnername), der Partner
-- verliert jeden Lese- und Schreibzugriff. Wird er neu eingeladen, sieht er sie wieder.
begin;

select pruef.konto('v'); select pruef.konto('p'); select pruef.konto('p2'); select pruef.konto('v2');
insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
  values (pruef.id('v'), true, true, 'registrierung'), (pruef.id('v2'), true, true, 'registrierung');
insert into public.nutzer_rollen (user_id, rolle) values (pruef.id('p'), 'service'), (pruef.id('p2'), 'service');
insert into public.service_zugaenge (user_id, vermieter_id, rolle) values
  (pruef.id('p'), pruef.id('v'), 'hausmeister'), (pruef.id('p2'), pruef.id('v'), 'hausmeister'),
  (pruef.id('p'), pruef.id('v2'), 'dienstleister');
insert into public.properties (id, user_id, bezeichnung) values ('11111111-0000-0000-0000-000000000001', pruef.id('v'), 'Pruefhaus');
insert into public.service_objekte (vermieter_id, service_user_id, prop_id) values (pruef.id('v'), pruef.id('p'), '11111111-0000-0000-0000-000000000001');
insert into public.firmen (user_id, name) values (pruef.id('v'), 'Prueffirma');
insert into public.auftraege (id, vermieter_id, service_user_id, titel, status, erstellt_von) values
  ('aaaaaaaa-0000-0000-0000-000000000001', pruef.id('v'), pruef.id('p'), 'Offen', 'offen', 'vermieter'),
  ('aaaaaaaa-0000-0000-0000-000000000002', pruef.id('v'), pruef.id('p'), 'Erledigt', 'erledigt', 'vermieter'),
  ('aaaaaaaa-0000-0000-0000-000000000003', pruef.id('v'), pruef.id('p2'), 'Anderer Partner', 'offen', 'vermieter'),
  ('aaaaaaaa-0000-0000-0000-000000000004', pruef.id('v2'), pruef.id('p'), 'Anderer Vermieter', 'offen', 'vermieter');
insert into public.auftrag_notizen (auftrag_id, vermieter_id, autor_id, autor_rolle, art, text, datei_name, datei_type, datei_data)
  values ('aaaaaaaa-0000-0000-0000-000000000001', pruef.id('v'), pruef.id('p'), 'service', 'foto', 'Foto', 'f.jpg', 'image/jpeg', 'AAAA');
insert into public.auftrag_rueckmeldungen (auftrag_id, art, nachricht) values ('aaaaaaaa-0000-0000-0000-000000000001', 'zusage', 'Firma kommt');

-- Vorher (positive Gegenprobe): Der verknüpfte Partner arbeitet.
select pruef.als('p');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege where vermieter_id = pruef.id('v')$$) = 2, 'vorher: Partner sieht seine zwei Aufträge bei V');
select pruef.ja(pruef.zeilen($$select 1 from public.auftrag_notizen where auftrag_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 1, 'vorher: Partner liest Notiz/Foto');
select pruef.ja(pruef.zeilen($$select 1 from public.auftrag_rueckmeldungen where auftrag_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 1, 'vorher: Partner liest Rückmeldung');
select pruef.ja(pruef.zeilen($$select 1 from public.service_objekte_portal$$) = 1, 'vorher: Partner sieht sein Objekt');
select pruef.ja(pruef.zeilen($$select 1 from public.firmen$$) = 1, 'vorher: Hausmeister sieht das Firmenverzeichnis');
select pruef.ja(public.verlaengere_auftrag_link('aaaaaaaa-0000-0000-0000-000000000001', 30) is not null, 'vorher: Partner verlängert den Auftrags-Link');
select pruef.zurueck();

-- Widerruf durch den Vermieter (wie lib/actions/service.ts → entferneServicePartner).
select pruef.als('v');
delete from public.service_zugaenge where vermieter_id = pruef.id('v') and user_id = pruef.id('p');
select pruef.zurueck();

-- Nachher (negative Proben): kein Lesen, kein Bearbeiten, kein Kommentieren, keine Anhänge.
-- Reihenfolge mit Absicht: Notizen/Rückmeldungen zuerst — ihre Regeln haben eine eigene
-- Verknüpfungs-Prüfung (zweite Linie hinter der Auftrags-Regel); eine Kombinationsmutation
-- (Auftrags-Regel UND Notiz-Regel aufgeweicht) muss hier rot werden, nicht erst bei den Aufträgen.
select pruef.als('p');
select pruef.wirft($$insert into public.auftrag_notizen (auftrag_id, vermieter_id, autor_id, autor_rolle, art, text)
  values ('aaaaaaaa-0000-0000-0000-000000000001', pruef.id('v'), pruef.id('p'), 'service', 'notiz', 'noch da?')$$, 'nachher: keine Notiz mehr');
select pruef.ja(pruef.zeilen($$select 1 from public.auftrag_notizen where auftrag_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 0, 'nachher: Notizen und Fotos unsichtbar');
select pruef.ja(pruef.zeilen($$select 1 from public.auftrag_rueckmeldungen where auftrag_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 0, 'nachher: Firmen-Rückmeldungen unsichtbar');
-- ohne WHERE: so gilt allein die Update-Regel (mit WHERE griffe zusätzlich die Lese-Regel)
update public.auftrag_rueckmeldungen set gelesen = true;
select pruef.zurueck();
select pruef.ja((select gelesen from public.auftrag_rueckmeldungen where auftrag_id = 'aaaaaaaa-0000-0000-0000-000000000001') is not true, 'nachher: Rückmeldung nicht als gelesen markierbar');
select pruef.als('p');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege where vermieter_id = pruef.id('v')$$) = 0, 'nachher: keine Aufträge von V sichtbar (offen UND erledigt)');
update public.auftraege set status = 'angenommen' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- UPDATE ohne WHERE und ohne Spaltenzugriff: Hier gilt NUR die Update-Regel, nicht die Lese-Regel.
update public.auftraege set status = 'angenommen';
select pruef.zurueck();
select pruef.ja((select status from public.auftraege where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'offen', 'nachher: Auftrag lässt sich nicht bearbeiten (auch nicht per UPDATE ohne WHERE)');
select pruef.ja((select status from public.auftraege where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'angenommen', 'UPDATE ohne WHERE traf nur den Auftrag beim noch verknüpften V2');
select pruef.als('p');
select pruef.ja(pruef.zeilen($$select 1 from public.service_objekte_portal$$) = 0, 'nachher: keine Objekte');
select pruef.ja(pruef.zeilen($$select 1 from public.firmen$$) = 0, 'nachher: kein Firmenverzeichnis');
select pruef.wirft($$select public.verlaengere_auftrag_link('aaaaaaaa-0000-0000-0000-000000000001', 30)$$, 'nachher: Auftrags-Link nicht mehr verlängerbar');
select pruef.ja(public.auftrag_fachbetrieb_vorschlagen('aaaaaaaa-0000-0000-0000-000000000001', null, null, 'Fachbetrieb nötig') is not true, 'nachher: kein Fachbetrieb-Vorschlag');
select pruef.wirft($$insert into public.auftraege (vermieter_id, service_user_id, titel, status, erstellt_von) values (pruef.id('v'), pruef.id('p'), 'Neu', 'freigabe', 'service')$$, 'nachher: kein neuer Antrag');
-- Der Zugang beim ANDEREN Vermieter bleibt (Widerruf gilt je Mandant).
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege where vermieter_id = pruef.id('v2')$$) = 1, 'Zugang bei V2 bleibt unberührt');
select pruef.zurueck();

-- Der andere Partner bei V arbeitet weiter, der Vermieter sieht alles.
select pruef.als('p2');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege$$) = 1, 'anderer Partner sieht seinen Auftrag weiter');
select pruef.zurueck();
select pruef.als('v');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege$$) = 3, 'Vermieter sieht alle eigenen Aufträge (auch die des entfernten Partners)');
select pruef.ja(pruef.zeilen($$select 1 from public.auftrag_notizen$$) = 1, 'Vermieter sieht den Verlauf weiter');
select pruef.zurueck();

-- Neue Einladung stellt den Zugang wieder her (ausdrücklich so gewollt).
insert into public.service_zugaenge (user_id, vermieter_id, rolle) values (pruef.id('p'), pruef.id('v'), 'hausmeister');
select pruef.als('p');
select pruef.ja(pruef.zeilen($$select 1 from public.auftraege where vermieter_id = pruef.id('v')$$) = 2, 'nach neuer Verknüpfung wieder sichtbar');
select pruef.zurueck();

rollback;
