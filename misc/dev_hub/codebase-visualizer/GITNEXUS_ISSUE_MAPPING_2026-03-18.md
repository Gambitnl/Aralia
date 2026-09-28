# GitNexus Comparison Against Local Visualizer Findings

Date: 2026-03-18
Compared local report: `F:\Repos\Aralia\misc\dev_hub\codebase-visualizer\VISUALIZER_ISSUES_2026-03-17.md`
External repo reviewed: `https://github.com/abhigyanpatwari/GitNexus`
Constraint followed: no code files were changed. This file is the only written artifact for this comparison.

## Status Legend

- `Solved`: GitNexus has a source-backed implementation that removes the local issue or replaces the broken behavior with a materially better mechanism.
- `Partially solved`: GitNexus improves the problem area, but the specific local defect still appears possible or only some variants are covered.
- `Not solved`: the inspected GitNexus source still appears to have the same weakness.
- `No proof`: I did not find enough GitNexus source evidence to claim the issue is solved.

## GitNexus Sources Reviewed

- `gitnexus-web/src/core/tree-sitter/parser-loader.ts`
- `gitnexus-web/src/core/ingestion/pipeline.ts`
- `gitnexus-web/src/core/ingestion/parsing-processor.ts`
- `gitnexus-web/src/core/ingestion/import-processor.ts`
- `gitnexus-web/src/core/ingestion/call-processor.ts`
- `gitnexus-web/src/core/ingestion/tree-sitter-queries.ts`
- `gitnexus-web/src/core/ingestion/ast-cache.ts`
- `gitnexus-web/src/core/ingestion/utils.ts`
- `gitnexus-web/src/core/ingestion/symbol-table.ts`
- `gitnexus-web/src/core/graph/types.ts`
- `gitnexus-web/src/lib/constants.ts`
- `gitnexus-web/src/lib/graph-adapter.ts`
- `gitnexus-web/src/hooks/useSigma.ts`
- `gitnexus-web/src/components/GraphCanvas.tsx`
- `gitnexus-web/src/components/FileTreePanel.tsx`
- `gitnexus-web/src/components/RightPanel.tsx`
- `gitnexus-web/src/workers/ingestion.worker.ts`
- `gitnexus-web/src/services/server-connection.ts`

## Category 1: Missing Dependency Relationships

### 1. `GameModals.tsx` lazy-loaded dependencies are missing from the graph
- Local proof: `src/components/layout/GameModals.tsx:31-62` uses `lazy(() => import(...))`, while the local parser in `server/analyzer.ts:50-76` only scans top-level import/export statements.
- GitNexus evidence: TypeScript and JavaScript queries in `gitnexus-web/src/core/ingestion/tree-sitter-queries.ts` capture `import_statement`, not dynamic `import(...)`; `import-processor.ts` only resolves captures named `@import`.
- Status: `Not solved`
- Conclusion: GitNexus is AST-based, but the inspected import extraction still misses the exact lazy/dynamic-import pattern that broke the local graph.

### 2. `App.tsx` lazy-loaded routes and screens are missing from the graph
- Local proof: `src/App.tsx:90-97` uses `React.lazy`, but the local graph omitted those edges because `server/analyzer.ts:50-76` has no dynamic-import handling.
- GitNexus evidence: same limitation as issue 1; no dynamic-import query or dedicated resolver was found in `tree-sitter-queries.ts` or `import-processor.ts`.
- Status: `Not solved`
- Conclusion: GitNexus improves static import parsing but does not show source-backed support for `React.lazy(() => import(...))`.

### 3. Asset imports are silently dropped
- Local proof: `src/components/MapPane.tsx:12` imports `../assets/images/old-paper.svg`, but the local resolver in `server/analyzer.ts:101-110` never tries `.svg`.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/import-processor.ts` resolves only code-file extensions such as `.tsx`, `.ts`, `.jsx`, `.js`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.go`, `.rs`, and `.rb`.
- Status: `Not solved`
- Conclusion: I found no asset-resolution path for `.svg` or other non-code imports.

