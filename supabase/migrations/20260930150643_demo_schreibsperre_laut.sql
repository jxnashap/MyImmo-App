-- Demo-Konto: Schreibversuche scheitern LAUT statt still
--
-- Anlass (30.09.2026, Phase 2 der Demo-Überarbeitung): Die Demo soll die
-- Kaufgründe zeigen — Steuer, Nebenkostenabrechnung, Mietkonto — und diese
-- Seiten haben viele Knöpfe, die schreiben. Die bisherige Sperre
-- (20260830150000) besteht aus restriktiven RLS-Policies. Für INSERT meldet
-- Postgres dabei einen Fehler, für UPDATE und DELETE NICHT: Die USING-Klausel
-- filtert die Zeilen einfach weg, die Anweisung trifft null Zeilen und gilt
-- als erfolgreich. Nachgemessen am 30.09.2026 in einer zurückgerollten
-- Transaktion: update_zeilen=0, delete_zeilen=0, kein Fehler.
--
-- Folge: Ein Besucher klickt „Miete bestätigen" oder „Löschen", die
-- Server-Action bekommt kein `error` zurück, meldet „Gespeichert." — und
-- nichts ist passiert. `components/DemoNurLesen.tsx` fängt das nur für
-- Formular-Knöpfe ab, nicht für Knöpfe mit eigenem onClick.
--
-- LÖSUNG: Ein BEFORE-Trigger auf ANWEISUNGS-Ebene wirft für das Demo-Konto
-- einen Fehler, bevor irgendeine Zeile angefasst wird. Jede Action wertet
-- `error` aus (Regel aus dem Durchgang vom 08.09., `schreibFehler.test.ts`),
-- also sieht der Besucher eine Fehlermeldung statt einer falschen Erfolgsmeldung.
--
-- Warum Anweisungs- statt Zeilen-Trigger: Ein Zeilen-Trigger feuert nur für
-- Zeilen, die die USING-Klausel durchlässt — und die restriktive Policy lässt
-- für das Demo-Konto keine durch. Der Anweisungs-Trigger feuert immer, und nur
-- einmal je Anweisung statt je Zeile.
--
-- Die restriktiven Policies BLEIBEN als zweite Linie stehen.
--
-- SECURITY DEFINER ist hier Pflicht, nicht Bequemlichkeit: `ist_demo_nutzer()`
-- darf nur von `authenticated` und `anon` aufgerufen werden. Ein Trigger, der
-- sie mit den Rechten des Aufrufers ruft, würde für die SERVICE-ROLE mit
-- „permission denied" scheitern — und damit Demo-Reset, Wert-Cron und
-- Zugriffsbremse lahmlegen. Genau diese Fälle prüft der Probelauf.

create or replace function public.demo_schreibsperre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.ist_demo_nutzer() then
    raise exception 'In der Demo wird nichts gespeichert. Mit eigenem Zugang steht die Funktion bereit.'
      using errcode = '42501', hint = 'demo_nur_lesen';
  end if;
  return null; -- bei Anweisungs-Triggern ohne Bedeutung
end;
$$;

comment on function public.demo_schreibsperre() is
  'Wirft für das Demo-Konto einen Fehler vor jedem Schreibvorgang (statt still 0 Zeilen). Siehe Migration 20260930120000.';

-- Niemand ruft die Funktion direkt auf; Trigger brauchen kein EXECUTE-Recht
-- des Auslösers (Postgres prüft es beim Anlegen des Triggers).
revoke all on function public.demo_schreibsperre() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
  loop
    execute format('drop trigger if exists demo_schreibsperre on public.%I', t.relname);
    execute format(
      'create trigger demo_schreibsperre before insert or update or delete on public.%I '
      'for each statement execute function public.demo_schreibsperre()',
      t.relname
    );
  end loop;
end $$;
