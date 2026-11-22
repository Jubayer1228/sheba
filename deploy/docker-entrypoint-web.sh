#!/bin/sh
set -eu
if [ -z "${BACKEND_URL:-}" ]; then
  echo "BACKEND_URL is required (Sheba API Cloud Run URL without trailing slash)" >&2
  exit 1
fi
export PORT="${PORT:-8080}"
envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/templates/sheba.conf.template > /etc/nginx/conf.d/default.conf