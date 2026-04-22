# Street Image Stitcher — Design Plan

**Date:** 2026-04-20
**Review:** /plan-design-review (initial) + /plan-ceo-review + /office-hours
**Initial design score:** 1/10
**Final design score:** 8/10

---

## Product Summary

A web tool for urban planners to composite multiple Google Street View screenshots into a seamless wide panoramic street elevation image. Used in inception reports, site analysis, and feasibility studies.

**Primary user:** Senior urban planner at a consultancy. Desktop. Professional, reports-focused.
**Problem solved:** Joel's manual Gemini workflow takes 1-3 hours per panorama. This takes 2 minutes.
**V1 scope:** Upload screenshots → label street → order left-to-right → AI stitches → download PNG + share.
**V2 scope:** Map UI + Google Street View Static API auto-capture. Build only after V1 validates demand.

**Key validation gate (do this before writing any code):**
Show 3 senior planners (not students) the naive imagy.app stitch vs Gemini output side-by-side.
Ask: "Would you pay $X/month for the Gemini-quality one automatically?" One "yes" = green light.

---

## Information Architecture

**Layout:** 3-step linear flow on a single page. No tabs, no panels, no navigation.

```
┌──────────────────────────────────────────────────┐
│  Street Image Stitcher                           │
├──────────────────────────────────────────────────┤
│  (1) Upload  →  (2) Order  →  (3) Result         │  ← step indicator
├──────────────────────────────────────────────────┤
│                                                  │
│  [active step content here]                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

Steps are not skippable. The numbered step indicator is visible at all times and shows the current step highlighted.

### Step 1: Upload

```
┌── Drop your Street View screenshots here ────────────────────────┐
│                                                                   │
│        [↑ icon]  Drop PNG or JPG files                            │
│                  or click to select  (up to 12 images)            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

- Full-width dashed drop zone, 200px tall
- Accepts: PNG, JPG (landscape preferred — Street View screenshots)
- Max: **12 images** (backend handles chunking transparently)
- File size limit: 10MB per image (show inline warning if exceeded)
- Drag-and-drop + click-to-browse both active
- Images appear as thumbnails immediately as they load — no blocking spinner
- After any image uploads: "Continue to ordering →" button activates

### Step 2: Order

```
  Label this panorama:
  Street name: [_________________]   Direction: [→ North-facing ▾]
  (optional)                          (optional)
  Timestamp:   [_________________]   (optional — e.g. "March 2024")

  Drag images left → right in the order they appear along the street:

  [1:img] [2:img] [3:img] [4:img] [5:img] [6:img]  ← drag to reorder
     ×       ×       ×       ×       ×       ×        ← remove button

  [ + Add more images ]          [ Stitch Images → ]
```

- Thumbnail strip with numbered badges (1, 2, 3...) and × remove button per thumbnail
- Drag-to-reorder: left/right arrow keys also work (keyboard support)
- Street name input (optional) — if provided, overlaid as a label on the output image
- Direction dropdown: North-facing / South-facing / East-facing / West-facing / (custom)
- Timestamp input (optional) — text field, e.g. "March 2024", "April 2026"
- "Add more images" link re-opens file picker (stays under 12 total)
- Stitch button: active only when ≥ 2 images are ordered
- Stitch button: `aria-disabled` with tooltip when inactive ("Add at least 2 images to stitch")

### Step 3: Result

```
  ✓ Your street elevation is ready — 6 images stitched
  Main Road, North-facing · April 2026

  [═══════════════ panoramic strip — scroll horizontally ═══════════]

  [ ↓ Download PNG ]   [ ← Stitch again (keeps your images) ]
```

- Full-width panoramic reveal, slides in from below (300ms ease-out)
- Header: "Your street elevation is ready — [N] images stitched"
- Subheader: "[Street name], [Direction] · [Timestamp]" (only shown if any label was provided)
- Panoramic image spans full viewport width minus 48px margin
- Horizontal scroll if panoramic wider than viewport
- Download PNG: triggers download of full-resolution output
- "Stitch again": returns to Step 2 with images still loaded — no re-upload needed

---

## Interaction States

| Feature | Loading | Empty | Error | Success |
|---------|---------|-------|-------|---------|
| Upload zone | Drag-active: border → blue, bg → #EFF6FF | "Drop PNG/JPG files..." with ↑ icon | "Upload failed — try again" | Thumbnails appear inline, continue button activates |
| Order strip | — | Unreachable | — | Thumbnails with numbered badges, × per thumbnail |
| Stitch button | Grayed (with tooltip: "Add at least 2 images") | — | — | Active blue |
| Stitching | "Stitching pass 1 of 2... (12s elapsed)" `aria-live` | — | "Stitching failed — try fewer images or try again" inline | — |
| Result panoramic | Skeleton strip (animated) | — | Error message, images stay in strip | Full-width scrollable strip |
| Download button | Grayed until result ready | — | — | Active |
| Share link button | Grayed until result uploaded | — | "Could not generate link" | Active — copies to clipboard |