### 4. JSON and `package.json` imports are silently dropped
- Local proof: `src/components/ui/VersionDisplay.tsx:2` imports `../../../package.json`, and `src/utils/core/i18n.ts:19` imports `../../locales/en.json`, but the local resolver has no `.json` path in `server/analyzer.ts:101-110`.
- GitNexus evidence: `.json` is not in the extension list in `gitnexus-web/src/core/ingestion/import-processor.ts`, and `getLanguageFromFilename` in `gitnexus-web/src/core/ingestion/utils.ts` does not treat JSON as a supported language.
- Status: `Not solved`
- Conclusion: GitNexus does not appear to model JSON-backed dependencies either.

### 5. Worker module dependencies are missing
- Local proof: `src/components/ThreeDModal/Experimental/DeformationManager.ts:108` creates a worker from `erosion.worker.ts`, which the local parser misses because it only scans top-level import/export lines.
- GitNexus evidence: I found no handling for `new Worker(new URL(..., import.meta.url))` in `tree-sitter-queries.ts`, `import-processor.ts`, or `call-processor.ts`.
- Status: `Not solved`
- Conclusion: Worker URL edges do not appear to be extracted by the inspected GitNexus ingestion passes.

## Category 2: Code Block Extraction Errors

### 6. Default-exported named declarations are not marked as exported
- Local proof: `src/assets/icons/BeltIcon.tsx:12` has `export default BeltIcon;`, but the local extractor in `server/analyzer.ts:147-152` only recognizes `export { ... }`.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/parsing-processor.ts` decides `isExported` by walking ancestor nodes and checking whether current text starts with `export `. A later `export default Name;` statement would not mark the earlier declaration.
- Status: `Not solved`
- Conclusion: GitNexus has better export detection than the local regex parser, but not for this specific later-default-export pattern.

### 7. Expression-bodied components get truncated block ranges
- Local proof: `BeltIcon.tsx` spans `6-10`, but the local visualizer reported `endLine: 7` because `server/analyzer.ts:167-188` relies on brace counting.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/parsing-processor.ts` stores `startLine` and `endLine` from `nameNode.startPosition.row` and `nameNode.endPosition.row`, which describes the identifier token, not the full declaration body.
- Status: `Not solved`
- Conclusion: GitNexus avoids the same brace heuristic, but the line-range data is still not declaration-accurate.

### 8. Constants are not extracted at all, despite being part of the advertised block type union
- Local proof: the local server advertises `'constant'` in `server/types.ts`, but `server/analyzer.ts:154-299` has no constant extraction pass.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/parsing-processor.ts` can emit `Const`, `Static`, `Macro`, `Property`, and `TypeAlias` for some languages, but the TypeScript and JavaScript queries in `tree-sitter-queries.ts` do not extract general constants.
- Status: `Partially solved`
- Conclusion: GitNexus is materially better for several languages, but it does not fully solve the constants gap for the TypeScript-heavy cases that matter most to this repo.

### 9. Enums are completely omitted from block extraction
- Local proof: `src/types/crime/index.ts` declares many exported enums, but the local extractor has no enum regex in `server/analyzer.ts:154-160`.
- GitNexus evidence: enum extraction exists for Java, C, C++, C#, Rust, PHP, and Swift in `tree-sitter-queries.ts`, and `parsing-processor.ts` maps `@definition.enum` to `Enum`. TypeScript queries inspected did not include enum extraction.
- Status: `Partially solved`
- Conclusion: GitNexus fixes enum extraction for many languages, but not clearly for TypeScript.

### 10. Uppercase constants can be misclassified as React components
- Local proof: `src/components/Submap/painters/shared.ts:338` defines `BIOME_PALETTES`, but the local `componentRegex` in `server/analyzer.ts:154` falsely extracted a fake component.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/tree-sitter-queries.ts` matches AST node kinds, not name casing heuristics; function-like TS/JS captures require `arrow_function` or `function_expression`.
- Status: `Solved`
- Conclusion: the specific regex false-positive that invented a fake React component is removed by AST-based matching.

