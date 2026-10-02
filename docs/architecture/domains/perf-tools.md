# Performance tools (fps and frame time)

Verified: 2026-09-30 - the game mount checked against `src/App.tsx` (panel only while dev mode is on) and rendered in the game with dev mode off and on. 2026-09-29 (evening) - checked against `src/devtools/perf/` after the "diagnose, not gauge" pass, and rendered on the river and the ocean viewer; proof captures in `.agent/scratch/perf-diagnose/` (the tracker inventory below was checked the same morning, captures in `.agent/scratch/perf-unify/`).

One tracker measures every three.js canvas in Aralia: the toolkit in
`src/devtools/perf/`. It finds each renderer by itself, so a 3D surface needs
no code to be measured. One import at a page entry puts the display on the
page. The display is an fps pill in the lower-right corner; Alt+P cycles it
to the full panel, then off.

Since 2026-09-29 the panel also DIAGNOSES a frame. It says whether the frame
time is only the display's rhythm, what each render pass cost on the CPU and
the GPU, whose triangles they were, what the camera sees, what made each slow
frame slow, which memory counts move, and how a marked reading compares with
the live one. See "What each number means" below.

## How it works now

### The renderer probe

`rendererProbe.ts` wraps the calls that every surface must make:
`renderer.render`, `renderAsync`, `compute` and `computeAsync`. It finds a
renderer by three routes:

1. A `WebGLRenderer` dispatches an `observe` event on
   `window.__THREE_DEVTOOLS__` when it is built. The probe listens for it.
2. A `WebGPURenderer` asks a canvas for a `webgpu` context. The probe watches
   `getContext`, then wraps the class that `three/webgpu` exports.
3. `instrumentRenderer(renderer, { id, label })` wraps a renderer that is
   handed in. `PerfProbe` calls it with the R3F `gl`.

A frame is every renderer call made in one display frame. The browser gives
every animation-frame callback of one display frame the same timestamp, and
the probe uses that timestamp as the frame key. A call outside a callback
(a timer, an `await` that resumed) joins the last frame if that frame started
less than 50 ms before. With no animation frame at all, one task is one frame.

The probe reads the renderer counters before and after each call and adds
the difference. It never changes `renderer.info.autoReset`. So it counts every
pass of a post-processed frame, and a scene that reads `gl.info` itself still
reads three's own numbers.

