-- Mietkonto für den Mieter (02.10.2026, Schritt 6 aus docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
-- Das Soll eines Monats hängt an den Miet-Zeiträumen (Mieterhöhungen, Staffeln). Der Mieter
-- darf die Tabelle `miet_zeitraeume` nicht lesen (nur der Vermieter) — ohne sie wäre sein Soll
-- nach jeder Mieterhöhung falsch. Wie bei `mieter_portal` (Audit A4): eine Sicht mit genau den
-- Spalten, die das Soll braucht, gefiltert über `mieter_zugang_aktiv()`, mit Eigentümerrechten
-- und security_barrier. Kein Zugriff auf die Tabelle selbst.

create or replace view public.miet_zeitraeume_portal with (security_barrier = true, security_invoker = false) as
  select z.mieter_id, z.von, z.bis, z.kaltmiete, z.nk_vorauszahlung, z.stellplatz_miete
    from public.miet_zeitraeume z
   where public.mieter_zugang_aktiv(z.mieter_id);

revoke all on public.miet_zeitraeume_portal from public, anon;
grant select on public.miet_zeitraeume_portal to authenticated;
