-- Demo-Objekte bekommen feste Koordinaten
--
-- Anlass (Review 30.09.2026): Die Demo zeigte „Karte noch nicht aktiviert".
-- Die Karte geokodiert beim ersten Aufruf von /karte und speichert lat/lng in
-- der properties-Zeile. Im Demo-Konto scheitert das Speichern (Schreibsperre),
-- also hätte JEDER Demo-Besucher erneut drei Nominatim-Anfragen mit je
-- 1,1 s Pause ausgelöst — langsam und gegen die Nutzungsregeln von Nominatim.
--
-- Die Werte stammen aus demselben Dienst und derselben Abfrage wie
-- `lib/geocode.ts` (Nominatim, countrycodes=de, limit=1), am 30.09.2026 je
-- Adresse hausnummerngenau aufgelöst.
--
-- Geschrieben wird in den Live-Bestand UND in den Schnappschuss `demo_seed` —
-- sonst löscht der nächste Demo-Reset die Punkte wieder. Zuordnung über die
-- Adresse, nicht über erzeugte IDs.

do $$
declare
  demo_id uuid;
  punkt record;
begin
  select id into demo_id from auth.users where email = 'demo.vermieter@myimmo.test';
  if demo_id is null then
    raise notice 'Demo-Konto nicht gefunden — Koordinaten übersprungen.';
    return;
  end if;

  for punkt in
    select * from (values
      ('Karl-Liebknecht-Str. 42, 04275 Leipzig', 51.3256329, 12.3733746),
      ('Müllerstr. 130, 13349 Berlin',          52.5520683, 13.3486958),
      ('Brühl 8, 04109 Leipzig',                51.3429113, 12.3738334),
      ('Zschochersche Str. 12, 04229 Leipzig',  51.3337880, 12.3388455),
      ('Beesener Str. 5, 06110 Halle (Saale)',  51.4725414, 11.9689917),
      ('Bautzner Str. 88, 01099 Dresden',       51.0651192, 13.7673482)
    ) as v(adresse, lat, lng)
  loop
    update public.properties set lat = punkt.lat, lng = punkt.lng
      where user_id = demo_id and adresse = punkt.adresse;
    update demo_seed.properties set lat = punkt.lat, lng = punkt.lng
      where user_id = demo_id and adresse = punkt.adresse;
  end loop;
end $$;