**Stitching progress detail:**
- Backend silently batches into groups of 3-4 per Gemini call
- UI shows pass count: "Stitching pass 1 of 2... (Xs elapsed)"
- Elapsed timer updates every second — prevents "is it broken?" anxiety
- On error: error message appears inline, images stay in order strip for retry

---

## User Journey

| Step | User Does | User Feels | Design Response |
|------|-----------|------------|-----------------|
| 1 | Lands on page | "What is this? Can I trust it?" | TODO: before/after demo above fold (see TODOS) |
| 2 | Drops screenshots | "Will these work?" | Thumbnails appear immediately — visceral feedback |
| 3 | Labels the street | "This feels professional" | Simple form, familiar pattern |
| 4 | Reorders thumbnails | "Am I doing this right?" | "left → right along the street" instruction copy |
| 5 | Clicks Stitch | "Hope this works..." | Button confident, single prominent action |
| 6 | Waits | "Is it broken?" | Pass counter + elapsed timer removes doubt |
| 7 | Sees panoramic | "Oh wow, that's the whole street!" | Full-width reveal with ceremony |
| 8 | Copies share link | "I can send this to my team now" | One-click copy, no login |
| 9 | Downloads | "Report is one paste away" | PNG download, no extra clicks |
| 10 | Adjusts | "Can I drop that blurry shot?" | × on thumbnail, stitch again — no re-upload |

---

## Design System

### Visual Identity
**Aesthetic:** Precision tool (CAD/GIS software feel, not SaaS startup). The street imagery IS the visual — the UI gets out of the way.

### Typography
```
App name:       IBM Plex Mono 600, 16px, #111111
Step labels:    Inter 500, 13px, uppercase tracking, #888888
Section heads:  Inter 600, 14px, #333333
Body / copy:    Inter 400, 14px, #444444
Result label:   Inter 700, 20px, #111111
Result sub:     Inter 400, 14px, #666666
```

### Colors
```css
--color-bg:        #F8F8F7  /* warm white — not pure white */
--color-surface:   #FFFFFF
--color-border:    #E4E4E4
--color-accent:    #2563EB  /* blue — active states, CTA */
--color-accent-bg: #EFF6FF  /* light blue — hover/drag states */
--color-error:     #DC2626
--color-text:      #111111
--color-muted:     #666666
--color-step-done: #16A34A  /* green — completed step indicator */
```

### Spacing Scale
4px base: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

### Component Specs

**Upload zone (inactive):**
- 2px dashed border, `--color-border`
- Background: `--color-surface`
- Border radius: 4px

**Upload zone (hover / drag-active):**
- `border-color: --color-accent`, `border-style: solid`
- `background: --color-accent-bg`

**Thumbnail in order strip:**
- 120px × 80px image + 20px label bar below
- Number badge: top-left, 20px × 20px, `--color-accent`, white text
- × button: top-right, 20px × 20px, appears on hover, #666 background
- Drag state: 2px solid `--color-accent` border, `transform: scale(1.03)`

**Stitch button:**
- Background: `--color-accent`, white text, `border-radius: 2px`
- Height: 44px, min-width: 160px
- Disabled: `opacity: 0.4`, `cursor: not-allowed`

**Result reveal animation:**
- `300ms ease-out` slide-up from 20px below, opacity 0 → 1

**Step indicator:**
- Inline row: `(1) Upload · (2) Order · (3) Result`
- Current step: bold + `--color-accent`
- Completed step: `--color-step-done` + checkmark
- Future step: `--color-muted`

### Anti-slop Rules (enforced)
- No cards around content sections — whitespace and borders only
- No icons in colored circles
- Left-aligned layout throughout
- Border radius max 4px on interactive elements
- No decorative gradients, blobs, or SVG dividers
- No hero copy — tool explains itself through the UI
- No color except single blue accent (+ green for completed steps + red for errors)

---

## Responsive / Accessibility

**Target:** Desktop-first (1024px+). Tablet and mobile explicitly out of scope for V1.

### Accessibility Spec
```
Upload zone:         <input type="file"> behind drop zone
                     aria-label="Upload Street View screenshots"

Order strip:         role="listbox" on container
                     role="option" + aria-grabbed on each thumbnail
                     keyboard: left/right arrow keys reorder selected image

Stitch button:       aria-disabled="true" when inactive
                     aria-describedby pointing to reason text

Progress state:      aria-live="polite" region
                     announces: "Stitching pass 1 of 2"

Result image:        alt="Street elevation panoramic of [N] images:
                     [street name], [direction], [timestamp]"

Download/Share:      Both ≥ 44px touch target height
                     aria-label="Download panoramic as PNG" etc.

Color contrast:      All body text WCAG AA minimum (4.5:1)
                     Error states: 4.5:1 minimum
```

