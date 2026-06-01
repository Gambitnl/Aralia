# World3D Rendering Hardening Implementation Plan

> **For agentic workers:** This plan is executed **inline with live browser verification** (preview tools), NOT subagent-driven — the failures are rendering/GPU issues a subagent cannot observe. Steps use checkbox (`- [ ]`) syntax. Unit-testable pieces still follow TDD; rendering pieces are verified by screenshot + console in the running dev server.

**Goal:** Make the streamed 3D world (`?phase=world3d`) reliably render terrain on a normal single page load — fixing the symptoms found during live debugging: a blank canvas caused by WebGL context loss + an over-heavy scene at extreme world coordinates, plus a cold-load phase bounce that sends `?phase=world3d` to the main menu.

**Context — what live debugging established (do not re-litigate):**
- The data path is correct: `runWorldSim` + `handleChunkRequest` produce valid geometry (256 verts / 1350 indices, heights ~97m), and streaming works — **81 chunks load successfully** (`loaded → 81, pending → 0`). It is NOT a missing-Azgaar-data or streaming problem.
- The blank canvas coincided with `THREE.WebGLRenderer: Context Lost.` Two contributors: (a) repeated `<Canvas>` remounts during debugging exhausted the browser's ~16 WebGL-context limit; (b) the scene is heavy (81 chunks × instanced vegetation + shadow casters/receivers) positioned at **~30,000 world-unit coordinates** (METERS_PER_CELL=1024, demo starts at grid-middle → world ~30720, 20480), and `preview_screenshot` timed out with "renderer may be stuck."
- The directional light's shadow camera is a small frustum near its own position; with terrain at ~30k it covers nothing useful.
- `?phase=world3d` intermittently redirects to `?phase=main_menu`: the first navigation after a cold start triggers Vite's dep re-optimize full-reload, which races the phase init in `useHistorySync`.

**Architecture principle:** Keep the streamer's absolute world-coordinate logic untouched (it is correct and unit-tested). Fix rendering by introducing a **scene-origin offset** so the R3F scene draws near (0,0,0), and by reducing per-frame GPU load. All offset/conversion math is pure and unit-tested; the visual results are verified in the browser.

**Tech Stack:** TypeScript, Vitest 4.x (globals — no test-fn imports), three.js r170, @react-three/fiber 9, @react-three/drei 10.

**Builds on:** Plan 3 (`docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md`) — landed. Touches `src/systems/world3d/` and `src/components/World3D/`.

---

## File Structure

**Created:**
- `src/systems/world3d/sceneOrigin.ts` — pure helpers: `worldToScene` / `sceneToWorld` offset conversion
- `src/systems/world3d/__tests__/sceneOrigin.test.ts`

**Modified:**
- `src/systems/world3d/config.ts` — add `MAX_VEGETATION_PER_CHUNK`, `STREAMED_WORLD_SHADOWS` flag
- `src/systems/world3d/vegetationScatter.ts` — honor an instance cap
- `src/systems/world3d/__tests__/vegetationScatter.test.ts` — cap test
- `src/components/World3D/World3DScene.tsx` — apply scene-origin offset to chunks/camera/lights; remove `shadows`/shadow casters or fit them; add context-loss recovery
- `src/components/World3D/FreeRoamCameraController.tsx` — report camera position converted back to world coords
- `src/components/World3D/World3DDemo.tsx` — pass `sceneOrigin`
- `src/hooks/useHistorySync.ts` — make a deep-linked `world3d` phase survive the cold-load re-optimize reload

---

## Conventions

- Run tests: `npx vitest run <path>`. Vitest 4.x globals — never import `it`/`describe`/`expect`.
- Dev server is managed via the preview tool (`.claude/launch.json` → `dev`, port 5174). To re-verify rendering: **stop the server, clear `node_modules/.vite`, start fresh, then load `?phase=world3d` twice** (the first navigation absorbs the cold re-optimize reload). Take a screenshot and read `error`-level console logs.
- Commit per task (`feat(world3d)` / `fix(world3d)`); stage only the files you changed (heavy unrelated automation churn is in the tree — never `git add -A`).

---

## Task 1: Scene-Origin Offset Helpers

**Files:**
- Create: `src/systems/world3d/sceneOrigin.ts`
- Test: `src/systems/world3d/__tests__/sceneOrigin.test.ts`

The scene renders relative to an origin near the player so coordinates stay small. These pure helpers convert between absolute world meters and scene-local meters.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/sceneOrigin.test.ts`:

```ts
import { worldToScene, sceneToWorld } from '../sceneOrigin';

const origin = { x: 30720, z: 20480 };

