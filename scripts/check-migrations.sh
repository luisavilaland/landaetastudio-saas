#!/usr/bin/env bash
# Guard: immutable migrations.
# DB migrations are append-only. Editing an already-shipped .sql file (or its
# _journal.json entry) is forbidden; schema changes must land as a NEW migration.
# Fails closed: if the base ref is unavailable we cannot prove nothing changed,
# so we exit with an error instead of silently passing.
set -euo pipefail

BASE_REF="origin/develop"
MIGRATIONS_DIR="packages/db/migrations"

# Ensure the base ref exists locally so we can actually diff against it.
if ! git rev-parse --verify --quiet "${BASE_REF}" >/dev/null 2>&1; then
  echo "Base ref '${BASE_REF}' not found locally, attempting fetch..." >&2
  git fetch origin develop
  if ! git rev-parse --verify --quiet "${BASE_REF}" >/dev/null 2>&1; then
    echo "❌ No se puede validar migraciones inmutables: no existe '${BASE_REF}'. Verificá que el CI haga un checkout con fetch-depth: 0." >&2
    exit 1
  fi
fi

changed_files="$(git diff --name-only "${BASE_REF}" -- "${MIGRATIONS_DIR}")"

if [[ -n "${changed_files}" ]]; then
  echo "❌ Migración existente modificada — crea una nueva migración, no edites las anteriores."
  echo ""
  echo "Archivos modificados:"
  echo "${changed_files}"
  exit 1
fi

echo "✅ Migraciones inmutables: OK"
exit 0