## Category 3: Category Color Mapping Gaps

### 11. `context` category nodes fall back to the generic gray color
- Local proof: the local UI defines `contexts` but not `context` in `client/js/main.js:27-40`, so `client/js/panel.js:56-57` and `client/js/rendering.js:486-489` fall back to gray.
- GitNexus evidence: GitNexus does not use the same path-category model; it colors node labels through `gitnexus-web/src/lib/constants.ts`. However, `parsing-processor.ts` can emit labels not present in `core/graph/types.ts` or `constants.ts`.
- Status: `Partially solved`
- Conclusion: GitNexus avoids this exact `context` typo class, but it still has taxonomy/color mismatches for other emitted node labels.

### 12. `constants` category nodes fall back to the generic gray color
- Local proof: `constants` is a real local category but missing from `client/js/main.js:27-40`.
- GitNexus evidence: GitNexus no longer colors by path category, but the parser can emit `Const` and `Static` labels while `core/graph/types.ts` and `lib/constants.ts` do not define them.
- Status: `Partially solved`
- Conclusion: the exact local category bug disappears, but the broader "emitted thing has no dedicated UI color/type support" problem still exists.

### 13. `scripts` category nodes fall back to the generic gray color
- Local proof: `scripts` is present in the local graph but not in `client/js/main.js:27-40`.
- GitNexus evidence: no identical path-category mechanism was found; the UI instead colors node labels via `lib/constants.ts`.
- Status: `Partially solved`
- Conclusion: GitNexus changes the modeling approach, but I cannot call the underlying visualization-taxonomy problem fully solved because unsupported emitted labels still exist.

### 14. `test` category nodes fall back to the generic gray color
- Local proof: `test` is missing from the local palette and rendered through fallback gray.
- GitNexus evidence: same as issues 11-13; different taxonomy, but incomplete typed/color support for several actual emitted labels.
- Status: `Partially solved`
- Conclusion: the exact local category key is gone, but the general "visual distinction missing for real graph entities" problem remains.

### 15. `workers` category nodes fall back to the generic gray color
- Local proof: `workers` exists locally as a category but has no dedicated palette entry.
- GitNexus evidence: I found no worker-specific node label, and worker imports themselves do not appear to be extracted.
- Status: `Partially solved`
- Conclusion: GitNexus avoids the exact category entry bug, but because worker edges are not clearly modeled, it does not provide a real worker-specific visualization solution.

## Category 4: Role Classification and Topology Semantics

### 16. Pure barrel files can miss the `bridge` role
- Local proof: `src/components/BattleMap/index.ts` was reported as `"role": "normal"` because `server/graphBuilder.ts:88-92` only marks bridges when re-export files are short or deprecated.
- GitNexus evidence: I found no comparable `bridge` role heuristic in the inspected GitNexus graph model. It emphasizes explicit graph edges and file tree structure instead of a brittle bridge-classification rule.
- Status: `Solved`
- Conclusion: the specific local failure mode is removed because GitNexus does not appear to rely on that short-file/deprecated bridge heuristic.

### 17. Non-deprecated public barrels can be treated as deprecated bridges
- Local proof: `src/commands/index.ts` became `bridge`, and `server/sync.ts:112-117` would label it `DEPRECATED BRIDGE / MIDDLEMAN`.
- GitNexus evidence: no sync-header or deprecation advisory system was found in the inspected GitNexus sources.
- Status: `Solved`
- Conclusion: GitNexus avoids this false deprecation path by not implementing the same bridge-to-header advisory pipeline.