it('worldToScene subtracts the origin', () => {
  expect(worldToScene(30720, 20480, origin)).toEqual({ x: 0, z: 0 });
  expect(worldToScene(30848, 20608, origin)).toEqual({ x: 128, z: 128 });
});

it('sceneToWorld adds the origin (inverse of worldToScene)', () => {
  expect(sceneToWorld(0, 0, origin)).toEqual({ x: 30720, z: 20480 });
  const w = sceneToWorld(128, 256, origin);
  expect(w).toEqual({ x: 30848, z: 20736 });
});

it('round-trips any point', () => {
  const s = worldToScene(31234, 21567, origin);
  const w = sceneToWorld(s.x, s.z, origin);
  expect(w.x).toBeCloseTo(31234);
  expect(w.z).toBeCloseTo(21567);
});
```

- [ ] **Step 2: Run test → fails** (`npx vitest run src/systems/world3d/__tests__/sceneOrigin.test.ts`).

- [ ] **Step 3: Implement**

Create `src/systems/world3d/sceneOrigin.ts`:

```ts
/**
 * @file sceneOrigin.ts
 * Convert between absolute world meters (what the streamer/sampler use) and
 * scene-local meters (what R3F renders). The scene origin is a fixed world point
 * near the player; subtracting it keeps rendered coordinates near 0, avoiding
 * float precision loss and keeping the camera/shadow math simple.
 */
export interface SceneOrigin {
  x: number;
  z: number;
}

export function worldToScene(worldX: number, worldZ: number, origin: SceneOrigin): { x: number; z: number } {
  return { x: worldX - origin.x, z: worldZ - origin.z };
}

export function sceneToWorld(sceneX: number, sceneZ: number, origin: SceneOrigin): { x: number; z: number } {
  return { x: sceneX + origin.x, z: sceneZ + origin.z };
}
```

- [ ] **Step 4: Run test → passes (3).**

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/sceneOrigin.ts src/systems/world3d/__tests__/sceneOrigin.test.ts
git commit -m "feat(world3d): scene-origin offset helpers for floating-origin rendering"
```

---

## Task 2: Vegetation Instance Cap

**Files:**
- Modify: `src/systems/world3d/config.ts`
- Modify: `src/systems/world3d/vegetationScatter.ts`
- Modify: `src/systems/world3d/__tests__/vegetationScatter.test.ts`

Bound per-chunk vegetation so 81 chunks don't spawn an unbounded instance count (a contributor to the renderer choking).

- [ ] **Step 1: Add the config constant**

In `src/systems/world3d/config.ts`, add to `WORLD3D_CONFIG`:

```ts
  /** Hard cap on vegetation instances emitted per chunk (perf guard). */
  MAX_VEGETATION_PER_CHUNK: 60,
  /** Whether the streamed world casts/receives real-time shadows (off = much cheaper). */
  STREAMED_WORLD_SHADOWS: false,
```

- [ ] **Step 2: Write the failing test**

Add to `src/systems/world3d/__tests__/vegetationScatter.test.ts`:

```ts
import { WORLD3D_CONFIG } from '../config';

it('never emits more instances than MAX_VEGETATION_PER_CHUNK', () => {
  // A high-resolution all-forest chunk would exceed the cap without clamping.
  const data = {
    cx: 1, cy: 1, resolution: 32,
    heights: new Float32Array(32 * 32).fill(50),
    biomeIds: new Array(32 * 32).fill('forest'),
    rivers: [], roads: [], sites: [],
  };
  const veg = buildVegetationScatter(data as any);
  const instances = veg.positions.length / 3;
  expect(instances).toBeLessThanOrEqual(WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK);
});
```

- [ ] **Step 3: Run test → fails** (32×32 forest currently yields ~512 instances).

- [ ] **Step 4: Implement the cap**

In `src/systems/world3d/vegetationScatter.ts`, import the config and stop emitting once the cap is hit. Add near the top:

```ts
import { WORLD3D_CONFIG } from './config';
```

In `buildVegetationScatter`, after computing `positions`/`scales`/`rotations` via the loop, guard each push with a running count, OR truncate at the end. Simplest: wrap the emit in a cap check inside the loop — add `if (positions.length / 3 >= WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK) break;` at the top of the inner loop body where an instance would be pushed (after the biome/gate checks, before `positions.push(...)`). Ensure the `break` exits both loops (use a labeled loop or a flag). A flag is cleanest:

```ts
  let capped = false;
  for (let j = 0; j < res && !capped; j++) {
    for (let i = 0; i < res; i++) {
      // ... existing biome + gate checks ...
      if (positions.length / 3 >= WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK) { capped = true; break; }
      // ... existing positions.push / scales.push / rotations.push ...
    }
  }
```

