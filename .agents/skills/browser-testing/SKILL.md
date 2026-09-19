---
name: shelf-life-ui-acceptance
description: Run browser acceptance and deterministic capture for Shelf Life's local Python game.
---

# Shelf Life UI acceptance

## Setup
- Run `make dev` from the repository; it prepares self-hosted Python assets and starts Vite on port 5173. No backend is needed.
- Use an existing Chrome/CDP connection when supplied. New isolated contexts are useful for fresh saves and migration fixtures, but their interactions may not appear in desktop recordings; capture page screenshots separately.
- On macOS use `Meta+A` inside CodeMirror. Set the exact viewport within each CDP attachment before resolution-sensitive screenshots; reconnection may restore the desktop viewport.

## Natural player flows
- Keep natural onboarding on the plain app URL without developer APIs. The title action is `New game`; intro story buttons are `Turn the page` (four beats), followed by `Open the library`.
- Tutorials use `Understood` or `Back to work` and may have multiple pages. Finish them before clicking obscured game controls.
- Scope the main editor to `[data-window="editor"] .cm-content`; use the window's exact `Run` and `Serve queue` buttons. Scratch uses `[data-window="scratch"] .cm-content` and `Try it`.
- Save dialogs are reached through `Pause menu` → `Save & load`. Saving/loading needs its confirmation button. Import invalid JSON and confirm both visible error and preserved exported state.
- Restore the desk layout only after choosing the viewport and UI scale for layout acceptance.
- Check `.cm-scroller` keyboard focus and PageDown with enough lines to overflow; axe alone does not prove scrolling.

## Separate developer tests
- Use `?dev=1` and Backquote for developer controls. The panel's Request selector can navigate to catalog requests. Do not count developer auto-solves as natural-play evidence.
- `window.__SHELF__.setCaptureMode(true)` freezes controller wall-clock advancement. Select a replay event and advance its time explicitly for identical normal/reduced-motion screenshot comparisons. Restore capture mode afterward.
- For runtime Retry, abort `**/engine/manifest.json` in an isolated browser context, then remove the route. The visible retry button is **Try again**, not Retry. Require actual Python warmup to an enabled New game after clicking.
- Test offline earnings using a real closed-page interval and recorded timestamps, not developer time warp. Isolated capture profiles have independent saves.

## Deterministic capture
- `CAPTURE_OUTPUT=<absolute directory> node scripts/capture.mjs --smoke` verifies the entire first-two-request capture flow cheaply.
- If smoke passes, run without `--smoke` in a new output directory. Full capture writes thousands of PNGs before encoding; console output appears after each caption block, so inspect frame modification times before assuming a stall.
- Require normal progression, nonempty successful queues, real Python results, actual partial-code frames, and visible captions; inspect the MP4 with ffprobe for H.264, 1920×1080, 30 fps, and size under 50 MB.
- Do not fix capture or product code during acceptance; retain completed product results if the capture needs a separate implementation handoff.

## Devin Secrets Needed
None for local runtime and UI testing.
