-- Demo: Schuldzinsen als Buchungen (externes Review, 30.09.2026).
--
-- Die Steuerseite der Demo zeigte „Die Schuldzinsen sind aus der heutigen
-- Restschuld hochgerechnet …" — weil im Schnappschuss keine einzige
-- Zinsbuchung lag. Die Anlage V schätzt dann aus der HEUTIGEN Restschuld, und
-- der Hinweis sagt ehrlich, dass der Wert nicht in die Steuererklärung gehört.
-- Ein Schaustück sollte zeigen, wie es richtig aussieht: gebuchte Zinsen.
--
-- Monatliche Zinsbuchung je Darlehen, gleicher Zeitraum wie das Hausgeld im
-- Schnappschuss (2025-01 bis 2026-06), jeweils zum 1. Die Restschuld wird dafür
-- rückwärts fortgeschrieben (Annuität: frühere Monate = höhere Restschuld =
-- mehr Zins), damit die Beträge nicht achtzehnmal identisch dastehen.
-- Der Reset schreibt sie wie alle Kosten aus dem Vorjahresmonat fort.
--
-- Der Monats-Cashflow zählt diese Buchungen NICHT als Kosten — die Zinsen
-- stecken bereits in der Kreditrate (lib/cashflowKennzahl.ts, `laufendeKosten`).
-- Geprüft in einer zurückgerollten Transaktion: 72 Schnappschuss-Zeilen,
-- 84 live nach dem Reset (bis zum laufenden Monat), Zinsen 2025 = 29.678,66 €.
do $$
declare
  demo_id uuid;
  k record;
  m int;
  zins_monat numeric;
  tilgung numeric;
  rest numeric;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise exception 'Demo-Konto nicht gefunden';
  end if;

  delete from demo_seed.kosten where user_id = demo_id and kategorie = 'Schuldzinsen';

  for k in
    select kr.prop_id, kr.restschuld, kr.zinssatz, kr.monatsrate
      from demo_seed.kredite kr
     where kr.user_id = demo_id and kr.restschuld > 0 and kr.zinssatz > 0
  loop
    -- Tilgung beim Anker (2026-06): Rate minus Zins.
    tilgung := k.monatsrate - k.restschuld * k.zinssatz / 100 / 12;
    for m in 0 .. 17 loop  -- 2026-06 zurück bis 2025-01
      rest := k.restschuld + greatest(tilgung, 0) * m;
      zins_monat := round(rest * k.zinssatz / 100 / 12, 2);
      insert into demo_seed.kosten
        (id, user_id, prop_id, buchungsdatum, kategorie, betrag, beschreibung, wiederkehrend, mieter_freigabe, created_at)
      values
        (gen_random_uuid(), demo_id, k.prop_id,
         (date '2026-06-01' - make_interval(months => m))::date,
         'Schuldzinsen', zins_monat, 'Darlehenszinsen', true, false, now());
    end loop;
  end loop;
end $$;

-- Live-Bestand sofort angleichen, nicht erst beim nächsten Demo-Start.
select public.demo_zuruecksetzen();
