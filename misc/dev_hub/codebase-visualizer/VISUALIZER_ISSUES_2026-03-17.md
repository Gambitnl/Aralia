# Codebase Visualizer Investigation

Date: 2026-03-17
Repo: `F:\Repos\Aralia`
Scope: `misc/dev_hub/codebase-visualizer`
Constraint followed: no code files were changed during this investigation. This file is the only written artifact.

## Investigation Method

I validated these findings by reading the visualizer server/client source, running the live server, calling `/api/health`, `/api/graph`, and `/api/scan`, generating a static export, and comparing graph output against real files under `src/`.

Key runtime evidence gathered during the investigation:

1. `npx tsx misc/dev_hub/codebase-visualizer/server/staticGenerator.ts`
   Result: generated `F:\Repos\Aralia\misc\codebase-visualization.html`
2. `Invoke-WebRequest http://localhost:3847/api/health`
   Result: `{"status":"ok","port":3847}`
3. `Invoke-WebRequest http://localhost:3847/api/graph`
   Result: JSON payload written to a temp file with length `1410697` bytes
4. `Invoke-WebRequest http://localhost:3847/api/scan`
   Result: JSON payload reporting `555` issues
5. Playwright load of `http://localhost:3847/`
   Result: UI loaded, and the browser console logged a `404` for `favicon.ico`

---

## Current Status After 2026-03-18 Fix Pass

The sections below remain the original investigation record. The status list here reflects the current visualizer code after the GitNexus-inspired implementation pass that changed:

- `server/analyzer.ts`
- `server/graphBuilder.ts`
- `server/sync.ts`
- `client/index.html`
- `client/css/style.css`
- `client/js/main.js`
- `client/js/panel.js`
- `client/js/rendering.js`

Status labels used here:

- `Fixed`: the issue was directly addressed in the current code.
- `Partially fixed`: some of the problem was removed, but the full issue is not gone.
- `Open`: the issue from the original report still stands.

Runtime proof for the parser/graph fixes:

- A fresh `GET /api/graph` on 2026-03-18 returned `1049` nodes and `2929` edges.
- `components/layout/GameModals.tsx` now includes lazy-loaded targets such as `components/MapPane.tsx` and `components/Submap/SubmapPane.tsx`.
- `components/MapPane.tsx` now has `assets/images/old-paper.svg` in `imports`.
- `components/ui/VersionDisplay.tsx` now has `package.json` in `imports`.
- `utils/core/i18n.ts` now has `locales/en.json` in `imports`.
- `components/ThreeDModal/Experimental/DeformationManager.ts` now has `workers/erosion.worker.ts` in `imports`.
- `assets/icons/BeltIcon.tsx` now reports `BeltIcon` as `exports: true` with the correct `6-10` span.
- `types/crime/index.ts` now includes enum blocks such as `CrimeType`, `HeatLevel`, `HunterTier`, and `GuildJobType`.
- `components/Submap/painters/shared.ts` now includes `BIOME_PALETTES` as a `constant` block.
- `types/index.d.ts` is no longer present as a pre-scanned graph node.

Runtime proof for the server/API hardening fixes:

- `GET /api/health` still returns `200`, but `POST /api/health` now returns `405` with `Allow: GET`.
- `GET /api/shutdown` now returns `405` with `Allow: POST`.
- `POST /api/shutdown` without the session token now returns `403` with `{"error":"Invalid shutdown token"}`.
- `GET /api/scan` now returns `405` with `Allow: POST`.
- `POST /api/scan` still succeeds with `200` and JSON output.
- A concurrent second `POST /api/scan` now returns `429`.
- Requests with `Origin: https://evil.example` no longer receive `Access-Control-Allow-Origin`, while `Origin: http://localhost:3847` receives a reflected loopback-only value.
- Starting a second visualizer server instance while one is already bound to `3847` now fails with an `EADDRINUSE` message instead of killing the existing listener.

Runtime proof for the remaining UI/export/performance fixes:

