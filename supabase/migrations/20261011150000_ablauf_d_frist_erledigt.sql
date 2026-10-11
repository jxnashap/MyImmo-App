-- Ablauf D (Prüfstand 11.10.2026, Phase 5): Fälligkeit und erledigter Geschäftsvorgang unterscheiden.
--
-- VORHER: Eine abgeleitete Frist (Wohnungsgeberbestätigung, Mieterhöhung, NK-Abrechnung) war entweder
-- „fällig“ oder AUSGEBLENDET. Ausblenden sagt aber nur „will ich nicht sehen“ — nicht, ob und wie das
-- Schreiben den Mieter erreicht hat. Ein im Archiv erzeugtes PDF galt nirgends als erledigt, und genau so
-- sollte es auch bleiben: Ein PDF ist kein Zustellnachweis.
--
-- JETZT: Dieselbe Zeile in `frist_ausgeblendet` trägt einen Grund. `erledigt` verlangt Datum und
-- Zustellweg (vom Vermieter bestätigt) und optional das Schreiben im Archiv. Altbestand bleibt
-- „ausgeblendet“ (Standard). Erledigt-Zeilen fallen wie ausgeblendete aus den offenen Listen.
-- Kein Löschbefehl, keine Fremdschlüssel → per apply_migration möglich. VOR dem Code-Deploy (der Code
-- liest die neuen Spalten).

alter table public.frist_ausgeblendet add column if not exists grund text not null default 'ausgeblendet';
alter table public.frist_ausgeblendet add column if not exists erledigt_am date;
alter table public.frist_ausgeblendet add column if not exists zustellweg text;
alter table public.frist_ausgeblendet add column if not exists notiz_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'frist_grund_wert') then
    alter table public.frist_ausgeblendet add constraint frist_grund_wert check (grund in ('ausgeblendet', 'erledigt'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'frist_erledigt_vollstaendig') then
    alter table public.frist_ausgeblendet add constraint frist_erledigt_vollstaendig
      check (grund <> 'erledigt' or (erledigt_am is not null and zustellweg is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'frist_zustellweg_wert') then
    alter table public.frist_ausgeblendet add constraint frist_zustellweg_wert check (zustellweg is null or zustellweg in
      ('persoenlich', 'bote', 'einwurf_einschreiben', 'einschreiben_rueckschein', 'post', 'mail', 'portal', 'meldebehoerde', 'sonstiges'));
  end if;
  -- Ein Erledigt-Vermerk ändert sich; dazu braucht es (anders als beim bloßen Ausblenden) eine Update-Regel.
  if not exists (select 1 from pg_policies where tablename = 'frist_ausgeblendet' and policyname = 'eigene Fristen aendern') then
    create policy "eigene Fristen aendern" on public.frist_ausgeblendet for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Das Schreiben, auf das sich der Vermerk stützt, muss dem Vermieter gehören (Lehre aus Ablauf C:
-- eine Spalte, die auf eine Konto-Zeile zeigt, prüft das Eigentum).
create or replace function public.frist_notiz_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if new.notiz_id is not null and not exists (
       select 1 from public.notizen n where n.id = new.notiz_id and n.user_id = new.user_id) then
    raise exception 'Das Schreiben gehört nicht zu diesem Konto.' using errcode = '42501', hint = 'frist_bezug';
  end if;
  return new;
end
$$;
revoke all on function public.frist_notiz_pruefen() from public, anon, authenticated;
create or replace trigger frist_ausgeblendet_notiz_pruefen
  before insert or update of notiz_id, user_id on public.frist_ausgeblendet
  for each row execute function public.frist_notiz_pruefen();

comment on column public.frist_ausgeblendet.grund is 'ausgeblendet (nur Ansicht) | erledigt (vom Vermieter bestätigt, mit Datum und Zustellweg) — Ablauf D.';
