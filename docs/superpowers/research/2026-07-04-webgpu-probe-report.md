# WebGPU Probe Report — streamed ground world on WebGPURenderer

Date: 2026-07-04
Author: webgpu-probe agent
Scope: a PROBE, not the migration. Prove Aralia's streamed 3D ground world renders through three.js `WebGPURenderer`.

## Verdict

**The migration path is viable.** The exact same streamed ground world the game uses — `createGroundChunkLoader` over a bridged L2 LocalArtifact, streamed chunk-by-chunk — mounts and renders through `WebGPURenderer` with no crashes and no code-structure changes to the streaming layer. 5,391 chunk meshes streamed into the WebGPU scene graph and drew at 34–59 FPS.

Two things stand between "it renders" and "it looks right", both expected and both now on the backlog below:
1. Terrain/material **shading is wrong on the node-material path** — the surface reads near-black except at grazing sun angles. Geometry, lights, and vertex colors are all present; the classic `MeshStandardMaterial` simply does not light the same way once the WebGPU renderer re-expresses it as TSL nodes.
2. The headless capture could **only exercise the WebGL2 fallback**, not a real WebGPU device (see "Backend honesty" below), so the shading defect above was observed on the fallback backend. Real-WebGPU hardware is already validated separately (RTX 2070S, 15.5M-tri scene — `docs/superpowers/research/2026-07-03-webgpu-validation.md`); a real-device eyeball is the one open verification.

## What was built (new files only)

- `src/components/World3D/WebGPUProbeScene.tsx` — probe-local R3F scene. A trimmed copy of `World3DScene`'s per-chunk rendering (terrain / water / roads / walls / sites), changed in exactly three ways that WebGPU requires:
  - `import * as THREE from 'three/webgpu'`
  - `extend(THREE)` so JSX intrinsics (`<mesh>`, `<meshStandardMaterial>`, …) resolve against the WebGPU namespace
  - an **async `gl` factory**: `new THREE.WebGPURenderer(props)` then `await renderer.init()` (the R3F v9 pattern)
- `src/components/World3D/WebGPUProbe.tsx` — host at `?phase=webgpuprobe`. Reuses the ground loader setup from `World3DDemo`'s `?ground=1` branch verbatim (same seed 42, same bridge, same spawn-at-center framing).
- Wiring (minimal edits to shared files): `GamePhase.WEBGPU_PROBE` appended in `src/types/core.ts`; slug `webgpuprobe` in `src/routes.ts`; lazy import + render branch in `src/App.tsx`.

`World3DScene.tsx` / `World3DWrapper.tsx` were **not touched** (hot-file rule) — the probe is an isolated copy so the experiment can't swap the renderer for the live game.

## What works

- **`WebGPURenderer` constructs and `init()`s** through R3F's async `gl` factory. No integration friction with `@react-three/fiber@9` / `three@0.170.0`. `three/webgpu` and `three/tsl` export paths are present in the installed build.
- **The streaming pipeline is renderer-agnostic.** `createGroundChunkLoader` + `useChunkStreaming` + the per-chunk mesh components drove the WebGPU scene with zero changes. Scene-graph inspection: **5,391 meshes, all with geometry**, material type `MeshStandardMaterial`, 86 vertex-colored.
- **A frame renders** — sky dome + horizon + terrain silhouette + building/wall geometry are all in the picture. FPS 34–59 (WebGL2-fallback backend, SwiftShader/ANGLE headless — not a meaningful perf number).

## What breaks (the migration backlog)