- The live Playwright accessibility snapshot now exposes the search box as `textbox "Search Files"` instead of relying on placeholder text alone.
- The same rendered snapshot now exposes file-list rows and graph nodes as buttons, proving keyboard focusability is no longer mouse-only.
- Static export generation now writes timestamped files under `misc\codebase-visualizations\` instead of overwriting one fixed path.
- The latest static export no longer contains the D3 CDN URL, no longer contains live `/js/api.js` script tags, and no longer contains absolute `F:\Repos\Aralia` paths.
- Live graph metadata now reports clearer descriptions such as `Re-export barrel for battle map...` for `components/BattleMap/index.ts` and the real consolidated-types summary for `types/index.ts`.
- Live category output still includes `context`, `constants`, `scripts`, `test`, and `workers`, and the browser legend now renders them with dedicated labels/colors instead of the generic fallback.
- Two back-to-back `GET /api/graph` requests both returned `200`, and the server log showed the second request completing immediately after cache reuse instead of another full multi-second rebuild.

Current counts:

- `Fixed`: 50
- `Partially fixed`: 0
- `Open`: 0

Issue-by-issue status:

1. `Fixed` - dynamic `import(...)` edges are now extracted through the AST import pass.
2. `Fixed` - `React.lazy` route and screen edges now appear because the lazy callback `import(...)` calls are parsed.
3. `Fixed` - asset imports now resolve into graph nodes such as `assets/images/old-paper.svg`.
4. `Fixed` - JSON imports now resolve into graph nodes such as `locales/en.json` and `package.json`.
5. `Fixed` - worker URL edges are now extracted for `new Worker(new URL(..., import.meta.url))` patterns.
6. `Fixed` - `export default Name;` is now recognized when computing exported blocks.
7. `Fixed` - expression-bodied block ranges now come from syntax node spans instead of brace heuristics.
8. `Fixed` - constants are now extracted as first-class blocks.
9. `Fixed` - enums are now extracted as first-class blocks.
10. `Fixed` - uppercase constants no longer get misclassified as React components.
11. `Fixed` - `context` category nodes now have a dedicated color entry instead of falling back to gray.
12. `Fixed` - `constants` category nodes now have a dedicated color entry instead of falling back to gray.
13. `Fixed` - `scripts` category nodes now have a dedicated color entry instead of falling back to gray.
14. `Fixed` - `test` category nodes now have a dedicated color entry instead of falling back to gray.
15. `Fixed` - `workers` category nodes now have a dedicated color entry instead of falling back to gray.
16. `Fixed` - pure re-export barrels are now classified as bridges without the short-file heuristic.
17. `Fixed` - active barrels are no longer implicitly treated as deprecated through bridge semantics.
18. `Fixed` - `MapPane.tsx` now shows the lazy-load dependent edge from `GameModals.tsx`.
19. `Fixed` - `SubmapPane.tsx` now shows the lazy-load dependent edge from `GameModals.tsx`.
20. `Fixed` - `.d.ts` files are no longer pre-scanned into the graph.
21. `Fixed` - sync now strips old advisory blocks instead of stacking duplicate headers.
22. `Fixed` - contradictory duplicated sync headers are prevented by the cleanup pass.
23. `Fixed` - sync now preserves full dependent paths instead of collapsing to basenames.
24. `Fixed` - sync bridge wording no longer calls bridges deprecated by default.
25. `Fixed` - the specific graph blind spots that made sync headers incomplete in the original report are now addressed.
26. `Fixed` - `/api/shutdown` now requires both `POST` and the per-session shutdown token.
27. `Fixed` - wildcard CORS was removed in favor of loopback-only origin reflection.
28. `Fixed` - API routes now enforce explicit HTTP methods and return `405` with `Allow` headers.
29. `Fixed` - `/api/scan` is now POST-only, local-only, and rejects overlapping runs with `429`.
30. `Fixed` - startup now refuses an occupied port instead of killing unrelated processes.
31. `Fixed` - static export now inlines D3 locally and no longer depends on the external CDN.
32. `Fixed` - static export now strips absolute workstation paths from the embedded graph payload.
33. `Fixed` - static export no longer bundles the live-only `api.js` script tag.
34. `Fixed` - static export now writes timestamped output paths, with optional `--output` override support.
35. `Fixed` - static export now uses a compact graph payload and only the runtime scripts needed for standalone viewing.
36. `Fixed` - the search input is now programmatically labeled with `for`/`id` wiring and descriptive text.
37. `Fixed` - graph nodes are now keyboard focusable and exposed as buttons.
38. `Fixed` - expanded view now has an explicit detail-panel action instead of relying only on double-click.
39. `Fixed` - tooltips now appear through focus and click paths instead of hover alone.
40. `Fixed` - browser `alert(...)` failures were replaced with an inline status surface.
41. `Fixed` - graph generation now uses asynchronous file reads instead of blocking `readFileSync` throughout the scan path.
42. `Fixed` - graph generation no longer reads each file twice.
43. `Fixed` - `/api/graph` now reuses a short-lived cache unless the caller explicitly requests `?refresh=1`.
44. `Fixed` - resize-driven graph rebuilds are now debounced.
45. `Fixed` - search-driven file-list rebuilds are now debounced.
46. `Fixed` - `constants.ts` description generation now pulls a meaningful summary from the file header instead of dropping to a blank result.
47. `Fixed` - barrel descriptions now explicitly describe re-export barrels instead of claiming they render UI.
48. `Fixed` - central type barrels now surface their real consolidated-type purpose instead of the generic `index` fallback.
49. `Fixed` - the mislabeled `Exports` dependency-view control now says `Dependents`.
50. `Fixed` - the inaccurate `Exports & Blocks` section title now says `Code Blocks`.

---

## Category 1: Missing Dependency Relationships

### 1. `GameModals.tsx` lazy-loaded dependencies are missing from the graph
Description: `src/components/layout/GameModals.tsx` lazy-loads a large number of modules, but the visualizer reports only its static imports.
Proof: `src/components/layout/GameModals.tsx:31-62` contains `lazy(() => import(...))` for `MapPane`, `QuestLog`, `SubmapPane`, `CharacterSheetModal`, and many others. The visualizer output for `components/layout/GameModals.tsx` reported only 10 imports: `types/index.ts`, `state/actionTypes.ts`, `config/mapConfig.ts`, `constants.ts`, `utils/permissions.ts`, `components/ui/LoadingSpinner.tsx`, `services/geminiService.ts`, `hooks/useDialogueSystem.ts`, `components/ui/ErrorBoundary.tsx`, and `components/ThreeDModal/ThreeDModal.tsx`. The parser in `server/analyzer.ts:50-76` only scans `import` and `export` statement lines and never looks for `import(...)`.

### 2. `App.tsx` lazy-loaded routes and screens are missing from the graph
Description: the root app file uses `React.lazy`, but those edges never appear in the graph.
Proof: `src/App.tsx:90-97` lazy-loads `TownCanvas`, `BattleMapDemo`, `CombatView`, `CharacterCreator`, `GameLayout`, `LoadGameTransition`, and `NotFound`. The visualizer output for `App.tsx` showed only its static imports and omitted all 7 of those lazy-loaded modules. Again, `server/analyzer.ts:50-76` has no dynamic-import handling.

### 3. Asset imports are silently dropped
Description: local asset dependencies do not appear in the graph even when the source file directly imports them.
Proof: `src/components/MapPane.tsx:12` imports `../assets/images/old-paper.svg`. The visualizer output for `components/MapPane.tsx` listed only TypeScript/TSX imports and omitted the SVG. `server/analyzer.ts:101-110` only resolves `'', .ts, .tsx, .js, .jsx, /index.ts, /index.tsx, /index.js, /index.jsx`, so `.svg` can never resolve.

### 4. JSON and `package.json` imports are silently dropped
Description: JSON-backed dependencies are invisible to the graph.
Proof: `src/components/ui/VersionDisplay.tsx:2` imports `../../../package.json`, and the visualizer output for `components/ui/VersionDisplay.tsx` returned `imports: []`. `src/utils/core/i18n.ts:19` imports `../../locales/en.json`, and the visualizer output for `utils/core/i18n.ts` also returned `imports: []`. The omission is explained by `server/analyzer.ts:101-110`, which has no `.json` resolution path.

### 5. Worker module dependencies are missing
Description: worker entry points created through `new Worker(new URL(..., import.meta.url))` are not represented in the graph.
Proof: `src/components/ThreeDModal/Experimental/DeformationManager.ts:108` constructs a worker from `../../../workers/erosion.worker.ts`. The visualizer output for `components/ThreeDModal/Experimental/DeformationManager.ts` listed only `components/ThreeDModal/Experimental/types.ts` and `components/ThreeDModal/Experimental/HydraulicErosion.ts`. The worker edge is missing because `server/analyzer.ts:50-76` only extracts top-level `import` and `export` statements.

---

## Category 2: Code Block Extraction Errors

### 6. Default-exported named declarations are not marked as exported
Description: the block extractor misses `export default Name;` style exports, so the UI understates what a file exports.
Proof: `src/assets/icons/BeltIcon.tsx:12` contains `export default BeltIcon;`. The visualizer code block output for `assets/icons/BeltIcon.tsx` showed the `BeltIcon` block with `"exports": false`. `server/analyzer.ts:147-152` only recognizes `export { ... }` lists and does not account for `export default Name;`.

### 7. Expression-bodied components get truncated block ranges
Description: the reported end line for expression-bodied components is wrong.
Proof: `src/assets/icons/BeltIcon.tsx` defines the component across `6-10`, but the visualizer output reported `startLine: 6` and `endLine: 7`. `server/analyzer.ts:167-188` finds block ends by brace counting; expression-bodied components wrapped in parentheses never open a function body brace, so the heuristic terminates too early.

### 8. Constants are not extracted at all, despite being part of the advertised block type union
Description: the visualizer claims to understand `constant` blocks but never extracts them.
Proof: `server/types.ts` includes `'constant'` in `CodeBlock['type']`, and `server/analyzer.ts:207-208` even has constant-specific description text, but there is no constant regex or extraction pass anywhere in `server/analyzer.ts:154-299`. This is observable in `src/constants.ts:43-64`, which exports a large constant barrel, while the visualizer output for `constants.ts` returned `codeBlocks: []`.

### 9. Enums are completely omitted from block extraction
Description: exported enums do not appear in the expanded graph or detail panel.
Proof: `src/types/crime/index.ts:6`, `:15`, `:55`, `:81`, `:92`, and `:111` declare exported enums such as `CrimeType`, `HeatLevel`, `HunterTier`, `HeistPhase`, `HeistRole`, and `HeistActionType`. The visualizer output for `types/crime/index.ts` contained interfaces only and no enum blocks. `server/analyzer.ts:154-160` defines regexes for components, functions, classes, hooks, types, and interfaces, but there is no enum regex.

### 10. Uppercase constants can be misclassified as React components
Description: non-component constants with uppercase names can be reported as components.
Proof: `src/components/Submap/painters/shared.ts:338` defines `export const BIOME_PALETTES = { ... }`. The visualizer output for that file included a block named `BIOME` with `type: "component"`, which does not exist in the source. The bad match is caused by `server/analyzer.ts:154`, whose `componentRegex` treats uppercase `const` names followed by object-ish syntax as component declarations.

---

## Category 3: Category Color Mapping Gaps

### 11. `context` category nodes fall back to the generic gray color
Description: the graph contains a `context` category, but there is no dedicated color for it.
Proof: the generated category list included `"context"`. `client/js/main.js:27-40` defines colors but contains `contexts` and not `context`. `client/js/panel.js:56-57` and `client/js/rendering.js:486-489` then fall back to `#888`.

