# Adversarial review - `water-foam-buoyancy-audio.md`

**Verdict: 32 claims checked. 15 failed.** The three highest-value
recommendations in the document (F3 Froude foam, B2 pontoon probes, A2 virtual
emitter) cannot be built from the data path the document describes. Two of the
three fail on a stated fact about the repo that is not true. The foam section is
the strongest; the buoyancy and sound sections both omit a hidden prerequisite
that the document itself was careful to state elsewhere.

Target: `F:\Repos\Aralia\docs\research\water-foam-buoyancy-audio.md`
Solver: `F:\Repos\Aralia\src\systems\worldforge\terrain\shallowWater.ts`

---

## Findings

### 1. The discharge is private. Every technique that reads it is blocked.

**The doc claims** (line 9): "Per-cell depth `d` and per-cell discharge (outflow
flux) are already computed each step." Line 30 then builds on it: "Everything
below that 'gets foam or sound cheaply' gets it from `d`, from `grad(d + b)`, or
from `u` derived by those two equations."

**Actually true.** The four flux arrays are private class members.
`shallowWater.ts:132-135`:

```ts
  private readonly fluxL: Float32Array;
  private readonly fluxR: Float32Array;
  private readonly fluxD: Float32Array;
  private readonly fluxU: Float32Array;
```

`bed`, `depth` and `exitSpeed` are `readonly` public (lines 116, 118, 131). The
flux arrays are not. There is no getter, no snapshot method and no export.
A repo-wide search finds zero reads of `fluxL`/`fluxR`/`fluxD`/`fluxU` outside
the class file.

