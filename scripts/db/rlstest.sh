#!/usr/bin/env bash
# Rollentests an der Datenbankgrenze gegen die LOKALE Test-Datenbank (11.10.2026).
#
#   PGHOST=/var/tmp/claude-pg PGPORT=54329 scripts/db/rlstest.sh [datenbank] [muster]
#
# Jede Datei in supabase/test/rls/ öffnet selbst eine Transaktion und rollt sie zurück — es
# bleiben keine Testdaten liegen. Am Ende prüft das Skript genau das: keine Zeile mit der
# Testkennung (pruef-…@myimmo.test) in auth.users und pruef.konten leer.
set -uo pipefail
DB="${1:-myimmo_test}"
MUSTER="${2:-}"
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}" -d "$DB")

"${PSQL[@]}" -f "$WURZEL/supabase/test/pruef.sql" >/dev/null 2>&1 || { echo "pruef.sql scheitert"; exit 2; }

fehler=0; ok=0
for f in $(ls "$WURZEL"/supabase/test/rls/*.sql | sort); do
  name="$(basename "$f")"
  [[ -n "$MUSTER" && "$name" != *"$MUSTER"* ]] && continue
  if out=$("${PSQL[@]}" -f "$f" 2>&1); then
    n=$(printf '%s\n' "$out" | grep -c 'NOTICE:  ok ')
    ok=$((ok + 1)); echo "OK      $name ($n Prüfungen)"
  else
    fehler=$((fehler + 1))
    echo "FEHLER  $name"
    printf '%s\n' "$out" | grep -E 'FEHLGESCHLAGEN|ERROR' | head -5 | sed 's/^/        /'
  fi
done

rest=$("${PSQL[@]}" -At -c "select (select count(*) from auth.users where email like 'pruef-%@myimmo.test') + (select count(*) from pruef.konten)")
echo "Dateien OK: $ok · FEHLER: $fehler · liegengebliebene Testkonten: $rest"
[[ $fehler -eq 0 && "$rest" == "0" ]]
