-- B12 – Wiederkehrende Termine: genau EIN Folgetermin, kein wandernder Tag (11.10.2026).
--
-- BEFUND: Beim Abhaken eines wiederkehrenden Termins wurde erst „erledigt“ gespeichert, dann per
-- Abfrage geprüft, dann der Folgetermin angelegt. Zwei gleichzeitige Klicks legten zwei Folgetermine
-- an; scheiterte das Anlegen, stand der Termin erledigt da ohne Nachfolger. Und jede Instanz rechnete
-- vom (gekappten) Datum der vorigen: 31.01. → 28.02. → 28.03. → 28.04. …
--
-- JETZT (lib/actions/termine.ts → toggleErledigt):
--   · `vorgaenger_id` — der Termin, aus dem dieser Folgetermin entstand; EINDEUTIG (NULL ist
--     verschieden: eigene Termine und Altbestand bleiben unberührt). Kein Fremdschlüssel: Ein
--     gelöschter Vorgänger soll den Folgetermin nicht mitnehmen und das Löschen nicht blockieren.
--   · `serien_tag` — Tag des Monats, auf den die Serie fällt (1–31); NULL = Tag des Datums.
-- Neue Spalten ohne Daten → keine Dubletten möglich. Kein Löschbefehl → per apply_migration möglich.

alter table public.termine add column if not exists vorgaenger_id uuid;
alter table public.termine add column if not exists serien_tag smallint;

comment on column public.termine.vorgaenger_id is 'Termin, aus dem dieser Folgetermin entstand (B12). Eindeutig: höchstens ein Folgetermin je Termin.';
comment on column public.termine.serien_tag is 'Tag des Monats, auf den die Serie fällt (B12); NULL = Tag des Datums.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'termine_vorgaenger_eindeutig') then
    alter table public.termine add constraint termine_vorgaenger_eindeutig unique (vorgaenger_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'termine_serien_tag_bereich') then
    alter table public.termine add constraint termine_serien_tag_bereich check (serien_tag is null or serien_tag between 1 and 31);
  end if;
end $$;
