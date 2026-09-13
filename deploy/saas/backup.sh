#!/bin/sh
set -eu

BACKUP_DIR="${REVIEWS_BACKUP_DIR:-/srv/backups}"
DB_NAME="${REVIEWS_DB_NAME:-reviews}"
DB_DSN="${REVIEWS_DB_DSN:-}"
KEY_FILE="${REVIEWS_CREDENTIALS_KEY_FILE:-/srv/reviews-saas/.credentials-key}"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%F)"
if [ -n "$DB_DSN" ]; then
  pg_dump "$DB_DSN" -Fc > "$BACKUP_DIR/reviews-$stamp.dump"
else
  pg_dump -Fc "$DB_NAME" > "$BACKUP_DIR/reviews-$stamp.dump"
fi
if [ -f "$KEY_FILE" ]; then
  install -m 0600 "$KEY_FILE" "$BACKUP_DIR/credentials-key-$stamp"
else
  echo "missing credentials key file: $KEY_FILE" >&2
  exit 1
fi
find "$BACKUP_DIR" -type f \( -name 'reviews-*.dump' -o -name 'credentials-key-*' \) -mtime +14 -delete
