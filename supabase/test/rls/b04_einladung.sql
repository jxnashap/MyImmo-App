-- B04 – Selbst-Einladung (11.10.2026). Eine Service-/Mieter-Einladung darf weder die
-- Freischaltung (Zugangscode) ersetzen noch eine Verknüpfung erzeugen, die der Einladende nicht
-- vergeben darf. Positive UND negative Gegenproben, alles in einer zurückgerollten Transaktion.
begin;

-- Aufbau (als postgres): V1/V2 freigeschaltete Vermieter, P neuer Partner, X nie freigeschaltet
-- (z. B. per Google oder direkt über die Auth-API angelegt), H mit Metadaten-Rolle hausverwaltung.
select pruef.konto('v1'); select pruef.konto('v2'); select pruef.konto('p'); select pruef.konto('p2');
select pruef.konto('x'); select pruef.konto('h', '{"rolle":"hausverwaltung"}');
insert into public.konto_freischaltung (user_id, consent_agb, consent_datenschutz, quelle)
  values (pruef.id('v1'), true, true, 'registrierung'), (pruef.id('v2'), true, true, 'registrierung');
select pruef.ja((select rolle from public.nutzer_rollen where user_id = pruef.id('h')) = 'hausverwaltung',
  'Aufbau: Metadaten setzen beim Anlegen die Rolle hausverwaltung (nutzeränderbar)');

-- 1) Nicht freigeschaltetes Konto darf keine Einladung ausstellen (direkt über die REST-Schicht).
select pruef.als('x');
select pruef.wirft($$insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('x'), 'SV-XXXX-0001', 'service')$$,
  'nicht freigeschaltetes Konto kann keinen Service-Code anlegen');
select pruef.zurueck();
select pruef.als('h');
select pruef.wirft($$insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('h'), 'SV-HHHH-0001', 'service')$$,
  'Konto mit Metadaten-Rolle hausverwaltung ohne Freischaltung kann keinen Code anlegen');
select pruef.zurueck();

-- 2) Selbst-Einlösung: Selbst wenn ein Code des eigenen Kontos existiert (hier als postgres
--    angelegt, als hätte eine frühere Regel ihn zugelassen), entsteht keine Freischaltung.
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('h'), 'SV-SELF-0001', 'service');
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('x'), 'SV-SELF-0002', 'service');
select pruef.als('h');
select pruef.ja((public.einladungscode_einloesen('SV-SELF-0001') ->> 'ok')::boolean is not true,
  'eigene Einladung lässt sich nicht einlösen (hausverwaltung)');
select pruef.zurueck();
select pruef.als('x');
select pruef.ja((public.einladungscode_einloesen('SV-SELF-0002') ->> 'ok')::boolean is not true,
  'eigene Einladung lässt sich nicht einlösen (ohne Rolle)');
select pruef.zurueck();
select pruef.ja(not exists (select 1 from public.konto_freischaltung where user_id in (pruef.id('h'), pruef.id('x'))),
  'Selbst-Einladung schaltet kein Konto frei');
select pruef.ja(not exists (select 1 from public.service_zugaenge where user_id in (pruef.id('h'), pruef.id('x'))),
  'Selbst-Einladung erzeugt keine Verknüpfung');

-- 3) Code eines NICHT freigeschalteten Ausstellers (X) an ein fremdes Konto (P2): keine Freischaltung.
select pruef.als('p2');
select pruef.ja((public.einladungscode_einloesen('SV-SELF-0002') ->> 'ok')::boolean is not true,
  'Code eines nicht freigeschalteten Ausstellers wird abgelehnt');
select pruef.zurueck();
select pruef.ja(not exists (select 1 from public.konto_freischaltung where user_id = pruef.id('p2')),
  'kein Freischalten über einen Code eines nicht freigeschalteten Ausstellers');

-- 4) Freigeschalteter Vermieter V1: darf ausstellen, aber NICHT selbst einlösen.
select pruef.als('v1');
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v1'), 'SV-V1V1-0001', 'service');
select pruef.ja((public.einladungscode_einloesen('SV-V1V1-0001') ->> 'ok')::boolean is not true,
  'Vermieter kann seinen eigenen Service-Code nicht selbst einlösen');
select pruef.wirft($$insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v2'), 'SV-FREM-0001', 'service')$$,
  'Vermieter kann keinen Code im Namen eines fremden Mandanten anlegen');
select pruef.zurueck();
select pruef.ja(not exists (select 1 from public.service_zugaenge where user_id = pruef.id('v1')),
  'keine Verknüpfung des Vermieters mit sich selbst');

-- 5) Legitime Einladung: V1 stellt aus, P löst ein → Verknüpfung genau zu V1, Rolle service.
select pruef.als('v1');
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v1'), 'SV-LEGI-0001', 'service');
select pruef.zurueck();
select pruef.als('p');
select pruef.ja((public.einladungscode_einloesen('SV-LEGI-0001') ->> 'ok')::boolean,
  'legitime Einladung wird eingelöst');
