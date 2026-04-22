import io
import logging
import statistics
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageStat

logger = logging.getLogger(__name__)

BLEND_WIDTH = 400  # pixels each side of the seam


def _download_image(url: str) -> bytes:
    import httpx
    with httpx.Client(timeout=30) as client:
        res = client.get(url)
        res.raise_for_status()
        return res.content


def _to_png(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _match_histogram(source: np.ndarray, reference: np.ndarray) -> np.ndarray:
    out = np.zeros_like(source)
    for c in range(3):
        src = source[:, :, c].flatten()
        ref = reference[:, :, c].flatten()
        src_hist, _ = np.histogram(src, 256, [0, 256])
        ref_hist, _ = np.histogram(ref, 256, [0, 256])
        src_cdf = np.cumsum(src_hist).astype(float)
        ref_cdf = np.cumsum(ref_hist).astype(float)
        src_cdf /= src_cdf[-1]
        ref_cdf /= ref_cdf[-1]
        lookup = np.interp(src_cdf, ref_cdf, np.arange(256))
        out[:, :, c] = lookup[source[:, :, c]].astype(np.uint8)
    return out


def _sigmoid_blend_seam(
    canvas_arr: np.ndarray,
    seam_x: int,
    left_arr: np.ndarray,
    right_arr: np.ndarray,
    left_offset: int,
    blend_w: int,
) -> np.ndarray:
    """
    Blend around seam_x using a sigmoid alpha mask.

    Constructs two distinct source arrays A and B:
      A = left image pixels, extended past the seam by repeating the last column
      B = right image pixels, extended before the seam by repeating the first column

    Then blends: result = A * alpha + B * (1 - alpha)
    where alpha is a smooth sigmoid from 1.0 (far left) to 0.0 (far right).

    This ensures a smooth colour/tone transition without colour corruption.
    """
    h, W = canvas_arr.shape[:2]

    zone_left = max(0, seam_x - blend_w)
    zone_right = min(W, seam_x + blend_w)
    zone_w = zone_right - zone_left
    seam_in_zone = seam_x - zone_left  # seam position inside the zone

    # --- Build A: left image content, padded with its last column past the seam ---
    l_start = zone_left - left_offset          # start col in left_arr
    l_end = seam_x - left_offset               # seam col in left_arr (exclusive)
    l_start_c = max(0, l_start)
    l_end_c = min(left_arr.shape[1], l_end)

    A = np.empty((h, zone_w, 3), dtype=np.float32)
    # Left of seam: original left image pixels
    if l_start_c < l_end_c:
        src_w = l_end_c - l_start_c
        dst_start = seam_in_zone - src_w
        A[:, dst_start:seam_in_zone] = left_arr[:, l_start_c:l_end_c]
    # Fill any gap at the very left (near start of panorama) with left_arr first column
    if l_start < 0:
        A[:, :(-l_start)] = left_arr[:, 0:1]
    # Right of seam: repeat last column of left image
    last_col = left_arr[:, l_end_c - 1:l_end_c]
    A[:, seam_in_zone:] = np.repeat(last_col, zone_w - seam_in_zone, axis=1)

    # --- Build B: right image content, padded with its first column before the seam ---
    r_end = zone_right - seam_x               # cols available from right_arr
    r_end_c = min(right_arr.shape[1], r_end)

    B = np.empty((h, zone_w, 3), dtype=np.float32)
    # Left of seam: repeat first column of right image
    first_col = right_arr[:, 0:1]
    B[:, :seam_in_zone] = np.repeat(first_col, seam_in_zone, axis=1)
    # Right of seam: original right image pixels
    B[:, seam_in_zone:seam_in_zone + r_end_c] = right_arr[:, 0:r_end_c]
    if r_end_c < zone_w - seam_in_zone:
        B[:, seam_in_zone + r_end_c:] = right_arr[:, r_end_c - 1:r_end_c]

    # --- Sigmoid alpha: 1.0 at left edge, 0.0 at right edge ---
    t = np.linspace(6, -6, zone_w, dtype=np.float32)
    alpha = (1.0 / (1.0 + np.exp(-t)))[np.newaxis, :, np.newaxis]

    blended = (A * alpha + B * (1.0 - alpha)).clip(0, 255).astype(np.uint8)
    canvas_arr[:, zone_left:zone_right] = blended
    logger.info("Sigmoid blend at seam x=%d, zone [%d:%d]", seam_x, zone_left, zone_right)
    return canvas_arr


def _add_label_overlay(
    image_bytes: bytes,
    street_name: Optional[str],
    timestamp: Optional[str],
) -> bytes:
    parts = [p for p in [street_name, timestamp] if p]
    label = " · ".join(parts)
    if not label:
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    draw = ImageDraw.Draw(img)

    font_size = max(16, img.height // 40)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()

    padding = 8
    text_bbox = draw.textbbox((0, 0), label, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    bar_h = text_h + padding * 2

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(
        [(0, img.height - bar_h), (text_w + padding * 3, img.height)],
        fill=(0, 0, 0, 160),
    )
    overlay_draw.text(
        (padding, img.height - bar_h + padding),
        label,
        font=font,
        fill=(255, 255, 255, 255),
    )

    result = Image.alpha_composite(img, overlay).convert("RGB")
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()


def _reinhard_match(
    left_arr: np.ndarray,
    right_arr: np.ndarray,
    strip_w: int = 150,
    max_shift: float = 80.0,
    max_scale: float = 2.5,
) -> np.ndarray:
    """
    Reinhard-style mean/std color transfer from left_arr's right edge to right_arr.
    Linear shift+scale only — cannot produce neon artifacts.
    Clamped: shift capped at ±max_shift levels, scale capped at [1/max_scale, max_scale].
    """
    ref = left_arr[:, -strip_w:].astype(np.float32)
    src = right_arr[:, :strip_w].astype(np.float32)
    out = right_arr.astype(np.float32)
    for c in range(3):
        src_mean = src[:, :, c].mean()
        src_std = max(src[:, :, c].std(), 1.0)
        ref_mean = ref[:, :, c].mean()
        ref_std = max(ref[:, :, c].std(), 1.0)
        scale = np.clip(ref_std / src_std, 1.0 / max_scale, max_scale)
        shift = np.clip(ref_mean - scale * src_mean, -max_shift, max_shift)
        out[:, :, c] = out[:, :, c] * scale + shift
    return out.clip(0, 255).astype(np.uint8)


def stitch_images(
    blob_urls: list[str],
    street_name: Optional[str],
    timestamp: Optional[str],
    on_progress: callable,
) -> bytes:
    """
    Stitch pipeline (attempt 11):
      1. Download + convert to PNG
      2. Resize all to common height
      3. Per-seam Reinhard mean/std matching (linear shift+scale from edge strips)
         — avoids CDF neon artifacts, corrects gross brightness/tone differences
      4. PIL concat at full resolution
      5. Sigmoid cross-fade blend at each seam (200px each side)
      6. Label overlay
    """
    logger.info("Downloading %d images", len(blob_urls))
    on_progress(1, 2)

    all_images = [_download_image(url) for url in blob_urls]
    png_images = [_to_png(b) for b in all_images]

    imgs = [Image.open(io.BytesIO(b)).convert("RGB") for b in png_images]
    target_h = min(img.height for img in imgs)

    resized = []
    for img in imgs:
        if img.height != target_h:
            scale = target_h / img.height
            img = img.resize((int(img.width * scale), target_h), Image.LANCZOS)
        resized.append(img)

    arrs = [np.array(img) for img in resized]

    # Global brightness normalization: match each image's mean luminance to the
    # median luminance across all images. Using median avoids being pulled toward
    # outliers (one very bright or very dark image).
    lums = [a.astype(float).mean() for a in arrs]
    ref_lum = float(np.median(lums))
    corrected = []
    for arr in arrs:
        src_lum = arr.astype(float).mean()
        scale = np.clip(ref_lum / max(src_lum, 1.0), 0.4, 2.5)
        corrected.append((arr.astype(float) * scale).clip(0, 255).astype(np.uint8))

    widths = [a.shape[1] for a in corrected]
    total_w = sum(widths)

    canvas = Image.new("RGB", (total_w, target_h))
    x = 0
    for arr in corrected:
        canvas.paste(Image.fromarray(arr), (x, 0))
        x += arr.shape[1]

    on_progress(2, 2)

    canvas_arr = np.array(canvas)
    x = 0
    for i in range(len(corrected) - 1):
        x += widths[i]
        left_offset = sum(widths[:i])
        blend_w = min(BLEND_WIDTH, widths[i] // 3, widths[i + 1] // 3)
        canvas_arr = _sigmoid_blend_seam(
            canvas_arr,
            seam_x=x,
            left_arr=corrected[i],
            right_arr=corrected[i + 1],
            left_offset=left_offset,
            blend_w=blend_w,
        )

    result_img = Image.fromarray(canvas_arr)
    buf = io.BytesIO()
    result_img.save(buf, format="PNG")
    final_png = buf.getvalue()

    labeled = _add_label_overlay(final_png, street_name, timestamp)
    return labeled