- [ ] **Step 5: Run tests → pass** (new cap test + existing vegetation tests). Determinism test must still pass (the cap is deterministic).

- [ ] **Step 6: Commit**

```bash
git add src/systems/world3d/config.ts src/systems/world3d/vegetationScatter.ts src/systems/world3d/__tests__/vegetationScatter.test.ts
git commit -m "feat(world3d): cap vegetation instances per chunk"
```

---

## Task 3: Floating-Origin Rendering in World3DScene

**Files:**
- Modify: `src/components/World3D/World3DScene.tsx`
- Modify: `src/components/World3D/World3DDemo.tsx`
- Modify: `src/components/World3D/FreeRoamCameraController.tsx`

Render the whole scene relative to a fixed `sceneOrigin` (the initial `start`). Chunk meshes, camera, and lights all use scene-local coordinates near 0. The camera controller reports its target back in absolute world coords (via `sceneToWorld`) so the streamer keeps working in world space.

- [ ] **Step 1: Pass a scene origin from the demo**

In `World3DDemo.tsx`, the `start` is already `[midX, 0, midZ]`. No change needed to `start`; World3DScene will derive the origin from it.

- [ ] **Step 2: Apply the offset in World3DScene**

In `src/components/World3D/World3DScene.tsx`:

- Import the helper: `import { worldToScene, sceneToWorld, type SceneOrigin } from '@/systems/world3d/sceneOrigin';`
- Derive a stable origin: `const sceneOrigin: SceneOrigin = useMemo(() => ({ x: start[0], z: start[2] }), [start]);`
- Each chunk piece currently positions at `chunkOriginWorld(c.cx, c.cy)` → `[origin.x, 0, origin.y]`. Change the per-piece position to subtract the scene origin. The simplest robust approach: pass `sceneOrigin` down to the piece components and compute `const o = chunkOriginWorld(chunk.cx, chunk.cy); const s = worldToScene(o.x, o.y, sceneOrigin);` then position at `[s.x, 0, s.z]`. Apply to `TerrainPiece`, `WaterPiece`, `RoadPiece`, `SitePieces`, `VegetationPiece` (each reads `chunkOriginWorld`). Thread `sceneOrigin` through `ChunkPieces`.
- The `<Canvas camera={{ position: [...] }}>`: change camera position to scene-local — e.g. `position: [120, 160, 120]` (relative to origin 0) instead of `start[0]+120`.
- `<FreeRoamCameraController initialTarget={start} ... />` → pass scene-local target `[0, 0, 0]` and the `sceneOrigin` so it can convert reported positions back to world.
- Lighting / fog that referenced `start` or `cameraTarget` should use scene-local `[0,0,0]`.

- [ ] **Step 3: Convert camera reports back to world in FreeRoamCameraController**

In `src/components/World3D/FreeRoamCameraController.tsx`:
- Accept a new prop `sceneOrigin: SceneOrigin` (import the type).
- Where it currently calls `onPositionChange(t.x, t.z)` with the controls target (scene-local), convert first: `const w = sceneToWorld(t.x, t.z, sceneOrigin); onPositionChange(w.x, w.z);` so the streamer receives absolute world coords.
- `initialTarget` is now `[0,0,0]` (scene-local); keep MapControls target at scene-local.

- [ ] **Step 4: Verify build + types**

Run: `npx tsc --noEmit 2>&1 | grep -E "World3D|world3d" || echo "no world3d type errors"` → expect clean.
Run: `npx vitest run src/systems/world3d src/components/World3D` → all pass (no test asserts on absolute render coords; if one does, update it to scene-local).

- [ ] **Step 5: Commit**

```bash
git add src/components/World3D/World3DScene.tsx src/components/World3D/World3DDemo.tsx src/components/World3D/FreeRoamCameraController.tsx
git commit -m "feat(world3d): floating-origin rendering (scene drawn near 0,0)"
```

---

## Task 4: Cheaper Lighting + WebGL Context-Loss Recovery

**Files:**
- Modify: `src/components/World3D/World3DScene.tsx`

Remove real-time shadow rendering for the streamed world (gated by `STREAMED_WORLD_SHADOWS`, default false) to cut GPU load, and add WebGL context-loss/restore handling so a transient loss doesn't leave a permanently blank canvas.

- [ ] **Step 1: Drop shadows for the streamed world**

In `World3DScene.tsx`:
- On `<Canvas>`, remove the `shadows` prop (or set `shadows={WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS}`).
- Remove `castShadow` / `receiveShadow` from the directional light, terrain meshes, site meshes, and vegetation instanced mesh (or gate them on the flag).
- Keep `hemisphereLight` + a non-shadow `directionalLight` for shape. Terrain already has vertex colors, so it remains readable without shadows.

- [ ] **Step 2: Add context-loss recovery**

