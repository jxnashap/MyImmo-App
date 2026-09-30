-- Hat das EIGENE Konto ein Passwort? (30.09.2026)
-- Die Einstellungen schlossen aus app_metadata.provider (= Anmeldeweg bei der
-- ANLAGE, ändert sich nie) auf „kein Passwort". Ein Google-Konto, das später
-- per „Passwort vergessen" ein Passwort bekam, konnte es danach nicht ändern.
-- Liefert nur ja/nein für auth.uid(); der Hash verlässt die Datenbank nicht.
create or replace function public.konto_hat_passwort()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password is not null and u.encrypted_password <> '', false)
  from auth.users u
  where u.id = auth.uid();
$$;

revoke execute on function public.konto_hat_passwort() from public, anon;
grant execute on function public.konto_hat_passwort() to authenticated;
