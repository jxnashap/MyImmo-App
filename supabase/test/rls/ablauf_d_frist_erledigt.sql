-- Ablauf D – Erledigt-Vermerk einer Frist: nur eigene, nur vollständig, nur mit eigenem Schreiben (11.10.2026).
begin;
select pruef.konto('v'); select pruef.konto('w');
insert into public.notizen (id, user_id, titel) values
  ('d0d0d0d0-0000-0000-0000-000000000001', pruef.id('v'), 'Wohnungsgeberbestätigung (§ 19 BMG) – Mia'),
  ('d0d0d0d0-0000-0000-0000-000000000002', pruef.id('w'), 'Fremdes Schreiben');

select pruef.als('v');
insert into public.frist_ausgeblendet (user_id, schluessel) values (pruef.id('v'), 'mieter|2026-10-15|Wohnungsgeberbestätigung ausstellen');
select pruef.ja((select grund from public.frist_ausgeblendet where user_id = pruef.id('v')) = 'ausgeblendet', 'Standard: ausgeblendet (Altbestand)');
update public.frist_ausgeblendet set grund = 'erledigt', erledigt_am = '2026-10-10', zustellweg = 'persoenlich', notiz_id = 'd0d0d0d0-0000-0000-0000-000000000001'
 where user_id = pruef.id('v');
select pruef.ja((select grund from public.frist_ausgeblendet where user_id = pruef.id('v')) = 'erledigt', 'ausgeblendet → erledigt (Update-Regel)');
select pruef.wirft($$insert into public.frist_ausgeblendet (user_id, schluessel, grund) values (pruef.id('v'), 'x', 'erledigt')$$, 'erledigt ohne Datum/Zustellweg');
select pruef.wirft($$insert into public.frist_ausgeblendet (user_id, schluessel, grund, erledigt_am, zustellweg) values (pruef.id('v'), 'y', 'erledigt', '2026-10-10', 'brieftaube')$$, 'nur bekannte Zustellwege');
select pruef.wirft($$insert into public.frist_ausgeblendet (user_id, schluessel, grund) values (pruef.id('v'), 'z', 'vergessen')$$, 'nur bekannte Gründe');
select pruef.wirft($$insert into public.frist_ausgeblendet (user_id, schluessel, grund, erledigt_am, zustellweg, notiz_id)
  values (pruef.id('v'), 'q', 'erledigt', '2026-10-10', 'post', 'd0d0d0d0-0000-0000-0000-000000000002')$$, 'kein fremdes Schreiben als Beleg');
select pruef.wirft($$update public.frist_ausgeblendet set notiz_id = 'd0d0d0d0-0000-0000-0000-000000000002' where user_id = pruef.id('v')$$, 'auch nicht nachträglich per Update');
insert into public.frist_ausgeblendet (user_id, schluessel) values (pruef.id('v'), 'steuer|2027-02-15|Grundsteuer fällig (Vierteljahresrate)');
select pruef.wirft($$update public.frist_ausgeblendet set user_id = pruef.id('w') where schluessel like 'steuer|%'$$, 'Vermerk nicht in ein fremdes Konto schieben');
select pruef.zurueck();

-- Fremdes Konto: sieht, ändert und löscht nichts; schreibt nichts ins fremde Konto.
select pruef.als('w');
select pruef.ja(pruef.zeilen($$select 1 from public.frist_ausgeblendet$$) = 0, 'fremde Vermerke unsichtbar');
select pruef.ja(pruef.betroffen($$update public.frist_ausgeblendet set zustellweg = 'mail' where user_id = pruef.id('v')$$) = 0, 'fremde Vermerke nicht änderbar');
select pruef.ja(pruef.betroffen($$delete from public.frist_ausgeblendet where user_id = pruef.id('v')$$) = 0, 'fremde Vermerke nicht löschbar');
select pruef.wirft($$insert into public.frist_ausgeblendet (user_id, schluessel) values (pruef.id('v'), 'untergeschoben')$$, 'kein Vermerk im fremden Konto');
select pruef.zurueck();
select pruef.ja((select zustellweg from public.frist_ausgeblendet where user_id = pruef.id('v') and schluessel like 'mieter|%') = 'persoenlich', 'Vermerk unverändert');
rollback;
