# Street Image Stitcher — Frontend

Next.js frontend for uploading Street View screenshots, ordering them left-to-right, and requesting stitched panorama jobs from the FastAPI backend.

## Stack

- Next.js (App Router)
- React + TypeScript
- `@hello-pangea/dnd` for horizontal reorder
- `@vercel/blob` for client uploads and storage cleanup

## User flow

1. Upload PNG/JPG screenshots (max 12)
2. Reorder images with drag-and-drop or keyboard arrows
3. Start stitch job and poll backend status every 3 seconds
4. Render stitched panorama and download PNG

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required:

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token for upload URL generation
- `NEXT_PUBLIC_BACKEND_URL`: backend base URL (for example `http://localhost:8000`)
- `CRON_SECRET`: bearer token for `GET /api/cron`

Optional:

- `RAILWAY_BACKEND_URL`: backend URL used by cron keep-alive ping

## Run locally

From `frontend/`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If backend is local, run it from `../backend` and set:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Scripts

- `npm run dev`: start local Next.js server
- `npm run build`: create production build
- `npm run start`: run production server
- `npm run lint`: run ESLint

## Frontend API routes

### `POST /api/blob/upload-url`

- Returns one scoped upload token per selected filename
- Limits uploads to PNG/JPEG
- Limits file size to 10 MB per image
- Limits batch size to 12 files

### `GET /api/cron`

- Requires `Authorization: Bearer <CRON_SECRET>`
- Pings `${RAILWAY_BACKEND_URL}/health` when configured
- Deletes Vercel blobs older than 24 hours

`vercel.json` schedules this route every 5 minutes.

## Backend contract used by frontend

- `POST /stitch` → returns `{ job_id }`
- `GET /status/{job_id}` → returns `processing|done|error` and `panorama_url` on success
- `GET /health`

## Key files

- Page orchestration: `app/page.tsx`
- Upload token + blob upload logic: `lib/blobUpload.ts`
- Stitch job start/poll logic: `lib/stitchJob.ts`
- Upload step UI: `components/UploadZone.tsx`
- Order step UI: `components/OrderStrip.tsx`
- Result step UI: `components/ResultPanel.tsx`

## Troubleshooting

- `blob not configured`: set `BLOB_READ_WRITE_TOKEN` in `.env.local`
- Stitch start fails: verify `NEXT_PUBLIC_BACKEND_URL` and backend CORS (`ALLOWED_ORIGINS`)
- `/api/cron` returns 401: verify `CRON_SECRET` matches bearer token
- Job fails repeatedly: check backend logs and blob URL accessibility
