#!/bin/sh
set -eu

ROOT="${REVIEWS_SAAS_ROOT:-/srv/reviews-saas-src}"
CORE_REF="${CORE_REF:-v0.3.2-saas-core3}"
CORE_REPO="${CORE_REPO:-git@github.com:marker-oss/yakit-reviews-extension.git}"
INSTALL_DIR="${REVIEWS_SAAS_INSTALL_DIR:-/srv/reviews-saas}"

cd "$ROOT"
CORE_REPO="$CORE_REPO" CORE_REF="$CORE_REF" ./build.sh
install -o reviews -g reviews -m 0755 dist/reviews-saas "$INSTALL_DIR/reviews-saas.new"
mv "$INSTALL_DIR/reviews-saas.new" "$INSTALL_DIR/reviews-saas"
systemctl restart reviews-saas.service
systemctl is-active --quiet reviews-saas.service
curl --fail --silent --show-error http://127.0.0.1:8092/healthz >/dev/null
printf '%s\n' "deployed core ref $CORE_REF"
