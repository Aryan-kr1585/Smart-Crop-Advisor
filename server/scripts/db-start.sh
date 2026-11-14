#!/bin/sh
set -e
PG="/Library/PostgreSQL/18/bin"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/.pgdata"
if "$PG/pg_isready" -h 127.0.0.1 -p 5433 >/dev/null 2>&1; then
  echo "Postgres already running on 5433"
  exit 0
fi
"$PG/pg_ctl" -D "$DATA" -l "$DATA/server.log" -o "-p 5433 -k '$DATA' -c listen_addresses=127.0.0.1" start
