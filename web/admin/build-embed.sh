#!/usr/bin/env sh
set -eu
npm run build
rm -rf ../../internal/server/admin_dist ../../internal/server/widget_dist
cp -r dist ../../internal/server/admin_dist
mkdir -p ../../internal/server/widget_dist
cp ../reviews-widget/loader.js ../reviews-widget/reviews-widget.js ../reviews-widget/reviews-widget.css ../../internal/server/widget_dist/
cp -r ../reviews-widget/assets ../../internal/server/widget_dist/assets
rm -rf ../../internal/server/widget_dist/assets/assets
echo "embedded admin SPA and widget runtime into internal/server"