1. **Standard-material lighting/vertex-color output is wrong on the node path.** Terrain renders near-black; only far faces at grazing sun angle catch light. Adding a strong `ambientLight` did not fix it, which points at the material→TSL translation, not scene lighting. Action: port terrain/water/road/wall/building materials to explicit TSL node materials (`MeshStandardNodeMaterial` or hand-authored TSL) and verify vertex-color multiply + directional/hemisphere contribution.
2. **`drei` helpers are unverified on WebGPU.** The probe deliberately dropped `<Sky>` (drei) and used a plain `<fog>` + lights. `<Sky>`, `<Sky>`-style shader helpers, and anything from `@react-three/postprocessing` (EffectComposer) use classic WebGL shader material and will need WebGPU/TSL equivalents. Not yet tested.
3. **Real WebGPU backend not exercised in CI/headless.** Headless chromium (even with `--enable-unsafe-webgpu --use-angle=vulkan`) fell back to WebGL2 (`THREE.WebGPURenderer: WebGPU is not available, running under WebGL2 backend`). A real-device eyeball is required to confirm the shading defect is a node-material issue and not a fallback artifact.
4. **Instanced vegetation, nameplates (drei/Html), agents, scene-cast** were not ported into the probe. Each is a separate port item — `InstancedMesh` should be fine, `Html`/`Text` from drei need checking.

## Backend honesty (no fallback hidden)

The probe reports the backend loudly on `window.__webgpuProbeBackend`. In the headless capture it read `webgl(fallback!)` and the console logged three.js's own fallback warning. The probe's `gl` factory does not itself degrade to WebGL — it always constructs `WebGPURenderer`; the WebGL2 fallback observed is `WebGPURenderer`'s *internal* one when the environment has no WebGPU adapter. That is surfaced, not swallowed. On a real WebGPU-capable browser/GPU (the RTX 2070S per the validation doc), the same code will bind a true WebGPU backend.

## How to reproduce

- Dev server on port 5174, base `/Aralia/`.
- URL: `http://localhost:5174/Aralia/?phase=webgpuprobe`
- Headless capture (WebGPU flags): `node .agent/scratch/shoot-webgpu.mjs "http://localhost:5174/Aralia/?phase=webgpuprobe" .agent/scratch/webgpu-probe.png --wait 8000`
- Live hooks: `window.__webgpuProbeBackend`, `window.__webgpuProbeReady`, `window.__webgpuProbeFps`, `window.__wf3dScene`.

## Evidence

- Screenshot: `.agent/scratch/webgpu-probe.png` (terrain surface framed from overhead-oblique; sky + horizon + terrain plane visible; near face dark = the shading defect above).
- Scene-graph probe: 5,391 meshes / 5,391 with geometry / `MeshStandardMaterial` / 86 vertex-colored.
- FPS: 34–59 (WebGL2 fallback; not representative of real WebGPU).

---

## Parity pass (2026-07-04, webgpu-materials agent)

The "near-black terrain" defect (backlog item 1) is **fixed**, and the dropped
drei helpers (item 2) are replaced. Fix lives entirely in the probe scene
(`WebGPUProbeScene.tsx`); production `World3DScene` untouched.

### Root cause — it was the lights, not the material translation

The probe report guessed "the `MeshStandardMaterial`→TSL translation is at fault."
That was wrong. Isolation on the probe (all on the WebGL2-fallback backend, which
runs the *same* node-material path) proved:

- Geometry, indices, and **world-space normals are correct** — sampled terrain
  normals give `N·sun avg = 0.61` with **0 / 5840 back-facing**. So lighting
  should be strongly positive.
- The **fragment pipeline and albedo are fine** — setting a material's `emissive`
  to red lit the whole terrain plane red uniformly. Emissive is a pure *additive*
  term that bypasses the light loop.
- But **`color` / `vertexColor` stayed pure black**, and neither boosting the
  scene lights ×10, re-adding fresh `AmbientLight`/`DirectionalLight`, toggling
  `light.visible`, nor disabling tone mapping changed anything.