### 18. `MapPane.tsx` appears to have no dependents even though `GameModals.tsx` uses it
- Local proof: `src/components/layout/GameModals.tsx:32` lazy-loads `../MapPane`, but the local graph shows `components/MapPane.tsx` with `importedBy: []`.
- GitNexus evidence: dynamic imports are not clearly extracted in `tree-sitter-queries.ts` or `import-processor.ts`.
- Status: `Not solved`
- Conclusion: because the missing edge type is still unhandled, the same dependent-count distortion can still occur.

### 19. `SubmapPane.tsx` appears to have no dependents even though `GameModals.tsx` uses it
- Local proof: `src/components/layout/GameModals.tsx:34` lazy-loads `../Submap/SubmapPane`, but the local graph shows no dependents.
- GitNexus evidence: same as issue 18; no source-backed dynamic-import extraction was found.
- Status: `Not solved`
- Conclusion: GitNexus does not show evidence that it fixes this topology hole.

### 20. Declaration files are treated as first-class graph nodes and clutter the ranking
- Local proof: the local file scan includes `**/*.{ts,tsx}` in `server/graphBuilder.ts:25-28`, which pulls in `.d.ts` surfaces.
- GitNexus evidence: `gitnexus-web/src/core/ingestion/utils.ts` treats any filename ending with `.ts` as TypeScript, which includes `.d.ts`. I found no `.d.ts` exclusion rule.
- Status: `Not solved`
- Conclusion: declaration files still appear likely to be indexed as regular TypeScript files.

## Category 5: Sync and Header Generation Defects

### 21. Sync can accumulate duplicate advisory blocks instead of replacing them
- Local proof: `server/sync.ts:87-92` prepends when old markers are absent; `src/state/actionTypes.d.ts:1-29` already contains duplicate advisories.
- GitNexus evidence: I found no source-writing sync/header feature in the inspected GitNexus repo.
- Status: `Solved`
- Conclusion: this exact failure mode is absent because GitNexus does not appear to mutate source files with advisory headers.

### 22. Duplicate sync headers can contradict each other inside the same file
- Local proof: `src/state/actionTypes.d.ts` contains one header calling the file an orphan and another calling it critical core.
- GitNexus evidence: no analogous header-writing system was found.
- Status: `Solved`
- Conclusion: GitNexus avoids this class of contradiction by not generating headers into source files.

### 23. Dependent names are lossy and can become ambiguous
- Local proof: `server/sync.ts:120-131` strips most dependent paths down to basenames, which is ambiguous for repeated filenames.
- GitNexus evidence: the inspected UI and graph data keep full `filePath` fields in `core/graph/types.ts`, `graph-adapter.ts`, `FileTreePanel.tsx`, and `RightPanel.tsx`.
- Status: `Solved`
- Conclusion: GitNexus keeps path-level identity instead of collapsing everything to basenames.

### 24. Bridge advisories overstate deprecation
- Local proof: `server/sync.ts:112-117` always emits `DEPRECATED BRIDGE / MIDDLEMAN` for anything classed as a bridge.
- GitNexus evidence: no bridge-advisory header writer was found.
- Status: `Solved`
- Conclusion: the exact local overstatement does not exist in GitNexus.

### 25. Sync inherits all graph blind spots, so generated headers can be incomplete
- Local proof: `server/sync.ts:47-50` builds advisories from `generateGraphData()`, which already misses dynamic imports, assets, JSON, and workers.
- GitNexus evidence: although there is no sync-header feature, the underlying graph still misses dynamic imports, asset imports, JSON imports, and worker URL patterns in the inspected ingestion logic.
- Status: `Partially solved`
- Conclusion: GitNexus removes the broken header-writing layer, but several of the same graph blind spots remain underneath.

## Category 6: Server/API Security and Operational Hazards

