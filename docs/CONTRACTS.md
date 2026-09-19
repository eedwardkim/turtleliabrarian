# Component boundaries for M1

The shared TypeScript wire schema is `src/contracts.ts`. Do not alter it
without reporting a necessary integration change. No `any`, no dynamic
attribute shortcuts, no fake Python interpreter.

## Python engine — ownership engine/, tests/engine/, engine-requirements.in, engine-requirements.txt
Independent `engine/datascience/__init__.py` and helper modules; exported
`engine/shelf_runtime.py` with `run(request: dict) -> dict` matching RunResult.
Run accepts JSON RunRequest and returns JSON-safe values, finite values or
null for NaN. Input code is trusted content, seeded with np.random.seed and
random.seed before evaluation. It introduces input globals. Explicit inputs
override the generator. Deserialize tagged table/array inputs. Collect named
inputs for 3D. Player code has fresh globals and deliver; evaluate last
expression notebook-style. Preserve complete delivered rows for checking.
Events include snapshots in payload `value` matching Value, plus operation
payloads. Use deterministic object ids within run.
M1: expressions, arrays, table construction/selection/where/sort/take.
Oracle tests import actual datascience under an isolated process or explicit
separate path; never vendor oracle source. Runtime starts sys.path with engine.

## Runtime — ownership src/runtime/, scripts/prepare-runtime.mjs,
## scripts/test-pyodide.mjs, tests/runtime/
Export singleton `runtime` from `src/runtime/client.ts` with:
`init(onProgress?: (progress:number,message:string)=>void): Promise<void>`,
`run(request:RunRequest): Promise<RunResult>`, `stop():void`, `dispose():void`.
Self-host Pyodide 314.0.7 (verified official stable on project start).
Prepare script copies npm Pyodide core and fetches NumPy wheel/dependencies
using pinned lock SHA256. Fetch only at setup/build time, never CDN in game.
Copy all engine Python to public/engine in preparation; worker installs into
virtual FS and imports shelf_runtime.run. Engine may not yet be present on
your branch: test wrapper with isolated simple fixture and leave integration
test command, do not implement replacement engine. Pre-warmed standby and
8s hard kill. Node parity tool accepts tests independently, no server required.

## World — ownership blender/, src/scene/, public/models/, assets/,
## scripts/models*, tests/assets/, asset-manifest.json
Default export `World` from `src/scene/World.tsx`, props WorldProps.
World includes Canvas; app layers windows above it. Static pleasant diorama
visible before Python finishes. Scene must load real original Blender GLBs.
No edits to App, game state, runtime or package manifest. Provide required
dependencies/commands in handoff if missing.
Pure Director in src/scene/director.ts consumes TraceEvent. Build Shelby,
Quill, book/card/cart, Atlas and Returns/Stacks set pieces in M1. Build named
rigid clips, render previews and check budgets. Later assets wait for M1 gate.

## Game/content — ownership content/ excluding ui strings; src/game/,
## tests/content/, scripts/validate-content.py, scripts/economy*
Export `puzzles: Puzzle[]` from `src/game/catalog.ts` imported from JSON files.
Build exactly first 12 M1 puzzles: 4 prologue + 6 ch1 + 2 ch2.
Export `useGame` Zustand hook from src/game/store.ts:
state fields: screen ('title'|'intro'|'game'|'credits'), loading (0..1),
loadingMessage, ready, save (SaveData), puzzle (Puzzle), activeFile (string),
result (RunResult|null), expected (Value), queue (QueueEntry[]),
diff (CheckDiff|null), busy (boolean), status (string), hintLevel (number),
traceIndex (number), replayPaused (boolean).
actions on state: initialize():Promise<void>, newGame(name:string):void,
setScreen(screen):void, setCode(code:string):void, setActiveFile(name):void,
addFile(name:string):void, run():Promise<void>, serveQueue():Promise<void>,
stop():void, gotoPuzzle(id:string):void, nextPuzzle():void, hint():void,
setSettings(partial):void, setLayout(id,layout):void,
setReplay(index:number):void, setReplayPaused(bool):void, setSpeed(n):void,
loadSlot(slot:number):Promise<void>, saveSlot(slot:number):Promise<void>,
exportSave():string, importSave(json:string):Promise<void>,
reset():void, fileStandingOrder():void, stepClock(seconds:number):void,
markTutorial(id:string):void, purchase(id:string):void,
autoSolve():Promise<void>, playNaive():Promise<void>.
The worker singleton is imported from runtime/client. UI should not implement
independent game rules. Checker is pure `check(actual,expected,settings)`.
Save service `src/game/saves.ts` uses idb. Tests on migrations/recovery/checker.
Return real reference expected outputs via worker; never expose answer in
normal dialogue. Validate content by importing engine runner when integrated.

## UI — ownership src/ui/, src/App.tsx, src/main.tsx, src/styles.css,
## index.html, content/strings/ui.json, public/fonts/, public/favicon.svg
Import World default and useGame above. No substitute state store/runtime.
Title screen then skippable intro/name then game. Beautiful original FWR
composition: full sky/center diorama, small resource toolbar upper-left,
tool buttons upper-right, code left (dark ink)/paper request right/output
lower-left. Keep center clear. Floating compact resizable draggable windows
with title-bar controls and saved positions. Responsive desktop and
below-1024 gate. Fully keyboard-operable. Show all actual outputs/errors.
UseCodeMirror directly, self-host fonts. Never add dead actions.
Connect every button to store actions, meaningful UI state or documented
functional dialogs. No page full of decorative static cards.

## Integrator (parent)
Owns root tooling/lockfiles/docs/E2E scripts/DEVTOOLS and tour wiring,
merges component commits, fixes integration, runs all automated checks,
delegates browser inspection and reviews screenshots itself. Contributors
must push isolated branches, report SHA, tests, gaps and dependencies.
Do not create PRs, deploy, send Slack, or launch other agents. Do not change
root package/contract files; report required changes. No content scaling
beyond M1. Do not claim completion of requirements without measured evidence.
