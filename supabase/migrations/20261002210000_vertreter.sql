-- Vertreter / Bevollmächtigter (02.10.2026, Vorgabe des Betreibers).
--
-- Anlass: Ein Vermieter im Ausland stellt einen Kreditantrag; die Bank verlangt Originale,
-- und beim Unterschreiben des Darlehens (und ggf. der Grundschuld beim Notar) handelt eine
-- Vertrauensperson in Deutschland. MyImmo hält fest, WER das ist und WELCHE Vollmacht vorliegt
-- (Art, Form, Beglaubigung/Apostille, Gültigkeit, wo das Original liegt) samt Scan.
--
-- Bewusst KEIN App-Zugang für den Vertreter (das wäre docs/zukunft/VERTRETER-ZUGANG.md und
-- berührt jede Tabelle). Hier nur Stammdaten des Vermieters über eine dritte Person.
--
-- Eine Regel `for all` statt je einer Regel pro Befehl: Der Lösch-Befehl im Migrationstext
-- löst den Bestätigungsdialog der Schnittstelle aus (siehe README). Ohne Fremdschlüssel.

create table if not exists public.vertreter (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vorname text check (char_length(vorname) <= 100),
  nachname text not null check (char_length(btrim(nachname)) between 1 and 100),
  beziehung text check (char_length(beziehung) <= 100),
  geburtsdatum date,
  geburtsort text check (char_length(geburtsort) <= 100),
  strasse text check (char_length(strasse) <= 200),
  plz text check (char_length(plz) <= 20),
  ort text check (char_length(ort) <= 100),
  land text check (char_length(land) <= 100),
  email text check (char_length(email) <= 200),
  telefon text check (char_length(telefon) <= 50),
  vollmacht_art text not null default 'bank'
    check (vollmacht_art in ('general', 'bank', 'darlehen', 'grundbuch', 'immobilie', 'sonstige')),
  vollmacht_form text not null default 'privatschriftlich'
    check (vollmacht_form in ('privatschriftlich', 'bankformular', 'beglaubigt', 'beurkundet')),
  umfang text check (char_length(umfang) <= 2000),
  ausgestellt_am date,
  gueltig_bis date,
  widerrufen_am date,
  im_ausland_unterzeichnet boolean not null default false,
  apostille boolean not null default false,
  beglaubigt_durch text check (char_length(beglaubigt_durch) <= 200),
  original_bei text check (char_length(original_bei) <= 200),
  notiz text check (char_length(notiz) <= 2000),
  datei_name text check (char_length(datei_name) <= 200),
  datei_type text check (char_length(datei_type) <= 100),
  datei_size integer check (datei_size between 0 and 8388608),
  datei_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vertreter_user on public.vertreter (user_id);

alter table public.vertreter enable row level security;

create policy vertreter_eigene on public.vertreter
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Demo: weder lesen noch schreiben (auch Entfernen — deshalb `for all`).
create policy demo_gesperrt on public.vertreter
  as restrictive for all to authenticated, anon
  using (not public.ist_demo_nutzer())
  with check (not public.ist_demo_nutzer());
create trigger demo_schreibsperre before insert or update on public.vertreter
  for each statement execute function public.demo_schreibsperre();