### 12. `constants` category nodes fall back to the generic gray color
Description: `constants` is a real category in the graph but has no assigned palette entry.
Proof: the generated category list included `"constants"`. `client/js/main.js:27-40` has no `constants` key, and the fallback path is `client/js/panel.js:56-57` plus `client/js/rendering.js:486-489`.

### 13. `scripts` category nodes fall back to the generic gray color
Description: `scripts` appears in the graph legend but has no dedicated category color.
Proof: the generated category list included `"scripts"`. `client/js/main.js:27-40` does not define `scripts`, so `client/js/panel.js:56-57` and `client/js/rendering.js:486-489` render it as the generic fallback color.

### 14. `test` category nodes fall back to the generic gray color
Description: test-category nodes are visible in the graph but not visually distinct from uncategorized nodes.
Proof: the generated category list included `"test"`. `client/js/main.js:27-40` has no `test` entry, and the fallback logic is in `client/js/panel.js:56-57` and `client/js/rendering.js:486-489`.

### 15. `workers` category nodes fall back to the generic gray color
Description: worker files are present in the graph but lose category-level visual distinction.
Proof: the generated category list included `"workers"`. `client/js/main.js:27-40` does not define `workers`, so the UI renders those nodes with fallback gray through `client/js/panel.js:56-57` and `client/js/rendering.js:486-489`.

