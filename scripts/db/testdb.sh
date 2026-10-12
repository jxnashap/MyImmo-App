#!/usr/bin/env bash
# Lokale Test-Datenbank aus dem Repo aufbauen (11.10.2026, Auftrag B18).
#
#   PGHOST=/var/tmp/claude-pg PGPORT=54329 scripts/db/testdb.sh [datenbank]
#
# Legt die Datenbank (Standard: myimmo_test) NEU an, lädt die Supabase-Nachbildung
# (supabase/test/supabase_stubs.sql), dann die Baseline und jede spätere Migration in
# Versionsreihenfolge — jede in einer eigenen Transaktion. Ältere Dateien als die Baseline
# werden übersprungen (die Baseline enthält sie, siehe supabase/migrations/README.md).
#
# OHNE_MIGRATION=<dateiname>: diese eine Migration auslassen (Mutationsproben).
#
# Ausgabe: je Datei OK / FEHLER mit der ersten Fehlerzeile. Exit 1, wenn eine Datei scheitert,
# die nicht in AUSNAHMEN steht. Berührt nur die genannte LOKALE Datenbank.
set -uo pipefail

DB="${1:-myimmo_test}"
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$WURZEL/supabase/migrations"
BASELINE="20260728120000"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}")

# Migrationen, die das LIVE-Demo-Konto voraussetzen und auf einer leeren Datenbank bewusst
# nichts tun können. Begründung je Datei in docs/app-entwicklung bzw. der Datei selbst.
AUSNAHMEN_DATEI="$WURZEL/supabase/test/ausnahmen.txt"

"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\";" >/dev/null
"${PSQL[@]}" -d postgres -c "create database \"$DB\";" >/dev/null
"${PSQL[@]}" -d "$DB" -c "alter database \"$DB\" set search_path to public, extensions;" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$WURZEL/supabase/test/supabase_stubs.sql" >/dev/null 2>&1 || { echo "Stubs scheitern"; exit 2; }

fehler=0; ok=0; erwartet=0
for f in $(ls "$MIG"/*.sql | sort); do
  name="$(basename "$f")"
  version="${name%%_*}"
  [[ "$version" < "$BASELINE" ]] && continue
  # Für Mutationsproben: genau diese Migration auslassen (sie wird danach mutiert eingespielt).
  [[ -n "${OHNE_MIGRATION:-}" && "$name" == "$OHNE_MIGRATION" ]] && continue
  if out=$("${PSQL[@]}" -d "$DB" --single-transaction -f "$f" 2>&1 >/dev/null); then
    ok=$((ok + 1))
  else
    erste="$(printf '%s\n' "$out" | grep -m1 -E 'ERROR|FEHLER' || printf '%s' "$out" | head -1)"
    if [[ -f "$AUSNAHMEN_DATEI" ]] && grep -q "^$name" "$AUSNAHMEN_DATEI"; then
      erwartet=$((erwartet + 1)); echo "ERWARTET  $name — $erste"
    else
      fehler=$((fehler + 1)); echo "FEHLER    $name — $erste"
    fi
  fi
done
echo "OK: $ok · erwartet gescheitert: $erwartet · FEHLER: $fehler"
[[ $fehler -eq 0 ]]
