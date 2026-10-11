-- B14 – Einheitengrenze an der Datenbank, auf JEDEM Schreibweg (11.10.2026).
begin;
select pruef.konto('v'); select pruef.konto('w');
-- Neue Konten bekommen per Bestandsschutz-Trigger „plus/testphase“ — hier den Tarif ausdrücklich setzen.
update public.abos set plan = 'kostenlos', status = 'aktiv' where user_id in (pruef.id('v'), pruef.id('w'));

-- Schalter AUS (Standard): nichts wird begrenzt.
update public.billing_einstellungen set einheiten_durchsetzen = false where id = 1;
select pruef.als('v');
insert into public.properties (user_id, bezeichnung, einheiten_anzahl) values (pruef.id('v'), 'A', 10), (pruef.id('v'), 'B', 10);
select pruef.ja(pruef.zeilen($$select 1 from public.properties$$) = 2, 'Schalter aus: keine Grenze (Early Access)');
select pruef.zurueck();

-- Schalter AN, Konto w im Tarif „kostenlos“ = 1 Einheit.
update public.billing_einstellungen set einheiten_durchsetzen = true where id = 1;
select pruef.als('w');
insert into public.properties (id, user_id, bezeichnung, einheiten_anzahl) values ('14141414-0000-0000-0000-000000000001', pruef.id('w'), 'Erstes', null);
select pruef.wirft($$insert into public.properties (user_id, bezeichnung) values (pruef.id('w'), 'Zweites')$$, 'kostenlos: kein zweites Objekt');
select pruef.wirft($$update public.properties set einheiten_anzahl = 3 where id = '14141414-0000-0000-0000-000000000001'$$, 'kostenlos: Einheiten nicht über das Limit erhöhbar (Bearbeiten)');
select pruef.ja(pruef.betroffen($$update public.properties set bezeichnung = 'Umbenannt' where id = '14141414-0000-0000-0000-000000000001'$$) = 1, 'Bearbeiten ohne mehr Einheiten bleibt möglich');
select pruef.zurueck();

-- Tarif plus für w: das EIGENE Objekt zählt beim Bearbeiten nicht doppelt (1 → 24 passt genau).
update public.abos set plan = 'plus', status = 'aktiv' where user_id = pruef.id('w');
select pruef.als('w');
select pruef.ja(pruef.betroffen($$update public.properties set einheiten_anzahl = 24 where id = '14141414-0000-0000-0000-000000000001'$$) = 1, 'plus: 1 → 24 Einheiten am selben Objekt passt genau');
select pruef.ja(pruef.betroffen($$update public.properties set einheiten_anzahl = 1 where id = '14141414-0000-0000-0000-000000000001'$$) = 1, 'zurück auf 1');
select pruef.zurueck();
-- Gekündigter Tarif zählt wie „kostenlos“ (1 Einheit), nicht wie der alte Tarif.
update public.abos set status = 'gekuendigt' where user_id = pruef.id('w');
select pruef.als('w');
select pruef.wirft($$insert into public.properties (user_id, bezeichnung) values (pruef.id('w'), 'Nach Kündigung')$$, 'gekündigt: wie kostenlos');
select pruef.zurueck();

-- Ganz ohne Abo-Zeile gilt ebenfalls „kostenlos“.
delete from public.abos where user_id = pruef.id('w');
select pruef.als('w');
select pruef.wirft($$insert into public.properties (user_id, bezeichnung) values (pruef.id('w'), 'Ohne Abo')$$, 'ohne Abo: kostenlos (1 Einheit)');
select pruef.zurueck();

-- Konto v liegt nach einem „Tarifwechsel“ über dem Limit: weniger geht, mehr nicht.
select pruef.als('v');
select pruef.wirft($$insert into public.properties (user_id, bezeichnung) values (pruef.id('v'), 'C')$$, 'über dem Limit: kein weiteres Objekt');
select pruef.ja(pruef.betroffen($$update public.properties set einheiten_anzahl = 5 where bezeichnung = 'A'$$) = 1, 'über dem Limit: Einheiten verringern bleibt erlaubt');
select pruef.zurueck();

-- Tarif plus (24 Einheiten) für v: 5 + 10 belegt → 9 frei.
update public.abos set plan = 'plus', status = 'aktiv' where user_id = pruef.id('v');
select pruef.als('v');
insert into public.properties (user_id, bezeichnung, einheiten_anzahl) values (pruef.id('v'), 'D', 9);
select pruef.wirft($$insert into public.properties (user_id, bezeichnung, einheiten_anzahl) values (pruef.id('v'), 'E', 1)$$, 'plus: 25. Einheit abgelehnt');
select pruef.zurueck();
-- Gekündigt zählt wie kostenlos.
update public.abos set status = 'gekuendigt' where user_id = pruef.id('v');
select pruef.als('v');
select pruef.wirft($$update public.properties set einheiten_anzahl = 11 where bezeichnung = 'B'$$, 'gekündigt: kein Ausbau');
select pruef.zurueck();
-- Business: unbegrenzt.
update public.abos set plan = 'business', status = 'aktiv' where user_id = pruef.id('v');
select pruef.als('v');
insert into public.properties (user_id, bezeichnung, einheiten_anzahl) values (pruef.id('v'), 'F', 500);
select pruef.ja(true, 'business: unbegrenzt');
select pruef.zurueck();

-- Service-Role (Demo-Reset, Cron) ist ausgenommen; die Grenzfunktion ist für Nutzer nicht aufrufbar.
select pruef.als_service();
insert into public.properties (user_id, bezeichnung, einheiten_anzahl) values (pruef.id('w'), 'Service', 50);
select pruef.ja(true, 'Service-Role: nicht begrenzt');
select pruef.zurueck();
select pruef.als('w');
select pruef.wirft($$select public.einheiten_limit_fuer(pruef.id('w'))$$, 'Grenzfunktion für Nutzer gesperrt');
select pruef.zurueck();
rollback;
