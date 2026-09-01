-- Demo-Konto: Beispielwerte fuer die sechs Mieter
--
-- Vorgabe des Betreibers (30.08.2026): In der Demo soll das Mieterhoehungs-
-- Dokument als Beispiel zum Selbstzusammenstellen benutzbar bleiben. Dafuer
-- fehlten bei ALLEN sechs Mietern genau die beiden Felder, die eine
-- Mieterhoehung erst rechenbar machen:
--   * `mietspiegel`      — ortsuebliche Vergleichsmiete in EUR/m2
--   * `letzte_erhoehung` — Beginn der 12-Monats-Sperrfrist (§ 558 Abs. 1 BGB)
-- Ohne sie zeigt die Mieterhoehung nichts an, und die Verbilligungs-Ampel auf
-- der Mieterseite bleibt grau ("Vergleichsmiete erfassen").
--
-- WIE DIE WERTE GEWAEHLT WURDEN — nicht geraten, sondern gerechnet:
-- `lib/steuer/verbilligt.ts` rechnet prozent = (kalt + nk) / (vgl_m2 * flaeche + nk).
-- Die Vergleichsmieten sind so gesetzt, dass beides zugleich gilt:
--   1. Ampel GRUEN: rund 91-95 % und damit klar ueber der 66-%-Schwelle des
--      § 21 Abs. 2 EStG — eine rote Ampel im Schaufenster waere ein
--      unfreiwilliges Eigentor.
--   2. Erhoehungsspielraum vorhanden: die Kaltmiete liegt UNTER der
--      ortsueblichen Vergleichsmiete, sonst zeigt das Dokument "keine
--      Erhoehung moeglich" — ausgerechnet im einzigen freigeschalteten
--      Werkzeug.
--
--   Weber    880 + 160, 72 m2, 13,60/m2 -> 91,3 %, Spielraum  99,20 EUR
--   Yilmaz   950 + 150, 58 m2, 17,80/m2 -> 93,0 %, Spielraum  82,40 EUR
--   Krueger  860 + 150, 60 m2, 15,60/m2 -> 93,0 %, Spielraum  76,00 EUR
--   Schmidt 1090 + 190, 64 m2, 18,20/m2 -> 94,5 % (Staffel, s. u.)
--   Berger   900 + 170, 70 m2, 14,00/m2 -> 93,0 % (Index, s. u.)
--   Hoffmann 1150 + 210, 105 m2, 11,90/m2 -> 93,2 % (ausgezogen)
--
-- `letzte_erhoehung` NUR bei den drei Standard-Mietverhaeltnissen, jeweils
-- mehr als zwoelf Monate zurueck, damit die Sperrfrist abgelaufen ist.
-- Bewusst NICHT gesetzt bei:
--   * Schmidt — Staffelmiete: Erhoehung nach Vergleichsmiete ist waehrend der
--     Staffel ausgeschlossen (§ 557a Abs. 2 S. 2 BGB). Die naechste Stufe
--     steht bereits in `staffel_datum`.
--   * Berger — Indexmiete: dasselbe nach § 557b Abs. 2 S. 2 BGB.
--   * Hoffmann — Mietende 30.09.2025, also ausgezogen.
-- So zeigt die Demo nebenbei, dass die App die drei Mietarten unterscheidet.
--
-- BEWUSST NICHT ergaenzt: Stellplatzmieten. Sie wuerden die Sollmiete erhoehen,
-- ohne dass es dazu passende Einnahmen gibt — die Demo zeigte dann erfundene
-- Rueckstaende im Mietkonto. Ein huebscheres Feld ist das nicht wert.

do $$
declare
  demo_id uuid;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — Beispielwerte uebersprungen.';
    return;
  end if;

  update public.mieter set mietspiegel = 13.60, letzte_erhoehung = date '2024-07-01'
    where user_id = demo_id and nachname = 'Weber';
  update public.mieter set mietspiegel = 17.80, letzte_erhoehung = date '2023-10-01'
    where user_id = demo_id and nachname = 'Yılmaz';
  update public.mieter set mietspiegel = 15.60, letzte_erhoehung = date '2025-01-01'
    where user_id = demo_id and nachname = 'Krüger';
  update public.mieter set mietspiegel = 18.20
    where user_id = demo_id and nachname = 'Schmidt';
  update public.mieter set mietspiegel = 14.00
    where user_id = demo_id and nachname = 'Berger';
  update public.mieter set mietspiegel = 11.90
    where user_id = demo_id and nachname = 'Hoffmann';

  -- Schnappschuss nachziehen. Ohne diesen Schritt setzt der naechste
  -- Demo-Start (`demo_zuruecksetzen()`) die Werte wieder auf leer zurueck —
  -- der Fehler waere erst beim zweiten Besucher aufgefallen.
  drop table if exists demo_seed.mieter;
  create table demo_seed.mieter as
    select * from public.mieter where user_id = demo_id;
end $$;