Diagnosis: `albedo × irradiance = albedo × 0 = black`. The WebGPU node path builds
a `LightsNode` **once** from the scene's lights at first material-compile and never
re-detects lights added or changed afterward (three.js
[#30044](https://github.com/mrdoob/three.js/issues/30044)). With R3F v9's
`<ambientLight>/<directionalLight>` JSX intrinsics extended from `three/webgpu`
([r3f #2853](https://github.com/pmndrs/react-three-fiber/issues/2853), closed
"not planned"), the light set the node graph captures is effectively empty, so
every lit surface receives **zero irradiance**. The thin lit band at the far ridge
in the original shot was **distance fog** (`#cdd9e6`, near 450), not lighting —
hence "lit only at grazing angles." The `flatShading`+`vertexColors` interaction,
tone mapping, and the classic→node auto-conversion were all **red herrings**.

### The fix

Bypass the fragile scene-light pipeline entirely. Every world material is now an
**unlit `MeshBasicNodeMaterial` whose `colorNode` bakes the shading in TSL**:
`albedo × (hemisphere + single directional Lambert)` against a constant sun
direction. Deterministic, backend-independent, needs no scene lights. Distance fog
and tone mapping still wrap the unlit output (unlit ≠ un-fogged). Terrain/walls use
`vertexColor()` albedo; roads/buildings/roofs/markers use their solid hex, cached by
color; water keeps a translucent lit tint + baked glow. The dead `<ambientLight>`/
`<hemisphereLight>`/`<directionalLight>` were removed (they did nothing). Intensities
(`SUN 1.15`, `HEMI 0.5`, `AMBIENT 0.18`, hemisphere sky `#bcd6ff` / ground `#6b6048`,
sun `#fff1da`) are tuned to match the WebGL `MeshStandardMaterial` look.

This *is* the "explicit TSL node material with a color attribute node" option the
probe report flagged — just applied to the lit **output**, since the scene-light
`LightsNode` (not the albedo node) was the broken link.

### Item 2 — sky + postprocessing

- **Sky**: the drei `<Sky>` was never in the probe. The existing CSS backdrop
  (`#cdd9e6`) + distance fog to the same color already reads as a hazy horizon and
  works fine on the node path; no drei sky shader is needed for parity. A richer
  gradient/atmospheric sky (three's `Sky` addon is WebGL-shader based; a TSL
  gradient-dome is the WebGPU-native replacement) is deferred beautification, not a
  parity blocker.
- **Postprocessing**: still **backlog**. The probe never had visible
  postprocessing, so there is nothing to reach parity *with*. When the wave wants
  bloom/SSAO, use three/webgpu's `PostProcessing` node pipeline (TSL passes), not
  `@react-three/postprocessing` (WebGL `EffectComposer`). Honest scope: not built.

### Before / after

- Before: `.agent/scratch/webgpu-parity-before.png` — terrain near-black, town
  invisible.
- After: `.agent/scratch/webgpu-parity-after.png` — soft-green terrain with
  readable relief, town fully lit (tan walls, terracotta roofs, wall ring), sky +
  fog horizon. 5,391 meshes, 0 page errors.

### Backend honesty (unchanged)

Both captures ran on the **WebGL2-fallback backend** of `WebGPURenderer` (headless
chromium has no WebGPU adapter — `window.__webgpuProbeBackend = "webgl(fallback!)"`).
That backend runs the **same node-material code path**, so the shading fix is
genuinely exercised. A **real-GPU eyeball on a WebGPU-capable browser remains the
one open verification** (as with the original probe). FPS in headless (2–59) is
SwiftShader software rendering and is not a meaningful perf number.

---

## Battle-map render path (2026-07-04, webgpu-bm3d agent)

Extended the proven probe pattern to the **3D tactical battle map** (BattleMap3D
component tree) behind an explicit opt-in. WebGL remains the default — this slice
does NOT flip it.

### What was built
- `src/components/BattleMap/webgpuBattleMapFlag.ts` — the opt-in switch:
  `?gpu=1` (or `WEBGPU_BATTLE_MAP_DEFAULT`, kept `false`).
- `src/components/BattleMap/BattleMap3DGpuScene.tsx` — a self-contained WebGPU
  scene (sibling of `WebGPUProbeScene`), rendering the SAME shared `mapData` /
  `characters` through baked-TSL `MeshBasicNodeMaterial` colorNodes (hemisphere +
  directional Lambert, no scene lights). Renders terrain (heightfield reused from
  `makeTerrainHeightSampler`, vertex-colored per-tile palette), water tiles, grid
  lines, and character/enemy tokens. Reuses the shared `CameraController` (so the
  `window.__bm3dCam.pose()` capture hook works).
  **FAIL-FAST (Remy follow-up, same day):** before mounting, the scene probes
  `navigator.gpu.requestAdapter()`. If WebGPU is unavailable it renders NO
  scene — an error panel states the reason ("WebGPU unavailable: …") with one
  explicit **"Use WebGL instead"** button; clicking it remounts the normal
  WebGL scene and strips `gpu=1` from the URL. If the renderer would still
  come up on a non-WebGPU backend after the probe passed, the `gl` factory
  throws. There is NO WebGL2-fallback render state anymore; the on-screen
  **"WebGPU" badge** exists only in the genuine-WebGPU success case.
- `src/components/BattleMap/BattleMap3D.tsx` — when the flag is on, delegates to
  `BattleMap3DGpuScene` (lazy-imported so `three/webgpu`+TSL never load on the
  default WebGL path). Shared combat hooks stay in BattleMap3D — **game logic
  untouched, render layer only**.
- `src/components/BattleMap/BattleMapDemo.tsx` — dev-only `?render=3d` param to
  start the demo in 3D for headless capture (production default stays 2D).

### Reached parity
An interim capture (before the fail-fast change, when the scene briefly allowed
the WebGL2-fallback backend) confirmed the baked-TSL materials work on the
battle map: terrain lights correctly (the black-terrain defect does NOT recur),
terrain colors match the WebGL baseline (green grass, tan/sand, blue water),
grid + fog + tokens present, tone mapping applied. That fallback render state
has since been REMOVED — the same node-material code now runs only on a genuine
WebGPU backend. Backend reported on `window.__bm3dGpuBackend`
(`webgpu` / `unavailable`).

### Documented parity GAPS (WebGL-only for now — NO silent fallback)
Real-time shadows on node materials; postprocessing bloom + vignette (WebGL
`EffectComposer`); procedural GLSL terrain texturing (`onBeforeCompile` — replaced
by a baked per-tile palette); grid movement/path/AoE shader overlay + targeting
decals; VFX; grass/tree instancing; drei `<Html>` nameplates; animated
`CharacterActor` rig (tokens are lit capsules). Each is a discrete next port item.

### Verification
- Tests: `BattleMap3D.parity` / `.visibility` / `.objectTargets` +
  `BattleMap3DGpuScene.failfast` (flag on + no adapter → error panel, not a
  scene; "Use WebGL instead" click → WebGL scene mounts) — **7/7 pass across 6
  files**. tsc clean on all touched source files (pre-existing
  BattleMapDemo/AbilityPalette/test errors unrelated).
- Shots (`.agent/scratch/shoot-bm3d-webgpu.mjs`, ?dummy=1&dev_combat=1 → CombatView
  → click "3D" toggle → pose):
  - `.agent/scratch/bm3d-webgl-baseline.png` — WebGL 3D battle map.
  - `.agent/scratch/bm3d-webgpu.png` — WebGPU path in headless chromium (no
    WebGPU adapter): the **fail-fast error panel** with the "Use WebGL
    instead" button. This is the CORRECT capture for a no-adapter environment.
  - `.agent/scratch/bm3d-webgpu-after-usewebgl.png` — after clicking the
    button: WebGL scene mounted, `gpu=1` stripped from the URL (live-verified:
    error panel gone, canvas + `__bm3dCam` hook present).
- The rendered WebGPU-backend battlefield can only be exercised on real WebGPU
  hardware. **Real-GPU eyeball is the one open verification.**

### How Remy triggers the WebGPU path locally
1. Dev server (e.g. `?phase=battle_map_demo` via Dev Menu → Battle Map Demo with
   a party, or a real combat encounter), switch the battle map to **3D**.
2. Append **`&gpu=1`** to the URL and reload. On the RTX 2070S in Chrome 113+
   the corner badge should read **"WebGPU"** and the battlefield should render.
   If WebGPU is unavailable you get the error panel + "Use WebGL instead"
   button instead — never a silent fallback.
   To make it the session default instead, flip `WEBGPU_BATTLE_MAP_DEFAULT` to
   `true` in `webgpuBattleMapFlag.ts` (do this only after the eyeball signs off).

---

## Status update — full-stack probe parity (2026-07-04, later)

**Status: full ground stack renders through the baked-TSL node path; FAIL-FAST aligned with the battle map; real-GPU eyeball is the one open item.**

The probe was upgraded from "terrain + building boxes" to the **full current ground stack** at the same seed/pose: procedural instanced trees, near-camera grass, the complete prop set (instanced boulders/logs/bushes/crates/barrels/sacks/hay + composed market-stalls/woodpiles/fences/wells/troughs/carts/crate-stacks), per-chunk bushes, styled roofs (buildRoofGeometry), and town walls/gates/decks/roads. It consumes the game's OWN data — chunk bundles for vegetation, `GroundWorld.props` for props (routed with the same `RENDER_VARIANT` map `GroundProps.tsx` uses).

### What reached parity
- Terrain, water, roads, walls/gates/decks (vertex-colored masonry), styled buildings + pitched/hip/gable/flat roofs, doors/windows — all lit and colored via the baked hemisphere+sun Lambert `MeshBasicNodeMaterial.colorNode` (no scene lights; three #30044 unchanged).
- Procedural trees, near-camera grass, per-chunk bushes, and the full prop catalog render at the same positions the WebGL world uses.
- Lighting constants are derived from the SAME `sunFromTime()` model `World3DLighting` uses, so sun direction/colors/fog match the WebGL ground profile.

### FAIL-FAST (no fallback) — matches the battle-map pattern
- Host pre-checks `navigator.gpu` + `requestAdapter()` BEFORE mounting the scene. No `navigator.gpu` / null adapter / adapter throw → NO scene, a full-pane **"WebGPU unavailable: <reason>"** error with one explicit **"View this scene in WebGL instead →"** button (routes to `?phase=world3d&ground=1` carrying the probe's gx/gy/wfseed/hour so the WebGL view frames the same spot). User-driven; never auto-fallback.
- The `gl` factory asserts the renderer's real backend is WebGPU after `init()`; a silent WebGL2 fallback or an init timeout calls `onFatal` → same error pane. Green **"WebGPU" + live FPS** badge only on genuine success.

### Explicit MISSING (shown on-screen, red)
- **Real-time shadows (node path, three 0.170)** — with lighting baked into `colorNode` there is no `LightsNode` to consume a shadow map, so three.js shadow maps do not drive the baked materials. Documented, not faked.

### Node-path gotcha found and fixed (important for any node-material instancing)
On the WebGPU node path, `InstanceNode` multiplies `instanceColor` into the material color pipeline **unconditionally** whenever the `instanceColor` buffer exists — even if your `colorNode` never references it. The vegetation scatter carries DARK per-instance palette tints (~0.02–0.07), so setting them via `setColorAt` crushed the lit trees/bushes to black. Proven in isolation on a **real WebGPU backend**: an instanced colored box renders center pixel **[0,19,0]** WITH a dark instanceColor vs **[109,158,88]** WITHOUT it. Fix: leave `instanceColor` null on trees (geometry leaf-green lights correctly) and bushes (solid green material); grass keeps `instanceColor` because its tints are bright enough to read as albedo.

### Verification
- `tsc` clean on both probe files (`WebGPUProbe.tsx`, `WebGPUProbeScene.tsx`). Vegetation + props suites green (202 passing; the 2 `World3DScene.lifecycle` failures are a concurrent `STREAMED_WORLD_SHADOWS: true` change in shared files, not the probe).
- Isolated real-WebGPU material tests (preview Chrome, `isWebGPUBackend: true`): baked `vertexColor().mul(irradiance)` box → lit green; instanced variant → lit green when instanceColor is null.
- Headless captures (`.agent/scratch/`): `probe-fullstack.png` = the fail-fast error pane + WebGL button (correct: headless Chromium has no WebGPU adapter); `probe-fullstack-webgl-ref.png` = the WebGL ground world at the same pose (the target look).
- **Open:** the rendered WebGPU full stack needs the real-GPU eyeball (RTX 2070S) — headless cannot drive a WebGPU device through R3F's async `gl` factory here.

### Addendum — owned town-prop forms mirrored (2026-07-04, latest)
The town-prop generators agent graduated 13 defs (gravestone, tomb, stone-cross, statue, milestone, wayside-shrine, lantern-post, tavern-sign, fingerpost, anvil, grindstone, scarecrow, brazier) from RENDER_VARIANT primitive reuse to owned vertex-colored meshes (`townPropForms.ts`, frozen-seed variant cache). The probe now mirrors this: those 13 ids are removed from the probe's `RENDER_VARIANT` and render via `buildTownPropForms()` as one instanced mesh per (def, variant) — identity base, yLift 0, lit `vertexColor()` node material with smooth normals, and **instanceColor left null** (the InstanceNode instanceColor-crushes-vertex-color bug documented above). Verified: tsc clean on the probe files, props suite 104/104 green, headless capture unchanged (fail-fast error pane on the probe as expected; WebGL-reference world still renders at the same pose — no regression).

---

## Battle-map visual parity port (2026-07-05, webgpu-bm3d-port agent)

The battle-map WebGPU scene (`BattleMap3DGpuScene.tsx`) advanced from
"terrain + grid lines + capsule tokens" to a **real visual parity pass** with
the WebGL battle map. Four rungs shipped; the cut line is documented honestly
(on-screen MISSING list + here). WebGL remains the default (`?gpu=1` opt-in,
`WEBGPU_BATTLE_MAP_DEFAULT=false`); the fail-fast/no-fallback contract is
preserved exactly.

### Rungs SHIPPED
1. **Procedural terrain texturing (rung 1).** The WebGL `onBeforeCompile` GLSL
   (per-type palettes for grass/rock/dirt/sand/water-bed/wall/floor, the 3-scale
   FBM+voronoi noise hierarchy, organic FBM-jittered edge blending toward the
   neighbour type, slope-exposed rock on grass/dirt/sand, shoreline wet banks,
   canopy dapple) is **translated to a TSL node graph** in
   `src/components/BattleMap/gpu/terrainColorNode.ts` (Fn/Loop/If, `texture()`
   sampling a per-tile type DataTexture). This is a genuine translation of the
   GLSL, NOT the flat per-tile palette the interim scene shipped. The baked
   hemisphere+sun Lambert multiplies on top (unlit `MeshBasicNodeMaterial`).
2. **Vegetation + props (rung 2).** Instanced grass (placement mirrors
   `GrassLayer.tsx`: per-grass-tile blades, seeded, height-varied, base→tip
   gradient + fake-AO baked into `colorNode`) and instanced ground scatter
   (pebble clusters + twigs, placement mirrors `GroundScatter.tsx`). All
   instanced (matching the WebGL perf pass — never per-tile meshes).
3. **Grid + movement/path/AoE overlay (rung 3).** TSL translation of
   `GridOverlay.tsx`'s `ShaderMaterial` in
   `src/components/BattleMap/gpu/gridOverlayNodes.ts` — a per-tile RGBA state
   DataTexture (R=validMove, G=activePath, B=blocked, **A=aoe**) drives
   `colorNode` + `opacityNode`; the scene lerps a `uniform` opacity for the same
   200ms fade. Terrain-conforming mesh. BattleMap3D now passes `validMoves` /
   `activePath` / `actionMode` / `aoeSet` into the GPU scene.
4. **Actors (rung 4, partial).** Tokens upgraded to team-colored lit capsules
   with HP fade (dead → gray), a selection ring, an active-turn ring, and a
   gentle idle sway. The full **animated `CharacterActor` rig is DEFERRED** (see
   cut line).

### Rung 5 (post-processing) — WIRED, real-GPU-gated
A three node `PostProcessing` pipeline (`pass()` → `bloom()` + a TSL vignette)
is constructed inside a `useFrame(priority 1)` render loop (R3F hands the render
to the highest-priority frame callback, so post owns the frame). `pass`/`bloom`
are **dynamically imported** so the display addon never touches module eval
(that was breaking the fail-fast path in jsdom). If the node pipeline throws it
is reported on the on-screen MISSING list, not faked. Whether bloom/vignette
actually composite can only be confirmed on real WebGPU hardware.

### Cut line (honest — shown on-screen in the red MISSING list too)
- **Real-time shadows** — baked `colorNode` lighting has no `LightsNode` to
  consume a shadow map on the node path (three 0.170). Same gap as the probe.
- **Animated CharacterActor rig + drei `<Html>` nameplates** — the WebGL rig is
  1,491 lines of drei `<Html>` / AnimationMixer state machine / fresnel-rim
  MeshStandard material; it does not translate 1:1 and would balloon this slice.
  Tokens keep the battlefield legible (team color, HP, selection/active rings).
- **GPU wind sway on grass** — the WebGL grass animates blades in its vertex
  shader; here the blades are static. The meadow reads; the sway does not.

### Verification (no real-GPU claim faked)
- **TSL node-graph construction is unit-tested WITHOUT a GPU** (the one thing CI
  can prove for a node translation): `gpu/__tests__/terrainColorNode.test.ts`
  (3) + `gpu/__tests__/gridOverlayNodes.test.ts` (2) build the graphs and wire
  them onto materials — vitest's jsdom provides `self`, so `three/webgpu`+TSL
  import and the Fn/Loop/If builders execute for real.
- **Battle-map suites green:** `BattleMap3DGpuScene.failfast` (2),
  `BattleMap3D.parity`, `.visibility`, `.objectTargets`, plus the 2 new node
  suites — **12 tests / 8 files, all passing**. `tsc` clean on every touched
  file (`BattleMap3DGpuScene.tsx`, `gpu/terrainColorNode.ts`,
  `gpu/gridOverlayNodes.ts`, `BattleMap3D.tsx`; repo-wide baseline of unrelated
  pre-existing test-file errors unchanged).
- **Captures (`.agent/scratch/`):**
  - `bm3d-port-webgl-ref.png` — the WebGL battle map at the standard pose
    (`window.__bm3dCam.pose(33,74,35)`): the forest battlefield with procedural
    terrain, trees, grass, scatter, water — **the target look for `?gpu=1`**.
  - `bm3d-port-webgpu.png` — the `?gpu=1` path in headless Chromium. Headless has
    `navigator.gpu` (Vulkan flags) but `requestAdapter()` returns null, so the
    **fail-fast error panel + "Use WebGL instead" button** render — no scene, no
    silent fallback. This is the CORRECT no-adapter behavior.
- **Open (unchanged from the probe):** the rendered WebGPU battlefield needs
  Remy's RTX 2070S eyeball at `?gpu=1`. What he should see: the corner **WebGPU**
  badge, a forest battlefield matching `bm3d-port-webgl-ref.png` (procedurally
  textured terrain — distinct grass/rock/dirt/sand, wet water banks, ragged type
  borders — plus grass, pebble/twig scatter, and the movement grid + green
  valid-move / blue path / amber AoE highlights when a token acts), team-colored
  tokens with selection/active rings, and a bottom-left **red MISSING list**
  naming exactly what is NOT yet ported. If bloom/vignette failed to construct,
  that line appears in the list.
