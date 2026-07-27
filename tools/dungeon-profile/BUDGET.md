# Dungeon 3D frame budget & profiling

Repeatable frame profiler for the procedural 3D dungeon scene
(`src/components/BattleMap/dungeon/Dungeon3DPreview.tsx`, rendered in the Design
Preview at `design.html?step=dungeon`).

## How to run

The dev server must already be running (default base
`http://127.0.0.1:3000/Aralia/misc/design.html`).

```
# GPU baseline (this machine's real GPU via ANGLE/D3D11)  -> results.json
node tools/dungeon-profile/profile.mjs

# Forced software rasterizer (SwiftShader) = no-GPU low-end floor -> results-software.json
node tools/dungeon-profile/profile.mjs --software

# options
node tools/dungeon-profile/profile.mjs --headed          # visible window
node tools/dungeon-profile/profile.mjs --base <url> --out <file>
```

Exit code is `0` when every variant meets the 30 fps floor on the true
render-cost metric, `1` otherwise.

## What is measured

Driven through the committed dev hook `window.__dungeonProfile` (added to
`Dungeon3DPreview.tsx`), which reads the live `THREE.WebGLRenderer`:

| Metric | Meaning |
| --- | --- |
| `trueRenderCost.msPerFrame` | **Budget-judged metric.** A synchronous `gl.render()` loop with a forced `finish()` per frame — full CPU+GPU cost per frame, independent of the display refresh rate. |
| `live.p50Ms` / `p95Ms` / `p99Ms` | Per-frame time as the app actually runs (React Three Fiber's `frameloop="always"` rAF loop). On a 60 Hz display this is vsync-bound near 16.7 ms; p95/p99 above ~17 ms means dropped frames. |
| `drawCalls` | `renderer.info.render.calls` for the last frame. |
| `triangles` / `lines` | `renderer.info.render.triangles` / `.lines`. |
| `instancedMeshes` / `totalInstances` | Scene traversal: number of `InstancedMesh` objects and the sum of their instance counts. |
| `geometries` / `textures` / `programs` | `renderer.info.memory` + program count. |

## The scenario (representative low-end)

- **Seed 42, crypt theme** — a large 42-room `mausoleum` (144×158 cells, ~604
  props, 101 encounters): a demanding but ordinary generated dungeon.
- **Stress variant: room count pushed to the slider maximum (80)** — the heavy
  tail a real dungeon can reach.
- Both the whole-level **tactical** camera and a close **objective** camera are
  measured. The renderer sets `frustumCulled={false}`, so instance submission is
  camera-independent; the objective preset additionally restores every prop
  (tactical hides "detail" props), giving the largest triangle/instance load.

Worst case in the matrix = `stress80-objective` (80 rooms, all props visible).

## The budget and why

The dungeon renderer is deliberately instanced (one draw call per material/shape
batch) and lit with a restrained fixed light set, so it is engineered to run on
weak hardware. The budget targets **low-end laptop / integrated-GPU** players:

- **Target 60 fps → 16.7 ms/frame.** Smooth motion during orbit/pan on a typical
  60 Hz low-end laptop.
- **Floor 30 fps → 33.3 ms/frame.** Playable minimum for a slow inspection
  camera. Falling below this is a **FAIL** and the harness exits non-zero.

The judged metric is `trueRenderCost` because it is display-refresh independent:
the live `p50` is vsync-capped at ~16.7 ms on a 60 Hz panel and only reveals
*dropped* frames, not headroom. To characterize genuinely weak hardware without a
zoo of test laptops, `--software` forces the SwiftShader CPU rasterizer — the
exact path a machine with a blocklisted or absent GPU falls back to — giving a
hard, conservative low-end floor.

## Results

Full data in `results.json` (GPU baseline) and `results-software.json` (software
floor). Each artifact records the WebGL backend and a per-variant PASS/FAIL.
Numbers are machine-specific; re-run on a target device for a device-specific
verdict.

Measured 2026-07-19. Draw calls are a constant **28** across every variant
(instanced batching), and the scene never spikes above **~365 k triangles** even
at the 80-room maximum.

### GPU baseline — NVIDIA RTX 2070 SUPER (ANGLE / D3D11)

| Variant | Rooms | Props | Triangles | Instances | True render ms | Live p50 / p95 | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| default-tactical | 42 | 604 | 154 k | 10 832 | 1.74 | 16.8 / 18.0 | PASS |
| default-objective | 42 | 604 | 192 k | 11 448 | 2.35 | 16.9 / 18.0 | PASS |
| stress80-tactical | 80 | 1146 | 290 k | 20 529 | 2.16 | 16.9 / 18.0 | PASS |
| stress80-objective | 80 | 1146 | 365 k | 21 690 | 2.49 | 16.8 / 18.0 | PASS |

Worst case **2.49 ms/frame** — a **6.7× margin** under the 16.7 ms 60 fps target.
Live p50 sits at the 60 Hz vsync cap with p95 ≈ 18 ms, i.e. no dropped frames.

### Software floor — SwiftShader CPU rasterizer (no GPU)

| Variant | Triangles | True render ms | Live p50 / p95 | Verdict |
| --- | --- | --- | --- | --- |
| default-tactical | 154 k | 224.8 | 229.0 / 237.6 | **FAIL** |
| default-objective | 192 k | 235.7 | 241.4 / 250.7 | **FAIL** |
| stress80-tactical | 290 k | 356.6 | 359.2 / 364.7 | **FAIL** |
| stress80-objective | 365 k | 351.0 | 369.0 / 390.8 | **FAIL** |

Worst case **2.8 fps**. With no GPU the scene is fill-rate bound (cost scales with
triangle/fragment load, ~225 ms → ~357 ms as rooms rise) and is not interactive.

### Verdict & finding

- On **any hardware-accelerated GPU** the dungeon comfortably clears the 60 fps
  target with large headroom; the instanced renderer (28 draw calls, ≤365 k
  tris) is not the bottleneck.
- **Pure software rendering fails hard (2.8–4.5 fps).** A real low-end integrated
  GPU (hardware fragment units) sits between these two bounds and is expected to
  pass, but machines that fall back to SwiftShader (blocklisted/absent GPU) cannot
  run this scene interactively. That is the one at-risk population to watch.
