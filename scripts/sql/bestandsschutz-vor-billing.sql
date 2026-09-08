-- BESTANDSSCHUTZ — seit 08.09.2026 AUTOMATISCH, dieses Skript ist nur noch Kontrolle.
--
-- ============================================================================
-- WAS SICH GEÄNDERT HAT
-- ============================================================================
-- Bis 08.09.2026 war dies ein Termin-Skript: unmittelbar vor `BILLING_ENFORCED=true`
-- von Hand ausführen, weil es nur die Konten versorgt, die es vorfindet. Ein
-- Termin-Skript ist ein Termin-Fehler in Wartestellung.
--
-- Migration `20260908082914_bestandsschutz_automatisch.sql` hat das ersetzt:
--   * Alle damaligen 22 Konten haben ihre Zeile (plus/testphase/bestandsschutz).
--   * Jedes NEUE Konto bekommt sie per Trigger auf auth.users — solange
--     `public.billing_einstellungen.bestandsschutz_offen = true` steht.
--
-- BEIM SCHARFSCHALTEN bleibt genau EIN Schritt, zusammen mit der Env:
--
--   update public.billing_einstellungen set bestandsschutz_offen = false, updated_at = now();
--
-- Wird er vergessen, bekommen neue Konten weiter Plus — großzügig, nicht
-- ausschließend. Das ist die richtige Richtung für einen vergessenen Schritt.
--
-- Die Abschnitte A und C unten sind Kontrollabfragen (nur lesen); Abschnitt B
-- ist als Nachholmaßnahme erhalten (idempotent, falls je eine Zeile fehlt);
-- Abschnitt D beendet den Bestandsschutz später — bewusst, mit Vorlauf.
--
-- Ausführung im Supabase-SQL-Editor (läuft als `postgres`, umgeht RLS).
-- `abos` hat bewusst KEINE insert/update-Policy — über die App ist das nicht
-- möglich, und das soll auch so bleiben.


-- ============================================================================
-- A) VORHER ANSEHEN (ändert nichts)
-- ============================================================================
-- Wer hätte nach dem Umlegen ein Problem?
select
  u.email,
  coalesce(e.einheiten, 0)                        as einheiten,
  (a.user_id is not null)                         as hat_abo_zeile,
  case
    when a.user_id is not null then 'ok — Abo vorhanden'
    when coalesce(e.einheiten, 0) > 1 then 'WÜRDE GESPERRT (über Kostenlos-Limit)'
    else 'liefe auf Kostenlos weiter'
  end                                             as folge
from auth.users u
left join public.abos a on a.user_id = u.id
left join (
  select user_id, sum(greatest(1, coalesce(einheiten_anzahl, 1))) as einheiten
  from public.properties
  group by user_id
) e on e.user_id = u.id
order by coalesce(e.einheiten, 0) desc, u.email;


-- ============================================================================
-- B) BESTANDSSCHUTZ NACHHOLEN (normalerweise 0 Zeilen — der Trigger war schneller)
-- ============================================================================
-- Tarifwahl, offen begründet:
--   * "plus" (24 Einheiten) deckt jedes heutige Konto mit Abstand — das größte
--     hat 8 Einheiten — und enthält alle Funktionen außer dem Hausverwaltungs-
--     Zugang. Wer im Early Access mitgemacht hat, verliert damit nichts.
--   * Bewusst NICHT "business": unbegrenzte Einheiten auf Dauer zu verschenken
--     ist etwas anderes, als den bisherigen Funktionsumfang zu erhalten.
--   * status = 'testphase' — zählt über `istZahlend()` als zahlend, ist aber
--     als das erkennbar, was es ist. 'aktiv' würde ein bezahltes Abo vortäuschen
--     und die Paddle-Auswertung verfälschen.
--   * provider = 'bestandsschutz' — macht die Zeilen jederzeit auffindbar und
--     verhindert, dass sie mit Paddle-Abos verwechselt werden. Die Spalte hat
--     keine CHECK-Beschränkung, der Wert ist zulässig.
--   * gueltig_bis wird als DOKUMENTATION gesetzt, NICHT als Ablauf:
--     `effektiverPlan()` in lib/plan.ts wertet `gueltig_bis` NICHT aus (geprüft
--     am 04.09.2026) — maßgeblich ist allein `status`. Der Bestandsschutz endet
--     also erst, wenn jemand Abschnitt D ausführt. Das ist Absicht: ein
--     stillschweigendes Ablaufen würde Nutzer ohne Vorwarnung aussperren —
--     genau der Fehler, den dieses Skript verhindern soll.

insert into public.abos (user_id, plan, status, zyklus, provider, gueltig_bis)
select
  u.id,
  'plus',
  'testphase',
  null,
  'bestandsschutz',
  now() + interval '12 months'
from auth.users u
on conflict (user_id) do nothing;   -- vorhandene (echte) Abos bleiben unberührt


-- ============================================================================
-- C) GEGENPROBE (ändert nichts) — muss 0 Zeilen liefern
-- ============================================================================
select u.id, u.email
from auth.users u
left join public.abos a on a.user_id = u.id
where a.user_id is null;

-- Zur Kontrolle: Verteilung nach Herkunft.
select provider, plan, status, count(*)
from public.abos
group by provider, plan, status
order by provider, plan;


-- ============================================================================
-- D) BESTANDSSCHUTZ SPÄTER BEENDEN (NICHT jetzt ausführen)
-- ============================================================================
-- Wenn der Bestandsschutz auslaufen soll, ist das eine bewusste Entscheidung
-- mit Vorlauf: Die Betroffenen müssen vorher informiert werden (Punkt A8 der
-- Start-Checkliste), sonst verlieren sie von einem Tag auf den anderen den
-- Zugriff auf ihre eigenen Auswertungen.
--
--   update public.abos
--      set plan = 'kostenlos', status = 'gekuendigt', updated_at = now()
--    where provider = 'bestandsschutz'
--      and gueltig_bis < now();
--
-- Wer stattdessen bezahlt hat, hat längst eine Paddle-Zeile — der Webhook
-- schreibt `provider = 'paddle'` und wird von dieser Bedingung nicht erfasst.


-- ============================================================================
-- DAS DEMO-KONTO
-- ============================================================================
-- demo.vermieter@myimmo.test (lib/demo.ts) bekommt über Abschnitt B ebenfalls
-- "plus" und ist damit versorgt. Das ist nicht nur Kosmetik: Die Dokument-PDF-
-- Route ist die EINZIGE Schreib-/Erzeugungs-Ausnahme des Nur-Lese-Demo-Kontos
-- (`data-demo-erlaubt` im DocGenerator). Ohne Abo-Zeile stünde das Demo-Konto
-- auf Kostenlos, die Route liefe in die Tarif-Schranke, und die Ausnahme wäre
-- tot — das Schaustück könnte sein wichtigstes Dokument nicht mehr zeigen.
--
-- "plus" genügt dafür (`dokumente` ist ab Privat frei). Soll das Demo-Konto
-- auch den Hausverwaltungs-Zugang vorführen, braucht es "business":
--
--   update public.abos set plan = 'business', updated_at = now()
--    where user_id = (select id from auth.users where email = 'demo.vermieter@myimmo.test');
