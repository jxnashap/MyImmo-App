-- Nachtrag zu 20261005100000 (05.10.2026, im Browser gefunden): Die restriktive Demo-Regel
-- `demo_gesperrt` galt `for all` — damit auch für SELECT, und der Demo-Vermieter sah seine eigenen
-- Zuordnungen nicht („noch keine Objekte“). Bei `vertreter` (Vorbild) fiel das nicht auf, weil die
-- Demo dort keine Daten hat.
-- Jetzt: die Regel gilt nur noch für `anon` (dort ohnehin ohne Wirkung), Schreiben sperren zwei
-- Regeln für Einfügen und Ändern — Namen wie auf allen anderen Tabellen.
-- Entfernen durch das Demo-Konto bleibt technisch möglich (eine Regel dafür bräuchte das
-- Lösch-Schlüsselwort und damit den Bestätigungsdialog). Folgenlos: `demo_service_verknuepfen()`
-- legt die Demo-Zuordnung vor jedem Demo-Start wieder an, und die Oberfläche sperrt Speichern.
alter policy demo_gesperrt on public.service_objekte to anon;

create policy demo_kein_insert on public.service_objekte
  as restrictive for insert to authenticated
  with check (not public.ist_demo_nutzer());
create policy demo_kein_update on public.service_objekte
  as restrictive for update to authenticated
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
