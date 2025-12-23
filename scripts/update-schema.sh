#!/bin/bash
set -euo pipefail

SQL_FILE=${1:-sql/updates/2024-10-01-add-connection-properties.sql}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-acdc}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && docker compose ps -q db >/dev/null 2>&1; then
  echo "Running schema update via docker compose..."
  if [ ! -f "$SQL_FILE" ]; then
    echo "SQL file not found: $SQL_FILE"
    exit 1
  fi
  cat "$SQL_FILE" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f /dev/stdin
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install psql or run with docker compose."
  exit 1
fi

echo "Running schema update via psql..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"
