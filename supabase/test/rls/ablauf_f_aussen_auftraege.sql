-- Ablauf F – dauerhafte Schritte nach außen und Vorgangskennungen (11.10.2026).
-- Schreiben nur die Service-Role; lesen, wen es betrifft; genau ein Bearbeiter; eindeutige Schlüssel.
begin;
select pruef.konto('v'); select pruef.konto('m'); select pruef.konto('x');

-- Service-Role legt einen Schritt an (Hinweis-Mail an m, ausgelöst von v).
select pruef.als_service();
insert into public.aussen_auftraege (id, user_id, ausgeloest_von, schluessel, art, nutzlast)
  values ('f0f0f0f0-0000-0000-0000-000000000001', pruef.id('m'), pruef.id('v'), 'hinweis:dokument:n1', 'hinweis_mail', '{"art":"dokument","bezug":"n1"}');
select pruef.wirft($$insert into public.aussen_auftraege (user_id, schluessel, art) values (pruef.id('m'), 'hinweis:dokument:n1', 'hinweis_mail')$$, 'Schlüssel je Konto eindeutig');
select pruef.wirft($$insert into public.aussen_auftraege (user_id, schluessel, art) values (pruef.id('m'), 'x:1', 'zahlung')$$, 'nur bekannte Arten');
select pruef.wirft($$update public.aussen_auftraege set status = 'erledigt' where schluessel = 'hinweis:dokument:n1'$$, 'erledigt nur mit Zeitpunkt');

-- Genau ein Bearbeiter.
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 1, 'erster Anspruch gelingt');
select pruef.ja((select status = 'in_arbeit' and versuche = 1 and letzter_versuch is not null from public.aussen_auftraege where schluessel = 'hinweis:dokument:n1'), 'Zustand in_arbeit, Versuch 1, letzter Versuch gesetzt');
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 0, 'zweiter Anspruch während der Arbeit scheitert');
update public.aussen_auftraege set letzter_versuch = now() - interval '6 minutes' where schluessel = 'hinweis:dokument:n1';
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 1, 'abgebrochener Lauf nach 5 min wieder frei');
update public.aussen_auftraege set status = 'fehler', naechster_versuch = now() + interval '1 hour' where schluessel = 'hinweis:dokument:n1';
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 0, 'vor dem nächsten Versuch nicht beanspruchbar');
update public.aussen_auftraege set naechster_versuch = now() - interval '1 second' where schluessel = 'hinweis:dokument:n1';
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 1, 'fälliger Fehler wird wiederholt (Versuch 3)');
update public.aussen_auftraege set status = 'fehler', naechster_versuch = now() - interval '1 second' where schluessel = 'hinweis:dokument:n1';
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 0, 'nach drei Versuchen kein vierter');
update public.aussen_auftraege set status = 'erledigt', erledigt_am = now() where schluessel = 'hinweis:dokument:n1';
select pruef.ja(pruef.zeilen($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$) = 0, 'erledigt wird nie erneut beansprucht');
select pruef.zurueck();

-- Lesen: Empfänger und Auslöser ja, Fremde nein. Schreiben: niemand außer der Service-Role.
select pruef.als('m');
select pruef.ja(pruef.zeilen($$select 1 from public.aussen_auftraege$$) = 1, 'Empfänger sieht seinen Schritt');
select pruef.wirft($$insert into public.aussen_auftraege (user_id, schluessel, art) values (pruef.id('m'), 'selbst', 'hinweis_mail')$$, 'Nutzer legt keinen Schritt an');
select pruef.wirft($$update public.aussen_auftraege set status = 'offen'$$, 'Nutzer ändert keinen Schritt');
select pruef.wirft($$delete from public.aussen_auftraege$$, 'Nutzer löscht keinen Schritt');
select pruef.wirft($$select * from public.aussen_auftrag_beanspruchen('f0f0f0f0-0000-0000-0000-000000000001')$$, 'Nutzer beansprucht nichts');
select pruef.zurueck();
select pruef.als('v');
select pruef.ja(pruef.zeilen($$select 1 from public.aussen_auftraege$$) = 1, 'Auslöser sieht den Schritt');
select pruef.zurueck();
select pruef.als('x');
select pruef.ja(pruef.zeilen($$select 1 from public.aussen_auftraege$$) = 0, 'Fremde sehen nichts');
select pruef.zurueck();
select pruef.als_anon();
select pruef.wirft($$select 1 from public.aussen_auftraege$$, 'anon liest nichts');
select pruef.zurueck();

-- Vorgangskennungen: ein zweites Absenden desselben Formulars legt nichts Zweites an.
select pruef.als('v');
insert into public.notizen (user_id, titel, vorgang) values (pruef.id('v'), 'Brief', 'abababab-0000-0000-0000-000000000001');
select pruef.wirft($$insert into public.notizen (user_id, titel, vorgang) values (pruef.id('v'), 'Brief', 'abababab-0000-0000-0000-000000000001')$$, 'Schreiben je Vorgang nur einmal');
insert into public.notizen (user_id, titel) values (pruef.id('v'), 'ohne Vorgang'), (pruef.id('v'), 'ohne Vorgang');
select pruef.ja(pruef.zeilen($$select 1 from public.notizen where titel = 'ohne Vorgang'$$) = 2, 'ohne Kennung wie bisher');
insert into public.auftraege (vermieter_id, titel, vorgang) values (pruef.id('v'), 'Auftrag', 'abababab-0000-0000-0000-000000000002');
select pruef.wirft($$insert into public.auftraege (vermieter_id, titel, vorgang) values (pruef.id('v'), 'Auftrag', 'abababab-0000-0000-0000-000000000002')$$, 'Auftrag je Vorgang nur einmal');
select pruef.zurueck();
select pruef.als('x');
insert into public.notizen (user_id, titel, vorgang) values (pruef.id('x'), 'Brief', 'abababab-0000-0000-0000-000000000001');
select pruef.ja(pruef.zeilen($$select 1 from public.notizen where vorgang = 'abababab-0000-0000-0000-000000000001'$$) = 1, 'gleiche Kennung bei einem anderen Konto stört nicht (und bleibt unsichtbar)');
select pruef.zurueck();

-- Kontolöschung nimmt die Schritte mit.
delete from auth.users where id = pruef.id('m');
select pruef.ja((select count(*) from public.aussen_auftraege where schluessel = 'hinweis:dokument:n1') = 0, 'Kontolöschung entfernt die Schritte');
rollback;