### 26. `/api/shutdown` is unauthenticated
- Local proof: `server/api.ts:45-50` shuts down on a plain request, with no auth check.
- GitNexus evidence: I did not retrieve backend route source showing a shutdown endpoint or its protections.
- Status: `No proof`
- Conclusion: I cannot claim this is solved because I did not verify the backend implementation.

### 27. The server advertises wildcard CORS to every origin
- Local proof: `server/index.ts:171-175` sets `Access-Control-Allow-Origin: *`.
- GitNexus evidence: the client in `gitnexus-web/src/services/server-connection.ts` calls `/api/repos`, `/api/repo`, and `/api/graph` without auth headers, but I did not inspect the backend CORS policy itself.
- Status: `No proof`
- Conclusion: there is not enough evidence to mark this solved or unsolved.

### 28. API routes do not enforce HTTP methods
- Local proof: `server/api.ts:37-85` keys behavior only on pathname.
- GitNexus evidence: backend route source was not retrieved.
- Status: `No proof`
- Conclusion: I cannot assess method enforcement from the inspected files.

### 29. `/api/scan` exposes an expensive repo-wide command with no guardrails
- Local proof: `server/api.ts:53-68` shells out to `npx tsx scripts/scan-quality.ts --json`.
- GitNexus evidence: I did not inspect server-side route handlers for equivalent expensive endpoints.
- Status: `No proof`
- Conclusion: there is not enough backend evidence to classify this.

### 30. Server startup force-kills any process bound to port 3847
- Local proof: `server/index.ts:34-90` kills any PID using port `3847`.
- GitNexus evidence: I found no matching startup script or server bootstrap source to compare.
- Status: `No proof`
- Conclusion: I cannot claim GitNexus fixes this operational hazard without the relevant backend source.

## Category 7: Static Export Contract Failures

### 31. The "standalone" export is not actually standalone
- Local proof: `server/staticGenerator.ts:50-56` injects the D3 CDN into a supposedly standalone HTML export.
- GitNexus evidence: I found no GitNexus static-single-file export implementation to inspect.
- Status: `No proof`
- Conclusion: there is no source-backed basis to say GitNexus solves or avoids this export contract problem.

### 32. Static export leaks absolute local filesystem paths
- Local proof: `server/staticGenerator.ts:54` serializes full absolute paths into the HTML export.
- GitNexus evidence: no comparable static export implementation was inspected.
- Status: `No proof`
- Conclusion: I cannot assess this for GitNexus.

### 33. Static export bundles `api.js` even though static mode cannot use the API
- Local proof: `server/staticGenerator.ts:26` inlines `api.js`, while `client/js/main.js:73-87` disables live-only controls in static mode.
- GitNexus evidence: no matching static export path was found in the inspected sources.
- Status: `No proof`
- Conclusion: this feature area was not present in the reviewed GitNexus sources.

### 34. Static export always overwrites the same file
- Local proof: `server/staticGenerator.ts:24` hardcodes `misc/codebase-visualization.html`.
- GitNexus evidence: no comparable export writer was inspected.
- Status: `No proof`
- Conclusion: no classification is justified.

### 35. The generated export is heavy because it inlines raw graph JSON and all client code
- Local proof: the local export was `1472162` bytes and is assembled by inlining graph JSON, scripts, and CSS in `server/staticGenerator.ts:50-56`.
- GitNexus evidence: no equivalent export bundling path was reviewed.
- Status: `No proof`
- Conclusion: I found no static export code to compare against.

## Category 8: UI, Accessibility, and Interaction Issues

### 36. The search field is not programmatically labeled
- Local proof: `client/index.html:38-40` separates the label from the input and does not associate them.
- GitNexus evidence: the file search input in `gitnexus-web/src/components/FileTreePanel.tsx` uses a placeholder but no explicit `<label>`, `id`/`htmlFor`, or `aria-label`.
- Status: `Not solved`
- Conclusion: the inspected GitNexus file search remains unlabeled in accessible terms.