select pruef.ja(pruef.zeilen($$select 1 from public.service_zugaenge where user_id = pruef.id('p') and vermieter_id = pruef.id('v1')$$) = 1,
  'Partner sieht seine Verknüpfung zu V1');
select pruef.ja(pruef.zeilen($$select 1 from public.service_zugaenge where vermieter_id = pruef.id('v2')$$) = 0,
  'keine Verknüpfung zu einem fremden Mandanten');
-- 6) Verwendeter Code: zweites Einlösen scheitert; direkte Verknüpfung am RPC vorbei scheitert.
select pruef.ja((public.einladungscode_einloesen('SV-LEGI-0001') ->> 'ok')::boolean is not true,
  'verwendeter Code lässt sich nicht erneut einlösen');
select pruef.wirft($$insert into public.service_zugaenge (user_id, vermieter_id) values (pruef.id('p'), pruef.id('v2'))$$,
  'Partner kann sich nicht direkt mit einem fremden Mandanten verknüpfen');
select pruef.zurueck();
select pruef.ja((select rolle from public.nutzer_rollen where user_id = pruef.id('p')) = 'service',
  'eingeladenes Konto hat die Rolle service');
select pruef.ja(exists (select 1 from public.konto_freischaltung where user_id = pruef.id('p') and quelle = 'einladung'),
  'eingeladenes Konto ist über die Einladung freigeschaltet');

-- 7) Abgelaufener Code.
insert into public.einladungscodes (vermieter_id, code, rolle, gueltig_bis)
  values (pruef.id('v1'), 'SV-ALT0-0001', 'service', now() - interval '1 minute');
select pruef.als('p2');
select pruef.ja((public.einladungscode_einloesen('SV-ALT0-0001') ->> 'ok')::boolean is not true,
  'abgelaufener Code wird abgelehnt');
select pruef.zurueck();

-- 8) Metadaten-Rolle hausverwaltung + legitimer Service-Code: Ergebnis ist ein SERVICE-Konto,
--    keine freigeschaltete Hausverwaltung (das wäre der Weg am Zugangscode vorbei).
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v1'), 'SV-HVHV-0001', 'service');
select pruef.als('h');
select pruef.ja((public.einladungscode_einloesen('SV-HVHV-0001') ->> 'ok')::boolean, 'H löst einen fremden, legitimen Code ein');
select pruef.zurueck();
select pruef.ja((select rolle from public.nutzer_rollen where user_id = pruef.id('h')) = 'service',
  'nach der Einladung ist H ein Service-Konto, keine Hausverwaltung');

-- 9) Bereits freigeschalteter Vermieter V2 löst einen Service-Code von V1 ein: Verknüpfung ja,
--    Rolle und Freischaltung bleiben unverändert.
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v1'), 'SV-V2V2-0001', 'service');
select pruef.als('v2');
select pruef.ja((public.einladungscode_einloesen('SV-V2V2-0001') ->> 'ok')::boolean, 'V2 löst V1s Code ein');
select pruef.zurueck();
select pruef.ja(not exists (select 1 from public.nutzer_rollen where user_id = pruef.id('v2')),
  'Rolle von V2 bleibt Vermieter (kein Eintrag)');
select pruef.ja((select quelle from public.konto_freischaltung where user_id = pruef.id('v2')) = 'registrierung',
  'Freischaltung von V2 bleibt die eigene');

-- 10) Registrierung mit Metadaten (Trigger): Code eines nicht freigeschalteten Ausstellers
--     verknüpft nicht und schaltet nicht frei.
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('x'), 'SV-TRIG-0001', 'service');
select pruef.konto('neu', '{"rolle":"service","einladungscode":"SV-TRIG-0001"}');
select pruef.ja(not exists (select 1 from public.service_zugaenge where user_id = pruef.id('neu')),
  'Anmelde-Trigger: keine Verknüpfung über den Code eines nicht freigeschalteten Ausstellers');
select pruef.ja(not exists (select 1 from public.konto_freischaltung where user_id = pruef.id('neu')),
  'Anmelde-Trigger: keine Freischaltung über diesen Code');
-- und legitim über den Trigger:
insert into public.einladungscodes (vermieter_id, code, rolle) values (pruef.id('v1'), 'SV-TRIG-0002', 'service');
select pruef.konto('neu2', '{"rolle":"service","einladungscode":"SV-TRIG-0002"}');
select pruef.ja(exists (select 1 from public.service_zugaenge where user_id = pruef.id('neu2') and vermieter_id = pruef.id('v1')),
  'Anmelde-Trigger: legitimer Code verknüpft mit V1');

-- 11) Code-Prüfung ist nur für die Service-Role aufrufbar (Paket 1 des Audits 01.10.2026).
select pruef.als_anon();
select pruef.wirft($$select public.einladungscode_pruefen('SV-LEGI-0001', 'service')$$, 'anon kann Codes nicht durchprobieren');
select pruef.zurueck();

rollback;
