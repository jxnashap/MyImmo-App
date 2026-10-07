-- NK Stufe 1, Audit 07.10.2026 (A4): CO₂ laut Brennstoff-/Wärmerechnung einmal für das GANZE Gebäude.
alter table public.nk_objekt_jahr
  add column if not exists co2_kg numeric(12,2) check (co2_kg is null or co2_kg >= 0),
  add column if not exists co2_kosten numeric(12,2) check (co2_kosten is null or co2_kosten >= 0),
  add column if not exists co2_gewerbe boolean not null default false;
