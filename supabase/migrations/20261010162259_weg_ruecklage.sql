-- Erhaltungsrücklage der WEG je Steuerjahr (10.10.2026, Betreiber nach P14).
-- BFH, Urteil vom 14.01.2025, IX R 19/24 (BStBl 2025 II S. 291): Die Zuführung zur Erhaltungsrücklage
-- ist keine Werbungskosten; abziehbar ist erst, was die Gemeinschaft für Erhaltung ausgibt (Entnahme).
-- Werte aus der WEG-Jahresabrechnung: {"2025": {"zufuehrung": 600, "entnahme": 0}}.
-- Hängt am Objekt → wird mit ihm gelöscht, keine eigene Tabelle, keine Kontolöschungs-Zeile. Kein delete.
alter table public.properties add column if not exists weg_ruecklage jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_weg_ruecklage_objekt') then
    alter table public.properties add constraint properties_weg_ruecklage_objekt
      check (jsonb_typeof(weg_ruecklage) = 'object');
  end if;
end $$;
