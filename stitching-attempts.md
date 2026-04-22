# Stitching Approach History

A log of what we tried, what we learned, and why we moved on.

---

## Attempt 1 — Multiple separate images → Gemini

**Approach:** Send N individual PNG files to `gemini-2.5-flash-image` with a prompt like "combine these into a panorama."

**Result:** Gemini hallucinated. It creatively recombined image content rather than faithfully stitching. The output was one image made of fragments from the inputs but with invented/imagined details added. Not usable.

**Why it failed:** Gemini Flash Image is a generative model — when given N independent images it interprets them as reference material for generation, not as sequential frames to splice. It doesn't reason about spatial ordering or pixel fidelity.

---

## Attempt 2 — PIL naive concat → Gemini seam fix

**Approach:** PIL-concatenate all images side by side (naively, no blending). Send the single wide image to Gemini with a prompt: "fix the seams between these frames."

**Result (first run):** Gemini returned one of the raw input images unchanged. No seam blending. This was because we used `google-generativeai==0.8.3` which doesn't support `response_modalities=["IMAGE"]` — the model returned a text response, not an image.

**SDK fix:** Switched from `google-generativeai` to `google-genai>=1.5.0` which supports `GenerateContentConfig(response_modalities=["IMAGE"])`.

**Result (after SDK fix):** Gemini returned a 2048×512 image. This was a fixed output resolution — Gemini cropped/compressed the input. For a 4-image concat (~2560px wide), the rightmost content was cut off. Users reported "only 3 images visible."

**Why it failed:** Gemini Flash Image has a hard output resolution cap (~2048px wide). Regardless of input dimensions, the output is always ~2048px. A 4-image panorama at full resolution is ~2560px — Gemini crops it.

**Image evidence:**

- Output: 2048×512 — visible seam in the middle, rightmost images missing
- ![attempt-2-result](stitched-images/attempt-2-gemini-output.png) *(if saved)*

---

## Attempt 3 — Scale input to 1920px before Gemini

**Approach:** Same as Attempt 2, but scale the PIL concat down to max 1920px wide before sending to Gemini, hoping to stay within the output resolution cap.

**Result:** Same 2048×512 output. No improvement. Scaling the input didn't help because Gemini generates at its own preferred resolution, it doesn't passthrough the input dimensions. The model appeared to output the same content regardless of whether the input was 1920px or 2560px.

**Why it failed:** Same root cause as Attempt 2. The output resolution is determined by Gemini's output, not the input size.

---

## Attempt 4 — Pure PIL: histogram matching + cross-fade

