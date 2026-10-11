#!/usr/bin/env bash
# Nebenläufigkeit an der Datenbank (B07, 11.10.2026): zwei ECHTE gleichzeitige Sitzungen.
#
#   PGHOST=/var/tmp/claude-pg PGPORT=54329 scripts/db/nebenlaeufig.sh [datenbank]
#
# Ein Test in EINER Transaktion kann eine Sperre nicht prüfen — dafür braucht es eine zweite
# Verbindung, die während der ersten Transaktion dasselbe versucht. Die Testdaten werden committed
# (beide Sitzungen müssen sie sehen), am Ende über ihre Kennung gelöscht und die Löschung geprüft.
set -uo pipefail
DB="${1:-myimmo_test}"
PSQL=(psql -X -q -At -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}" -d "$DB")
KENNUNG="nebenlaeufig-$$@myimmo.test"
TOKEN="cccccccc-$(printf '%04d' $(( $$ % 10000 )))-0000-0000-000000000001"
fehler=0

aufraeumen() {
  "${PSQL[@]}" <<SQL >/dev/null
delete from public.angebote where anfrage_id in (select id from public.angebotsanfragen where public_token = '$TOKEN');
delete from public.angebotsanfragen where public_token = '$TOKEN';
delete from public.anliegen where vermieter_id in (select id from auth.users where email = '$KENNUNG');
delete from public.firmen where user_id in (select id from auth.users where email = '$KENNUNG');
delete from public.mieter where user_id in (select id from auth.users where email = '$KENNUNG');
delete from auth.users where email = '$KENNUNG';
SQL
}
trap aufraeumen EXIT

"${PSQL[@]}" <<SQL >/dev/null || { echo "Aufbau scheitert"; exit 2; }
with u as (insert into auth.users (email) values ('$KENNUNG') returning id),
     m as (insert into public.mieter (user_id, nachname) select id, 'Neben' from u returning id, user_id),
     a as (insert into public.anliegen (vermieter_id, mieter_id, titel) select user_id, id, 'Test' from m returning id, vermieter_id),
     f as (insert into public.firmen (user_id, name) select id, 'Firma' from u returning id)
insert into public.angebotsanfragen (vermieter_id, anliegen_id, firma_id, titel, public_token)
  select a.vermieter_id, a.id, f.id, 'Test', '$TOKEN' from a, f;
select public.angebot_public_abgeben('$TOKEN', 'Firma', null, 100, null, 'eins');
select public.angebot_public_abgeben('$TOKEN', 'Firma', null, 110, null, 'zwei');
SQL

# Sitzung A: drittes Angebot abgeben, Transaktion 2 s offen halten.
( "${PSQL[@]}" -c "begin; select public.angebot_public_abgeben('$TOKEN', 'Firma', null, 120, null, 'drei-A'); select pg_sleep(2); commit;" >/dev/null ) &
sleep 0.5
# Sitzung B: gleichzeitig ebenfalls ein drittes — muss warten und danach abgelehnt werden.
B=$("${PSQL[@]}" -c "select public.angebot_public_abgeben('$TOKEN', 'Firma', null, 130, null, 'drei-B')")
wait
anzahl=$("${PSQL[@]}" -c "select count(*) from public.angebote where anfrage_id in (select id from public.angebotsanfragen where public_token = '$TOKEN')")

if [[ "$anzahl" == "3" ]]; then echo "ok  Angebotsgrenze hält bei gleichzeitiger Abgabe (3 Angebote)"; else echo "FEHLGESCHLAGEN: $anzahl Angebote statt 3 (B: $B)"; fehler=1; fi
if [[ "$B" == *"error"* ]]; then echo "ok  zweite Sitzung wartet und wird abgelehnt"; else echo "FEHLGESCHLAGEN: zweite Sitzung wurde angenommen ($B)"; fehler=1; fi

aufraeumen; trap - EXIT
rest=$("${PSQL[@]}" -c "select (select count(*) from auth.users where email = '$KENNUNG') + (select count(*) from public.angebotsanfragen where public_token = '$TOKEN')")
if [[ "$rest" == "0" ]]; then echo "ok  Testdaten entfernt"; else echo "FEHLGESCHLAGEN: $rest Testzeilen liegen noch"; fehler=1; fi
exit $fehler
