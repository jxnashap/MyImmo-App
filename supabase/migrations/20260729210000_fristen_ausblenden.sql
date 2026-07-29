-- Abgeleitete Fristen (Miete, Kredit, Objekt, Steuer, Banking) werden aus den
-- Stammdaten GERECHNET — sie haben keine Zeile in `termine` und deshalb bisher
-- weder Haken noch Schliessen-Knopf. In der Liste stand an ihrer Stelle nur ein
-- leerer Platzhalter.
--
-- Folge: Eine einmal verpasste Frist bleibt fuer immer stehen. Nach ein paar
-- Monaten besteht die Termine-Seite ueberwiegend aus Altlasten, die niemand
-- wegbekommt — und die echten, anstehenden Termine gehen darin unter. Genau die
-- Seite, die Ordnung schaffen soll, wird damit unbrauchbar.
--
-- Loesung: Der Vermieter kann eine abgeleitete Frist ausblenden. Geloescht wird
-- nichts (die Frist ergibt sich weiter aus den Stammdaten) — sie verschwindet
-- nur aus der Ansicht und ist ueber „Ausgeblendete anzeigen" zurueckholbar.

create table if not exists public.frist_ausgeblendet (
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Stabiler Schluessel der Frist: "<quelle>|<datum>|<label>".
  -- Bewusst inklusive Datum: Eine wiederkehrende Frist (z. B. NK-Abrechnung)
  -- soll im FOLGEJAHR wieder auftauchen und nicht dauerhaft stumm bleiben.
  schluessel  text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, schluessel)
);

alter table public.frist_ausgeblendet enable row level security;

create policy "eigene ausgeblendete Fristen lesen"
  on public.frist_ausgeblendet for select
  using (user_id = auth.uid());

create policy "eigene Fristen ausblenden"
  on public.frist_ausgeblendet for insert
  with check (user_id = auth.uid());

create policy "eigene Fristen wieder einblenden"
  on public.frist_ausgeblendet for delete
  using (user_id = auth.uid());

comment on table public.frist_ausgeblendet is
  'Vom Vermieter ausgeblendete ABGELEITETE Fristen (Termine-Seite). Schluessel: "<quelle>|<datum>|<label>".';
