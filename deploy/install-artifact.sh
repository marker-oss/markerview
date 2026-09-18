#!/usr/bin/env sh
set -eu
umask 077

APP_DIR=${APP_DIR:-/srv/reviews}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:8080/healthz}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-30}
SERVICE=reviews.service
TARGET=$APP_DIR/reviews
BACKUPS=$APP_DIR/backups
LOCK=$APP_DIR/.install-artifact.lock
ARTIFACT=${1:-}
REVISION=${2:-}
EXPECTED_SHA=${3:-}

fail() { echo "install-artifact: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || fail "must run as root"
[ "$#" -eq 3 ] || fail "usage: $0 ARTIFACT REVISION SHA256"
[ -f "$ARTIFACT" ] || fail "artifact does not exist: $ARTIFACT"
printf '%s\n' "$REVISION" | grep -Eq '^[0-9a-fA-F]{40}$' || fail "revision must be a 40-hex commit"
printf '%s\n' "$EXPECTED_SHA" | grep -Eq '^[0-9a-fA-F]{64}$' || fail "checksum must be a 64-hex SHA256"
[ -d "$APP_DIR" ] || fail "application directory does not exist: $APP_DIR"
[ -x "$TARGET" ] || fail "current executable does not exist: $TARGET"
command -v flock >/dev/null 2>&1 || fail "flock is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"

actual_sha=$(sha256sum "$ARTIFACT" | cut -d ' ' -f 1)
[ "$actual_sha" = "$(printf '%s' "$EXPECTED_SHA" | tr '[:upper:]' '[:lower:]')" ] || fail "artifact SHA256 mismatch"

mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"
exec 9>"$LOCK"
flock -x 9

# Read the running service's environment without ever printing it. The process
# environment is the source of truth: .env may be stale or unavailable.
main_pid=$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || true)
case "$main_pid" in ''|*[!0-9]*|0) fail "could not find running $SERVICE MainPID" ;; esac
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=$(mktemp -d "$BACKUPS/${REVISION}-${stamp}-XXXXXX")
chmod 700 "$backup"
staged=$(mktemp "$APP_DIR/.reviews-install.XXXXXX")
chmod 700 "$staged"
replaced=0

rollback() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ "$replaced" -ne 1 ]; then
        rm -f -- "$staged"
        exit "$status"
    fi
    echo "install-artifact: deployment failed; restoring binary (backup: $backup)" >&2
    rm -f -- "$staged"
    staged=$(mktemp "$APP_DIR/.reviews-rollback.XXXXXX")
    if install -m 0755 -- "$backup/reviews" "$staged" && mv -f -- "$staged" "$TARGET"; then
        systemctl restart "$SERVICE" || echo "install-artifact: CRITICAL: previous binary did not restart" >&2
    else
        echo "install-artifact: CRITICAL: could not restore $TARGET; backup: $backup" >&2
    fi
    exit "$status"
}
trap 'exit 1' HUP INT TERM
trap rollback EXIT

cp -p -- "$TARGET" "$backup/reviews"
chmod 700 "$backup/reviews"
python3 - "$main_pid" "$backup" "$APP_DIR" <<'PY'
import os, shlex, sqlite3, subprocess, sys, tempfile
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
pid, backup, app_dir = sys.argv[1:]
values = {}
try:
    for item in open(f"/proc/{pid}/environ", "rb").read().split(b"\0"):
        if b"=" in item:
            key, value = item.split(b"=", 1)
            if key in (b"REVIEWS_DB_DRIVER", b"REVIEWS_DB_DSN"):
                values[key.decode()] = value.decode(errors="surrogateescape")
except OSError as exc:
    raise SystemExit(f"cannot read service environment: {exc}")
driver, dsn = values.get("REVIEWS_DB_DRIVER", "sqlite").lower(), values.get("REVIEWS_DB_DSN", "")
if not dsn:
    raise SystemExit("REVIEWS_DB_DSN is missing from service environment")
if driver == "sqlite":
    if dsn.startswith("file:"):
        uri = urlsplit(dsn)
        options = dict(parse_qsl(uri.query))
        options["mode"] = "ro"
        source = urlunsplit((uri.scheme, uri.netloc, uri.path, urlencode(options), uri.fragment))
    else:
        source = Path(dsn)
        if not source.is_absolute():
            source = Path(app_dir) / source
        source = source.as_uri() + "?mode=ro"
    os.chdir(app_dir)
    try:
        src = sqlite3.connect(source, uri=True)
        dst = sqlite3.connect(os.path.join(backup, "database.sqlite"))
        with dst:
            src.backup(dst)
        src.close(); dst.close()
    except Exception as exc:
        raise SystemExit(f"sqlite backup failed: {exc}")
elif driver == "postgres":
    try:
        fields = shlex.split(dsn)
        with tempfile.NamedTemporaryFile("w", dir=backup, prefix="pgservice-") as service:
            service.write("[backup]\n")
            for field in fields:
                if "=" not in field:
                    raise ValueError("invalid PostgreSQL DSN")
                key, value = field.split("=", 1)
                if any(char in key + value for char in "\r\n"):
                    raise ValueError("invalid PostgreSQL DSN")
                service.write(f"{key}={value}\n")
            service.flush()
            env = os.environ.copy(); env.update(PGSERVICEFILE=service.name, PGSERVICE="backup", PGCONNECT_TIMEOUT="10")
            subprocess.run(["pg_dump", "--format=custom", "--file=" + os.path.join(backup, "database.dump")], env=env, check=True)
    except Exception as exc:
        raise SystemExit(f"PostgreSQL backup failed: {exc}")
else:
    raise SystemExit(f"unsupported database driver: {driver}")
PY

# Stage on the application filesystem, then replace with one rename.
install -m 0755 -- "$ARTIFACT" "$staged"
replaced=1
mv -f -- "$staged" "$TARGET"
staged=''

if ! systemctl restart "$SERVICE"; then
    fail "could not restart $SERVICE"
fi
healthy=0
i=0
while [ "$i" -lt "$HEALTH_TIMEOUT" ]; do
    if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 1
    i=$((i + 1))
done
[ "$healthy" -eq 1 ] || fail "$HEALTH_URL did not become healthy"

printf '%s\n' "$REVISION" > "$APP_DIR/.deployed-revision.tmp"
chmod 0644 "$APP_DIR/.deployed-revision.tmp"
mv -f -- "$APP_DIR/.deployed-revision.tmp" "$APP_DIR/deployed-revision"
trap - EXIT HUP INT TERM
rm -f -- "$staged" 2>/dev/null || true
echo "deployed revision $REVISION"