On the `<Canvas>`, add an `onCreated={({ gl }) => { ... }}` that wires the canvas element's context events:

```tsx
onCreated={({ gl }) => {
  const canvasEl = gl.domElement;
  canvasEl.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allows the context to be restored
    // eslint-disable-next-line no-console
    console.warn('[world3d] WebGL context lost — will attempt restore');
  }, false);
  canvasEl.addEventListener('webglcontextrestored', () => {
    // eslint-disable-next-line no-console
    console.warn('[world3d] WebGL context restored');
  }, false);
}}
```

(`preventDefault` on `webglcontextlost` is what enables the browser to fire `webglcontextrestored`; without it the context stays dead.)

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit 2>&1 | grep -E "World3DScene" || echo "clean"`.
Run: `npx vitest run src/components/World3D` → pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/World3D/World3DScene.tsx
git commit -m "fix(world3d): drop shadows + add WebGL context-loss recovery"
```

---

## Task 5: Make `?phase=world3d` Survive the Cold-Load Reload

**Files:**
- Modify: `src/hooks/useHistorySync.ts`

On the first cold navigation, Vite re-optimizes deps and forces a full reload; the phase init in `useHistorySync` can land on the default (main menu) instead of the URL's `world3d`. Make the URL phase authoritative across that reload.

- [ ] **Step 1: Investigate the actual reset**

Read `src/hooks/useHistorySync.ts` (initial-mount branch around lines 85–118) and `src/App.tsx` startup / `useGameInitialization` to find whether a startup effect dispatches `SET_GAME_PHASE` to the menu AFTER `useHistorySync` honors the URL. Identify which runs last. (Hypothesis: a game-init effect resets to `MAIN_MENU` after mount, overriding the deep link.)

- [ ] **Step 2: Apply the minimal fix**

The fix depends on what Step 1 finds. Most likely one of:
- If a startup effect unconditionally sets `MAIN_MENU`: guard it so it does NOT override when a valid non-menu phase is present in the URL on initial load (e.g., read `getPhaseFromSlug` and skip the menu reset for `WORLD3D_DEMO`).
- If the order is a race: make `useHistorySync`'s initial-mount `safeNavigate(urlPhase, true)` run in a `useEffect` that re-asserts the URL phase once after game-init settles (a one-shot ref-guarded effect keyed on `gameState.phase` returning to menu while the URL still says `world3d`).

Keep the change surgical and limited to honoring a valid deep-linked phase on cold load. Do not change navigation behavior for in-app transitions.

- [ ] **Step 3: Verify in the browser** (see Task 6 — this is verified together with the render).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHistorySync.ts
git commit -m "fix(world3d): honor deep-linked world3d phase across cold-load reload"
```

---

## Task 6: Live Browser Verification

No new files — this is the acceptance gate, run against the dev server.

- [ ] **Step 1: Clean restart**

Stop the preview server, clear the Vite cache, start fresh:
```bash
# (preview tool stop), then:
rm -rf node_modules/.vite
# (preview tool start 'dev')
```

- [ ] **Step 2: Load and confirm phase sticks**

Navigate to `?phase=world3d`. If the cold re-optimize reload bounces once, the Task 5 fix should land it back on `world3d`. Confirm the URL stays `?phase=world3d` and the "World 3D Chunk Streaming Sandbox" header shows.

- [ ] **Step 3: Confirm terrain renders**

`preview_screenshot`: expect visible terrain (biome-green plains, not flat sky-blue). `preview_console_logs level=error`: expect **no** `Context Lost`, no R3F errors, no React key flood from world3d.

- [ ] **Step 4: Confirm interaction**

Pan the camera (drag). New chunks stream in/out; the canvas stays rendered (no context loss under movement).

- [ ] **Step 5: Record the result**

If terrain renders cleanly: done. If still blank, capture the new console/error state and iterate (do NOT assume — re-run the streamer debug log from the live-debugging session if needed).

---

## Out of Scope (future)

- Periodic origin rebasing as the player pans many kilometers (fixed origin is sufficient for the demo; a moving floating-origin is a later refinement).
- PBR terrain textures, animated water, glTF props (Plan 3 deferred these; still deferred).
- The 2D↔3D transition + Azgaar marker sync (Plan 4).
- The global duplicate-React-key warning flood (`key=<timestamp>`) — it originates outside World3D (a global App list) and is tracked separately; it does not block World3D rendering.

---

## Acceptance

`?phase=world3d`, on a clean single load, shows a biome-colored streamed terrain that pans smoothly with no WebGL context loss and no error-boundary fallback. All `src/systems/world3d` + `src/components/World3D` unit tests pass; `tsc --noEmit` has no new world3d errors.
