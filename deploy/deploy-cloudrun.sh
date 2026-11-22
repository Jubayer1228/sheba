#!/usr/bin/env bash
# Deploy Sheba API + static web to Google Cloud Run (see deploy/README.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GCLOUD="${GCLOUD:-gcloud}"
if command -v gcloud >/dev/null 2>&1; then
  GCLOUD=gcloud
elif [ -x "${HOME}/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="${HOME}/google-cloud-sdk/bin/gcloud"
elif [ -x "/Users/jubayer_1228/Documents/Projects/potential-project/Thine/backend/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="/Users/jubayer_1228/Documents/Projects/potential-project/Thine/backend/google-cloud-sdk/bin/gcloud"
fi

PROJECT_ID="${GCP_PROJECT:-$("$GCLOUD" config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
API_SERVICE="${SHEBA_API_SERVICE:-sheba-api}"
WEB_SERVICE="${SHEBA_WEB_SERVICE:-sheba-web}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Set GCP project: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

echo "Project: $PROJECT_ID  Region: $REGION"
"$GCLOUD" services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJECT_ID"

cd "$ROOT"
"$GCLOUD" builds submit --project="$PROJECT_ID" --region="$REGION" --config=deploy/cloudbuild.yaml .

WEB_URL="$("$GCLOUD" run services describe "$WEB_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
API_URL="$("$GCLOUD" run services describe "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
echo ""
echo "Deployed."
echo "  Web (open this): $WEB_URL"
echo "  API:             $API_URL"
echo ""
echo "Optional: add AI keys on the API service:"
echo "  gcloud run services update $API_SERVICE --region=$REGION --update-env-vars=LLM_API_KEY=...,DEEPGRAM_API_KEY=...,JWT_SECRET=..."