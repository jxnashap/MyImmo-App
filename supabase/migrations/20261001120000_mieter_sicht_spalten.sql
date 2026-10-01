-- Audit 01.10.2026, Paket 5 (A4): Mieter-Konten lasen per REST die KOMPLETTE
-- Objekt- und Mieterzeile ihres Vermieters — properties hat 39 Spalten
-- (kaufpreis, wert, marktwert_aktuell, bodenrichtwert, afa_*, notiz_import),
-- mieter 33 (notiz = Vermieter-Notiz ÜBER den Mieter, miethistorie,
-- iban/kaution_bank als Chiffretext). Die Zeilen-Policies
-- properties_select_zugang / mieter_select_zugang gaben alles frei.
--
-- Jetzt: zwei Sichten mit genau den Spalten, die das Mieterportal zeigt.
-- Sie laufen als Eigentümer (postgres, kein security_invoker) und filtern
-- selbst über mieter_zugaenge auf auth.uid(); security_barrier verhindert,
-- dass eine Funktion im WHERE an den Filter vorbei liest. Die Zeilen-Policies
-- auf den Tabellen entfallen — ein Mieter sieht die Tabellen nicht mehr.
--
-- Geprüft vor dem Anwenden: Keine andere Policy und kein Mieter-Codepfad
-- liest mieter/properties mit Mieter-Rolle außer app/(app)/portal/page.tsx
-- (umgestellt). Die Tenant-Policies auf anliegen, einnahmen, kosten, notizen,
-- vermieter_anfragen, zaehlerstand_meldungen gehen über mieter_zugaenge.

drop policy if exists properties_select_zugang on public.properties;
drop policy if exists mieter_select_zugang on public.mieter;

create or replace view public.mieter_portal
with (security_barrier = true, security_invoker = false) as
  select m.id, m.prop_id, m.vorname, m.nachname, m.einheit, m.flaeche,
         m.mietbeginn, m.mietende, m.kuendigung,
         m.kaltmiete, m.nk_vorauszahlung, m.stellplatz, m.stellplatz_miete,
         m.kaution, m.kaution_status, m.mietart
    from public.mieter m
   where exists (
     select 1 from public.mieter_zugaenge z
      where z.mieter_id = m.id and z.user_id = (select auth.uid())
   );

create or replace view public.properties_portal
with (security_barrier = true, security_invoker = false) as
  select p.id, p.bezeichnung, p.adresse, p.typ
    from public.properties p
   where exists (
     select 1 from public.mieter_zugaenge z
      where z.prop_id = p.id and z.user_id = (select auth.uid())
   );

revoke all on public.mieter_portal from public, anon;
revoke all on public.properties_portal from public, anon;
grant select on public.mieter_portal to authenticated;
grant select on public.properties_portal to authenticated;
