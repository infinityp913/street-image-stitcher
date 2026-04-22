import logging
import os
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from services.stitcher import stitch_images
from utils.rate_limiter import is_allowed

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory job store (resets on restart — acceptable for V1)
_jobs: dict[str, dict] = {}

VERCEL_BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
MAX_IMAGES = 12
MAX_FILE_SIZE = 10 * 1024 * 1024


class StitchRequest(BaseModel):
    blob_urls: list[str]
    street_name: Optional[str] = None
    timestamp: Optional[str] = None


async def _validate_blobs(urls: list[str]) -> None:
    """Check that all blobs are accessible and within size limits."""
    async with httpx.AsyncClient(timeout=15) as client:
        for url in urls:
            try:
                res = await client.head(url)
                if not res.is_success:
                    raise HTTPException(status_code=422, detail=f"Could not access blob: {url}")
                content_type = res.headers.get("content-type", "")
                if not any(t in content_type for t in ("image/png", "image/jpeg")):
                    raise HTTPException(status_code=422, detail=f"Non-image blob: {url}")
                content_length = res.headers.get("content-length")
                if content_length and int(content_length) > MAX_FILE_SIZE:
                    raise HTTPException(status_code=422, detail=f"File too large: {url}")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=422, detail=f"Blob error: {exc}") from exc


def _run_stitch(job_id: str, request_data: StitchRequest) -> None:
    """Background task: stitch images and update job state."""
    try:
        def on_progress(pass_num: int, total: int) -> None:
            _jobs[job_id]["pass"] = pass_num
            _jobs[job_id]["total"] = total

        result_png = stitch_images(
            blob_urls=request_data.blob_urls,
            street_name=request_data.street_name,
            timestamp=request_data.timestamp,
            on_progress=on_progress,
        )

        # Upload result to Vercel Blob
        panorama_url = _upload_result(job_id, result_png)

        # Delete input blobs
        _delete_input_blobs(request_data.blob_urls)

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["panorama_url"] = panorama_url
        logger.info("Job %s done: %s", job_id, panorama_url)

    except Exception as exc:
        logger.error("Job %s failed: %s", job_id, exc, exc_info=True)
        message = _user_friendly_error(exc)
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["message"] = message
        _jobs[job_id]["debug"] = f"{type(exc).__name__}: {exc}"


def _upload_result(job_id: str, png_bytes: bytes) -> str:
    import httpx as _httpx
    filename = f"results/{job_id}.png"
    with _httpx.Client(timeout=60) as client:
        res = client.put(
            f"https://blob.vercel-storage.com/{filename}",
            content=png_bytes,
            headers={
                "Authorization": f"Bearer {VERCEL_BLOB_TOKEN}",
                "Content-Type": "image/png",
                "x-content-type": "image/png",
                "cache-control": "public, max-age=86400",
            },
        )
        res.raise_for_status()
        data = res.json()
        return data["url"]


def _delete_input_blobs(urls: list[str]) -> None:
    import httpx as _httpx
    with _httpx.Client(timeout=30) as client:
        for url in urls:
            try:
                client.delete(
                    "https://blob.vercel-storage.com/",
                    params={"url": url},
                    headers={"Authorization": f"Bearer {VERCEL_BLOB_TOKEN}"},
                )
            except Exception as exc:
                logger.warning("Failed to delete blob %s: %s", url, exc)


def _user_friendly_error(exc: Exception) -> str:
    msg = str(exc).lower()
    if "timeout" in msg:
        return "Stitching timed out. Try fewer images or smaller files."
    if "refusal" in msg or "safety" in msg:
        return "AI stitching failed. Try a different set of images."
    if "quota" in msg or "rate" in msg:
        return "API quota exceeded. Please try again in a moment."
    return "Stitching failed — try fewer images or try again."


@router.post("/stitch")
async def start_stitch(
    body: StitchRequest,
    background_tasks: BackgroundTasks,
    request: Request,
):
    ip = request.client.host if request.client else "unknown"

    if not is_allowed(ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    if not body.blob_urls:
        raise HTTPException(status_code=422, detail="No images provided.")
    if len(body.blob_urls) > MAX_IMAGES:
        raise HTTPException(status_code=422, detail=f"Max {MAX_IMAGES} images.")
    if len(body.blob_urls) < 2:
        raise HTTPException(status_code=422, detail="At least 2 images required.")

    await _validate_blobs(body.blob_urls)

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "processing", "pass": 0, "total": 0}

    background_tasks.add_task(_run_stitch, job_id, body)

    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/health")
async def health():
    return {"status": "ok"}
