# Street Image Stitcher — Backend

FastAPI backend that accepts uploaded image blob URLs, stitches them into a panorama, uploads the result to Vercel Blob, and exposes async job status endpoints.

## Stack

- FastAPI + Uvicorn
- `httpx` for blob/network calls
- Pillow + NumPy for image stitching pipeline
- In-memory rate limiter and in-memory job store

## What it does

- Validates incoming blob URLs (content type + size checks)
- Starts a background stitch job (`POST /stitch`)
- Applies stitching pipeline in `services/stitcher.py`
- Uploads final PNG to Vercel Blob (`results/{job_id}.png`)
- Deletes input blobs after successful result upload
- Returns progress and final URL through `GET /status/{job_id}`

## API

### `POST /stitch`

Starts an async stitch job.

Request body:

```json
{
  "blob_urls": ["https://...", "https://..."],
  "street_name": "Main Road",
  "timestamp": "April 2026"
}
```

Rules:

- Minimum 2 images
- Maximum 12 images
- Image content types must be PNG/JPEG
- Max file size 10 MB per image
- IP rate limit: 20 requests per hour

Response:

```json
{
  "job_id": "uuid"
}
```

### `GET /status/{job_id}`

Possible responses:

- Processing:

```json
{
  "status": "processing",
  "pass": 1,
  "total": 2
}
```

- Done:

```json
{
  "status": "done",
  "panorama_url": "https://...png"
}
```

- Error:

```json
{
  "status": "error",
  "message": "Stitching failed — try fewer images or try again.",
  "debug": "ExceptionType: ..."
}
```

### `GET /health`

Simple health endpoint:

```json
{
  "status": "ok"
}
```

## Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required for current runtime:

- `BLOB_READ_WRITE_TOKEN`: used for result upload + input blob deletion
- `ALLOWED_ORIGINS`: comma-separated CORS allowlist

Also present:

- `GEMINI_API_KEY`: included in env template for planned/alternate AI flow

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Docker

Build and run:

```bash
docker build -t street-image-stitcher-backend .
docker run --rm -p 8000:8000 --env-file .env street-image-stitcher-backend
```

`Dockerfile` installs `fonts-dejavu-core` for label rendering fallback fonts.

## Railway

- Config file: `railway.toml`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health path: `/health`

## Key files

- App bootstrap + CORS: `main.py`
- HTTP routes + job lifecycle: `routers/stitch.py`
- Stitching algorithm: `services/stitcher.py`
- Rate limiter: `utils/rate_limiter.py`

## Operational caveats

- Job state is in-memory (`_jobs`): restarting process loses in-flight history
- Rate-limit buckets are in-memory: reset on restart
- Output/access durability is provided by Vercel Blob, not local disk
