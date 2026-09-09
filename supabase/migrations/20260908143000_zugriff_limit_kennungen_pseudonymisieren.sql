-- Die Zugriffsbremse speicherte die Besucher-IP im KLARTEXT und loeschte nie.
-- Am 08.09.2026 gemessen: 29 Zeilen, alle 29 mit IP, die aelteste neun Tage alt.
-- Ueber `newsletter_adresse` waere zusaetzlich die E-Mail-Adresse dort gelandet.
--
-- Drei Teile. Die App gibt die Kennung ab sofort nur noch als HMAC weiter
-- (lib/net/bremse.ts); hier kommt dazu, was in der Datenbank noetig ist.

-- 1) ALTBESTAND. Die Zeilen sind fachlich wertlos (das Zeitfenster ist laengst
--    abgelaufen), tragen aber Klartext-IPs. Sie einfach zu loeschen ist der
--    vollstaendigste Weg — Pseudonymisieren wuerde den Klartext nur ersetzen,
--    nicht die Frage beantworten, warum er so lange lag.
delete from public.zugriff_limit;

-- 2) AUFRAEUMEN AUF DAUER. Das laengste benutzte Fenster ist eine Stunde
--    (`ki_import`, 3600 s). Alles, was aelter als 24 Stunden ist, kann keinen
--    Zaehler mehr beeinflussen und ist reiner Datenbestand ohne Zweck —
--    Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung).
create index if not exists zugriff_limit_fenster_idx
  on public.zugriff_limit (fenster_start);

create or replace function public.rate_limit_pruefen(
  p_aktion text, p_max integer, p_sekunden integer, p_kennung text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s text := p_aktion || '|' || coalesce(nullif(p_kennung, ''), anfrage_ip());
  jetzt timestamptz := now();
  neu int;
begin
  -- Aufraeumen bei Gelegenheit statt bei jedem Aufruf: Ein DELETE pro Anfrage
  -- waere Schreiblast ohne Gegenwert. Bei rund einem Prozent der Aufrufe ist
  -- die Tabelle trotzdem dauerhaft klein, ohne dass ein Cron noetig waere,
  -- der ausfallen und unbemerkt stehenbleiben kann.
  if random() < 0.01 then
    delete from zugriff_limit where fenster_start < jetzt - interval '24 hours';
  end if;

  insert into zugriff_limit (schluessel, fenster_start, anzahl)
  values (s, jetzt, 1)
  on conflict (schluessel) do update
    set anzahl = case
          when zugriff_limit.fenster_start < jetzt - make_interval(secs => p_sekunden) then 1
          else zugriff_limit.anzahl + 1
        end,
        fenster_start = case
          when zugriff_limit.fenster_start < jetzt - make_interval(secs => p_sekunden) then jetzt
          else zugriff_limit.fenster_start
        end
  returning anzahl into neu;

  if neu > p_max then
    raise exception 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.'
      using errcode = 'P0001';
  end if;
end $function$;

-- 3) AUFRUFRECHT. Die App ruft die Funktion ausschliesslich ueber die
--    Service-Role auf (lib/net/bremse.ts -> createAdminClient). `anon` und
--    `authenticated` brauchen sie nicht — mit dem Recht koennte dagegen jeder
--    angemeldete Nutzer den Zaehler eines fremden Schluessels hochtreiben und
--    damit z. B. den Zugangscode-Versuch anderer blockieren.
--    Hinweis: `from public` ist noetig, `from anon, authenticated` allein
--    waere wirkungslos (die beiden erben von PUBLIC) — siehe CLAUDE.md.
--    NACH dem Entzug live geprueft: /api/demo laeuft weiter (Rauchtest gruen).
revoke execute on function public.rate_limit_pruefen(text, integer, integer, text)
  from public, anon, authenticated;
