-- B02 – Kontolöschung (11.10.2026). Die Datenbereinigung ist nur für die Service-Role
-- ausführbar; ein angemeldetes Konto kann sie weder für sich noch für andere direkt auslösen.
begin;

select pruef.konto('a'); select pruef.konto('b'); select pruef.konto('partner');
insert into public.properties (id, user_id, bezeichnung) values
  ('22222222-0000-0000-0000-00000000000a', pruef.id('a'), 'Haus A'),
  ('22222222-0000-0000-0000-00000000000b', pruef.id('b'), 'Haus B');
insert into public.kosten (user_id, prop_id, betrag, kategorie, buchungsdatum)
  values (pruef.id('a'), '22222222-0000-0000-0000-00000000000a', 10, 'Reparatur', '2026-01-01'),
         (pruef.id('b'), '22222222-0000-0000-0000-00000000000b', 20, 'Reparatur', '2026-01-01');
insert into public.service_zugaenge (user_id, vermieter_id, firma) values (pruef.id('partner'), pruef.id('b'), 'Hausmeister Pruef');
insert into public.auftraege (vermieter_id, service_user_id, titel, status, erstellt_von)
  values (pruef.id('b'), pruef.id('partner'), 'Rinne', 'erledigt', 'vermieter');

-- Direkter Aufruf als angemeldetes Konto — mit frischer aal2-Sitzung, also ohne jede Ausrede.
select pruef.als('a', 'aal2');
select pruef.wirft($$select public.delete_own_account()$$, 'eigenes Konto kann delete_own_account nicht direkt aufrufen');
select pruef.wirft($$select public.konto_loeschen(pruef.id('a'))$$, 'eigenes Konto kann konto_loeschen nicht aufrufen');
select pruef.wirft($$select public.konto_loeschen(pruef.id('b'))$$, 'fremdes Konto lässt sich erst recht nicht löschen');
select pruef.zurueck();
select pruef.als_anon();
select pruef.wirft($$select public.delete_own_account()$$, 'anon ruft delete_own_account nicht auf');
select pruef.wirft($$select public.konto_loeschen(pruef.id('a'))$$, 'anon ruft konto_loeschen nicht auf');
select pruef.zurueck();
select pruef.ja(exists (select 1 from auth.users where id = pruef.id('a')), 'nach den Versuchen besteht Konto A noch');

-- Positiv: Der Server (Service-Role) löscht genau Konto A samt Daten.
select pruef.als_service();
select public.konto_loeschen(pruef.id('a'));
select pruef.zurueck();
select pruef.ja(not exists (select 1 from auth.users where id = pruef.id('a')), 'Konto A ist gelöscht');
select pruef.ja(not exists (select 1 from public.kosten where user_id = pruef.id('a')), 'Daten von A sind gelöscht');
select pruef.ja(not exists (select 1 from public.properties where user_id = pruef.id('a')), 'Objekte von A sind gelöscht');
select pruef.ja(exists (select 1 from public.kosten where user_id = pruef.id('b')), 'Daten von B bleiben');

-- Wiederholung ist gefahrlos (z. B. nach einem Zeitüberlauf).
select pruef.als_service();
select public.konto_loeschen(pruef.id('a'));
select pruef.zurueck();
select pruef.ja(true, 'zweiter Aufruf für dasselbe Konto wirft nicht');

-- Partner löscht sein Konto: Der Auftrag beim Vermieter B behält den Namen.
select pruef.als_service();
select public.konto_loeschen(pruef.id('partner'));
select pruef.zurueck();
select pruef.ja((select service_name from public.auftraege where vermieter_id = pruef.id('b')) = 'Hausmeister Pruef',
  'Auftrag beim Vermieter behält den Partnernamen');

-- Demo-Konten sind auch für die Service-Role gesperrt.
insert into auth.users (id, email) values ('33333333-0000-0000-0000-000000000001', 'demo.vermieter@myimmo.test');
select pruef.als_service();
select pruef.wirft($$select public.konto_loeschen('33333333-0000-0000-0000-000000000001')$$, 'Demo-Konto wird nicht gelöscht');
select pruef.zurueck();

rollback;