CPU time runs from the top of the animation-frame callback to the end of that
callback (until 2026-09-29 evening it stopped at the last renderer call, and
missed the page's script after the last draw). GPU time on WebGL comes from
`EXT_disjoint_timer_query_webgl2`, one query SEGMENT per pass
(`PassGpuTimer` in `gpuTimer.ts`): a pass ends its segment when it returns, and
a nested pass (a shadow map) ends its parent's segment and resumes it after,
because only one query may be open. The frame's GPU time is the sum of the
segments; GPU work between two passes is not in it.

Every render and compute call is kept as a named PASS, nested passes
included. The probe also wraps the graphics API calls that upload data,
compile shaders, or wait for the GPU, and files their time per frame.

### The staple import

`import './devtools/perf/staple';` at the top of a page entry installs the
probe and mounts the display. It must come before the page's own components,
because the probe cannot find a renderer that was built before it. These
entries have it:

| Page | Entry | Notes |
|---|---|---|
| Design Preview (`misc/design.html`) | `src/design-preview.tsx` | Also mounts `<PerfOverlay />` in `DesignPreviewPage.tsx`; the root is shared and counted. |
| Game (only while dev mode is on) | `src/App.tsx` | `installPerfAutoProbe()` at module scope under `import.meta.env.DEV`; `<PerfOverlay />` mounts only while `gameState.isDevModeEnabled` is true. |
| Building Identity Lab (`misc/building-identity-lab.html`) | `src/building-identity-lab.tsx` | Had no display before 2026-09-29. |
| Character Atelier (`misc/character-atelier.html`) | `src/devtools/characterAtelier/main.tsx` | Had no display and no probe before 2026-09-29. |

**One template (Remy, 2026-09-30, question sheet q1).** Every page reads the
same module, so a change to `src/devtools/perf/` reaches every 3D renderer on
the next page load. Do not copy the tracker into a page, and do not add a
private frame counter to a HUD: show `<PerfFpsText>` instead. The main game
shows the tracker only while dev mode is on. Dev mode starts on in a dev build
and off in a production build; the Developer Menu control
`SET_DEV_MODE_ENABLED` turns it either way. Proof: the pill shows with dev
mode on, goes away after "Disable Dev Mode", and comes back after "Enable Dev
Mode" (`.agent/scratch/perf-diagnose/devModeGate.mjs`).

A production game build does not install the probe at module scope. The
probe installs when the overlay mounts, so after dev mode comes on it finds
only the renderers built after that. A `PerfProbe` still measures its own
canvas (World3DScene has one), because `instrumentRenderer` wraps that one
renderer without the page-wide hooks.

### The display

- **The pill** shows the fps of the first surface that is drawing. With more
  than one, it adds the surface name and a count.
- **The panel** (Alt+P) shows fps, mean, p95 and worst frame time, a frame
  graph, GPU and CPU time, a bottleneck verdict, draw calls, triangles, lines,
  points, render passes, compute calls, memory, surface size, spans, surface
  readings and the slow-frame log. It has one tab for each surface.
- **The window badge** (`PerfWindowBadge.tsx`) shows the fps of the canvas
  inside a Design Preview window, in that window's title bar. A window with no
  measured canvas shows nothing. A click opens the panel on that surface.
- **`PerfFpsText`** is the fps as inline text, for a HUD. It reads the named
  session, or the session in the same window. The Debug HUD, the fluid HUDs,
  the entity debugger HUDs and the WebGPU probe badge use it.

The badge and `PerfFpsText` never call `setState`. They write into the DOM
from a timer. A timer that re-rendered the page's own React root once starved
a heavy Suspense render forever (see `PerfOverlayHost.tsx`).

### Names

| How | Where | Effect |
|---|---|---|
| `<PerfProbe id="x" label="X" />` | Inside an R3F `<Canvas>` | Stable id `x`. |
| `instrumentRenderer(renderer, { id, label })` | A raw loop | Stable id; release on teardown. |
| `data-perf-id` and `data-perf-label` | Any element around the canvas | Stable id with no script. |
| Nothing | - | Id `auto:<slug>`, labeled by the WindowFrame title, else `?step=`, else the page title. |

### Surface readings

A surface puts its own numbers beside the frame times:

- `session.span(name, ms)` for a time per frame. Spans also feed the slow-frame log.
- `session.setStat(name, value)` for any other number, such as a cell count.

Get the session with `getPerfSession(id)` or `perfSessionForRenderer(renderer)`.

### The headless contract

`window.__araliaPerf` is the capture-rig interface. It keeps its 2026-08
shape: `ids()`, `snapshots()`, `report(id)`, `record(id)`, `stop(id)`. It adds
`open(id)`, `longFrames()` (the browser's long-frame reports the probe holds)
and `scenes(id)` (the live scenes and cameras a surface drew lately, for use
inside `page.evaluate`). A snapshot adds `origin`, `stats`,
`counters.renderCalls`, `passes`, `passGpuNote`, `vsync`, `costs`, `cpuParts`,
`memory` and `inventory`. `report()` carries the whole diagnosis as text. The
container id `aralia-perf-hud-root` is unchanged.

### What it cannot measure

| Gap | Why | Tracked |
|---|---|---|
| GPU time on WebGPU, per frame or per pass | three r172 timestamp queries record only the first pass, so every later reading is the same constant. | GG-334 |
| GPU work between two WebGL passes | The per-pass queries cover the passes, not the gaps. | GG-358 |
| The screen share on WebGPU | The ID render swaps WebGL materials only. | GG-355 |
| The cause of a slow frame under 50 ms outside the frame callback | Chrome writes a Long Animation Frame report only above 50 ms. | GG-356 |
| A garbage collection's time; any GC in default Chrome | Seen only as a heap fall, and default Chrome rounds the heap reading. | GG-357 |
| A canvas not drawn by three (Pixi battle board, dice) | The probe wraps three's renderer, not the GL context. | GG-336 |
| A `WebGPURenderer` on its WebGL2 fallback, with no `PerfProbe` | That backend asks for `webgl2`, so route 2 never sees it. | GG-337 |
| A renderer built before the probe was installed | There is no event to catch after the fact. | Staple import order |
| A worker or `OffscreenCanvas` renderer | The probe runs on the main thread. | - |

## What each number means (the diagnosis)

Remy opened the panel on the river on 2026-09-29 and saw "58 fps, 17.2 ms,
GPU 11.27, CPU 8.38, mixed, 7 renders per frame, slow frames outside the
measured frame". He asked what would make it more indicative. The panel now
answers, top to bottom:

**1. The vsync floor.** The yellow line "vsync floor · 60 Hz · 1 refresh a
frame" means most frames land on whole refreshes of a 60 Hz rhythm. Then the
frame time (16.7, 33.3 ms) is the display's bucket, not the render cost
(memory note: vsync-floor-hides-render-cost). Below it:

- **work** is the LONGER of GPU and CPU. The two sides overlap (the CPU builds
  frame N+1 while the GPU draws frame N), so the longer side sets the pace.
  "in series" is the sum, shown only as the cost if they could not overlap.
- **wait** is the frame time minus the work: time spent waiting for the display.
- **headroom** is the budget minus the work, in ms and in percent. On WebGPU it
  says "CPU side only", because the GPU side is not measured.

The rhythm is the known refresh rate that most frames land on once; it is kept
while frames stay on its multiples (a 60 Hz page that drops to 30 fps reads
"2 refreshes a frame"). A page that has only ever run at 30 fps on a 60 Hz
display reads as 30 Hz: the panel names a rhythm, not the monitor.

**5. The budget.** "budget display | 60 | 30" in the header picks what the
headroom and the passes are judged against: the page's own rhythm, 16.7 ms or
33.3 ms. The graph draws it as a dashed amber line.

**2. Passes** (tab). Each render and compute call, in the order it ran, with
its own CPU ms (its children and its uploads taken out), GPU ms (WebGL), its
triangles, and a bar for its share of the budget. A pass inside another is
indented (a shadow map). A pass that runs only some frames says so ("·12%").
"all passes" sums them. A pass is named, in this order, by:

1. `userData.perfPass` on the scene, the camera or the render target;
2. otherwise "scene → target": the scene is its `name`, a single child's
   `userData.perfGroup` or name, "fullscreen quad", its kind ("Mesh · Shader ·
   Sphere"), or "N objects"; the target is "screen", its texture's `name`, or its
   size against the canvas ("½ target", "full target #2").

**3. Groups** (tab). Triangles by the scene's own groups: the nearest
`userData.perfGroup` tag on the object or an ancestor, else its name, else a
named ancestor, else "unnamed". The unnamed row is split by kind, material and
geometry, so it still points somewhere. The walk runs once a second between
frames and prints its own cost.

**6. View** (tab). For each scene, judged through the camera that drew the most
passes (the eye, not the mirror): triangles mounted, in view (inside the
camera's frustum, by bounding sphere, as three culls), and drawn. "the cull
leaves out N%". "nearest water" is the distance to the world-space box of a
group whose name says water. "measure" draws the view once into a 192-pixel
target with one flat color per group and counts the pixels: the visible share
of the screen per group (WebGL only).

**4. Causes** (tab). "where the CPU goes" lists the frame's CPU parts, which
add up: the page's script before the first draw, between draws and after the
last draw; each pass's draw submission; texture and buffer uploads; shader
compiles; and "GPU readback (the CPU waits)" (`readPixels`, `getBufferSubData`,
`finish`, `clientWaitSync`). "uploads and compiles" sums them over 1 s and 10 s.
Each slow frame lists what moved against its normal. Parts named "browser: …"
come from Chrome's Long Animation Frame report (style and layout, "React work",
"another animation-frame callback", a timer by its function and file). A note
such as "heap fell 39 MB (a garbage collection)" or "+3 shader programs" has no
time. "outside the measured frame" and "unattributed CPU" remain only for time
no measurement explains.

**7. Memory** (tab). Geometries, textures, programs and heap: now, the change
over the last second, and the mean change a second over ten seconds. A count
that grew in every one of ten seconds is marked "growing". The tab says when
the heap reading is too coarse to show a GC (Chrome without
`--enable-precise-memory-info`).

**8. Compare** (tab). "mark" saves the numbers as a column; the tab shows the
marked and the live values side by side with the delta, green for better and
red for worse, for the frame, GPU, CPU, the longer side, counts and each pass
that ran in both. The A/B rule is printed under it: alternate A B A B with vsync
off in the same minutes, and a number on the 16.7 or 33.3 ms floor is a lower
bound, not a cost.

### Naming a scene for the panel

A surface names its passes and groups with one line each. Names only; nothing
renders differently.

```ts
scene.name = 'river';                          // passes read "river → …"
renderTarget.texture.name = 'reflection';      // passes read "… → reflection"
mesh.userData.perfGroup = 'water';             // groups, view and screen share read "water"
scene.userData.perfPass = 'mirror pass';       // names the pass outright
```

The river and the ocean name nothing today. `.agent/scratch/perf-diagnose/nameWaterPasses.patch.mjs`
adds the names in `riverReachScene.ts` (ground, boulders, stones, vegetation,
floaters, water, sky, post; targets reflection, opaque, water composite) and in
`SideBySideOcean.tsx` (water, sky). Their owners run it (GG-352). The same
edits, for a reader without the script:

| File | After this line | Add |
|---|---|---|
| `riverReachScene.ts` | `const m = new THREE.Mesh(g, this.bankMat);` (ground tiles) | `m.userData.perfGroup = 'ground';` |
| `riverReachScene.ts` | `const rocks = new THREE.Mesh(g, this.bankMat);` | `rocks.userData.perfGroup = 'boulders';` |
| `riverReachScene.ts` | before `this.scene.add(stones)` and `this.scene.add(mixedStones)` | `stones.userData.perfGroup = 'stones';` (and the same for `mixedStones`) |
| `riverReachScene.ts` | before `this.scene.add(veg.group)` | `veg.group.userData.perfGroup = 'vegetation';` |
| `riverReachScene.ts` | `this.floaters.group.visible = false;` | `this.floaters.group.userData.perfGroup = 'floaters';` |
| `riverReachScene.ts` | before `this.skyScene.add(this.sky)` | `this.sky.userData.perfGroup = 'sky'; this.scene.name = 'river';` |
| `riverReachScene.ts` | before `this.waterScene.add(this.water)` / `this.quadScene.add(this.quad)` | `this.water.userData.perfGroup = 'water';` / `this.quad.userData.perfGroup = 'post';` |
| `riverReachScene.ts` | in `makeSceneRT`, `makeFinalRT`, `makeReflRT` | `rt.texture.name = 'opaque'`, `'water composite'`, `'reflection'` |
| `SideBySideOcean.tsx` | before `scene.add(field.surface.mesh)` / `scene.add(skyMesh)` | `field.surface.mesh.userData.perfGroup = 'water';` / `skyMesh.userData.perfGroup = 'sky'; scene.name = 'ocean';` |

## Tracker inventory

An audit on 2026-09-29 found 30 trackers beside the shared toolkit. "Merged"
means the private counter is gone and its page shows the shared number. "Kept"
means the tracker measures something the shared tool does not, or a rig reads
it.

| # | File | Page | Measures | Status after 2026-09-29 | Why that is safe |
|---|---|---|---|---|---|
| 1 | `src/components/World3D/World3DWrapper.tsx` (fps loop) | Game 3D world | fps from a second rAF loop, 1 s window, `setFps` once a second | **Merged.** Loop and state removed; the Debug HUD reads the `world3d` session. | Only the Debug HUD read it. `World3DScene` feeds `world3d` in every build. The old loop counted browser callbacks, not drawn frames, and re-rendered the wrapper every second in every build. |
| 2 | `src/components/World3D/WebGPUProbeScene.tsx` (`ProbeInstrument`) | `?phase=webgpuprobe` | fps, 500 ms window; `window.__webgpuProbeFps`; host badge | **Merged.** The badge reads `webgpu-probe`; the global is gone; status reports only on a backend change. | No rig in `tools/`, `scripts/` or `.agent/` reads the global. Proof: badge "WebGPU · 39 fps", session 37.9 fps. |
| 3 | `WebGPUProbeScene.tsx` (`AdaptiveFrameLoop`) | same | host rAF rate over 2 s | **Kept.** | It decides when to switch to a timer loop. It shows nothing. |
| 4 | `src/components/World3D/VolumeGroundBubble.tsx` `renderInfo()` | Game 3D world | calls, triangles, geometries on demand | **Kept.** | An on-demand read for `__volBubble`, not a live counter. |
| 5 | `VolumeGroundBubble.tsx` build stats | same | fill, mesh, wrap ms per build | **Kept.** | Build times, not frame times. |
| 6 | `src/components/World3D/water/riverReachScene.ts` `bench(n)` | `?step=water&river=1` | ms per frame with the GPU drained | **Kept.** | A GPU-drained bench; the live tool cannot give it. |
| 7 | `riverReachScene.ts` `frames` | same | frame count | **Kept.** | `__RIVER__.frames` is a capture contract. The river itself is now measured by the probe with no edit (session `auto:water`). |
| 8 | `riverReachScene.ts` cull counts | same | triangles per cull pass | **Kept.** | Cull diagnostics. |
| 9 | `src/components/DesignPreview/steps/FlipScene3D.tsx` | `?step=water&water=droplets` | fps EMA | **Merged.** The HUD reads `fluid-flip`; `__flipProof` keeps `frames`. | No rig reads `__flipProof.fps`. Proof: HUD 60, session 60. |
| 10 | `FluidScene3D.tsx` | `?step=water&water=grid` | "fps" that was really solver steps per second; chain ms | **Merged and renamed.** The field is `stepsPerSec`; the HUD shows the shared fps and steps/s; the chain time is a span; steps/s and starved bricks are readings. | No rig reads `__fluidProof.fps`. The old label called a step rate a frame rate. Proof: 60 fps, 70 steps/s. |
| 11 | `FluidSolverLegacy.tsx` | `?step=water&water=cpu` | fps EMA, step ms | **Merged.** The HUD reads `fluid-cpu`; the step is a span; wet cells is a reading. | No global. Proof: HUD 18, session 17.8. |
| 12 | `EntityDebugScene.tsx` stats feed | `?step=entitydebug`, `?step=herolab` | fps EMA; calls and triangles from `gl.info` | **Merged (fps).** `EntityDebugStats` has no `fps`; both HUDs read the window's session. Calls, triangles and segments stay. | `__entitydebug` never exposed the stats. Proof: HUD "60 fps · 84 calls · 784 tris", panel 60 fps, 84 calls, 784 tris. |
| 13 | `EarthGolemImg2ThreeScene.tsx` | entitydebug, img2threejs golem | fps over 500 ms; `renderer.info` | **Merged (fps).** Renderer named `golem-img2three`. | It had no probe; now it has a stable session. Proof: HUD 60, session 60. |
| 14 | `land/Reframe.tsx` `stats()` | `?step=land` | `gl.info` on demand | **Kept.** | On-demand read for `__volCam`. |
| 15 | `land/PointerRig.tsx` | `?step=land` | nothing (a comment only) | - | - |
| 16 | `src/components/BattleMap/camera/CameraController.tsx` `info()` | Combat map | one forced render's counters | **Kept.** | A rig snapshot of one forced render. |
| 17 | `CameraController.tsx` `sceneBreakdown()` | same | object counts by type | **Kept.** | Scene attribution, not frame time. |
| 18 | `BattleMap/terrain/VolumeArenaGround.tsx` worst carve frame | Combat map | worst carve-drain ms | **Kept.** | A carve budget probe for `__bmArena`. |
| 19 | `VolumeArenaGround.tsx` `sceneAudit()` | same | triangles by owner; `gl.info` | **Kept.** | Scene audit. |
| 20 | `BattleMap/dungeon/Dungeon3DPreview.tsx` `FrameProfiler` | `?step=dungeon`, in-game dungeon | frame ms percentiles between `start()` and `stop()` | **Kept.** | `tools/dungeon-profile/profile.mjs` reads `__dungeonProfile`; `BUDGET.md` results depend on it. |
| 21 | `Dungeon3DPreview.tsx` `benchRender` | same | bench ms per frame | **Kept.** | Same rig. |
| 22 | `sidebyside/SideBySideTrees.tsx` | `?step=land` trees panel | tree build ms | **Kept.** | Build time. The canvas is now measured by the probe. |
| 23 | `landTypeSwatch.ts` | `?step=land` land types | swatch render count | **Kept.** | A count of one-shot bakes; the probe skips one-shot renders. |
| 24-27 | `sidebyside/oceanExtras/wake.ts` benches | `?step=water&ocean=1` | wake compute ms, GPU frame ms, A/B | **Kept.** | Special GPU benches for the ocean gauntlet. |
| 28 | `src/systems/world3d/ocean/oceanSeabed.ts` `gpuPassMs` | same | GPU ms per render pass | **Kept.** | A seabed probe; see the r172 timestamp trap. |
| 29 | `sidebyside/SideBySideOcean.tsx` `__OCEAN__` and facts strip | `?step=water&ocean=1` | fps, ms per frame, CPU ms and split, GPU ms from timestamps | **Kept.** The probe measures the ocean with no edit. | `__OCEAN__` is the gauntlet's capture contract. The numbers agree: fps 60.0 and 60.0, frame 16.67 and 16.67 ms, CPU 1.04 and 1.02 ms. The strip's GPU rows show a constant (GG-332). |
| 30 | `misc/fiddle.html` | saved JSFiddle page | frames per second or more | **Kept.** | Not app code. It prints the frame count and does not divide by the time. |
| - | `PartLabScene.tsx`, `characterAtelier/CharacterScene.tsx` | `?step=partlab`, character atelier | nothing | Now measured by the probe. | - |

## Proof record (2026-09-29)

Headless Chrome on the real GPU (`--enable-unsafe-webgpu --use-angle=d3d11`),
1600x900, rig `.agent/scratch/perf-unify/shootPerf.mjs`. Captures and JSON are
throwaway files in `.agent/scratch/perf-unify/`.

| Page | Session | Reading |
|---|---|---|
| Ocean, `?step=water&ocean=1` | `auto:water`, WebGPU | 60 fps, 1.04 ms CPU, GPU "not measured on WebGPU", 3 draws, 526,273 triangles, 1 compute call |
| River, `?step=water&river=1` | `auto:water`, WebGL | 60 fps, GPU 7.94 ms, CPU 3.89 ms, 392 draws, 4.36 M triangles, 7 render passes |
| Entity Debug (R3F) | `entitydebug` | 60 fps, GPU 1.23 ms, 84 draws; HUD and badge agree |
| Game 3D world, `?phase=world3d` | `world3d` | 27.9 fps, 1,061 draws, 14.3 M triangles, 20 render passes, scene-cost breakdown |
| WebGPU probe, `?phase=webgpuprobe` | `webgpu-probe` | 37.9 fps; badge 39 fps from the same session |
| Fluid, droplets, CPU solver | `fluid-gpu`, `fluid-flip`, `fluid-cpu` | 60, 60, 17.8 fps; HUDs agree |
| Land, Building Lab, Character Atelier | `volume`, `building3d`, `auto:character-atelier-aralia` | 60 fps each |

### Diagnosis proof (2026-09-29, evening)

Rig `.agent/scratch/perf-diagnose/shootDiagnose.mjs`: the same Chrome with
`--enable-precise-memory-info --js-flags=--expose-gc`, one panel capture per
tab, a provoked slow frame (a resize, a 70 ms script and a GC), and a mark
before a change for compare. Captures: `river-<tab>.png`, `river-named-*.png`
(runtime tags as the patch would set them), `ocean-<tab>.png`.

| Item | River (`?step=water&river=1&full=1&live=1`, WebGL) | Ocean (`?step=water&ocean=1&full=1&sea=waterpro`, WebGPU) |
|---|---|---|
| 1 vsync floor | 60 Hz, 1 refresh a frame (92 to 100% of frames); work GPU 9.5 ms; wait 7.2 ms; headroom 7.2 ms (43%) | 60 Hz (100%); work CPU 1.2 ms; headroom 93%, "CPU side only" |
| 2 passes | 7 passes; GPU 0.35 · 3.57 · 0.42 · 4.20 · 0.30 · 0.88 · 0.03 ms, which sum to 9.75 ms against a frame mean of 9.48 ms (both are rolling means, over windows of slightly different length); named "river → ½ target" (the reflection) and "river → full target" (the opaque pass) with tags | "compute ×15" 0.19 ms CPU and "3 objects → screen" 0.60 ms CPU; GPU "—" with the reason |
| 3 groups | untagged: one "unnamed" row split by kind; tagged: vegetation 1.79 M, ground 1.13 M, stones 600 k, water 44 k | "OceanSky.mesh" 2 k; the water mesh unnamed (524 k) |
| 6 view | mounted 3.5 M, in view 1.85 M (equal to the opaque pass's drawn 1,849,583); screen share tagged: ground 44.7%, vegetation 37.2%, water 14.2%, stones 3.8%; nearest water 19.0 m | in view 526 k; screen share "not measured on WebGPU yet" |
| 4 causes | 121 texture uploads, 175 MB, 38 ms per 10 s (the live flow map); a readback of 7.4 to 9.3 ms (the exposure meter); a 97 ms frame named "browser: another animation-frame callback +90.2"; a GC note "heap fell 73 MB" | 1,780 buffer uploads, 259 KB per 10 s; the 171 ms frame named and its GC note |
| 7 memory | 593 geo, 13 tex, 14 prog, all +0 a second; heap precise | +0.4 textures a second over 10 s after a camera change |
| 8 compare | reflection off: GPU 9.38 → 6.08 ms (−3.30), draws 331 → 102, triangles 4.0 M → 1.9 M; the opaque pass alone rose 1.17 ms (the GPU clock drops with the load: the A/B note) | camera to "overhead": marked against live side by side |

## Related

- ADR: none. The probe is reversible: delete the staple imports and the
  toolkit falls back to `PerfProbe` measurement.
- Gaps: GG-332 to GG-339 (the first pass) and GG-352 to GG-359 (the
  diagnosis pass) in `docs/projects/GLOBAL_GAPS.md`.
- Plan map: `perf-toolkit-3d` in `public/planmap/topics.json`.
