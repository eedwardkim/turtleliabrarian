# Developer tools

## Frame capture

With the app running, `node scripts/capture.mjs` captures the opening tour into
`artifacts/V00/V00.mp4`. It uses the real title, introduction, tutorials, editor,
Python worker, and first two request queues at 1920×1080/30fps. Captions are burned
into the full-page frames before ffmpeg encodes silent H.264. `CAPTURE_URL` and
`CAPTURE_OUTPUT` override the local origin and artifact directory. `--smoke`
shortens holds for checking the pipeline.

`?dev=1&capture=1` disables the controller's wall-clock advancement.
`window.__SHELF__.stepClock(1 / 30)` advances one frame; the capture script also
steps browser timers and animation frames. Captures use an isolated browser
context and do not replace the player's saved library.

Add `?dev=1` to the address. Press backquote while focus is outside an editor.
The panel has searchable actions, puzzle and tutorial navigation, reference
typing and queue execution, naive and forced failure demonstrations, resource
editing, an eight-hour idle time warp, 0.25–50× replay, save
snapshot/restore/reset, camera presets, wireframe, grid, live renderer
statistics, fixtures, reference code and trace inspection.

Developer navigation explicitly enables Open Stacks and unlocks wing purchases.
It does not mark requests complete; auto-solve executes their real code and queues.
These tools alter the current local save. Export a player save first if needed.

Deep links support `puzzle`, `speed`, `autosolve=1`, and `tour`:

```
/?dev=1&puzzle=ch2-show-2&speed=10&autosolve=1
/?dev=1&tour=chapter-1
```

`window.__SHELF__` is available in developer mode. It exposes `getState`,
`gotoPuzzle`, `setCode`, `run`, `serveQueue`, `waitForIdle`, `getTrace`,
`setSpeed`, `startTour`, and `stepClock`. Tours accept `chapter-N`,
`first-10-minutes`, and `full-campaign`. They type reference scripts into
the actual editor state and execute actual Python and queues.