**Approach:** No Gemini. Concatenate at full resolution. Apply per-channel histogram matching (match each image's color distribution to the first image). Apply a 60px linear cross-fade at each seam.

**Result:** Full resolution output (17319×1540 for 6 images). All images included, correct order. But quality was poor — seams still visible, color inconsistencies between frames, the cross-fade was mechanical and didn't understand image content.

**Image evidence:**

- Output: 17319×1540 — all images present, correct order, rough seams with visible color jumps

**Why it wasn't good enough:** Histogram matching adjusts overall brightness/contrast but doesn't fix local color casts, perspective differences, or duplicate content at frame edges. The 60px cross-fade just blends pixels linearly — it doesn't understand that a pole, wall edge, or awning should be seamlessly continued.

**User verdict:** "this is pretty bad. the point of using gemini was to have a foundation model predict and blend images at seams."

---

## Attempt 5 — Pairwise Gemini seam blending (current)

**Approach:** PIL concat at full resolution (preserving all content at full width). Then for each seam between adjacent images i and i+1:
1. Extract a ~400px wide strip centered on the seam (200px from right of image i, 200px from left of image i+1)
2. Send that narrow strip to Gemini with prompt: "blend the seam between the left and right halves"
3. Composite Gemini's blended strip back into the full-resolution canvas

For N images, this is N-1 Gemini calls. Each call receives a small image (~400px × full height), well within Gemini's output resolution cap.

**Why this should work:**
- Full resolution preserved (Gemini never sees the full panorama, so the 2048px cap is irrelevant)
- Gemini does what it's actually good at: semantic blending of a small, focused region
- Falls back to PIL cross-fade per-seam if any Gemini call fails
- N-1 API calls is acceptable for N ≤ 12 images (max 11 calls)

**Result:** Failed. Seams as sharp as naive stitching.

**Why it failed:** Two bugs discovered:
1. Gemini receives a tall narrow strip (e.g. 400×1540px portrait). Gemini outputs at its fixed ~2048×512 landscape resolution regardless of input. When we resize that back to 400×1540, the content is stretched/distorted beyond recognition.
2. The PIL cross-fade fallback had a bug — it was blending `left_strip` with itself (same array reference), producing zero blending. Canvas was completely unmodified if Gemini call failed.

**Root cause:** Same Gemini output resolution cap, just hitting it differently. The strip is portrait-oriented but Gemini outputs landscape. Any resize back to original dimensions destroys the blended content.

---

## Attempt 6 — Laplacian pyramid blending

**Approach:** Multi-scale blending using a Laplacian pyramid. Low-frequency content (color, broad gradients) blends over a wide zone; high-frequency content (edges, texture) blends sharply. Each level of the pyramid uses a different blend width. Combined with global histogram matching (all images matched to image 0).

**Result:** Seams 4-5 still had visible artifacts. Color inconsistencies remained.

**Why it failed:** Bug discovered: both `left_strip` and `right_strip` were sliced from the already-painted canvas at the same position. `A * alpha + A * (1 - alpha) = A` — zero blending. Color artifacts at seams 66% and 83% came from pyramid reconstruction of identical arrays.

---

## Attempt 7 — Sigmoid blend with correct A/B construction

**Approach:** Construct truly distinct A (left image pixels padded past seam with last column) and B (right image pixels padded before seam with first column) arrays. Blend with sigmoid alpha mask (smooth S-curve from 1.0 at left to 0.0 at right). Global histogram matching (all images to image 0).

**Result:** Seams 1-3 improved but seams 4-5 had noticeable color step. All seams present and correctly positioned.

**Why it wasn't good enough:** Global histogram matching to image 0 over-corrects images 4-6 which have very different exposure/color temperature. Matching warm afternoon images to a cooler reference creates unnatural color shifts at the point of the seam.

---

## Attempt 8 — Chain histogram matching (each image to left neighbour)

**Approach:** Instead of matching all images to image 0, chain-match: image 2 → image 1, image 3 → image 2, etc. Used edge strips (right 300px of left image, left 300px of right image) for local accuracy. Sigmoid blend for the seam itself.

**Result:** Severe orange/red color cast across all images. Worse than attempt 7 for color accuracy.

**Why it failed:** Chain matching propagates errors. Image 4's right edge is bright warm daylight; image 5's left edge is darker with a yellow awning. Chain matching over-corrected image 5 toward the warm edge of image 4, then image 6 toward the now-wrong image 5, creating runaway color drift across all downstream images.

---

## Root Cause Summary

| Issue | Root Cause |
|-------|-----------|
| Gemini hallucinating | N separate images → Gemini treats them as references, not frames |
| Only 3 images in output | Gemini output resolution capped at ~2048px; wide concat gets cropped |
| Scaling input didn't help | Gemini outputs at its own resolution regardless of input size |
| PIL seams visible | Histogram matching + linear cross-fade can't handle content-level differences |
| Laplacian pyramid no-op | Both A and B were sliced from same canvas position — blending with itself |
| Chain matching color drift | Error propagation: warm edge of img4 cascades through img5→img6 |

**Key insight:** Gemini Flash Image is a *generative* model, not a pixel-perfect image editor. It cannot faithfully reproduce a wide input at the same resolution. For pure PIL stitching, global or chain color correction fails when images have large exposure discontinuities — need per-seam local correction applied only within the blend zone.

---

## Attempt 9 — Per-seam local histogram correction (no chain propagation)

**Approach:** Per-seam histogram matching using edge strips (left 150px of right image matched to right 150px of left image). Use original uncorrected arrays as reference for each seam to prevent chain-propagation of errors. Sigmoid blend at 200px each side.

**Result:** Severe neon/psychedelic color artifacts at seams 3-5. Green, pink, magenta blobs visible at transitions. Completely unusable.

**Why it failed:** Histogram matching via CDF interpolation produces garbage LUTs when source and reference strips have incompatible distributions (e.g., one strip is a bright sky, the other is a dark shutter). The CDF map sends colors to completely wrong values. The issue is specific to `np.interp(src_cdf, ref_cdf, np.arange(256))` — when the CDFs are very different, the interpolation creates wild non-monotonic lookups.

---

## Attempt 10 — No color correction, sigmoid blend only

**Approach:** Remove all color correction. Just resize images to common height, concat at full resolution, and apply sigmoid blend at each seam (200px each side). Accept exposure differences as-is.

**Result:** No neon artifacts. Seams 1, 4, 5 look decent. Seam 2 has a visible warm/cool color step (img3 is noticeably warmer than img2). Seams are visible but clean.

**Why it's not ideal:** The exposure difference between img2 (cool, dark) and img3 (warm, orange) creates a sharp tonal step visible through the blend zone. The sigmoid blend smooths pixel geometry but can't bridge a 60-level mean difference in RGB.

---

## Attempt 11 — Reinhard mean/std matching (linear shift+scale, no CDF)

**Approach:** Per-seam Reinhard color transfer — match each right image's left edge to the left image's right edge using mean and std only: `out = (src - src_mean) / src_std * ref_std + ref_mean`. Caps: max_shift=40, max_scale=1.5. Sigmoid blend at 200px each side.

**Result:** Slightly better than attempt 10. No neon artifacts (linear transform can't produce them). Seam 2 still has a visible warm/cool step because the correction was capped too aggressively (seam 1 delta was ~60 levels; cap was 40).

**Why it wasn't ideal:** Conservative caps under-corrected seams with large exposure gaps. Blend zone still too narrow at 200px each side.

---

## Attempt 12 — Reinhard + wider blend zone (current best)

**Approach:** Same Reinhard mean/std correction but with relaxed caps (max_shift=80, max_scale=2.5) to fully correct large exposure gaps. Widened blend zone to 400px each side (800px total per seam).

**Result:** Best result so far. All 5 seams show smooth gradual transitions with no hard color steps or neon artifacts. The wider blend zone creates a noticeable "ghost" double-image effect where the two scenes overlap, but this is a natural consequence of blending non-overlapping content. Colors are consistent across the panorama.

**Remaining limitation:** Street View images are taken at different positions with completely different content at seam edges — there is no geometric overlap to align. The "ghost" effect (soft double-image in the blend zone) is unavoidable with any purely spatial blend approach. Eliminating it would require a content-aware seam finder (e.g., graph cuts to find a minimum-cost seam path through shared content), which these images don't have.

---

## Attempt 13 — Global brightness normalization to img1 + per-seam Reinhard + wider blend

**Approach:** Two-pass correction: (1) scale each image's mean luminance to match img1, then (2) per-seam Reinhard fine-tuning. 400px blend zone.

**Result:** No visible improvement over attempt 12. Dark section in middle persisted.

**Why it failed:** The per-seam Reinhard (pass 2) partially undoes the global normalization — it tries to match img3 to img2's right edge which is still relatively dark, darkening img3 back toward its original value. The two passes fight each other.

---

## Attempt 14 — Median global normalization only + 400px sigmoid blend (current best)

**Approach:** Single-pass global normalization — compute median luminance across all images, scale each image to match that median. No per-seam correction (which was causing counter-corrections). 400px sigmoid blend at each seam.

**Result:** Best result so far. Panorama has even brightness across all 6 images. No dark hole, no neon artifacts, smooth transitions at all seams. The 800px total blend zone creates a gradual crossfade that hides the tone differences. Seam transitions are smooth gradients rather than cuts.

**Remaining limitation:** The "ghost" double-image effect in the blend zone is unavoidable — the images show genuinely different street positions with no shared content. Any spatial blend of non-overlapping content produces a visible opacity gradient between two different scenes.
