-- Abo-Zahlung als Kostenbuchung (05.10.2026, lib/billing/aboBuchung.ts).
-- Jede bezahlte Paddle-Transaktion wird GENAU EINMAL als Kosten „Verwaltung"
-- gebucht (Anlage V Zeile 46). Paddle stellt Webhooks mindestens einmal zu;
-- Merker und Kostenzeilen entstehen deshalb in EINER Transaktion: Scheitert
-- das Einfügen der Kosten, verschwindet auch der Merker, und die nächste
-- Zustellung bucht erneut.

create table if not exists public.abo_zahlungen (
  transaktion_id text primary key check (transaktion_id ~ '^txn_[a-z0-9]{26}$'),
  user_id uuid not null,
  betrag_cent integer not null check (betrag_cent > 0),
  gebucht_am timestamptz not null default now()
);
-- Keine Policy: nur die Service-Role (über die Funktion unten) liest und schreibt.
alter table public.abo_zahlungen enable row level security;

create or replace function public.abo_zahlung_buchen(
  p_user uuid, p_transaktion text, p_cent integer, p_zeilen jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.abo_zahlungen (transaktion_id, user_id, betrag_cent)
    values (p_transaktion, p_user, p_cent)
    on conflict (transaktion_id) do nothing;
  if not found then
    return false; -- schon gebucht: wiederholte Zustellung
  end if;

  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) = 0 then
    raise exception 'abo_zahlung_buchen: keine Zeilen';
  end if;
  if (select sum(round((z->>'betrag')::numeric * 100)) from jsonb_array_elements(p_zeilen) z) <> p_cent then
    raise exception 'abo_zahlung_buchen: Summe der Zeilen passt nicht zum Betrag';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_zeilen) z
     where z->>'prop_id' is not null
       and not exists (select 1 from public.properties p
                        where p.id = (z->>'prop_id')::uuid and p.user_id = p_user)
  ) then
    raise exception 'abo_zahlung_buchen: Objekt gehört nicht zum Konto';
  end if;

  insert into public.kosten (user_id, prop_id, buchungsdatum, kategorie, betrag, beschreibung)
    select p_user, (z->>'prop_id')::uuid, (z->>'buchungsdatum')::date,
           z->>'kategorie', (z->>'betrag')::numeric, z->>'beschreibung'
      from jsonb_array_elements(p_zeilen) z;
  return true;
end $$;

revoke all on function public.abo_zahlung_buchen(uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.abo_zahlung_buchen(uuid, text, integer, jsonb) to service_role;