### 37. Graph nodes are mouse-only and not keyboard focusable
- Local proof: `client/js/rendering.js:96-178` attaches mouse handlers only and adds no focus or keyboard behavior.
- GitNexus evidence: `gitnexus-web/src/hooks/useSigma.ts` registers `clickNode`, `clickStage`, `enterNode`, and `leaveNode`; I found no keyboard navigation or focusable graph-node interaction path.
- Status: `Not solved`
- Conclusion: GitNexus still appears mouse-centric for graph-node interaction.

### 38. Expanded file view depends on double-click only
- Local proof: `client/index.html:16` tells users to double-click to expand, and `client/js/rendering.js:171-173` binds that behavior only to `dblclick`.
- GitNexus evidence: the inspected GitNexus UI exposes graph focus via click and exposes a separate file tree panel in `GraphCanvas.tsx` and `FileTreePanel.tsx`; I found no equivalent double-click-only gate.
- Status: `Solved`
- Conclusion: GitNexus provides direct click-based and panel-based navigation rather than a double-click-only affordance.

### 39. Tooltips are inaccessible to keyboard and touch users
- Local proof: local tooltips appear only on `mouseover`/`mouseout`.
- GitNexus evidence: `GraphCanvas.tsx` shows hovered-node UI from hover state, and `useSigma.ts` only triggers it from `enterNode` and `leaveNode`.
- Status: `Not solved`
- Conclusion: the tooltip/preview path is still hover-driven.

### 40. Error handling uses blocking alerts instead of an in-app status surface
- Local proof: `client/js/main.js:113-115`, `130-131`, and `138-139` use `alert(...)`.
- GitNexus evidence: `gitnexus-web/src/components/RightPanel.tsx` renders inline error/status surfaces for `agentError`, readiness, and initialization state; `App.tsx` also routes pipeline errors into overlay/status state instead of browser alerts.
- Status: `Solved`
- Conclusion: GitNexus clearly uses in-app error/status rendering instead of blocking browser alerts.

## Category 9: Performance and Scale Problems

### 41. Graph generation uses synchronous file I/O for every file
- Local proof: `server/graphBuilder.ts:34-38` loops through all files with `fs.readFileSync(...)`.
- GitNexus evidence: the web ingestion pipeline operates on an in-memory `files` array in `gitnexus-web/src/core/ingestion/pipeline.ts`, and heavy work is moved into `gitnexus-web/src/workers/ingestion.worker.ts`.
- Status: `Partially solved`
- Conclusion: the UI-blocking synchronous read pattern is avoided in the inspected web flow, but I did not inspect backend indexing code deeply enough to claim the entire stack is free of it.

### 42. Graph generation reads each file twice
- Local proof: the local tool rereads files in `server/graphBuilder.ts:34-38` and again in `85-91`.
- GitNexus evidence: the pipeline stores contents once, then reuses parsed ASTs through `gitnexus-web/src/core/ingestion/ast-cache.ts` across parsing, import, call, heritage, community, and process passes.
- Status: `Solved`
- Conclusion: GitNexus does multi-pass analysis, but it does not re-read raw file content in the same wasteful way.

### 43. `/api/graph` recomputes the entire graph on every request
- Local proof: `server/api.ts:71-77` calls `generateGraphData()` on each request.
- GitNexus evidence: the worker builds a graph once per ingestion and stores state in memory in `ingestion.worker.ts`; the README also says incremental indexing is still on the roadmap.
- Status: `Partially solved`
- Conclusion: GitNexus is better because it keeps a built graph around after ingestion, but there is not enough source evidence to say all graph-serving paths are incrementally updated.

### 44. Window resize rebuilds the entire graph without debounce
- Local proof: `client/js/main.js:276-279` rebuilds the full D3 graph on every resize event.
- GitNexus evidence: I found no resize-triggered graph rebuild hook in `GraphCanvas.tsx` or `useSigma.ts`; Sigma owns the renderer instance and graph state.
- Status: `Solved`
- Conclusion: the exact local "teardown and rebuild on resize" problem is absent from the inspected GitNexus UI.

