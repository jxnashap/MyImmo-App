-- Mieterportal-Zugang endet automatisch (02.10.2026, Entscheidung des Betreibers):
-- Nach dem Auszug sieht der Mieter sein Portal noch bis zum 31.12. des FOLGEJAHRES — so
-- lange, wie die Nebenkostenabrechnung für das Auszugsjahr zugehen muss (§ 556 Abs. 3 BGB:
-- zwölf Monate nach Ende des Abrechnungszeitraums). Danach nichts mehr.
--
-- Vorher endete ein Zugang nie (docs/zukunft/MIETERPORTAL-AUSBAU.md, F2): Ein Ex-Mieter sah
-- dauerhaft alles, was später an seine Mieter-Zeile gehängt wurde, und JEDEN künftig
-- freigegebenen Beleg des Objekts — auch aus Jahren, in denen er dort nicht wohnte.
--
-- Umsetzung: EINE Prüffunktion, an der alle neun Stellen hängen (sieben Regeln, zwei
-- Sichten). Zeitgesteuert über das Datum, ohne Aufräum-Job, der unbemerkt ausfallen kann.
-- Stichtag in deutscher Zeit (der Server läuft in UTC).
--
-- Belege zusätzlich auf die eigene Mietzeit begrenzt: vom 1.1. des Einzugsjahres bis zum
-- 31.12. des Auszugsjahres (eine Jahresabrechnung umfasst das ganze Kalenderjahr).

create or replace function public.mieter_zugang_endet(p_mietende date)
 returns date
 language sql
 immutable
as $$
  select case when p_mietende is null then null
              else make_date(extract(year from p_mietende)::int + 1, 12, 31) end
$$;

-- Hat das angemeldete Konto einen GÜLTIGEN Zugang zu dieser Mieter-Zeile?
-- SECURITY DEFINER: Mieter lesen die Tabelle `mieter` nicht direkt (Audit A4).
create or replace function public.mieter_zugang_aktiv(p_mieter uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select exists (
    select 1
      from public.mieter_zugaenge z
      join public.mieter m on m.id = z.mieter_id
     where z.user_id = auth.uid()
       and z.mieter_id = p_mieter
       and (m.mietende is null
            or (now() at time zone 'Europe/Berlin')::date <= public.mieter_zugang_endet(m.mietende))
  )
$$;

-- Darf das angemeldete Konto einen freigegebenen Beleg dieses Objekts mit diesem Datum sehen?
create or replace function public.mieter_beleg_sichtbar(p_prop uuid, p_datum date)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select exists (
    select 1
      from public.mieter_zugaenge z
      join public.mieter m on m.id = z.mieter_id
     where z.user_id = auth.uid()
       and z.prop_id = p_prop
       and (m.mietende is null
            or (now() at time zone 'Europe/Berlin')::date <= public.mieter_zugang_endet(m.mietende))
       and (m.mietbeginn is null or p_datum is null
            or p_datum >= make_date(extract(year from m.mietbeginn)::int, 1, 1))
       and (m.mietende is null or p_datum is null
            or p_datum <= make_date(extract(year from m.mietende)::int, 12, 31))
  )
$$;

revoke execute on function public.mieter_zugang_aktiv(uuid) from public, anon;
revoke execute on function public.mieter_beleg_sichtbar(uuid, date) from public, anon;
grant execute on function public.mieter_zugang_aktiv(uuid) to authenticated;
grant execute on function public.mieter_beleg_sichtbar(uuid, date) to authenticated;

-- ---- Regeln: dieselbe Bedeutung wie vorher, plus Gültigkeit ----

-- ALTER statt DROP + CREATE: ändert nur den Ausdruck. (Ein DROP löst in der Supabase-
-- Schnittstelle eine Bestätigung aus, die in der Cloud-Sitzung nicht ankommt — der erste
-- Versuch lief am 02.10.2026 in den Zeitüberlauf, ohne etwas anzuwenden.)

alter policy notizen_select_mieter_freigabe on public.notizen
  using (mieter_freigabe and mieter_id is not null and public.mieter_zugang_aktiv(mieter_id));

alter policy einnahmen_select_mieter_zugang on public.einnahmen
  using (
    (kategorie = 'Miete' or kategorie = 'Nebenkosten')
    and mieter_id is not null
    and public.mieter_zugang_aktiv(mieter_id));

alter policy kosten_select_mieter_freigabe on public.kosten
  using (mieter_freigabe and public.mieter_beleg_sichtbar(prop_id, buchungsdatum));

alter policy vanfrage_select_mieter on public.vermieter_anfragen
  using (public.mieter_zugang_aktiv(mieter_id));

alter policy vanfrage_update_mieter on public.vermieter_anfragen
  using (public.mieter_zugang_aktiv(mieter_id))
  with check (public.mieter_zugang_aktiv(mieter_id));

alter policy anliegen_insert_mieter on public.anliegen
  with check (
    (select auth.uid()) = mieter_user_id
    and exists (
      select 1 from public.mieter_zugaenge z
       where z.user_id = (select auth.uid())
         and z.mieter_id = anliegen.mieter_id
         and z.vermieter_id = anliegen.vermieter_id)
    and public.mieter_zugang_aktiv(mieter_id));

alter policy zaehler_insert_mieter on public.zaehlerstand_meldungen
  with check (
    (select auth.uid()) = mieter_user_id
    and exists (
      select 1 from public.mieter_zugaenge z
       where z.user_id = (select auth.uid())
         and z.mieter_id = zaehlerstand_meldungen.mieter_id
         and z.vermieter_id = zaehlerstand_meldungen.vermieter_id)
    and public.mieter_zugang_aktiv(mieter_id));

-- ---- Sichten des Portals (Spalten unverändert, Audit A4) ----

create or replace view public.mieter_portal with (security_barrier = true, security_invoker = false) as
  select m.id, m.prop_id, m.vorname, m.nachname, m.einheit, m.flaeche, m.mietbeginn, m.mietende,
         m.kuendigung, m.kaltmiete, m.nk_vorauszahlung, m.stellplatz, m.stellplatz_miete,
         m.kaution, m.kaution_status, m.mietart
    from public.mieter m
   where public.mieter_zugang_aktiv(m.id);

create or replace view public.properties_portal with (security_barrier = true, security_invoker = false) as
  select p.id, p.bezeichnung, p.adresse, p.typ
    from public.properties p
   where exists (
     select 1 from public.mieter_zugaenge z
      where z.prop_id = p.id
        and z.user_id = (select auth.uid())
        and public.mieter_zugang_aktiv(z.mieter_id));
