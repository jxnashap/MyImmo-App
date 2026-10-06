-- Demo: vier Beispiel-Kandidaten für den Vergleich (Kaufweg Schritt 1) — Ja des Betreibers 06.10.2026.
-- Vorher zeigte die Demo Schritt 1 leer: Sie hatte keine Kaufprüfungen und kann keine speichern.
--
-- Zahlen: `summary` ist genau kennzahlenSummary(objektKennzahlen(data)) aus lib/kauf/objektKennzahlen.ts —
-- dieselbe Rechnung wie der Objekt-Rechner. tests/demoKandidaten.test.ts rechnet jede Zeile nach.
-- Namen tragen „(Beispiel)“, keine Hausnummern (keine echte Anschrift).
--
-- NICHT im Demo-Reset: `kalkulationen` steht nicht in `tabellen` von demo_zuruecksetzen() — der Reset
-- fasst diese Zeilen nicht an. Die Demo kann nicht schreiben (Trigger demo_schreibsperre + restriktive
-- Policies auf kalkulationen), die Zeilen bleiben also unverändert stehen. Kommt kalkulationen je in den
-- Reset, braucht es vorher eine demo_seed-Kopie dieser Zeilen.
--
-- Idempotent: feste IDs, `on conflict do nothing`. Fehlt das Demo-Konto, wird nichts eingefügt.

insert into public.kalkulationen (id, user_id, name, data, summary, created_at)
select v.id, u.id, v.name, v.data, v.summary, v.created_at
  from auth.users u
 cross join (values
  ('567eb840-6e71-4cfe-b7d3-8dca4cc19fbf'::uuid, 'Altbau-ETW, Leipzig-Gohlis (Beispiel)',
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Altbau-ETW, Leipzig-Gohlis (Beispiel)","kaufpreis":"189000","flaeche":"64","kaltmiete":"610","baujahr":"1908","bundesland":"0.055"}'::jsonb,
   '{"kp":189000,"gesamtInvest":209922.3,"sanierung":0,"preisM2":2953.125,"brutto":3.8730158730158735,"nettomiet":2.789603581896731,"faktor":25.81967213114754,"kaltmiete":610,"nutzung":1,"marktwert":97439}'::jsonb,
   '2026-09-20T09:12:00Z'::timestamptz),
  ('33442b7f-ac55-4694-add5-454306a55410'::uuid, 'ETW mit Balkon, Leipzig-Schönefeld (Beispiel)',
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"ETW mit Balkon, Leipzig-Schönefeld (Beispiel)","kaufpreis":"159000","flaeche":"58","kaltmiete":"545","baujahr":"1995","bundesland":"0.055"}'::jsonb,
   '{"kp":159000,"gesamtInvest":176601.3,"sanierung":0,"preisM2":2741.3793103448274,"brutto":4.113207547169812,"nettomiet":2.962605598033537,"faktor":24.31192660550459,"kaltmiete":545,"nutzung":1,"marktwert":125079}'::jsonb,
   '2026-09-24T17:40:00Z'::timestamptz),
  ('175142b1-5b5b-4787-b732-7e5ca9809cef'::uuid, 'Altbau-ETW, Halle-Paulusviertel (Beispiel)',
   '{"makler":"3.57","sanierung":"18500","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Altbau-ETW, Halle-Paulusviertel (Beispiel)","kaufpreis":"142000","flaeche":"66","kaltmiete":"560","baujahr":"1912","bundesland":"0.05"}'::jsonb,
   '{"kp":142000,"gesamtInvest":175509.4,"sanierung":18500,"preisM2":2151.5151515151515,"brutto":4.732394366197183,"nettomiet":3.063083800639738,"faktor":21.13095238095238,"kaltmiete":560,"nutzung":1,"marktwert":87621}'::jsonb,
   '2026-09-28T11:05:00Z'::timestamptz),
  ('63c7b4f5-1f5e-4620-ae95-8f5026aa4cb7'::uuid, 'Neubau-ETW, Leipzig-Lindenau (Beispiel)',
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Neubau-ETW, Leipzig-Lindenau (Beispiel)","kaufpreis":"289000","flaeche":"71","kaltmiete":"860","baujahr":"2021","bundesland":"0.055"}'::jsonb,
   '{"kp":289000,"gesamtInvest":320992.3,"sanierung":0,"preisM2":4070.4225352112676,"brutto":3.570934256055364,"nettomiet":2.5720243133558034,"faktor":28.003875968992247,"kaltmiete":860,"nutzung":1,"marktwert":235703}'::jsonb,
   '2026-10-02T08:30:00Z'::timestamptz)
 ) as v(id, name, data, summary, created_at)
 where u.email = 'demo.vermieter@myimmo.test'
on conflict (id) do nothing;
