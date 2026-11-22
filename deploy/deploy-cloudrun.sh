#!/usr/bin/env bash
# Build images in Cloud Build, deploy to Cloud Run with your gcloud user (avoids Cloud Build actAs issues).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GCLOUD="${GCLOUD:-gcloud}"
for cand in gcloud "${HOME}/google-cloud-sdk/bin/gcloud" "/Users/jubayer_1228/Documents/Projects/potential-project/Thine/backend/google-cloud-sdk/bin/gcloud"; do
  if [ -x "$cand" ] || command -v "$cand" >/dev/null 2>&1; then
    GCLOUD="$cand"
    break
  fi
done

PROJECT_ID="${GCP_PROJECT:-$("$GCLOUD" config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
API_SERVICE="${SHEBA_API_SERVICE:-sheba-api}"
WEB_SERVICE="${SHEBA_WEB_SERVICE:-sheba-web}"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Set GCP project: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

"$GCLOUD" services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJECT_ID"

cd "$ROOT"
echo "Building API image…"
"$GCLOUD" builds submit --project="$PROJECT_ID" --region="$REGION" --config=deploy/cloudbuild-api.yaml .

echo "Deploying API…"
"$GCLOUD" run deploy "$API_SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --image="${REPO}/${API_SERVICE}:latest" --platform=managed --allow-unauthenticated \
  --port=8080 --memory=512Mi --cpu=1 --timeout=3600 --max-instances=3 \
  --set-env-vars=GIN_MODE=release,DATABASE_PATH=/tmp/sheba.db,UPLOAD_DIR=/tmp/uploads

API_URL="$("$GCLOUD" run services describe "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"

echo "Building web image…"
"$GCLOUD" builds submit --project="$PROJECT_ID" --region="$REGION" --config=deploy/cloudbuild-web.yaml .

echo "Deploying web…"
"$GCLOUD" run deploy "$WEB_SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --image="${REPO}/${WEB_SERVICE}:latest" --platform=managed --allow-unauthenticated \
  --port=8080 --memory=256Mi --set-env-vars="BACKEND_URL=${API_URL}"

WEB_URL="$("$GCLOUD" run services describe "$WEB_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
"$GCLOUD" run services update "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" \
  --update-env-vars="CORS_ORIGIN=${WEB_URL}"

echo ""
echo "Deployed."
echo "  Web (open this): $WEB_URL"
echo "  API:             $API_URL"
echo ""
echo "Add AI keys: gcloud run services update $API_SERVICE --region=$REGION --update-env-vars=LLM_API_KEY=...,DEEPGRAM_API_KEY=...,JWT_SECRET=..."