**Consequence.** F3 (Froude foam, ranked #2 for foam), F4 (advection, #3), F5
(flow map, #4), A2 (the #1 sound recommendation) and B6 (#2 for buoyancy) all
require the flux. None of them can be written without first changing the
solver's API. The document presents all five as "already there". A reader
budgets zero solver work and finds a compile error.

### 2. The flux is not a discharge. The Froude number comes out at least 30x too small.

**The doc claims** (lines 18-27) that Mei equations 8 and 9 convert the repo's
flux to velocity, and (line 27): "At `l_X = l_Y = 1 m` this is four adds, a
halving and one divide per cell per axis."

**Actually true.** Mei's `f` is a volumetric rate in m³/s. The repo's flux is a
depth decrement in metres, applied straight to `depth`. `shallowWater.ts:340`:

```ts
        if (out > 0) depth[i] -= out;
```

The correct conversion is `Q = flux_m * cellM^2 / dt`. The document's arithmetic
omits the `/ dt`. So `u_doc = u_true * dt`.

`maxStableStep()` (lines 201-209) caps `dt` at `1/30` s and lowers it in deep
water. So `u_doc` is understated by a factor of 30 to 55.

**Consequence.** `Fr = |u| / sqrt(g*d)` built the document's way is 30 to 55
times too small. No cell ever reaches `Fr > 1`. F3 produces no foam at a chute
and no hydraulic jump. A4, the #2 sound recommendation, blends on the same
number, so the pond loop never crosses to the rapid loop. Both features look
implemented and do nothing. This is the worst failure mode in the document:
silent, not loud.

### 3. There is no physics engine. The whole buoyancy section has an unstated prerequisite.

**The doc claims** (line 350): "N bilinear samples plus N `applyForceAtPoint`
calls per body per frame." B2 is ranked #1 for buoyancy.

**Actually true.** The repo has no rigid-body dynamics. `package.json`
dependencies are: `@3d-dice/dice-box`, `@dgreenheck/ez-tree`, `@google/genai`,
`@google/generative-ai`, `@modelcontextprotocol/sdk`, `@react-three/drei`,
`@react-three/fiber`, `@react-three/postprocessing`, `@takram/three-atmosphere`,
`@takram/three-clouds`, `@takram/three-geospatial`, `@types/axe-core`, `alea`,
`better-sqlite3`, `delaunator`, `dompurify`, `dotenv`, `framer-motion`,
`google-auth-library`, `lucide-react`, `marked`, `n8ao`, `node-pty`,
`pixi.js`, `postprocessing`, `react`, `react-dom`, `three`, `uuid`, `ws`, `zod`.
No `rapier`, no `cannon`, no `ammo`, no `matter-js`. A search of `src` for
`applyForceAtPoint`, `applyImpulse` and `RigidBody` returns nothing. A search
for `buoyan` returns nothing.

**Consequence.** B1, B2, B3, B5 and B6 all assume force and torque accumulation
on a rigid body with a center of gravity. None of that exists. The document is
explicit about the equivalent gap in sound (line 482: "This project has **no
audio middleware**") and silent about this one. That inconsistency in the
document's own standard of care makes the buoyancy section read as more
shovel-ready than it is. The real first task is "choose and integrate a physics
engine", which the document never names.

### 4. "No WebGPU" is false. B7's verdict rests on that false premise.

**The doc claims** (line 3): "Research for a three.js r172 WebGL project (React
Three Fiber, no WebGPU)." B7 then argues (lines 470-473): "WebGL2 has no compute
shaders and its `getBufferSubData` readback path stalls the pipeline far worse
than Unity's `AsyncGPUReadback`. Moving this solver to the GPU would make
buoyancy substantially harder, not easier."

**Actually true.** The repo runs `WebGPURenderer` and TSL compute today.
`src/systems/worldforge/terrain/fluidCompute.ts:75-76`:

```ts
import { Fn, If, Loop, instanceIndex, float, int, modInt, select, storage, uniform } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
```

with dispatches at lines 305, 360, 399, 456 and 501 (`.compute(n * n)`).
`src/components/DesignPreview/steps/FluidScene3D.tsx:31` imports
`* as THREE from 'three/webgpu'` and line 421 casts the renderer to
`THREE.WebGPURenderer`. `FlipScene3D.tsx` and `flipSurfaceRender.ts` do the same.

`PreviewWater.tsx` - the file that constructs a `ShallowWaterField` at line 269 -
lazy-loads those GPU scenes. Its own comment at line 95 says "Both GPU scenes
pull in three/webgpu + TSL".

**Consequence.** B7's stated reason for "DOES NOT FIT" is wrong, and so is its
policy advice. A reader takes "do not move the solver to the GPU" as settled
when the platform for that move is already in the tree and already in use on the
same surface. The correct argument against a GPU move is different and the
document does not make it.

### 5. The document never mentions `exitSpeed`, the one public speed field.

**The doc claims** the only route to speed is the private flux plus Mei
equations 8 and 9 (lines 18-31, 138-143). The string `exitSpeed` does not appear
anywhere in the document.

**Actually true.** `shallowWater.ts:131` declares `readonly exitSpeed:
Float32Array`, public, per cell, written every step (lines 237 and 295). Its own
docstring at lines 122-130 states its purpose: "A jet, foam at a fall foot, and
water sound all need it."

It carries three traps the document therefore never warns about:

- It is a **scalar**, not a vector. `shallowWater.ts:294-295`:
  `const fastest = Math.max(dl, dr, dd, du); this.exitSpeed[i] = fastest > 0 ?
  Math.sqrt(2 * G * fastest) : 0;` F4 advection and F5 flow maps need a 2D
  direction. `exitSpeed` cannot supply one.
- It is a **Torricelli speed from the surface drop, not the realized flow**. It
  is computed before the outflow limiter at lines 320-327. A cell whose fluxes
  are scaled to near zero still reports a large `exitSpeed`.
- At the **domain edge it reports on depth alone**. The drop closure at lines
  246-247 uses `edge ? Math.max(0, surf - bed[i])`, which is `h`. So every wet
  boundary cell reports `sqrt(2*g*h)` regardless of what is outside. A 2 m deep
  rim cell reports 6.3 m/s.

**Consequence.** Two ways to lose. A reader who follows the document builds the
private-flux path that cannot compile. A reader who finds `exitSpeed` instead
uses it as `|u|` for the Froude term and lights up the entire domain rim as
white water, and hears the A2 audio emitter pinned to the map edge.

### 6. The sound section has two more unstated prerequisites: no listener, no assets.

**The doc claims** (lines 482-488) that the engine constraint is stated, and
names `PositionalAudio` as available.

**Actually true.** Two things the document does not say:

- A repo-wide search of `src` for `AudioListener`, `PositionalAudio` and
  `THREE.Audio` returns **nothing**. `PositionalAudio` requires an
  `AudioListener` on the camera. No 3D surface has one.
- A repo-wide search for `*.mp3`, `*.ogg`, `*.wav`, `*.flac` and `*.m4a`,
  excluding `node_modules`, returns **zero files**. The repo holds no audio
  assets at all.

**Consequence.** A2 needs one loop. A4 needs three or four loops plus near and
far variants. A5 needs a one-shot bank. None of them exist and none can be
written in code. The document ranks A2 first and calls it "the cheapest sound in
this document" (line 529). It is cheap in CPU and expensive in everything else.
The real first task is asset sourcing plus a listener rig, and the document
states neither.

### 7. The Mei parity claim is false. There is no velocity state and the flux has no memory.

**The doc claims** (lines 14-16): "Their grid stores exactly what this project
stores: 'terrain height b, water height d, ... the outflow flux f = (f L, f R,
f T , f B) and velocity vector v = (u, v)'."

**Actually true.** The repo stores no velocity vector. It also does not store
Mei's flux as state. Mei accumulates `f_new = max(0, f_prev + dt*A*g*dh/l)`. The
repo recomputes flux from scratch each step, with no reference to the previous
value. `shallowWater.ts:280-283`:

```ts
        let l = Math.max(Math.min(dl * accel * FRICTION, dl * cap), jet(dl));
```

`FRICTION` scales the fresh value, not a carried one. The solver is a memoryless
slope-driven flux scheme, not the virtual-pipe model with momentum.

**Consequence.** "Exactly what this project stores" is the sentence that
licenses the rest of the document. It is wrong on two of the four named
quantities. Anything that assumes momentum persistence - a surge that keeps
running after the surface levels, a current that advects foam across a flat pool
- will not behave as the cited paper's figures do.

### 8. F2 is already shipped in the repo. The document presents it as new.

**The doc claims** (lines 106-109): "**FITS, and it is free.** `d` is the primary
state variable of the solver. The source term is `foam += k * smoothstep(maxDepth,
0, d)`." It ranks F2 second for foam.

**Actually true.** Shoreline foam from shallow depth already runs, and already
uses `smoothstep`. `src/components/BattleMap/terrain/WaterSystem.tsx:197-202`:

```glsl
  // Shoreline foam - animated breakup in a thin band where depth -> 0
  float _foamBand = 1.0 - smoothstep(0.0, 0.09, _depth);
```

**Consequence.** A reader schedules work that is done. Worse, the document's
"trap this project has already hit" warning at lines 111-115 tells the reader to
avoid a mistake the shipped code already avoids, which reads as though the
document inspected the renderer. It did not. `WaterSystem.tsx` is absent from
the in-repo source list at line 761.

### 9. `surfaceAt` is not bilinear, is unclamped, and wraps silently.

**The doc claims** (line 322): "Sampling is a bilinear read of `b + d` on the
grid. That is about ten flops."

**Actually true.** `shallowWater.ts:170-178`:

```ts
  idx(x: number, z: number): number {
    return z * this.n + x;
  }

  surfaceAt(x: number, z: number): number {
    const i = this.idx(x, z);
    return this.bed[i] + this.depth[i];
  }
```

Nearest cell, integer index, no interpolation and no bounds check. `add()` at
lines 181-185 does bound-check; `surfaceAt` does not. `idx(n, 0)` returns `n`,
which is cell `(0, 1)` - a silent wrap into the next row. A negative index
returns `undefined + undefined`, which is `NaN`.

**Consequence.** B2 is ranked #1 and puts four probes at the corners of a body.
A body near the domain edge gets probes off-grid. One probe returns a wrong cell
from the wrong row, and the raft tilts toward nothing. Another returns `NaN`,
which propagates into the force and destroys the body's transform. The
document's "Complicates: nothing" (line 327) is wrong. A bilinear sampler with
clamping must be written first.

### 10. The Water2 cost claim omits two extra scene renders per frame.

**The doc claims** (lines 202-204): "That is a fragment-shader cost, paid per
covered pixel, not per cell. CPU side, one RG texture upload per frame (115 KB
as RG8)."

**Actually true.** `Water2` builds a `Reflector` and a `Refractor`, each of which
renders the scene into its own render target every frame.
`node_modules/three/examples/jsm/objects/Water2.js:73` `const reflector = new
Reflector( geometry, {`, line 79 `const refractor = new Refractor( geometry, {`,
lines 124-125 bind `reflector.getRenderTarget().texture` and
`refractor.getRenderTarget().texture`.

**Consequence.** Adopting `Water2` costs three scene renders per frame, not one
plus a texture upload. On a 3D surface that already runs a heavy terrain, that is
the dominant cost of the change and the document does not price it. The document
does flag the forking problem at lines 204-206 but not this.

### 11. `useAudio.ts` is a 24 kHz mono speech pipe, not a sound system.

**The doc claims** (line 484): "`src/hooks/useAudio.ts` drives raw Web Audio with
a single `GainNode`."

**Actually true.** True as far as it goes, and incomplete in a load-bearing way.
`src/hooks/useAudio.ts:2-3` describes it as "Custom hook for managing audio
context and PCM audio playback". Lines 11-15 set
`AUDIO_CONTEXT_SAMPLE_RATE = 24000`, `PCM_AUDIO_BIT_DEPTH = 16`,
`NUMBER_OF_CHANNELS = 1`. Line 92 constructs
`new AudioContext({ sampleRate: AUDIO_CONTEXT_SAMPLE_RATE })`.

An `AudioContext` sample rate is fixed at construction and cannot be changed.
24 kHz gives a 12 kHz Nyquist limit.

**Consequence.** A4 asks for "brighter spray and sharper transients" up close
(line 587). That content lives above 12 kHz and this context cannot carry it.
Water audio needs a second `AudioContext` at 48 kHz, or the speech context must
be rebuilt. The document cites the file and misses the number that decides the
design.

### 12. `d_avg` needs a second depth buffer the document does not budget.

**The doc claims** (line 24): "with `d_avg` the mean water height across the
step" and (lines 30-31) "No second simulation is needed for any of it."

**Actually true.** Mei's `d_avg` is the mean of depth before and after the step.
The repo mutates `depth` in place in pass two (`shallowWater.ts:340-349`). The
pre-step depth is gone by the time `step()` returns. A caller must snapshot
`depth` before every step.

**Consequence.** One more `Float32Array(57600)` and one more full copy per step,
on top of the F1 and F4 buffers the document does budget. Small, but it belongs
in the cost table at lines 298-302 and is absent.

### 13. The stated grid constraint matches one surface out of three.

**The doc claims** (lines 7-8): "A 240 x 240 grid at 1 m, so 57,600 cells."

**Actually true.** That matches `?step=land` only.
`src/components/DesignPreview/steps/PreviewVolumeGround.tsx:331` and `:343` set
`useState(240)` for `extentM` and `useState(1)` for `cellM`.

The other two live call sites differ. `PreviewWater.tsx:196-197` sets `N = 128`
and `CELL_M = WATER_EXTENT_M / N`, with `WATER_EXTENT_M = 64`
(`waterConditions.ts:28`) - so 128 x 128 at 0.5 m, 16,384 cells.
`VolumeArenaWater.tsx:357` takes `n` and `cellM` from the arena handle.

**Consequence.** Buffer sizes, per-cell budgets and the F5 flow-map resolution
argument ("1 texel per meter, four times coarser than Valve's 4 texels/m",
line 198) are stated as facts about "the" grid. On `?step=water` the flow map is
2 texels per metre and the buffers are 3.5 times smaller. The arithmetic itself
is correct - 57600 x 4 = 230,400 bytes checks out - but it is scoped to one
surface without saying so.

### 14. One quoted source is cited nowhere.

**The doc claims** (lines 561-563): "Commercial packages exist: the Fab
*Procedural River Sound* Blueprint spawns 'a River Sound Audio Component that
follows the character along the setup spline' and blends five water types".

**Actually true.** That is a direct quotation with no link, no entry in the
Sources list at lines 741-761, and no entry in the "Sources I could not read"
section at lines 40-56. Every other unread source in the document is flagged.
This one is not.

**Consequence.** The honesty section is otherwise good and is incomplete by one
item. A reader who trusts the flagging scheme treats this quotation as verified.

---

## Checked and holds

- **F1**: buffer arithmetic checked (57600 x 4 = 230,400 B; R8 = 57,600 B), holds.
- **F2 (physics of the technique)**: `depth` is public at `shallowWater.ts:118`, holds.
- **F3 (formula only)**: `Fr = |u| / sqrt(g*h)` is the standard form, holds. Its inputs do not (Findings 1, 2, 5).
- **F3 (clamp warning)**: the denominator does go to zero at the dry edge, holds.
- **F5 (three.js API)**: `Water2.js` in r172 carries `flowMap` (line 48), `halfCycle` (line 53), `flowMapOffset0`/`flowMapOffset1` (lines 312-313) and `flowLerp` (line 333), holds.
- **F7 (waterfall criterion)**: it is a bed-slope test, and `bed` is public at `shallowWater.ts:116`, holds. This is the only "free from the solver" claim that survives intact.
- **F8**: no displacement map in the solver, holds.
- **B4**: the grid is Kerner's cached patch, holds.
- **B5 (in-repo mechanism)**: `VolumeArenaWater.tsx:263` reads "**A bed that DROPPED (a crater) keeps its column's water MASS.**" - quotation accurate. Rim redistribution confirmed at lines 292-300, holds.
- **A1**: Web Audio has one position per `PannerNode`, holds.
- **A4 / A5 (three.js API)**: `PositionalAudio.js` has `setRefDistance` (50), `setRolloffFactor` (64), `setDistanceModel` (78), `setMaxDistance` (92), `setDirectionalCone` (100). `Audio.js` has `setFilters` (249) and `setFilter` (295), holds.
- **Audio middleware absence**: no Wwise, FMOD, Howler or Tone in `package.json`, holds.
- **three r172**: `node_modules/three/package.json` reports `0.172.0`, holds.
- **Hall of shame reference**: `docs/water-hall-of-shame.md:60-71`, entry 4 "The shoreline that flickers", the ripple layer, 2026-08-26, fixed with `smoothstep`. Characterization accurate, holds.

---

## Not checkable here

- **Every external citation.** I did not fetch the SIGGRAPH, Crest, Epic, Kerner,
  Chentanez, Mei, Vlachos, Lettier, Tardif or Game Audio Learning Portal pages.
  I checked the document's claims against the repo only. The quotations may be
  accurate, misattributed or invented, and I cannot say which.
- **The performance estimates.** "Order of a tenth of a millisecond in JS"
  (line 88) and "Roughly the cost of F1 again, maybe two to three times it"
  (line 172) are unmeasured. The document says so for the first one. It does not
  for the second. Neither can be settled without a bench.
- **Whether the pipe law is dimensionally consistent.** `accel` at
  `shallowWater.ts:226` evaluates to units of 1/s, so `dl * accel` is m/s, while
  `jet()` at lines 273-278 returns metres. Both are subtracted from `depth` as
  metres at line 340. This may be intentional absorption of a step factor or it
  may be a solver bug. It is outside the review mandate and I did not chase it,
  but it compounds Finding 2 and someone should settle it before any Froude work
  starts.
- **Whether `Water2`, `Reflector` and `Refractor` work under `WebGPURenderer`.**
  Relevant to F5 given Finding 4. Not tested.