---

## Category 4: Role Classification and Topology Semantics

### 16. Pure barrel files can miss the `bridge` role
Description: the bridge heuristic misses obvious re-export barrels when they are longer than 500 characters and do not include `@deprecated`.
Proof: `src/components/BattleMap/index.ts` is a pure re-export file. The visualizer output for `components/BattleMap/index.ts` reported `"role": "normal"` and `importedBy: 0`. `server/graphBuilder.ts:88-92` only marks a bridge when a file both re-exports and either contains `@deprecated` or is shorter than 500 characters.

### 17. Non-deprecated public barrels can be treated as deprecated bridges
Description: the tool conflates "bridge" with "deprecated".
Proof: `src/commands/index.ts` is a current barrel file with no `@deprecated` marker. The graph output still reported `"role": "bridge"` for `commands/index.ts`. `server/sync.ts:112-117` then hardcodes the advisory text `DEPRECATED BRIDGE / MIDDLEMAN`, which would tell users the file is deprecated even when it is not.

### 18. `MapPane.tsx` appears to have no dependents even though `GameModals.tsx` uses it
Description: missing dynamic-import edges distort dependent counts and topology.
Proof: `src/components/layout/GameModals.tsx:32` lazy-loads `../MapPane`. The graph output for `components/MapPane.tsx` reported `importedBy: []`. That topology is materially false.

