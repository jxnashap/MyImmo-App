-- SICHERHEIT (Gesamtprüfung P7, nebenbei gefunden 08.10.2026): Die Portal-Sichten waren SCHREIBBAR.
-- `mieter_portal`, `properties_portal` und `miet_zeitraeume_portal` sind einfache Sichten über eine
-- Tabelle → Postgres macht sie automatisch aktualisierbar, und `authenticated` hatte INSERT/UPDATE/
-- DELETE (Supabase-Standardrechte). Weil die Sichten als Eigentümer laufen (security_invoker=false),
-- griff die RLS der Tabelle nicht: Ein Mieter konnte seine Mieterzeile (Kaltmiete, Mietende,
-- Kautionsstatus), Bezeichnung/Adresse des Objekts und die Miet-Zeiträume des Vermieters ändern oder
-- löschen. In einer zurückgerollten Transaktion als echtes Mieter-Konto nachgewiesen (UPDATE → 1 Zeile).
-- Die Sichten sind nur zum LESEN da (Migration 20261001120000) — Schreibrechte entzogen, auch PUBLIC.
revoke insert, update, delete, truncate, references, trigger on public.mieter_portal          from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.properties_portal      from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.miet_zeitraeume_portal from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.service_objekte_portal from public, anon, authenticated;
alter view public.mieter_portal set (security_invoker = false);
