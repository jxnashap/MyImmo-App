-- Demo-Kandidaten: Bundesland als Kürzel, Bewertungsjahr, Kennzahlen neu (Gesamtprüfung 07.10.2026, Paket P9).
--
-- Drei Änderungen an den vier Beispiel-Kaufprüfungen aus 20261006064806 — nur Werte, keine neue Zeile:
--   1. `data.bundesland`: Kürzel statt Satz (B32). Leipzig stand als „0.055“ da und erschien nach dem Laden
--      als Bremen, Halle als „0.05“ unter Baden-Württemberg. Jetzt SN (Sachsen) bzw. ST (Sachsen-Anhalt);
--      die Grunderwerbsteuer bleibt gleich.
--   2. `data.bewertungsjahr` = 2026 (C28): Restnutzungsdauer und Bewirtschaftungskosten hängen am Jahr —
--      ohne das Feld wäre tests/demoKandidaten.test.ts am 01.01.2027 rot geworden.
--   3. `summary` = kennzahlenSummary(objektKennzahlen(data)) mit den Bewirtschaftungskosten 2026 statt 2021
--      (B33): Marktwerte sinken um 3–5 % (Halle 87.621 → 83.442 €, wie im Audit nachgerechnet), dazu das
--      Merkmal `marktwertVorlaeufig` (B30) — alle vier sind ohne Bodenrichtwert gerechnet, also vorläufig.
--
-- Nur das Demo-Konto, nur diese vier IDs. Wiederholbar (setzt dieselben Werte). Kein Lösch- oder
-- Entfernen-Befehl. tests/demoKandidaten.test.ts liest diese Datei und rechnet jede Zeile nach.

update public.kalkulationen k
   set data = v.data, summary = v.summary
  from auth.users u,
  (values
  ('567eb840-6e71-4cfe-b7d3-8dca4cc19fbf'::uuid,
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Altbau-ETW, Leipzig-Gohlis (Beispiel)","kaufpreis":"189000","flaeche":"64","kaltmiete":"610","baujahr":"1908","bundesland":"SN","bewertungsjahr":"2026"}'::jsonb,
   '{"kp":189000,"gesamtInvest":209922.3,"sanierung":0,"preisM2":2953.125,"brutto":3.8730158730158735,"nettomiet":2.789603581896731,"faktor":25.81967213114754,"kaltmiete":610,"nutzung":1,"marktwert":93347,"marktwertVorlaeufig":1}'::jsonb),
  ('33442b7f-ac55-4694-add5-454306a55410'::uuid,
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"ETW mit Balkon, Leipzig-Schönefeld (Beispiel)","kaufpreis":"159000","flaeche":"58","kaltmiete":"545","baujahr":"1995","bundesland":"SN","bewertungsjahr":"2026"}'::jsonb,
   '{"kp":159000,"gesamtInvest":176601.3,"sanierung":0,"preisM2":2741.3793103448274,"brutto":4.113207547169812,"nettomiet":2.962605598033537,"faktor":24.31192660550459,"kaltmiete":545,"nutzung":1,"marktwert":119525,"marktwertVorlaeufig":1}'::jsonb),
  ('175142b1-5b5b-4787-b732-7e5ca9809cef'::uuid,
   '{"makler":"3.57","sanierung":"18500","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Altbau-ETW, Halle-Paulusviertel (Beispiel)","kaufpreis":"142000","flaeche":"66","kaltmiete":"560","baujahr":"1912","bundesland":"ST","bewertungsjahr":"2026"}'::jsonb,
   '{"kp":142000,"gesamtInvest":175509.4,"sanierung":18500,"preisM2":2151.5151515151515,"brutto":4.732394366197183,"nettomiet":3.063083800639738,"faktor":21.13095238095238,"kaltmiete":560,"nutzung":1,"marktwert":83442,"marktwertVorlaeufig":1}'::jsonb),
  ('63c7b4f5-1f5e-4620-ae95-8f5026aa4cb7'::uuid,
   '{"makler":"3.57","sanierung":"","nutzung":"vermietung","bewirt":"20","hausgeld":"","objektTyp":"wohnung","grundFlaeche":"","bodenrichtwert":"","gebTyp":"efh","ausstattung":"3","bpiFaktor":"1.9","regionalFaktor":"1.0","lz":"3.5","anzahlWhg":"1","swFaktor":"1.0","adresse":"Neubau-ETW, Leipzig-Lindenau (Beispiel)","kaufpreis":"289000","flaeche":"71","kaltmiete":"860","baujahr":"2021","bundesland":"SN","bewertungsjahr":"2026"}'::jsonb,
   '{"kp":289000,"gesamtInvest":320992.3,"sanierung":0,"preisM2":4070.4225352112676,"brutto":3.570934256055364,"nettomiet":2.5720243133558034,"faktor":28.003875968992247,"kaltmiete":860,"nutzung":1,"marktwert":228476,"marktwertVorlaeufig":1}'::jsonb)
  ) as v(id, data, summary)
 where k.id = v.id
   and k.user_id = u.id
   and u.email = 'demo.vermieter@myimmo.test';
