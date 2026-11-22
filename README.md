# Sheba — Pharmacy delivery for Bangladesh

Desktop-first pharmacy marketplace: browse nearby partner shops, upload a prescription, order OTC or Rx medicines, and choose **delivery** or **pickup**.

Product strategy for Bangladesh (trust, speed, payments, chronic care): see [`docs/BANGLADESH_STRATEGY.md`](docs/BANGLADESH_STRATEGY.md).

## Stack

- **Backend:** Go (Gin), GORM, SQLite, JWT auth
- **Frontend:** React, TypeScript, Vite, TanStack Query, Zustand

## Quick start

```bash
# Terminal 1 — API (http://localhost:8080)
cd backend
go run ./cmd/server

# Terminal 2 — Web (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Or from the repo root:

```bash
make run-api    # builds + starts API
make run-web    # starts Vite
```

Open [http://localhost:5173](http://localhost:5173).

## Cloud Run (GCP)

See [`deploy/README.md`](deploy/README.md). Quick deploy:

```bash
./deploy/deploy-cloudrun.sh
```

### Demo account

| Field    | Value               |
|----------|---------------------|
| Email    | `demo@sheba.com.bd` |
| Password | `password123`       |

Default location: **Dhanmondi, Dhaka**.

## What you can do

- Discover 12 Dhaka pharmacies sorted by distance, rating, fee, or speed
- Search medicines (Napa, Seclo, Amoxicil, …) across partners
- Upload prescription (JPG/PNG/WEBP/PDF) and assign a pharmacy that accepts Rx
- Cart scoped per pharmacy (Foodpanda-style clear-on-switch)
- Checkout: delivery or pickup · COD / bKash / Nagad / Card
- Live order status (demo auto-progress) and reviews

## API overview

Base URL: `http://localhost:8080/api`

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register`, `/auth/login` | — |
| GET/PATCH | `/me` | ✓ |
| GET | `/pharmacies`, `/pharmacies/:id`, `/pharmacies/:id/medicines` | — |
| GET | `/categories`, `/banners`, `/areas`, `/medicines/search` | — |
| POST/GET | `/prescriptions` | ✓ |
| POST/GET | `/orders`, `/orders/:id` | ✓ |

Uploads are served at `/uploads/...`.

## Project layout

```
sheba/
  backend/          Go API + seed data
  frontend/         React SPA
  Makefile
  README.md
```

## Notes

- SQLite DB file: `backend/sheba.db` (recreate by deleting it and restarting the API)
- CORS allows `http://localhost:5173`; Vite proxies `/api` and `/uploads`
- Change `JWT_SECRET` / `PORT` via environment variables in production
