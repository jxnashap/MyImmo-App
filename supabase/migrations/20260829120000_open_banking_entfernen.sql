-- Open Banking (Konto-Anbindung) zurückgestellt — Feature komplett entfernt.
-- Siehe docs/zukunft/OPEN-BANKING.md; der vollständige Code liegt in der
-- Git-Historie bis Commit 85feb98 (inkl. der CREATE-Statements dieser Tabellen).
-- Die Tabellen enthielten nur Sandbox-Testreste (nie live gegangen).

drop table if exists public.bank_umsaetze cascade;
drop table if exists public.bank_auth_anfragen cascade;
drop table if exists public.bankverbindungen cascade;

-- Das bezahlte Banking-Add-on entfällt mit dem Feature (Bezahlsystem ist ohnehin inaktiv).
alter table public.abos drop column if exists banking_addon;