### 45. The file list is fully rebuilt on every keystroke
- Local proof: `client/js/main.js:253-257` calls `panel.buildFileList(...)` on each input, and `client/js/panel.js:75-113` recreates the entire DOM list.
- GitNexus evidence: `gitnexus-web/src/components/FileTreePanel.tsx` uses React state and memoized filtering instead of manual `innerHTML` teardown and listener reattachment.
- Status: `Solved`
- Conclusion: while React still rerenders, the specific full-DOM rebuild pattern from the local tool is removed.

## Category 10: Misleading Descriptions and Labels

### 46. `constants.ts` gets a blank description
- Local proof: `src/constants.ts:1-10` has a real header comment, but `server/analyzer.ts:302-311` produced `description: ""`.
- GitNexus evidence: I did not find a directly comparable file-description generator in the inspected sources.
- Status: `No proof`
- Conclusion: there is not enough evidence to say GitNexus solves local description-quality issues.

### 47. Barrel descriptions degrade into nonsense like "rendering index"
- Local proof: local output described `components/BattleMap/index.ts` as `UI component for rendering index`, driven by `server/analyzer.ts:315-324`.
- GitNexus evidence: no analogous file-description fallback heuristic was identified in the reviewed GitNexus code.
- Status: `No proof`
- Conclusion: I cannot make a grounded comparison for this metadata feature.

### 48. Central type barrels get generic, low-value descriptions
- Local proof: local output described `types/index.ts` as `Type definitions for index`.
- GitNexus evidence: no comparable description-generation path was found.
- Status: `No proof`
- Conclusion: insufficient source evidence.

### 49. The `Exports` dependency-view toggle does not show exports
- Local proof: `client/index.html:33-35` labels a mode `Exports`, but `client/js/rendering.js:234-238` actually highlights `importedBy`.
- GitNexus evidence: the inspected GitNexus UI uses node/edge filters in `FileTreePanel.tsx` rather than an `Exports` dependency-view mode. I found no equivalent mislabeled exports toggle.
- Status: `Solved`
- Conclusion: the exact mislabeled control is absent in GitNexus.

### 50. The `Exports & Blocks` panel title is inaccurate
- Local proof: `client/index.html:69` titles the section `Exports & Blocks`, but `client/js/panel.js:160-176` renders exported and non-exported blocks together.
- GitNexus evidence: I found no equivalent `Exports & Blocks` panel in the inspected GitNexus UI.
- Status: `Solved`
- Conclusion: GitNexus does not appear to carry over this misleading panel label.

## Summary

Counts across the 50 local issues:

- `Solved`: 16
- `Partially solved`: 12
- `Not solved`: 14
- `No proof`: 8

High-confidence takeaways:

1. GitNexus is materially better on parser architecture, graph richness, and some UI/runtime performance issues because it uses AST parsing, a staged ingestion pipeline, worker offload, and a richer graph model.
2. GitNexus does not solve the local visualizer's TypeScript-specific dynamic import, asset import, JSON import, or worker import blind spots based on the source I reviewed.
3. GitNexus avoids the entire sync-header/advisory defect family by not appearing to write dependency headers back into source files.
4. GitNexus still appears weak on accessibility for graph interaction and still has its own taxonomy/type-to-UI mismatch problem for several emitted node labels.
5. I did not retrieve enough backend/export code to make strong claims about the server-security and static-export issue families.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"misc/dev_hub/codebase-visualizer/GITNEXUS_ISSUE_MAPPING_2026-03-18.md","sha256WithoutMarker":"641acb75954d22a5011b1a5d19c3c980af8341c4a4125ebe5ad94916af00a41d","markedAtUtc":"2026-06-26T00:42:50.364Z"} -->
