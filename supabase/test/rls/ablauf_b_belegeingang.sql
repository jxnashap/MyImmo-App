-- Ablauf B – Belegeingang: nur eigene Einträge, genau ein Bearbeiter, eine Buchung je Beleg (11.10.2026).
begin;
select pruef.konto('v'); select pruef.konto('w');

-- Positiv: eigener Eintrag anlegen, lesen, beanspruchen.
select pruef.als('v');
insert into public.beleg_eingang (id, user_id, datei_pfad, datei_name, datei_mime, datei_groesse, datei_hash)
  values ('b0b0b0b0-0000-0000-0000-000000000001', pruef.id('v'), 'x/eingang-1.pdf', 'Rechnung.pdf', 'application/pdf', 1200, repeat('a', 64));
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$) = 1, 'eigener Eintrag lesbar');
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 1, 'erster Aufruf beansprucht');
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 0, 'zweiter Aufruf bekommt ihn NICHT (in Arbeit)');
-- Abgebrochener Lauf (letzter Versuch vor 6 Minuten) ist wieder frei; nach drei Versuchen nicht mehr.
update public.beleg_eingang set letzter_versuch = now() - interval '6 minutes' where id = 'b0b0b0b0-0000-0000-0000-000000000001';
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 1, 'abgebrochener Lauf nach 5 min wieder frei');
update public.beleg_eingang set status = 'fehler' where id = 'b0b0b0b0-0000-0000-0000-000000000001';
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 1, 'nach Fehler: dritter Versuch');
update public.beleg_eingang set status = 'fehler' where id = 'b0b0b0b0-0000-0000-0000-000000000001';
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 0, 'nach drei Versuchen keiner mehr');
-- Anlegen nur im Ausgangszustand (kein „schon gebucht“ untergeschoben), Status nur aus der Liste.
select pruef.wirft($$insert into public.beleg_eingang (user_id, datei_pfad, datei_name, datei_mime, datei_groesse, datei_hash, status, versuche)
  values (pruef.id('v'), 'x/eingang-2.pdf', 'R.pdf', 'application/pdf', 10, repeat('b', 64), 'vorschlag', 0)$$, 'Anlegen nur mit Status „neu“');
select pruef.wirft($$update public.beleg_eingang set status = 'erledigt' where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$, 'unbekannter Status');
select pruef.wirft($$update public.beleg_eingang set status = 'gebucht' where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$, '„gebucht“ nur mit Kosten-ID');
select pruef.wirft($$insert into public.beleg_eingang (user_id, datei_pfad, datei_name, datei_mime, datei_groesse, datei_hash)
  values (pruef.id('v'), 'x/eingang-3.pdf', 'R.pdf', 'application/pdf', 10, 'kein-hash')$$, 'Prüfsumme muss SHA-256 sein');
select pruef.wirft($$update public.beleg_eingang set user_id = pruef.id('w') where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$, 'eigenen Eintrag nicht in ein fremdes Konto schieben');
-- Eine Buchung je Beleg.
insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, beleg_eingang_id, umlagefaehig)
  values (pruef.id('v'), '2026-03-01', 'Müll', 120, 'b0b0b0b0-0000-0000-0000-000000000001', 'ja');
select pruef.wirft($$insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, beleg_eingang_id)
  values (pruef.id('v'), '2026-03-01', 'Müll', 120, 'b0b0b0b0-0000-0000-0000-000000000001')$$, 'zweite Buchung zum selben Beleg');
select pruef.ja(pruef.betroffen($$insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, beleg_eingang_id)
  values (pruef.id('v'), '2026-03-01', 'Müll', 120, 'b0b0b0b0-0000-0000-0000-000000000001')
  on conflict (beleg_eingang_id) do nothing$$) = 0, 'upsert/ignoreDuplicates überspringt still');
select pruef.wirft($$insert into public.kosten (user_id, buchungsdatum, kategorie, betrag, umlagefaehig)
  values (pruef.id('v'), '2026-03-01', 'Müll', 120, 'vielleicht')$$, 'Umlagefähigkeit nur ja/nein/unklar');
insert into public.kosten (user_id, buchungsdatum, kategorie, betrag) values (pruef.id('v'), '2026-03-01', 'Müll', 1), (pruef.id('v'), '2026-03-01', 'Müll', 2);
select pruef.ja(true, 'Buchungen ohne Beleg bleiben frei (NULL ist verschieden)');
-- Gebuchter Eintrag lässt sich nicht löschen (die Buchung verweist darauf).
update public.beleg_eingang set status = 'gebucht', kosten_id = gen_random_uuid() where id = 'b0b0b0b0-0000-0000-0000-000000000001';
select pruef.ja(pruef.betroffen($$delete from public.beleg_eingang where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$) = 0, 'gebucht = nicht löschbar');
select pruef.zurueck();

-- Negativ: ein fremdes Konto sieht, beansprucht, ändert und löscht nichts — und legt nichts im fremden Konto an.
select pruef.als('w');
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang$$) = 0, 'fremder Eingang unsichtbar');
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$) = 0, 'fremder Eingang nicht beanspruchbar');
select pruef.ja(pruef.betroffen($$update public.beleg_eingang set fehler = 'x' where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$) = 0, 'fremder Eingang nicht änderbar');
select pruef.ja(pruef.betroffen($$delete from public.beleg_eingang where id = 'b0b0b0b0-0000-0000-0000-000000000001'$$) = 0, 'fremder Eingang nicht löschbar');
select pruef.wirft($$insert into public.beleg_eingang (user_id, datei_pfad, datei_name, datei_mime, datei_groesse, datei_hash)
  values (pruef.id('v'), 'x/eingang-9.pdf', 'R.pdf', 'application/pdf', 10, repeat('c', 64))$$, 'kein Eintrag im fremden Konto');
select pruef.zurueck();

-- Ohne Anmeldung: kein Aufruf der Funktion, kein Lesen.
select pruef.als_anon();
select pruef.wirft($$select public.beleg_eingang_beanspruchen('b0b0b0b0-0000-0000-0000-000000000001')$$, 'anon darf nicht beanspruchen');
select pruef.ja(pruef.zeilen($$select 1 from public.beleg_eingang$$) = 0, 'anon sieht nichts');
select pruef.zurueck();
rollback;