### 19. `SubmapPane.tsx` appears to have no dependents even though `GameModals.tsx` uses it
Description: the same dynamic-import blind spot breaks topology for other screens too.
Proof: `src/components/layout/GameModals.tsx:34` lazy-loads `../Submap/SubmapPane`. The graph output for `components/Submap/SubmapPane.tsx` reported `importedBy: []`.

### 20. Declaration files are treated as first-class graph nodes and clutter the ranking
Description: `.d.ts` files appear alongside runtime files and can dominate the graph.
Proof: `server/graphBuilder.ts:25-28` scans `**/*.{ts,tsx}`, which includes `.d.ts` files. The generated top-15 node list included both `types/index.ts` with `434` connections and `types/index.d.ts` with `38` connections. This duplicates conceptually similar surfaces and inflates the visual graph with declaration-only nodes.

---

## Category 5: Sync and Header Generation Defects

### 21. Sync can accumulate duplicate advisory blocks instead of replacing them
Description: files with an older unmarked advisory header get a new marked header prepended above the old one.
Proof: `server/sync.ts:87-92` only replaces content when both marker comments exist. Otherwise it prepends a new block. `src/state/actionTypes.d.ts:1-29` now contains two full advisories, one marked and one unmarked, proving the duplication path already happened in the repo.

### 22. Duplicate sync headers can contradict each other inside the same file
Description: once duplicated, the tool leaves mutually inconsistent architectural guidance in place.
Proof: in `src/state/actionTypes.d.ts:1-15`, the marked header says the file is an "ISOLATED UTILITY or ORPHAN". In `src/state/actionTypes.d.ts:17-29`, the older header says it is a "CRITICAL CORE SYSTEM". Both statements cannot be true simultaneously.

### 23. Dependent names are lossy and can become ambiguous
Description: sync collapses most dependent paths down to bare basenames, so duplicate names are not distinguishable.
Proof: `server/sync.ts:120-131` formats dependents by returning only the basename, except for `index.ts`. The repo contains duplicate basenames such as `pathfinding.ts`, `planarUtils.ts`, `targetingUtils.ts`, and `walkabilityUtils.ts` in multiple folders under `src`. A sync header would collapse those to ambiguous repeated names.

### 24. Bridge advisories overstate deprecation
Description: any file that lands in the bridge bucket gets a deprecation warning, even when the file is an active barrel.
Proof: `server/sync.ts:112-117` always returns `DEPRECATED BRIDGE / MIDDLEMAN` for `isBridge`. `commands/index.ts` has no deprecation marker, yet the graph classified it as `bridge`, so the sync text would be false for that file.

### 25. Sync inherits all graph blind spots, so generated headers can be incomplete
Description: because sync is built on `generateGraphData()`, any missed edge becomes a stale or wrong advisory count.
Proof: `server/sync.ts:47-50` loads the graph from `generateGraphData()`. The investigation already confirmed missing edges for `GameModals.tsx`, `App.tsx`, `MapPane.tsx`, `VersionDisplay.tsx`, `utils/core/i18n.ts`, and `DeformationManager.ts`, so sync-generated headers for those files cannot be complete.

---

## Category 6: Server/API Security and Operational Hazards

### 26. `/api/shutdown` is unauthenticated
Description: any caller who can reach the server can stop it.
Proof: `server/api.ts:45-50` shuts the server down on a plain request to `/api/shutdown`. There is no authentication, local token, or origin check.

