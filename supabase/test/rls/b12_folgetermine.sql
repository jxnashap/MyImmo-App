-- B12 – höchstens EIN Folgetermin je Termin; nur eigene Termine (11.10.2026).
begin;
select pruef.konto('v'); select pruef.konto('w');

select pruef.als('v');
insert into public.termine (id, user_id, titel, datum, wiederkehrung) values ('12121212-0000-0000-0000-000000000001', pruef.id('v'), 'Wartung', '2027-01-31', 'monatlich');
insert into public.termine (user_id, titel, datum, wiederkehrung, vorgaenger_id, serien_tag)
  values (pruef.id('v'), 'Wartung', '2027-02-28', 'monatlich', '12121212-0000-0000-0000-000000000001', 31);
select pruef.wirft($$insert into public.termine (user_id, titel, datum, wiederkehrung, vorgaenger_id)
  values (pruef.id('v'), 'Wartung', '2027-02-28', 'monatlich', '12121212-0000-0000-0000-000000000001')$$, 'kein zweiter Folgetermin zum selben Vorgänger');
select pruef.ja(pruef.betroffen($$insert into public.termine (user_id, titel, datum, wiederkehrung, vorgaenger_id)
  values (pruef.id('v'), 'Wartung', '2027-02-28', 'monatlich', '12121212-0000-0000-0000-000000000001')
  on conflict (vorgaenger_id) do nothing$$) = 0, 'upsert/ignoreDuplicates überspringt still');
select pruef.wirft($$insert into public.termine (user_id, titel, datum, serien_tag) values (pruef.id('v'), 'X', '2027-01-01', 32)$$, 'Serientag nur 1–31');
insert into public.termine (user_id, titel, datum) values (pruef.id('v'), 'Eigen', '2027-01-01'), (pruef.id('v'), 'Eigen', '2027-01-01');
select pruef.ja(true, 'Termine ohne Vorgänger bleiben frei (NULL ist verschieden)');
select pruef.zurueck();

-- Ein fremdes Konto kann an MEINEN Termin keinen Folgetermin hängen und sieht meinen nicht.
select pruef.als('w');
select pruef.ja(pruef.zeilen($$select 1 from public.termine where id = '12121212-0000-0000-0000-000000000001'$$) = 0, 'fremder Termin unsichtbar');
select pruef.ja(pruef.betroffen($$update public.termine set erledigt = true where id = '12121212-0000-0000-0000-000000000001'$$) = 0, 'fremder Termin nicht abhakbar');
select pruef.wirft($$insert into public.termine (user_id, titel, datum) values (pruef.id('v'), 'Untergeschoben', '2027-01-01')$$, 'kein Termin im fremden Konto');
select pruef.zurueck();
rollback;
