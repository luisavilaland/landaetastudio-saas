#!/usr/bin/env bash
# Guard: immutable migrations.
# DB migrations are append-only. Editing an already-shipped .sql file (or its
# _journal.json entry) is forbidden; schema changes must land as a NEW migration.
# Fails closed: if the base ref is unavailable we cannot prove nothing changed,
# so we exit with an error instead of silently passing.
#
# IMPORTANTE — decisiones no obvias:
#
# 1. --diff-filter=MD (modificados y eliminados)
#    El guard debe fallar si un archivo de migración existente fue
#    modificado (M) O eliminado (D). Los archivos nuevos (A, Added)
#    son esperados y válidos. Sin este flag, cualquier PR que
#    agregue una migración nueva fallaría (bug encontrado en T5,
#    PR #121). Renamed (R) no aplica a migraciones porque cada
#    archivo es único.
#
# 2. _journal.json NO está en el check
#    _journal.json es metadata de Drizzle que se modifica cada vez
#    que se agrega una migración nueva. No es una migración en sí
#    (no contiene SQL), así que no aplica la regla de inmutabilidad.
#    Solo los *.sql y *_snapshot.json son inmutables.
#
# 3. Excepción: reset de baseline autorizado
#    Si el diff incluye docs/migrations-archive/<fecha>/README.md,
#    se trata de un reset documentado. En ese caso se permite M/D
#    solo para archivos que tengan contraparte con el mismo basename
#    en el directorio del archive. El resto sigue bloqueado.
#    El README del archive es el marcador explícito de aprobación.
#
# 4. El archive también es inmutable (2026-09-26)
#    Antes del squash, todo el historial vivía en
#    packages/db/migrations/. El squash del 2026-09-24 movió las
#    migraciones incrementales 0005-0015 a docs/migrations-archive/,
#    fuera del pathspec: quedaban desprotegidas y el CI pasaba verde
#    mientras alguien podia reescribir 0013_ensure_rls_and_grants.sql.
#    Un guard que pasa sin cubrir lo que dice proteger es peor que no
#    tener guard, porque genera confianza falsa. Por eso el pathspec
#    incluye 'docs/migrations-archive/*/*.sql' y '*.json'.
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

# Detectar reset de baseline autorizado: si el diff incluye el README
# del archive, es un reset documentado. En ese caso se permite M/D
# solo para archivos que tengan contraparte con el mismo basename en
# el directorio del archive. El resto de modificaciones sigue bloqueado.
archive_marker="$(git diff --name-only "${BASE_REF}" -- \
  'docs/migrations-archive/*/README.md' | head -1)"

changed_files="$(git diff --name-only --diff-filter=MD "${BASE_REF}" -- \
  'packages/db/migrations/*.sql' \
  'packages/db/migrations/meta/*_snapshot.json' \
  'docs/migrations-archive/*/*.sql' \
  'docs/migrations-archive/*/*.json')"

if [[ -n "${archive_marker}" && -n "${changed_files}" ]]; then
  # Reset autorizado: filtrar los archivos que NO tienen contraparte
  # en el archive.
  archive_dir="$(dirname "${archive_marker}")"
  truly_changed=""
  while IFS= read -r file; do
    [[ -z "${file}" ]] && continue
    basename_file="$(basename "${file}")"
    if ! find "${archive_dir}" -name "${basename_file}" -print -quit 2>/dev/null | grep -q .; then
      truly_changed="${truly_changed}${file}"$'\n'
    fi
  done <<< "${changed_files}"

  if [[ -n "${truly_changed}" ]]; then
    echo "❌ Migración existente MODIFICADA sin contraparte archivada — crea una nueva migración, no edites las anteriores."
    echo ""
    echo "Archivos afectados:"
    printf '%s' "${truly_changed}"
    exit 1
  fi

  echo "✅ Reset de migraciones detectado (archive presente): archivos con contraparte en archive permitidos."
  exit 0
fi

# Comportamiento normal (sin archive README): fail-closed sobre MD.
if [[ -n "${changed_files}" ]]; then
  echo "❌ Migración existente modificada o eliminada — crea una nueva migración, no edites ni borres las anteriores."
  echo ""
  echo "Archivos afectados:"
  echo "${changed_files}"
  exit 1
fi

echo "✅ Migraciones inmutables: OK"
exit 0
