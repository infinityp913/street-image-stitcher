# Street Image Stitcher

Upload Street View screenshots, order them left-to-right, and generate a stitched panoramic street elevation image.

This repo contains:

- `frontend/`: Next.js app (upload, ordering UI, job polling, result download)
- `backend/`: FastAPI service (validates blobs, stitches images, uploads final PNG)
- `raw-images/`: sample input images
- `stitched-images/`: sample stitched outputs

## Current architecture

1. Frontend gets per-file upload tokens from `POST /api/blob/upload-url`
2. Frontend uploads images directly to Vercel Blob
3. Frontend calls backend `POST /stitch` with blob URLs + optional labels
4. Backend starts a background job and returns `job_id`
5. Frontend polls `GET /status/:job_id` every 3 seconds
6. Backend uploads stitched PNG to Blob and returns `panorama_url`

## Quickstart (local)

### 1) Start backend

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2) Start frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Set in `frontend/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Open `http://localhost:3000`.

## Environment variables

### Frontend (`frontend/.env.local`)

- `BLOB_READ_WRITE_TOKEN`: required for signed upload token generation and cron cleanup
- `NEXT_PUBLIC_BACKEND_URL`: backend base URL used by client job calls
- `CRON_SECRET`: bearer auth secret for `GET /api/cron`
- `RAILWAY_BACKEND_URL` (optional): backend URL for keep-alive ping from cron

### Backend (`backend/.env`)

- `BLOB_READ_WRITE_TOKEN`: required to upload result PNG and delete input blobs
- `ALLOWED_ORIGINS`: comma-separated CORS origins (include `http://localhost:3000` for local dev)
- `GEMINI_API_KEY`: present in env example for planned/alternate AI flow

## Deployment notes

- Frontend is set up for Vercel (`frontend/vercel.json` includes a 5-minute cron on `/api/cron`)
- Backend includes `railway.toml` and `Dockerfile` for Railway deployment
- Cron route pings backend `/health` and deletes blobs older than 24 hours

## API summary

- `POST /stitch`: accepts `{ blob_urls, street_name?, timestamp? }`, returns `{ job_id }`
- `GET /status/{job_id}`: returns job status (`processing|done|error`) and output URL on success
- `GET /health`: health check

## Docs

- Frontend setup and UX flow: `frontend/README.md`
- Backend API and operations: `backend/README.md`
- Product/design intent: `DESIGN-PLAN.md`
