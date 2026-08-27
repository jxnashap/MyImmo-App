-- Bewerbungs-Dokumente: Mietinteressenten können der Selbstauskunft Dateien
-- beilegen (z. B. die letzten 3 Gehaltsabrechnungen, SCHUFA-Auskunft,
-- Mietschuldenfreiheitsbescheinigung). Speicherung wie überall im Projekt als
-- Base64-Data-URL in einer Tabellenspalte — kein Storage-Bucket.
--
-- Sicherheitsmodell wie bei den Bewerbungen selbst:
--   * KEIN öffentliches INSERT — Dateien kommen ausschließlich über die
--     SECURITY-DEFINER-RPC bewerbung_datei_anhaengen() herein, die das
--     Link-Token prüft und nur an FRISCH eingereichte Bewerbungen anhängt.
--   * Lesen/Löschen darf nur der Vermieter (RLS auf user_id).
--   * Löschen der Bewerbung räumt die Dateien mit ab (ON DELETE CASCADE).

create table if not exists public.bewerbung_dateien (
  id            uuid primary key default gen_random_uuid(),
  bewerbung_id  uuid not null references public.bewerbungen(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  typ           text not null,
  groesse       integer not null default 0,
  data          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists bewerbung_dateien_bewerbung_idx on public.bewerbung_dateien (bewerbung_id);
create index if not exists bewerbung_dateien_user_idx on public.bewerbung_dateien (user_id);

alter table public.bewerbung_dateien enable row level security;

drop policy if exists "bewerbung_dateien_owner_select" on public.bewerbung_dateien;
create policy "bewerbung_dateien_owner_select" on public.bewerbung_dateien for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "bewerbung_dateien_owner_delete" on public.bewerbung_dateien;
create policy "bewerbung_dateien_owner_delete" on public.bewerbung_dateien for delete to public
  using ((select auth.uid()) = user_id);

-- Datei an eine frisch eingereichte Bewerbung anhängen (öffentlicher Weg).
-- Der Client ruft das direkt nach bewerbung_einreichen() je Datei einzeln auf
-- (kleine Requests statt eines Riesen-Payloads). Grenzen:
--   * Bewerbung muss zum Token gehören und jünger als 1 Stunde sein
--     (verhindert, dass eine alte Bewerbungs-ID später befüllt wird)
--   * max. 5 Dateien je Bewerbung
--   * nur PDF/JPEG/PNG/WebP, Data-URL, max. ~8 MB Base64 (≈ 6 MB Datei)
create or replace function public.bewerbung_datei_anhaengen(p_token uuid, p_bewerbung uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  b record;
  v_name text := left(coalesce(nullif(trim(p->>'name'),''), 'Dokument'), 200);
  v_typ text := p->>'typ';
  v_data text := p->>'data';
  anzahl int;
begin
  select bl.id, bl.user_id into l
  from bewerber_links bl where bl.token = p_token and bl.aktiv;
  if not found then return jsonb_build_object('error','Link ungültig oder deaktiviert.'); end if;

  select bw.id into b from bewerbungen bw
  where bw.id = p_bewerbung and bw.link_id = l.id
    and bw.created_at > now() - interval '1 hour';
  if not found then return jsonb_build_object('error','Bewerbung nicht gefunden.'); end if;

  if v_typ is null or v_typ not in ('application/pdf','image/jpeg','image/png','image/webp') then
    return jsonb_build_object('error','Nur PDF-, JPG-, PNG- oder WebP-Dateien.');
  end if;
  if v_data is null or v_data not like 'data:%;base64,%' or length(v_data) > 8000000 then
    return jsonb_build_object('error','Datei zu groß (max. 6 MB) oder ungültig.');
  end if;

  select count(*) into anzahl from bewerbung_dateien where bewerbung_id = p_bewerbung;
  if anzahl >= 5 then
    return jsonb_build_object('error','Maximal 5 Dokumente je Bewerbung.');
  end if;

  insert into bewerbung_dateien (bewerbung_id, user_id, name, typ, groesse, data)
  values (p_bewerbung, l.user_id, v_name, v_typ,
          greatest(0, least(coalesce(nullif(p->>'groesse','')::int, 0), 100000000)), v_data);
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('error','Dokument konnte nicht gespeichert werden.');
end $function$;

revoke all on function public.bewerbung_datei_anhaengen(uuid, uuid, jsonb) from public;
grant execute on function public.bewerbung_datei_anhaengen(uuid, uuid, jsonb) to anon, authenticated;
