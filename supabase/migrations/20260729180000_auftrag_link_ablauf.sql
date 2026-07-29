-- Der oeffentliche Auftrags-Link (/auftrag/<token>) gab Name, Telefonnummer
-- und E-Mail-Adresse des MIETERS heraus — an jeden, der den Link hat, und ohne
-- jedes Ablaufdatum. Ein Link, der einmal per E-Mail an eine Handwerksfirma
-- ging, blieb damit dauerhaft gueltig: weitergeleitet, im Postfach eines
-- ausgeschiedenen Mitarbeiters, in einem Ticketsystem. Der Mieter hat dem nie
-- zugestimmt und kann es auch nicht widerrufen.
--
-- Die Beleihungs-Freigabe macht es laengst richtig (beleihung_public_info
-- prueft `aktiv and ablauf > now()`); hier fehlte das Gegenstueck.

alter table public.auftraege
  add column if not exists public_token_ablauf timestamptz;

-- Bestand: 90 Tage ab Erstellung. Bereits aeltere Auftraege sind damit sofort
-- abgelaufen — das ist beabsichtigt, ihre Terminabsprache ist laengst durch.
update public.auftraege
   set public_token_ablauf = coalesce(created_at, now()) + interval '90 days'
 where public_token_ablauf is null;

alter table public.auftraege
  alter column public_token_ablauf set default (now() + interval '90 days'),
  alter column public_token_ablauf set not null;

comment on column public.auftraege.public_token_ablauf is
  'Ablauf des oeffentlichen Auftrags-Links. Danach liefert auftrag_public_info nichts mehr; der Vermieter kann den Link ueber verlaengere_auftrag_link neu aktivieren.';

-- RPC: Ablauf mitpruefen.
create or replace function public.auftrag_public_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  a record;
begin
  select au.titel, au.beschreibung, au.objekt_name, au.vermieter_name, au.termin, au.status,
         m.vorname, m.nachname, m.telefon, m.email
    into a
  from auftraege au
  left join mieter m on m.id = au.mieter_id
  where au.public_token = p_token
    and au.status in ('offen','angenommen')
    and au.public_token_ablauf > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'titel', a.titel,
    'beschreibung', a.beschreibung,
    'objekt', a.objekt_name,
    'vermieter', a.vermieter_name,
    'termin', a.termin,
    'mieter_name', nullif(trim(coalesce(a.vorname,'') || ' ' || coalesce(a.nachname,'')), ''),
    'mieter_telefon', a.telefon,
    'mieter_email', a.email
  );
end $function$;

-- Der Vermieter/Hausmeister kann den Link erneuern, wenn sich die Ausfuehrung
-- zieht — bewusst als eigene Aktion, nicht automatisch bei jedem Aufruf.
create or replace function public.verlaengere_auftrag_link(p_auftrag_id uuid, p_tage int default 90)
returns timestamptz language plpgsql security definer set search_path to 'public' as $function$
declare
  neu timestamptz;
begin
  if p_tage < 1 or p_tage > 365 then
    raise exception 'Verlaengerung nur zwischen 1 und 365 Tagen moeglich.';
  end if;
  update auftraege
     set public_token_ablauf = now() + make_interval(days => p_tage)
   where id = p_auftrag_id
     and (vermieter_id = auth.uid() or service_user_id = auth.uid())
  returning public_token_ablauf into neu;
  if neu is null then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung.';
  end if;
  return neu;
end $function$;

revoke all on function public.verlaengere_auftrag_link(uuid, int) from public, anon;
grant execute on function public.verlaengere_auftrag_link(uuid, int) to authenticated;
