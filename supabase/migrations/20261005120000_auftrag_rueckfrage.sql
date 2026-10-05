-- Hausmeister & Servicepartner, Schritt 3 (05.10.2026): Freigabe mit [Freigeben] [Ablehnen]
-- [Rückfrage]. Eine Rückfrage ist eine Notiz des VERMIETERS mit Merkmal `rueckfrage` — der Auftrag
-- bleibt in der Freigabe, der Hausmeister antwortet im Verlauf. Eigene Spalte statt einer neuen
-- `art`: Die Prüfregel der Spalte `art` ließe sich nur über Entfernen + Neuanlegen erweitern
-- (Bestätigungsdialog).
alter table public.auftrag_notizen
  add column if not exists rueckfrage boolean not null default false;

-- Nur der Vermieter stellt Rückfragen.
alter policy auftrag_notizen_schreiben on public.auftrag_notizen
  with check (
    autor_id = (select auth.uid())
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and (not rueckfrage or autor_rolle = 'vermieter')
    and exists (select 1 from public.auftraege a
                 where a.id = auftrag_notizen.auftrag_id
                   and a.vermieter_id = auftrag_notizen.vermieter_id
                   and ((autor_rolle = 'vermieter' and a.vermieter_id = (select auth.uid()))
                     or (autor_rolle = 'service' and a.service_user_id = (select auth.uid()))))
  );
