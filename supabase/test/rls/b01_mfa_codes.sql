-- B01 – Wiederherstellungscodes (11.10.2026). Kein angemeldetes Konto — auch nicht das eigene,
-- auch nicht mit aal2 — darf die Tabelle direkt lesen oder beschreiben. Nur die Service-Role
-- (lib/actions/mfa.ts, serverseitig nach Faktor-/aal2-/Frische-Prüfung).
begin;

select pruef.konto('k');
insert into auth.mfa_factors (user_id, friendly_name, status) values (pruef.id('k'), 'MyImmo', 'verified');
insert into public.mfa_wiederherstellung (user_id, code_hash) values (pruef.id('k'), repeat('a', 64));

-- Der eigentliche Angriff: Passwort-Sitzung (aal1) eines 2FA-Kontos legt einen eigenen Hash an.
select pruef.als('k', 'aal1');
select pruef.wirft($$insert into public.mfa_wiederherstellung (user_id, code_hash) values (pruef.id('k'), repeat('b', 64))$$,
  'aal1 kann keinen eigenen Code-Hash einfügen');
select pruef.wirft($$select code_hash from public.mfa_wiederherstellung$$, 'aal1 kann keine Hashes lesen');
select pruef.wirft($$update public.mfa_wiederherstellung set verbraucht_am = null$$, 'aal1 kann keinen Code zurücksetzen');
select pruef.wirft($$delete from public.mfa_wiederherstellung$$, 'aal1 kann keine Codes löschen');
select pruef.zurueck();

-- Auch eine aal2-Sitzung nicht direkt — der Weg führt nur über den Server.
select pruef.als('k', 'aal2');
select pruef.wirft($$insert into public.mfa_wiederherstellung (user_id, code_hash) values (pruef.id('k'), repeat('c', 64))$$,
  'auch aal2 schreibt nicht direkt (nur über den Server)');
select pruef.wirft($$select count(*) from public.mfa_wiederherstellung$$, 'auch aal2 liest nicht direkt');
select pruef.zurueck();

select pruef.als_anon();
select pruef.wirft($$select count(*) from public.mfa_wiederherstellung$$, 'anon liest nichts');
select pruef.zurueck();

-- Positive Gegenprobe: Die Service-Role (Server) kann anlegen, atomar verbrauchen und aufräumen.
select pruef.als_service();
insert into public.mfa_wiederherstellung (user_id, code_hash) values (pruef.id('k'), repeat('d', 64));
select pruef.ja(pruef.betroffen($$update public.mfa_wiederherstellung set verbraucht_am = now()
  where user_id = pruef.id('k') and code_hash = repeat('d', 64) and verbraucht_am is null$$) = 1,
  'Server verbraucht einen Code atomar');
select pruef.ja(pruef.betroffen($$update public.mfa_wiederherstellung set verbraucht_am = now()
  where user_id = pruef.id('k') and code_hash = repeat('d', 64) and verbraucht_am is null$$) = 0,
  'derselbe Code ist kein zweites Mal verbrauchbar');
select pruef.zurueck();

-- Unverändert: Nach dem Angriffsversuch liegt kein fremder Hash in der Tabelle.
select pruef.ja(not exists (select 1 from public.mfa_wiederherstellung where code_hash in (repeat('b', 64), repeat('c', 64))),
  'kein eingeschleuster Hash vorhanden');

rollback;
