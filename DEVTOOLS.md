# Developer tools

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