### 27. The server advertises wildcard CORS to every origin
Description: the process allows cross-origin browser calls from anywhere.
Proof: `server/index.ts:171-175` sets `Access-Control-Allow-Origin: *` and allows `GET, POST, OPTIONS`. Combined with the unprotected API routes, any page opened in the same browser can call this server.

### 28. API routes do not enforce HTTP methods
Description: route behavior is keyed only by pathname, not method.
Proof: `server/api.ts:37-85` checks only `pathname`. A `GET`, `POST`, or any other method that reaches `handleApiRequest` can hit `/api/shutdown`, `/api/scan`, or `/api/graph`.

### 29. `/api/scan` exposes an expensive repo-wide command with no guardrails
Description: any caller can trigger the quality scan process repeatedly.
Proof: `server/api.ts:53-68` shells out to `npx tsx scripts/scan-quality.ts --json`. During this investigation, a direct request to `/api/scan` returned a JSON report with `555` issues. That endpoint is expensive and unauthenticated.

### 30. Server startup force-kills any process bound to port 3847
Description: the visualizer can terminate unrelated software if that software happens to be using the chosen port.
Proof: `server/index.ts:34-90` runs `taskkill /PID ... /F` on Windows or `kill -9` on Unix for every PID listening on port `3847` before the server starts. The code does not verify that the process being killed is an older visualizer instance.

---

## Category 7: Static Export Contract Failures

### 31. The "standalone" export is not actually standalone
Description: the exported HTML still depends on an external CDN.
Proof: `VISUALIZER_README.md` says the static export is a "standalone dependency report". `server/staticGenerator.ts:50-56` injects `<script src="https://d3js.org/d3.v7.min.js"></script>`, and the generated HTML contains that script tag at `misc/codebase-visualization.html:831`.

### 32. Static export leaks absolute local filesystem paths
Description: sharing the HTML also shares workstation-specific absolute paths.
Proof: `server/staticGenerator.ts:54` serializes the full `GraphData` into `window.__VISUALIZER_GRAPH_DATA__`. The generated HTML at `misc/codebase-visualization.html:834` embeds values such as `"fullPath":"F:\\Repos\\Aralia\\src\\types\\index.ts"`.

### 33. Static export bundles `api.js` even though static mode cannot use the API
Description: the export includes dead runtime code.
Proof: `server/staticGenerator.ts:26` includes `api.js` in `SCRIPT_FILES`, and `server/staticGenerator.ts:56` inlines every script file. But `client/js/main.js:73-87` explicitly disables live-only controls in static mode, so that API wrapper is dead weight in the standalone artifact.

### 34. Static export always overwrites the same file
Description: repeated runs destroy the previous report without versioning or confirmation.
Proof: `server/staticGenerator.ts:24` hardcodes `misc/codebase-visualization.html`, and `server/staticGenerator.ts:78-79` writes to that path unconditionally.

### 35. The generated export is heavy because it inlines raw graph JSON and all client code
Description: the static artifact is much larger than it needs to be.
Proof: the generated file size is `1472162` bytes. The size follows directly from `server/staticGenerator.ts:50-56`, which inlines the entire graph JSON plus every client script and the full stylesheet into one HTML file.

---

## Category 8: UI, Accessibility, and Interaction Issues

### 36. The search field is not programmatically labeled
Description: screen readers get the placeholder text, not the visible label.
Proof: `client/index.html:38-40` renders a `<label>` and a separate `<input>` with no `for`/`id` association and no wrapping label element. In the Playwright accessibility snapshot, the control appeared as `textbox "Type to filter files..."` rather than `Search Files`.

### 37. Graph nodes are mouse-only and not keyboard focusable
Description: keyboard users cannot move focus to a node or activate it.
Proof: `client/js/rendering.js:96-178` appends SVG `<g>` elements, attaches `click`, `dblclick`, `mouseover`, and `mouseout` handlers, and adds no `tabindex`, `focus`, `blur`, or `keydown` support.

### 38. Expanded file view depends on double-click only
Description: the primary affordance for the expanded graph has no equivalent button or keyboard action.
Proof: `client/index.html:16` tells users "Double-click to expand." `client/js/rendering.js:171-173` binds expansion only to `dblclick`.

### 39. Tooltips are inaccessible to keyboard and touch users
Description: node detail previews appear only on hover.
Proof: `client/js/rendering.js:175-178` shows tooltips on `mouseover` and hides them on `mouseout`. `client/js/rendering.js:427-458` contains no alternative trigger for focus or tap.

