# Worker ownership and messaging

Verified: 2026-10-25 against the shared helper and the first seven resumed C12 migration waves. Real route-change leak qualification remains open.

## Current behavior

`src/workers/workerClient.ts` owns worker creation, termination and live-worker accounting for migrated callers. `createWorkerClient` serves a continuing feature. `runWorkerTask` serves one job and releases its worker on success, failure or abort. `useWorkerClient` ties a continuing client to React mount and unmount; no application caller uses that hook yet.

A feature keeps its literal `new Worker(new URL(...), { type: 'module' })` factory beside the worker entry point. Vite needs that literal expression to bundle the worker. Pass the factory to the shared helper; do not replace it with a generic string-path loader. Worker scripts stay with their owning feature unless several features genuinely share the same protocol.

The continuing client counts a worker until termination, clears crashed workers and starts a replacement on the next `start()` or `post()`. Its optional `onSpawn` callback initializes each replacement and replays stranded requests. A correlated caller calls `start()` before adding its new request to its pending map. This keeps that new request out of the replay pass and sends it once.

Callbacks belong to the worker generation that installed them. Released workers have their handlers detached, and saved old callbacks cannot deliver stale data or terminate a replacement. These controls are tested with disposable fake workers; the tests do not establish browser event ordering or real route-change leak freedom.

The existing single-argument `onError(message)` contract is preserved. A feature can provide `formatError(event)` to keep its established failure text. Initialization failure releases the otherwise unreachable worker and rethrows the error.

Pooling is deferred. No pool or shared job queue is implemented.

## Migration status

Task `agora-9ed9.12` remains in progress. The source inventory found 17 literal worker constructions in 16 files, including local ignored source and excluding tests and comments. A literal construction remaining in a factory does not mean the factory is unmigrated: caller ownership matters.

| Owner | Current state |
|---|---|
| `components/World3D/createWorldGenClient.ts` | Migrated. Shared lifecycle; original request IDs, progress, Stage A/B behavior and error text retained. |
| `components/World3D/createGroundWorkerChunkLoader.ts` | Migrated. Ground initialization, pending request replay, LOD and disposal retained. |
| `components/World3D/createWorkerChunkLoader.ts` | Migrated. World initialization, pending request replay, LOD and disposal retained. |
| `components/World3D/water/riverReachScene.ts` | Existing one-shot job uses `runWorkerTask`. This is not complete river-client migration. |
| `systems/world3d/river/riverWorkerSpawn.ts` | Single factory home for solver/map worker URLs. The continuing `riverLiveClient` still owns raw worker lifecycles. |
| `components/World3D/createVolumeBubbleClient.ts` | Migrated. Ground initialization, supersession, snapshot reconstruction and column metadata retained; crashed worker now terminated. |
| `components/DesignPreview/steps/createLandVolumeClient.ts` | Migrated locally. Source and its nine-case fixture are ignored preview files. Cache identities, inline fallback, 12-second watchdog and retain/release behavior retained. |
| `components/BattleMap/terrain/createArenaVolumeClient.ts` | Migrated. Snapshot ownership, callback order and original arena buffer transfer list retained; crashed worker now terminated. |
| `systems/world3d/ocean/oceanBeach.ts`, `oceanMouth.ts`, `oceanSkip.ts` | Not migrated. Worker readiness, simulation epoch, transfer buffers and disposal require their own checks. |
| `components/World3D/water/riverBoundaryWorkerCache.ts`, `waterfallTerrainComparisonView.ts` | Not migrated. |
| `components/Worldforge/responsiveAtlasPreparation.ts` | Migrated. One-shot helper keeps split replies, shared promise identity and canonical install; failures are evicted and workers released. |
| `components/DesignPreview/steps/sidebyside/SideBySideTerrain.tsx` | Migrated locally. Still lazy on button press; request IDs, stale-response filter, spec and layout retained; shared cleanup and explicit retryable failures. |
| `components/ThreeDModal/Experimental/DeformationManager.ts` | Migrated locally for lifecycle only. Existing worker is an incompatible placeholder; actual erosion remains unfinished. |
| `components/ThreeDModal/Experimental/VoxelTerrain.tsx` | Migrated locally. Mount teardown uses shared disposal; StrictMode resets retired busy state and old callbacks are ignored. Density, geometry and transfer-copy rules retained. |

## Evidence and remaining acceptance

