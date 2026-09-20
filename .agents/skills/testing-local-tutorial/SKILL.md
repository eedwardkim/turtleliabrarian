---
name: testing-local-tutorial
description: Run the local Shelf Life tutorial in a fresh browser and verify editor completion, Pyodide execution, and scene replay.
---

# Local tutorial runtime testing

## Devin Secrets Needed
None. The Vite application runs Python in-browser through Pyodide.

## Setup
- Run `make dev` from the repository root. This prepares the pinned runtime before starting Vite, normally at `http://localhost:5173`.
- Use a fresh Chrome incognito session or isolated profile so IndexedDB progress does not suppress new-player tutorials.
- Verify the title menu has no Continue option before claiming fresh storage. Incognito windows can share an existing incognito session; close all of them first or use an isolated origin such as `http://127.0.0.1:5173`.
- Wait for the loading screen to become the title menu; first Pyodide initialization may take time.
- Maximize the browser. On macOS, double-clicking an empty title-bar area expands it without entering browser fullscreen.

## Reach the feature
- New game → story (Turn the page or Skip story) → name form → Begin enters the guided demo. Read current tutorial content rather than assuming a fixed step count.
- The Help lightbulb in the upper-right toolbar replays the demo.
- Settings exposes Reduce motion and Default replay speed (minimum 0.5×).
- Saved code may already satisfy a replayed exercise. Restore the current puzzle's starter containing `___` before testing ghost acceptance again.

## Runtime evidence
- Test Tab with the cursor away from the blank, clicking the ghost, and manually replacing the blank.
- Main Run and scratch Run are different controls. The blotting-paper window has its own Run.
- Floating windows can be moved by their title bars; move blotting paper left to uncover the Stacks and sieve.
- Check both the main Output and the scratch output after runs. Automatic step transitions can remount scratch windows or navigate requests, so capture whether results remain visible instead of assuming successful computation implies a visible table.
- Do not infer animation correctness from a final station pose. Record the walk/action sequence; inspect original recording frames if actions are too quick to judge.
- Lesson puzzles suppress normal tutorial popups and queue/hint/scratch UI; later chapters should restore them. Test both sides of that boundary.
- The Solved overlay hides the active guided demo. Test Stay here to inspect the demo's satisfied state, and separately test Next request directly from Solved to verify it ends the demo. Starting New game from the title resets local test progress.
- The Solved overlay blurs the scene, so a screenshot of it cannot establish Shelby's cheer animation. Success audio also needs audible evidence; do not infer it from completion.
