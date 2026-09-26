#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-14}"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-}"
COMPOSE=(docker compose --env-file .env.production -f compose.production.yaml)
if [[ "${CYBERPANEL_MODE:-false}" == "true" ]]; then
  COMPOSE+=(-f compose.cyberpanel.yaml)
fi

if [[ ! -f "${ROOT_DIR}/.env.production" ]]; then
  echo "Missing ${ROOT_DIR}/.env.production" >&2
  exit 1
fi

exec 9>/run/lock/readyrentals-backup.lock
if ! flock -n 9; then
  echo "A ReadyRentals backup is already running" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/${STAMP}"
mkdir -p "${DEST}"
chmod 700 "${BACKUP_ROOT}" "${DEST}"

cd "${ROOT_DIR}"
API_STOPPED=0
restart_api() {
  if [[ "${API_STOPPED}" == "1" ]]; then
    "${COMPOSE[@]}" up -d api >/dev/null
  fi
}
trap restart_api EXIT

# Briefly stop writes so the PostgreSQL dump and uploaded-file archive agree.
"${COMPOSE[@]}" stop api
API_STOPPED=1

"${COMPOSE[@]}" exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "${DEST}/readyrentals.dump"

docker run --rm \
  --mount type=volume,src=readyrentals_uploads_data,dst=/data,readonly \
  alpine:3 tar -czf - -C /data . \
  > "${DEST}/uploads.tar.gz"

test -s "${DEST}/readyrentals.dump"
test -s "${DEST}/uploads.tar.gz"
(cd "${DEST}" && sha256sum readyrentals.dump uploads.tar.gz > SHA256SUMS)

"${COMPOSE[@]}" up -d api
API_STOPPED=0
trap - EXIT

if [[ -n "${RESTIC_REPOSITORY}" ]]; then
  if ! command -v restic >/dev/null 2>&1; then
    echo "RESTIC_REPOSITORY is set, but restic is not installed" >&2
    exit 1
  fi
  if [[ -z "${RESTIC_PASSWORD_FILE:-}" || ! -r "${RESTIC_PASSWORD_FILE}" ]]; then
    echo "Set RESTIC_PASSWORD_FILE to a readable file before configuring off-site backups" >&2
    exit 1
  fi
  restic --password-file "${RESTIC_PASSWORD_FILE}" backup "${DEST}" --tag readyrentals
  restic --password-file "${RESTIC_PASSWORD_FILE}" forget \
    --tag readyrentals --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
else
  echo "WARNING: RESTIC_REPOSITORY is unset; this backup is local to the VPS only." >&2
fi

# Keep a bounded local cache. When Restic is configured, the encrypted off-site
# copy is completed first, so local cleanup never removes the only copy.
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
  -name '20????????T??????Z' -mtime "+${LOCAL_RETENTION_DAYS}" \
  -exec rm -rf -- {} +

echo "Backup created at ${DEST}"
echo "Local backups older than ${LOCAL_RETENTION_DAYS} days are pruned."
