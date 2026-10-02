-- Demo-Service, Teil 2: Schnappschuss für Firmen, Aufträge, Rückmeldung.
-- Siehe 20261001180000_demo_service_konten.sql für den Hintergrund.

-- ---------------------------------------------------------------------------
-- 2. Schnappschuss.
create table if not exists demo_seed.firmen as select * from public.firmen where false;
create table if not exists demo_seed.auftraege as select * from public.auftraege where false;
create table if not exists demo_seed.auftrag_rueckmeldungen as select * from public.auftrag_rueckmeldungen where false;
-- Der Auftrag kennt seinen Partner im Schnappschuss nur über die E-Mail: die
-- Konto-ID entsteht erst beim ersten Demo-Start.
alter table demo_seed.auftraege add column if not exists service_email text;

-- Kein Leeren vorab: die Tabellen sind neu. Angewendet wurde das Einfügen
-- mit `where not exists` (Fassung in der Datenbank); inhaltlich identisch.

insert into demo_seed.firmen (id, user_id, name, gewerk, telefon, email, website, notiz, created_at) values
  ('7a1c0e10-0000-4000-8000-000000000001', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'Heizung & Sanitär Böhm', 'Heizung / Warmwasser', '030 23125 101', 'service@boehm-haustechnik.test', null, 'Notdienst 24 h, Ansprechpartner Herr Böhm', '2026-01-12T09:00:00Z'),
  ('7a1c0e10-0000-4000-8000-000000000002', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'Elektro Hartmann', 'Elektro', '030 23125 102', 'info@elektro-hartmann.test', null, 'E-Check alle 4 Jahre', '2026-01-12T09:05:00Z'),
  ('7a1c0e10-0000-4000-8000-000000000003', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'Dachdeckerei Kühn', 'Dachdecker', '030 23125 103', 'kontakt@dach-kuehn.test', null, 'Rinnenreinigung im Herbst', '2026-02-03T10:00:00Z'),
  ('7a1c0e10-0000-4000-8000-000000000004', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'Schlüsseldienst Express', 'Schlüsseldienst', '030 23125 104', 'auftrag@schluessel-express.test', null, 'Festpreis tagsüber 89 €', '2026-03-18T14:30:00Z'),
  ('7a1c0e10-0000-4000-8000-000000000005', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'Malerbetrieb Seidel', 'Maler / Lackierer', '030 23125 105', 'seidel@maler-seidel.test', null, null, '2026-04-07T08:15:00Z');