### 40. Error handling uses blocking alerts instead of an in-app status surface
Description: failures interrupt the user with modal browser popups and leave no persistent error state in the UI.
Proof: `client/js/main.js:113-115`, `:130-131`, and `:138-139` call `alert(...)` for graph and scan failures. There is no inline error panel or status region.

---

## Category 9: Performance and Scale Problems

### 41. Graph generation uses synchronous file I/O for every file
Description: the server blocks the event loop while reading the repo.
Proof: `server/graphBuilder.ts:34-38` iterates every matched file and uses `fs.readFileSync(fullPath, 'utf-8')`.

### 42. Graph generation reads each file twice
Description: the second pass doubles the file-read cost just to classify bridges.
Proof: after the initial read in `server/graphBuilder.ts:34-38`, the bridge pass rereads every file again in `server/graphBuilder.ts:85-91`.

### 43. `/api/graph` recomputes the entire graph on every request
Description: the tool does no caching and no incremental reuse.
Proof: `server/api.ts:71-77` calls `generateGraphData()` on every `/api/graph` request. During this investigation, the resulting payload was `1410697` bytes, so repeated refreshes do substantial work.

### 44. Window resize rebuilds the entire graph without debounce
Description: resizing the browser can trigger repeated full D3 teardown and reconstruction.
Proof: `client/js/main.js:276-279` calls `rendering.createGraph(...)` on every `resize` event with no debounce or `requestAnimationFrame` buffering.

### 45. The file list is fully rebuilt on every keystroke
Description: search scales poorly because each input event empties and recreates the whole sidebar list and all item listeners.
Proof: `client/js/main.js:253-257` calls `panel.buildFileList(...)` on each `input`. `client/js/panel.js:75-113` clears `container.innerHTML`, refilters the entire node array, recreates every row, and reattaches click and double-click handlers.

---

## Category 10: Misleading Descriptions and Labels

### 46. `constants.ts` gets a blank description
Description: the description generator can lose meaningful top-of-file docs entirely.
Proof: `src/constants.ts:1-10` has a substantial file header explaining what the module does. The visualizer output for `constants.ts` reported `description: ""`. The relevant extraction logic is `server/analyzer.ts:302-311`.

### 47. Barrel descriptions degrade into nonsense like "rendering index"
Description: the path-based fallback produces misleading summaries for barrel files.
Proof: the visualizer output for `components/BattleMap/index.ts` reported `description: "UI component for rendering index"`. The source file is a pure re-export barrel, not a UI component implementation. The fallback heuristic is `server/analyzer.ts:315-324`.

### 48. Central type barrels get generic, low-value descriptions
Description: some of the most important files get metadata that is technically true but practically useless.
Proof: the visualizer output for `types/index.ts` reported `description: "Type definitions for index"`. That text is too generic to help humans understand what the file actually represents.

### 49. The `Exports` dependency-view toggle does not show exports
Description: the label says "Exports", but the implementation highlights dependents, not exported symbols.
Proof: `client/index.html:33-35` labels the third dependency mode button `Exports`. `client/js/rendering.js:234-238` implements that mode by iterating `selectedNode.importedBy`, which means "files that import this file", not the file's exports.

### 50. The `Exports & Blocks` panel title is inaccurate
Description: the detail panel mixes exported and non-exported blocks under one heading.
Proof: `client/index.html:69` titles the section `Exports & Blocks`. `client/js/panel.js:160-176` renders every code block and only adds an `EXPORTED` badge when `block.exports` is true. Non-exported blocks are therefore still shown under an exports-labeled heading.

---

## Summary

This investigation found 50 evidence-backed issues across 10 categories. The most severe patterns are:

1. The dependency graph misses real edges for lazy imports, workers, assets, and JSON.
2. Code-block extraction both drops real symbols and invents fake ones.
3. The sync/header trust contract is already broken by duplicate and contradictory advisories.
4. The live server exposes shutdown and scan operations without authentication.
5. The static export is not actually standalone and leaks local filesystem paths.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"misc/dev_hub/codebase-visualizer/VISUALIZER_ISSUES_2026-03-17.md","sha256WithoutMarker":"bfc5896e7b591c084ca699eaa9e68d9e03edcf77b7e1e8baa941424c176cd659","markedAtUtc":"2026-06-26T00:42:50.363Z"} -->
