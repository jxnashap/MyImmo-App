-- B01 – Wiederherstellungscodes nur noch über den Server (11.10.2026).
--
-- BEFUND (supabase/test/rls/b01_mfa_codes.sql): Die Regel `own_mfa_wiederherstellung` erlaubte
-- jedem angemeldeten Konto ALLES auf den eigenen Zeilen — auch einer reinen Passwort-Sitzung
-- (aal1) eines 2FA-Kontos. Wer das Passwort kannte, konnte per REST einen selbst gewählten
-- Code-Hash einfügen und mit diesem Code über lib/actions/mfa.ts den zweiten Faktor entfernen
-- lassen. Ebenso ließen sich die Hashes lesen (bloßer SHA-256 über 40 Bit → offline ratbar).
--
-- JETZT: Die Tabelle ist für anon/authenticated/PUBLIC vollständig entzogen; lib/actions/mfa.ts
-- liest und schreibt sie ausschließlich über die Service-Role (serverseitig, nach Prüfung von
-- Faktor, aal2 und Frische). Die Regel bleibt als zweite Linie bestehen, lässt aber nichts mehr zu.
--
-- REIHENFOLGE beim Ausrollen: ERST den Code (lib/actions/mfa.ts mit Admin-Client) deployen, DANN
-- diese Migration — umgekehrt scheitern bis zum Deploy das Erzeugen und Zählen der Codes.
-- Kein Löschbefehl; Service-Role behält ihre Standardrechte.

revoke all on table public.mfa_wiederherstellung from public, anon, authenticated;

alter policy own_mfa_wiederherstellung on public.mfa_wiederherstellung
  using (false)
  with check (false);

comment on table public.mfa_wiederherstellung is
  'Wiederherstellungscodes (HMAC, früher SHA-256) für 2FA. Nur Service-Role (lib/actions/mfa.ts); für Nutzer gesperrt seit 20261011102000.';