The first resumed wave has 30 passing focused tests, including four new cases for generation isolation, initialization cleanup, startup ordering and stranded replay. The original 26 tests pass unchanged. The second wave adds six volume-client cases. Against the unchanged clients, four passed and two proved crash-cleanup failures. After migration, all 36 combined tests pass. All nine changed files have clean scoped types (zero errors or suppressed diagnostics); the second wave is lint-clean. Both volume clients retain exact public declarations, factory expressions and message-handler bodies, with CRLF preserved. The first candidate exposed an `onError` argument-count regression; the implementation was corrected without weakening that expectation.

Disposable receipts and frozen inputs live in `.agent/scratch/agora-review-c12/`. That directory is ignored and does not ship with a clone. The lasting contract is the source, tests and this document.

The land wave brings the combined local run to 45 passing tests: 36 portable cases plus nine cases beside the ignored preview source. Its pre-migration run passed 14 of 15 relevant cases and exposed another crash-reference cleanup failure. Both changed land files have zero scoped errors or suppressed diagnostics. Eight static preservation checks pass, including exact inline jobs, request payloads, watchdog logic and returned retain/release methods. Six pre-existing unused console-rule suppressions remain. No ignore rule changed; the portable volume tests were restored byte-for-byte.

The Atlas wave brings the combined local run to 58 passing tests: 49 portable cases plus the nine ignored land cases. The unchanged Atlas baseline passed 15/15 with the helper. Eight new Atlas cases exposed four pre-existing failures: unreadable replies hung, constructor failures remained cached, synchronous send failures leaked workers, and saved duplicate callbacks terminated twice. Those cases now pass, along with replacement-cache ownership and two shared error-format cases. Four scoped files have zero errors or suppressed diagnostics. Nine static preservation checks retain the factory, fallback, key/cache reuse, public signature, and original two data tests. Seven existing test-any warnings remain. Canonical installation still happens after worker termination and before the returned promise fulfills; it now runs in a promise continuation rather than the message callback.

The local experimental erosion client adds six worker-lifecycle cases: three passed before migration and three exposed crash/decode hangs and send-failure cleanup. The combined focused run now passes 64/64, and the two existing deformation/interpolation tests pass separately (66 distinct cases). Both changed experimental files have zero scoped errors or suppressed diagnostics. All other class members, the public method signature, literal worker factory and request fields are exact. One existing forbidden-require lint error and one unused-import warning remain; comparison with the frozen original confirms both are inherited. Source and fixtures are ignored by the existing experimental-directory rule.

The actual `workers/erosion.worker.ts` is still a placeholder: it echoes `heightMap`, while this client sends `grid/gridSize/config` and expects `status/grid` replies. Shared cleanup does not implement erosion. This unfinished protocol was routed to the active gap owner through Agora 8683; no canonical gap ID is claimed yet.

The voxel wave raises the combined focused run to 74 passing tests (49 portable and 25 ignored local cases). Six unchanged-source React lifecycle cases initially split 3/3: StrictMode replacement had no initial request, an obsolete callback delivered after unmount, and crashes left the mesher busy. Eight final cases pass, adding decode/send recovery. React owns the real effects and refs, while the returned mesh JSX is deliberately unmounted. `structuredClone` really transfers the copied density buffer. This is lifecycle evidence, not WebGL or browser route proof. Both changed files have zero scoped errors or suppressed diagnostics; 11 original lint warnings remain. Seven static comparisons preserve index mapping, interaction/deformation rules, density generation, material/JSX output, requests, factory tokens and response-body order apart from its typed data binding. Worker errors now produce a warning; the next edit can retry without an automatic crash loop.

The terrain-comparison wave raises the combined run to 81 passing tests (49 portable and 32 ignored local). Five unchanged-source cases passed 3/5 and exposed unreleased crash workers and attached callbacks after unmount. Seven final cases pass, including send/decode recovery. Both files have clean scoped types; one original lint warning remains. Seven preservation checks keep the factory, request spec, constants, canvas renderer, output layout, response logic and constructor-failure wording.

In a separate browser tab, the real mountain request rendered both 250×250 hillshades. Closing and reopening the panel then completed a plain request in the visible accessibility state. Its following screenshot instead showed land initialization with the panel absent; that unexpected capture is retained and is not a second rendered pass. Captured geometry warnings have no before/after attribution. The isolated tab was closed, original tabs were untouched, and no browser worker census establishes leak freedom. Receipts and captures live under the ignored C12 runtime folder.

C12 still requires every remaining caller to use the helper, independent review, and real route-change/unmount verification showing no leaked workers. A helper count omits workers created outside the helper; a zero count alone cannot qualify the whole application. The ocean's rendered C5 proof and this task's worker lifecycle proof are separate claims.