---

## NOT In Scope (V1)

| Item | Reason |
|------|--------|
| Mobile layout | Desktop only; revisit in V2 |
| Tablet layout | Out of scope for V1 |
| PDF export | Adds format complexity; validate quality first |
| JPG download | PNG is sufficient for report insertion; add later |
| Advanced options (chunk size, blend quality) | Default to auto; expose only if users ask |
| Session persistence (page refresh) | Acceptable for V1 — images lost on refresh |
| V2 map + auto-capture | Out of scope until V1 validated |
| User accounts / history | No login required for V1 |
| Portrait image hard-block | Warning only, not hard block |
| Shareable URL / permalink | Deferred — YAGNI before buyer validation; add after first paying user |

---

## What Already Exists

- **Raw screenshots:** [`raw-images/`](raw-images/) — 6 Street View screenshots of a street (India). Perfect test set.
- **Naive stitched result:** [`stitched-images/naive-merged-image-image-app.png`](stitched-images/naive-merged-image-image-app.png) — hard seams, perspective distortion. The "before" for the landing demo.
- **CEO Plan:** `~/.gstack/projects/street-image-stitcher/ceo-plans/2026-04-20-street-image-stitcher.md`
- **Office hours brief:** `~/.gstack/projects/street-image-stitcher/ananth-unknown-design-20260419-181338.md`

---

## Architecture (V1) — updated by /plan-eng-review

See CEO plan for full architecture diagram. Key decisions:

- **Async job:** POST /stitch returns `job_id` immediately; frontend polls GET /status/:id every 3s
- **Signed URL batch:** all N signed upload URLs generated in parallel (single roundtrip)
- **CORS:** Railway backend allows Vercel domain only
- **Rate limit:** 20 stitches/hr per IP (in-memory, resets on restart — acceptable for V1)
- **Label in PNG:** Pillow renders street name + direction + timestamp onto output PNG (bottom-left)
- **Sanity check:** backend validates output width/height ≥ 3.0 before returning result
- **Keep-alive:** Vercel cron pings Railway /health every 5min; also deletes blobs older than 24h
- **Gemini prompt:** "...Blend exposure differences at seams. Remove duplicate overlapping elements." (no "correct perspective distortion")
- **Launch gate:** Gate 0 (Gemini chain quality test with Joel's 6 images) MUST run before go-live

---

## Open Questions (Must Answer Before Building)

From CEO review — these gate implementation:

1. **Gemini quality test:** Upload Joel's 6 raw images to Gemini 2.0 Flash API now. Is it meaningfully better than imagy.app naive? How much?
2. **Context threshold:** Exact number of images Gemini handles per call. Does chunking introduce second-order seam artifacts?
3. **Buyer validation:** Find 3 senior planners (not students). Show them naive vs Gemini. Ask: "Would you pay $X/month?"
4. **Google TOS (V2 only):** Street View Static API + feeding into Gemini — does this violate terms?
5. **Vercel Blob share link:** How long do links live? Is there a storage cost concern at scale?

---

## TODOS

### TODO-1: Before/after landing demo
**What:** Comparison view above upload zone — naive imagy.app stitch vs AI-stitched result.
**Why:** New users won't trust the tool until they see output quality. Text can't answer this.
**Pros:** Dramatically improves first-visit trust; perfect content already exists in the repo.
**Cons:** Need one AI-stitched output to compare against (can't build this until the tool works).
**Context:** The naive-merged-image.png in stitched-images/ is ready to use as the "before." Build the "after" once the first stitch works.
**Depends on:** First successful AI stitch via Gemini API.

### TODO-2: Quality feedback mechanism
**What:** "Something look off?" link after result — captures session + output for debugging.
**Why:** When Gemini produces a bad seam, users currently have no recourse or way to report it.
**Pros:** Enables iterating on AI quality; users feel supported.
**Cons:** Requires a feedback endpoint + storage for captured sessions.
**Context:** CEO plan notes this as a known risk — Gemini makes "mistakes in the sensibility of the merging."
**Depends on:** Backend API built out.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | 5 expansions proposed, 3 accepted; 5 critical open questions |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score: 1/10 → 8/10, 8 decisions made |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** CEO Review open. Design Review complete. Eng Review complete (7 issues resolved, 1 unresolved risk: Gate 0 deferred). Ready to implement. Run Gate 0 before launch.
