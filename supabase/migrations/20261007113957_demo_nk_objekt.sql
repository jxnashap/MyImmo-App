-- Demo: Nebenkosten am Objekt für das „Zweifamilienhaus Dresden“ (NK Stufe 1, 07.10.2026).
-- Die Demo kann nichts speichern — ohne Beispieldaten zeigte /properties/<id>/nebenkosten nur eine
-- leere Liste. Gleiches Muster wie die Demo-Kaufprüfungen (20261006064806): direkt eingefügt, NICHT im
-- Demo-Reset (der fasst diese Tabellen nicht an), feste IDs von Objekt und Mietern (stehen im
-- Schnappschuss). Idempotent: legt nur an, was für Objekt + Jahr noch fehlt. Kein delete.
--
-- Die Hausbeträge passen zu den bisherigen Positionen beim Mieter (Krüger 60 m², Berger 70 m²) und
-- zeigen jeden Schlüssel einmal, auch einen Rest beim Vermieter (Wasser: Hauptzähler > Wohnungen).
--
-- Grenze: Jahr fest 2025. Der Reset schiebt die übrigen Demo-Daten jahresweise weiter; ab 2027 zeigt
-- die Seite standardmäßig 2026 (leer, die Abrechnung fällt dann auf den Altbestand zurück).

insert into public.nk_objekt_jahr (user_id, prop_id, jahr, flaeche_gesamt, einheiten, mea_gesamt, mieter)
select u.id, 'd560ceb5-9dc2-4869-a0c8-41833c061a2c', 2025, 130, 2, null,
       '{"381fd68f-2229-4ada-8174-3027dbe2e91f": {"personen": 1}, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": {"personen": 2}}'::jsonb
from auth.users u
where u.email = 'demo.vermieter@myimmo.test'
  and exists (select 1 from public.properties p where p.id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c' and p.user_id = u.id)
on conflict (prop_id, jahr) do nothing;

insert into public.nk_objekt_kosten (user_id, prop_id, jahr, bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, quelle, sort)
select u.id, 'd560ceb5-9dc2-4869-a0c8-41833c061a2c', 2025, k.bezeichnung, k.betrag, k.schluessel, k.umlagefaehig, k.lohnanteil, k.art_35a, k.nenner, k.werte, 'manuell', k.sort
from auth.users u
cross join (values
  ('Grundsteuer',          280.00, 'flaeche',   true,  null::numeric, null::text,     null::numeric, '{}'::jsonb, 1),
  ('Gebäudeversicherung',  325.00, 'flaeche',   true,  null,          null,           null,          '{}'::jsonb, 2),
  ('Wasser / Abwasser',    780.00, 'verbrauch', true,  null,          null,           130,           '{"381fd68f-2229-4ada-8174-3027dbe2e91f": 58, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": 68}'::jsonb, 3),
  ('Heizung / Warmwasser', 1400.00, 'direkt',   true,  null,          null,           null,          '{"381fd68f-2229-4ada-8174-3027dbe2e91f": 640, "f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2": 760}'::jsonb, 4),
  ('Müllabfuhr',           252.00, 'personen',  true,  null,          null,           null,          '{}'::jsonb, 5),
  ('Allgemeinstrom',       120.00, 'einheiten', true,  null,          null,           null,          '{}'::jsonb, 6),
  ('Gartenpflege',         180.00, 'flaeche',   true,  150,           'haushaltsnah', null,          '{}'::jsonb, 7),
  ('Verwaltungskosten',    150.00, 'flaeche',   false, null,          null,           null,          '{}'::jsonb, 8)
) as k(bezeichnung, betrag, schluessel, umlagefaehig, lohnanteil, art_35a, nenner, werte, sort)
where u.email = 'demo.vermieter@myimmo.test'
  and exists (select 1 from public.properties p where p.id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c' and p.user_id = u.id)
  and not exists (
    select 1 from public.nk_objekt_kosten x
    where x.prop_id = 'd560ceb5-9dc2-4869-a0c8-41833c061a2c' and x.jahr = 2025 and x.bezeichnung = k.bezeichnung
  );
