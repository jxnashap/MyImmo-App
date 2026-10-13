#!/usr/bin/env bash
# Nebenläufigkeit an der Datenbank (B07, 11.10.2026; Beauftragen 13.10.2026): zwei ECHTE gleichzeitige Sitzungen.
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
TOKEN2="cccccccc-$(printf '%04d' $(( $$ % 10000 )))-0000-0000-000000000002"
fehler=0

aufraeumen() {
  "${PSQL[@]}" <<SQL >/dev/null
delete from public.auftraege where vermieter_id in (select id from auth.users where email = '$KENNUNG');
delete from public.anliegen_ereignisse where anliegen_id in
  (select id from public.anliegen where vermieter_id in (select id from auth.users where email = '$KENNUNG'));
delete from public.angebote where anfrage_id in (select id from public.angebotsanfragen where public_token in ('$TOKEN', '$TOKEN2'));
delete from public.angebotsanfragen where public_token in ('$TOKEN', '$TOKEN2');
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

# Ablauf F: Zwei Server-Läufe beanspruchen denselben Schritt gleichzeitig — genau einer bekommt ihn.
JOB="dddddddd-$(printf '%04d' $(( $$ % 10000 )))-0000-0000-000000000001"
"${PSQL[@]}" -c "insert into public.aussen_auftraege (id, user_id, schluessel, art) select '$JOB', id, 'nebenlaeufig', 'hinweis_mail' from auth.users where email = '$KENNUNG'" >/dev/null \
  || { echo "FEHLGESCHLAGEN: Schritt nicht angelegt"; fehler=1; }
FA=$(mktemp)
( "${PSQL[@]}" -c "begin; set local role service_role; select count(*) from public.aussen_auftrag_beanspruchen('$JOB'); select pg_sleep(2); commit;" > "$FA" 2>&1 ) &
sleep 0.5
JB=$("${PSQL[@]}" -c "begin; set local role service_role; select count(*) from public.aussen_auftrag_beanspruchen('$JOB'); commit;" 2>&1 | grep -E '^[0-9]+$')
wait
JA=$(grep -E '^[0-9]+$' "$FA"); rm -f "$FA"
versuche=$("${PSQL[@]}" -c "select versuche from public.aussen_auftraege where id = '$JOB'")
if [[ "$JA" == "1" && "$JB" == "0" && "$versuche" == "1" ]]; then echo "ok  Schritt nach außen: genau ein Bearbeiter bei gleichzeitigem Anspruch"; else echo "FEHLGESCHLAGEN: Anspruch A=$JA B=$JB Versuche=$versuche"; fehler=1; fi

# Angebot beauftragen (13.10.2026): zwei Firmen DESSELBEN Vorgangs gleichzeitig beauftragt — genau EIN
# Auftrag; die zweite Sitzung wartet auf die Sperre des Vorgangs und findet ihre Anfrage abgelehnt.
"${PSQL[@]}" <<SQL >/dev/null || { echo "FEHLGESCHLAGEN: Aufbau Beauftragen"; fehler=1; }
with q as (select vermieter_id, anliegen_id from public.angebotsanfragen where public_token = '$TOKEN'),
     f as (insert into public.firmen (user_id, name) select vermieter_id, 'Firma 2' from q returning id),
     a2 as (insert into public.angebotsanfragen (vermieter_id, anliegen_id, firma_id, titel, public_token)
             select q.vermieter_id, q.anliegen_id, f.id, 'Test', '$TOKEN2' from q, f returning id)
insert into public.angebote (anfrage_id, firma, betrag) select id, 'Firma 2', 200 from a2;
SQL
UID_V=$("${PSQL[@]}" -c "select id from auth.users where email = '$KENNUNG'")
G1=$("${PSQL[@]}" -c "select g.id from public.angebote g join public.angebotsanfragen q on q.id = g.anfrage_id where q.public_token = '$TOKEN' order by g.betrag limit 1")
G2=$("${PSQL[@]}" -c "select g.id from public.angebote g join public.angebotsanfragen q on q.id = g.anfrage_id where q.public_token = '$TOKEN2' limit 1")
ALS="select set_config('request.jwt.claims', json_build_object('sub', '$UID_V', 'role', 'authenticated')::text, true); set local role authenticated;"
# Das Zeitfenster weiten: Sitzung C hält die Vorgangszeile; A bleibt dadurch MITTEN in der Funktion stehen
# (Fremdschlüssel-Prüfung beim Anlegen des Auftrags), nachdem A seine Anfrage schon beansprucht hat. Ohne die
# Sperre auf den Vorgang beanspruchte B jetzt seine eigene Anfrage — Ergebnis wäre ein Deadlock-Abbruch statt
# einer klaren Antwort (beide Reihenfolgen sind so nachgestellt worden).
ANL=$("${PSQL[@]}" -c "select anliegen_id from public.angebotsanfragen where public_token = '$TOKEN'")
( "${PSQL[@]}" -c "begin; select 1 from public.anliegen where id = '$ANL' for update; select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 0.5
FB=$(mktemp)
( "${PSQL[@]}" -c "begin; $ALS select public.angebot_beauftragen('$G1', false, null); commit;" > "$FB" 2>&1 ) &
sleep 0.5
BB=$("${PSQL[@]}" -c "begin; $ALS select public.angebot_beauftragen('$G2', false, null); commit;" 2>&1)
wait
BA=$(cat "$FB"); rm -f "$FB"
auftraege=$("${PSQL[@]}" -c "select count(*) from public.auftraege where vermieter_id = '$UID_V'")
if [[ "$auftraege" == "1" && "$BA" == *'"ok": true'* && "$BB" == *"schon entschieden"* ]]; then
  echo "ok  Angebot beauftragen: zwei Firmen gleichzeitig → genau ein Auftrag, die zweite wartet und wird abgelehnt"
else
  echo "FEHLGESCHLAGEN: $auftraege Aufträge (A: ${BA//$'\n'/ } | B: ${BB//$'\n'/ })"; fehler=1
fi

aufraeumen; trap - EXIT
rest=$("${PSQL[@]}" -c "select (select count(*) from auth.users where email = '$KENNUNG') + (select count(*) from public.angebotsanfragen where public_token in ('$TOKEN', '$TOKEN2')) + (select count(*) from public.aussen_auftraege where schluessel = 'nebenlaeufig') + (select count(*) from public.auftraege where vermieter_id = '$UID_V')")
if [[ "$rest" == "0" ]]; then echo "ok  Testdaten entfernt"; else echo "FEHLGESCHLAGEN: $rest Testzeilen liegen noch"; fehler=1; fi
exit $fehler
