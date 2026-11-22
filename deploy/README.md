# Deploy Sheba on Google Cloud Run

Two services:

| Service | Image | Role |
|---------|--------|------|
| `sheba-api` | `backend/Dockerfile` | Go API (SQLite + uploads under `/tmp`, re-seeded on cold start) |
| `sheba-web` | `deploy/Dockerfile.web` | Nginx + React build; proxies `/api` and `/uploads` to the API URL |

## One-command deploy

```bash
export GCP_PROJECT=your-gcp-project   # optional if gcloud default is set
chmod +x deploy/deploy-cloudrun.sh
./deploy/deploy-cloudrun.sh
```

Recommended flow (build in Cloud Build, deploy with your user — avoids IAM `actAs` issues on some projects):

```bash
./deploy/deploy-cloudrun.sh
```

`deploy/cloudbuild.yaml` is all-in-one (build + deploy) and may need extra Cloud Build IAM on the default compute service account.

After deploy, open the **web** service URL (not the API URL directly).

## Environment / secrets (API)

Set on `sheba-api` (Cloud Run console or `gcloud run services update`):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Required in production |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Voice/chat LLM |
| `DEEPGRAM_API_KEY` | ASR/TTS |

`CORS_ORIGIN` is set automatically to the web service URL by `cloudbuild.yaml`.

## Local Docker smoke test

```bash
docker build -t sheba-api -f backend/Dockerfile backend
docker run --rm -p 8080:8080 -e JWT_SECRET=dev sheba-api

# After API is up:
export BACKEND_URL=http://host.docker.internal:8080
docker build -t sheba-web -f deploy/Dockerfile.web .
docker run --rm -p 5173:8080 -e BACKEND_URL="$BACKEND_URL" -e PORT=8080 sheba-web
```

## Production notes

- SQLite on `/tmp` is **ephemeral** (resets on new instances / deploys). For real data use Cloud SQL or Firestore.
- File uploads under `/tmp/uploads` are not durable across instances.
- Increase API `--timeout` (already 3600) for slow LLM voice turns.