-- Gesamtprüfung P3, B44 (08.10.2026): Weitere Mieter laut Vertrag.
--
-- Mieterhöhung und Kündigung müssen an ALLE Vertragspartner gehen (Berliner Mieterverein;
-- eigener Ratgeber lib/ratgeber.ts). Bisher kannte die Mieterzeile nur einen Namen — ein
-- Vertrag von Anna und Ben Weber stand als „Anna Weber“ da, und der Brief ging nur an sie.
--
-- Freitext, je Zeile (oder Komma/Semikolon) ein Name; gelesen über `weitereMieterListe()`
-- (lib/briefPruefung.ts). Nicht in den Portal-Sichten (die nennen ihre Spalten einzeln).

alter table public.mieter add column if not exists weitere_mieter text;

-- Nur anlegen, wenn neu (idempotent, ohne Entfernen-Befehl — der löst den Bestätigungsdialog aus).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mieter_weitere_mieter_laenge') then
    alter table public.mieter add constraint mieter_weitere_mieter_laenge
      check (weitere_mieter is null or char_length(weitere_mieter) <= 600);
  end if;
end $$;