-- Aufträge. Daten liegen um den Schnappschuss-„Heute" (30.06.2026); der Reset
-- zieht sie tagesgenau auf das echte Heute.
insert into demo_seed.auftraege
  (id, vermieter_id, service_email, prop_id, anliegen_id, mieter_id, firma_id, objekt_name, vermieter_name, service_name,
   titel, beschreibung, termin, status, antwort, erstellt_von, public_token, public_token_ablauf,
   betrag, lohnanteil, created_at, updated_at) values
  -- Vom Hausmeister beantragt, wartet auf Freigabe → der Vermieter sieht die Freigabe-Knöpfe.
  ('7a1c0e20-0000-4000-8000-000000000001', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.hausmeister@myimmo.test',
   'd560ceb5-9dc2-4869-a0c8-41833c061a2c', null, null, '7a1c0e10-0000-4000-8000-000000000003',
   'Zweifamilienhaus Dresden', 'Max Mustermann', 'Hausmeisterservice Krause',
   'Dachrinne verstopft, Wasser läuft an der Fassade herunter',
   'Beim Rundgang gesehen: Die Rinne über dem Eingang läuft bei Regen über. Vorschlag: Dachdeckerei Kühn, Hubsteiger nötig.',
   '2026-07-06', 'freigabe', null, 'service', '7a1c0e30-0000-4000-8000-000000000001', '2026-08-29T00:00:00Z',
   null, null, '2026-06-29T16:20:00Z', '2026-06-29T16:20:00Z'),
  -- Vermieter → Hausmeister, Mieter-Kontakt geteilt, Firma hat über den Link zugesagt.
  ('7a1c0e20-0000-4000-8000-000000000002', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.hausmeister@myimmo.test',
   'dbb0fe08-becf-4835-a553-7a48a4ec5618', '6d274f7b-b155-48cc-9115-0886f0af199e', '7dab5144-8317-4918-901a-a63f348325a6',
   '7a1c0e10-0000-4000-8000-000000000001',
   'Altbau-ETW Leipzig Süd', 'Max Mustermann', 'Hausmeisterservice Krause',
   'Heizkörper im Bad prüfen',
   'Meldung von Frau Weber: Heizkörper im Bad bleibt kalt, Entlüften hat nichts gebracht. Bitte Heizung & Sanitär Böhm beauftragen.',
   '2026-07-02', 'offen', null, 'vermieter', '7a1c0e30-0000-4000-8000-000000000002', '2026-08-28T00:00:00Z',
   null, null, '2026-06-28T10:05:00Z', '2026-06-28T10:05:00Z'),
  -- Vom Sanitärbetrieb angenommen, mit Rückmeldung.
  ('7a1c0e20-0000-4000-8000-000000000003', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.sanitaer@myimmo.test',
   'a3d4fa7d-3b86-4210-a6ea-6eb09625e9cd', '6fb214e5-df05-474e-969f-baf93f641461', '190f1a7a-acc0-43d1-8dfe-46248259d7a5', null,
   'ETW Berlin Wedding', 'Max Mustermann', 'Sanitär Lindner GmbH',
   'Küchenarmatur tauschen',
   'Armatur tropft auch zugedreht. Kartusche oder ganze Armatur tauschen, je nach Zustand.',
   '2026-07-03', 'angenommen', 'Termin mit Frau Yılmaz für Donnerstag vereinbart, Ersatzarmatur ist bestellt.', 'vermieter',
   '7a1c0e30-0000-4000-8000-000000000003', '2026-08-19T00:00:00Z',
   null, null, '2026-06-20T08:30:00Z', '2026-06-21T11:10:00Z'),
  -- Offener Auftrag für den Garten-/Winterdienst.
  ('7a1c0e20-0000-4000-8000-000000000004', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.garten@myimmo.test',
   'b2e5ebb3-61f3-4f01-b1bc-5372710acf50', null, null, null,
   'Reihenhaus Halle', 'Max Mustermann', 'Garten- & Winterdienst Petersen',
   'Winterdienst für die kommende Saison einplanen',
   'Räum- und Streupflicht Gehweg vor dem Haus, werktags bis 7 Uhr. Bitte Angebot mit Pauschale je Monat.',
   null, 'offen', null, 'vermieter', '7a1c0e30-0000-4000-8000-000000000004', '2026-08-24T00:00:00Z',
   null, null, '2026-06-25T13:00:00Z', '2026-06-25T13:00:00Z'),
  -- Erledigt mit Betrag und Lohnanteil → „Als Kosten übernehmen" (§ 35a).
  ('7a1c0e20-0000-4000-8000-000000000005', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.garten@myimmo.test',
   'b2e5ebb3-61f3-4f01-b1bc-5372710acf50', null, null, null,
   'Reihenhaus Halle', 'Max Mustermann', 'Garten- & Winterdienst Petersen',
   'Hecke schneiden und Grünschnitt entsorgen',
   null,
   '2026-06-12', 'erledigt', 'Erledigt, Grünschnitt ist entsorgt. Rechnung folgt per Post.', 'vermieter',
   '7a1c0e30-0000-4000-8000-000000000005', '2026-08-09T00:00:00Z',
   312.80, 240.00, '2026-06-10T07:45:00Z', '2026-06-12T15:30:00Z'),
  ('7a1c0e20-0000-4000-8000-000000000006', 'ed274dbf-ecaf-492b-9aa4-b1c8a2b5fcd4', 'demo.hausmeister@myimmo.test',
   '885ec4f2-71c9-47ec-8bd9-d05a4d26d5e2', null, null, null,
   'ETW Leipzig Zentrum', 'Max Mustermann', 'Hausmeisterservice Krause',
   'Treppenhausbeleuchtung 2. OG defekt',
   null,
   null, 'erledigt', 'Zwei Leuchtmittel getauscht, Bewegungsmelder funktioniert wieder.', 'vermieter',
   '7a1c0e30-0000-4000-8000-000000000006', '2026-07-27T00:00:00Z',
   48.90, 35.00, '2026-05-28T09:00:00Z', '2026-05-29T10:20:00Z');

-- Die Firma Böhm hat über den Auftrags-Link zugesagt.
insert into demo_seed.auftrag_rueckmeldungen (id, auftrag_id, art, firma, kontakt, termin, nachricht, created_at, gelesen) values
  ('7a1c0e40-0000-4000-8000-000000000001', '7a1c0e20-0000-4000-8000-000000000002', 'zusage', 'Heizung & Sanitär Böhm',
   '030 23125 101', '2026-07-02', 'Wir kommen Donnerstag zwischen 8 und 10 Uhr, Frau Weber ist informiert.', '2026-06-29T07:50:00Z', false);

