-- Wochenbericht Herkunft und Aktivierung (docs/MARKETINGPLAN.md §6).
-- NUR LESEND. Im Supabase-SQL-Editor ausführen (oder von Claude per execute_sql).
--
-- :ab = Stichtag, ab dem gezählt wird. Vor dem Start gibt es nur Testkonten —
-- deshalb den Tag des Gratis-Starts (S1) eintragen, nicht ein frühes Datum.
-- Demo-Konten (@myimmo.test) sind immer ausgenommen.
--
-- Was die Herkunft NICHT kann (lib/herkunft.ts): Sie kennt nur die Marke der
-- Seite, auf der das Formular abgeschickt wurde. Google-Registrierungen und
-- Einträge ohne Marke erscheinen als „direkt“.

with params as (select date '2026-10-01' as ab),

-- 1) Warteliste je Woche und Herkunft (bestätigt = Double-Opt-in abgeschlossen)
warteliste as (
  select date_trunc('week', angefordert_am)::date as woche,
         coalesce(herkunft, 'direkt') as herkunft,
         count(*) as eingetragen,
         count(*) filter (where bestaetigt_am is not null and abgemeldet_am is null) as bestaetigt
    from public.newsletter_anmeldungen, params
   where angefordert_am >= params.ab
   group by 1, 2
),

-- 2) Vermieter-Konten mit Aktivierung (Objekt + Mieter + Buchung binnen 7 Tagen)
konten as (
  select u.id, u.created_at, u.last_sign_in_at,
         coalesce(u.raw_user_meta_data->>'herkunft', 'direkt') as herkunft
    from auth.users u, params
   where u.created_at >= params.ab
     and u.email not like '%@myimmo.test'
     and not exists (select 1 from public.nutzer_rollen r
                      where r.user_id = u.id and r.rolle in ('mieter', 'service'))
),
aktivierung as (
  select k.*,
         exists (select 1 from public.properties p where p.user_id = k.id and p.created_at < k.created_at + interval '7 days')
     and exists (select 1 from public.mieter m where m.user_id = k.id and m.created_at < k.created_at + interval '7 days')
     and (exists (select 1 from public.einnahmen e where e.user_id = k.id and e.created_at < k.created_at + interval '7 days')
       or exists (select 1 from public.kosten c where c.user_id = k.id and c.created_at < k.created_at + interval '7 days'))
         as aktiviert,
         -- Erst nach 4 Wochen beurteilbar; jüngere Konten zählen hier nicht mit.
         case when k.created_at > now() - interval '28 days' then null
              else k.last_sign_in_at >= k.created_at + interval '28 days' end as aktiv_nach_4_wochen
    from konten k
)

select 'warteliste' as teil, woche::text as woche, herkunft,
       eingetragen as anzahl, bestaetigt as davon, null::numeric as quote
  from warteliste
union all
select 'registrierung', date_trunc('week', created_at)::date::text, herkunft,
       count(*), count(*) filter (where aktiviert),
       round(100.0 * count(*) filter (where aktiviert) / nullif(count(*), 0), 0)
  from aktivierung group by 2, 3
union all
select 'aktiv_nach_4_wochen', null, herkunft,
       count(*) filter (where aktiv_nach_4_wochen is not null),
       count(*) filter (where aktiv_nach_4_wochen),
       round(100.0 * count(*) filter (where aktiv_nach_4_wochen)
             / nullif(count(*) filter (where aktiv_nach_4_wochen is not null), 0), 0)
  from aktivierung group by 3
order by 1, 2, 3;
-- Spalten: anzahl = eingetragen bzw. registriert; davon = bestätigt bzw. aktiviert
-- bzw. noch aktiv; quote = davon in Prozent.
