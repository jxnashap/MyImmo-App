-- Mietminderung erfassen (Gesamtprüfung 07.10.2026, P7 / B15).
-- Liste am Mieter: [{von: "YYYY-MM", bis: "YYYY-MM"|null, prozent|betrag, grund, anliegen_id}].
-- Eine Minderung tritt kraft Gesetzes ein (§ 536 Abs. 1 BGB); geminderte Monate gelten mit dem
-- geminderten Betrag als bezahlt (lib/mietkonto.ts → sollFuerMonat). Hängt am Mieter → wird mit ihm
-- gelöscht, keine eigene Tabelle, keine Kontolöschungs-Zeile nötig. Kein delete.
alter table public.mieter add column if not exists minderungen jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mieter_minderungen_liste') then
    alter table public.mieter add constraint mieter_minderungen_liste
      check (jsonb_typeof(minderungen) = 'array' and jsonb_array_length(minderungen) <= 50);
  end if;
end $$;
