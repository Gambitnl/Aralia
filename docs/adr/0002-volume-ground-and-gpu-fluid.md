# 2. Volume ground and GPU fluid

Date: 2026-08-05

## Status

**Superseded in part, 2026-08-07.** The volume-ground decision stands. The
water decision does not: a deep research pass argued for a conservative 2D
solver as the primary model, with 3D as a local exception, and the numbers
agreed. See "Revision: water is 2D first" at the end of this record.

## Context

Aralia's world read as hollow. A facade audit against the source found the
cause: terrain is one triangle layer with a skirt only at chunk borders, water
is an upward-facing lid over a carved bed, and roads, walls and decks are
separate sheets stacked over the ground. Remy's words: "it's like there's a
bunch of sheets overlaying each other instead of actual ground and water."

Two forces made a surface model insufficient rather than merely ugly.

**Spells cut the ground.** `TerrainCommand` already changes tile elevation, and
the spell list splits in two. Displacement spells — Move Earth, Erupting Earth,
Mold Earth — a height map can serve. Void spells cannot be represented at all:
Passwall, a Stone Shape doorway, an Earthquake fissure. A height map stores one
height per column, and a tunnel needs ground above and below the same point.

**Remy asked for real fluid.** Not a rising level, but simulation: a breached
dam empties under its own head, water finds a hole that was just dug. Fluid
must ask "is this point solid" thousands of times per step, and a surface mesh
cannot answer that. It knows where its skin is, not what is behind it.

Those two together rule out the shell. Volume became the requirement, not the
preference.

## Decision

**The ground becomes a voxel volume in a bubble around the player.** The
classic heightfield holds everywhere else. Fluid exists exactly where volume
exists.

**The bubble is 64 m across at 25 cm cells**: 256 cubed, 16.8 million cells.

**The fluid solver runs as a GPU compute pass** over five dense storage
buffers, at 320 MB total. The count was four (256 MB) when this ADR was
accepted; the build added a second velocity buffer. See the gather-form
consequence below for why.

Every number above came from a measurement, at Remy's instruction, rather than
from an estimate.

## The measurements that decided it

**Sparse voxel storage is cheap.** A 64 m bubble at 12 cm filled from real
terrain costs 6.3 MB, against 147 MB dense — a 23× saving. Terrain is a
surface, so only the thin band where material changes needs cells. Memory was
expected to be the constraint on the CPU and is not.

**CPU fluid is not fast enough.** Measured at roughly 3 microseconds per moving
cell per step:

| Bubble | Wet cells | Step |
|---|---|---|
| 32 m at 12 cm | 9,137 | 15.7 ms |
| 64 m at 12 cm | 34,170 | 108.5 ms |
| 64 m at 12 cm, large pour | 133,033 | 179.9 ms |

A whole frame at 60 fps is 16.7 ms. The gap at 64 m is an order of magnitude
and tuning does not close it.

**GPU memory is expensive, and this reverses the CPU result.** A compute pass
indexes by position, so its buffers must exist everywhere — including the 99%
that is solid rock or open sky. None of the sparse saving survives:

| Bubble | Four dense buffers |
|---|---|
| 32 m at 12 cm | 281 MB |
| 64 m at 12 cm | 2,350 MB |
| 64 m at 25 cm | 256 MB |
| 128 m at 25 cm | 2,048 MB |

So GPU compute buys either the AREA or the DETAIL, not both. Remy took the
area.

## Consequences

**A 25 cm step is visible.** On a tunnel wall, and on a small splash. This is a
known and accepted limit, not a defect to be reported later.

**Water beyond 64 m stays a level on a heightfield.** Two water models coexist,
and the boundary between them has to be handled.

**Bubble fill costs 778 ms at this size.** That is a visible freeze if it runs
on the main thread. It must be filled ahead of the player in a worker, the same
pattern the staged 3D entry already established for chunk streaming.

**The removal must never precede its replacement.** A cut wall is generated at
the moment of the cut. Swap the mesh only when the new one is complete, or the
player sees a one-frame hole into an empty world — the exact fault Remy
anticipated before it was built.

**The kernel must gather, never scatter.** The first kernel pushed mass into
neighbor cells. On a GPU all cells run at once, so two cells that push into
the same neighbor race, and the field silently loses water. WGSL has no float
atomics to lean on. The shipped kernel (2026-08-06) is gather-form: each cell
recomputes its neighbors' outflows and writes only itself. Velocity gets a
read and a write buffer for the same reason — that is the fifth buffer and
the extra 64 MB. A plain-TypeScript twin (`fluidGather.ts`) proves
conservation in vitest; the GPU kernel mirrors it node for node, and a
readback on the proof page confirmed the total is flat.

**The physics is mass exchange, not a projection solve.** It gives genuine
pressure-driven flow. It does not give a correct pressure field, and it should
not be described as one.

## The route out, when 25 cm proves too coarse

Sparse compute: brick allocation on the GPU, dispatched over a live list of
bricks that can hold water. This restores 64 m at 12 cm for roughly 100 MB by
recovering on the GPU the saving the CPU already proved. It is meaningfully
more work than the dense version and is the correct next step rather than a
different direction.

## Alternatives considered

**Keep the shell and generate cut faces.** Red Faction 1's model, and the route
this session built first in `groundSolid.ts`. Rejected once real fluid was
chosen: a shell has no inside for a fluid to query. The work is not wasted —
the layer stack it introduced is what colors a voxel cut.

**Scoped destruction.** Red Faction Guerrilla breaks structures and leaves
terrain solid; you cannot dig into the ground in it. Rejected because Passwall
through a mountainside is a named requirement.

**Full Navier-Stokes.** A global pressure solve per step. Rejected on cost; the
mass-exchange model gives the observable behavior Remy asked for at a fraction
of it.


---

## Revision: water is 2D first (2026-08-07)

A deep research pass reviewed this ADR and its measurements. Its verdict:

> Volumetric ground is not the mistake. Treating the whole nearby world as one
> uniformly resolved volumetric simulation is the mistake.

That is precisely what the decision above describes, and it is wrong.

### What changed

**Water is a conservative 2D depth-and-discharge grid.** 3D cells and particles
become a local exception for waterfalls, breached edges and tunnel flow.

The arithmetic is decisive and uses this ADR's own measurement. The 3D field
over the shipped bubble is 16.8 million cells and stepped at 108 ms. The same
ground in 2D is 256 x 256 = 65,536 cells — 256 times fewer. Measured after the
build: a full 256-grid step runs in **under 16 ms**, and typically far less. The
wall that drove the whole GPU-compute decision does not exist in 2D.

**Volume lives only where the ground was EDITED**, not in a uniform bubble.
Untouched hillside stays a heightfield.

**The CPU owns the truth.** The GPU receives a transient working set. Saves hold
the seed, the edit log and a water mass ledger — never GPU state, because WGSL
permits floating-point differences between implementations and cross-hardware
replay was never available.

**A static exterior cannot conserve mass.** It is an infinite reservoir. The
exterior needs a coarse volume ledger, which `ShallowWaterField.boundaryLedgerM3`
now supplies from the inside.

### One claim in the research that does not survive checking

It warns that a 320 MB monolithic allocation exceeds WebGPU's guaranteed limits
of 128 MiB per storage binding and 256 MiB per buffer.

This design is not monolithic. It is five separate buffers of 64 MiB each, and
each clears the guaranteed floor with 2x headroom. The objection does not apply
as written.

The recommendation still holds for a better reason: the dense grid is waste, not
a limit breach. Roughly 99% of those cells are solid rock or open sky.

### What survived from the original build

- `voxelVolume.ts` — 8-cubed sparse bricks, which is exactly the recommended
  storage, and the same brick size AMD Brixelizer uses.
- `surfaceNets.ts` — named in the research as the best default for natural
  terrain, and a variant of what Roblox ships.
- `fluidGather.ts` — CPU-side, conservation proven in vitest.
- Every measurement. The numbers were right; the design drawn from them was not.

### Three bugs the 2D build found, all conservation faults

**Lowering the bed created water.** The stated rule `h_new = max(0, eta - b_new)`
holds the free surface, which is right for a cell inside a lake and wrong for a
cell in isolation. It manufactured 2.5 m of water from 0.5 m.

**Raising the bed deleted water.** The mirror fault, exposed by fixing the first.
The displaced volume was computed as zero and silently dropped.

**The solver checkerboarded.** A cell could shed its entire depth in one step, so
wet and dry cells swapped contents forever while conserving volume exactly. It
looked stable for 20,000 steps. The fix caps total outflow at half the largest
drop, so a cell and its deepest neighbor meet level instead of trading places.

All three were invisible without a test that watched total volume, which is why
that test was written before any behavior test.

### A fourth bug, found by eye and not by test (2026-08-07)

**The volume had no floor and no sides.** The mesher walked cells 0 to n-2 and
sampled corners at x and x+1. A cell on the border therefore had all eight
corners solid, so it was never a boundary and emitted no face. Only the top
surface existed.

The fault survived because it is invisible from above. From below, the open
bottom showed the underside of the terrain's own top surface, which reads
convincingly as a dark floor. It became visible only when a crater carved inside
the ground appeared as a lit dome hanging in mid-air.

**The fix seals the border by padding the sample lattice one step on all six
sides**, where `VoxelVolume.get` reports Air. The caps then come from the same
code path as every other face, so their winding and vertex sharing are correct by
construction. The shell version in `groundSolid.ts` needed three separate winding
fixes because its rim, cap and surface were each built by hand; padding avoids
repeating that.

`VoxelVolume.get` also gained an explicit bounds check. Negative indices returned
Air by luck. The high side did not: `x = n` indexes a real brick in a neighboring
column, so a mesher sampling past the edge would have sealed against the wrong
material.

**The test that was missing.** Every existing mesher test asked about contents —
counts, smoothness, color, determinism — and a surface with no floor passed all
of them. The new test asks about topology: every edge must be shared by exactly
two triangles. One user is a hole, three is a fold. That is the only claim that
separates a solid from a sheet, which is the point of the file.

**A review note.** Two rounds of exposure tuning were spent on cut walls that
looked blown out to white. A pixel readout put them at RGB 71, with the frame's
brightest pixel at 146 of 255. Nothing was clipping; the near-black panel made
mid-gray look white. Sample the buffer before trusting the eye on a dark UI.

---

## Collision against the volume (2026-08-08)

Rays and bodies now query the volume directly. Two files, 30 tests.

**`voxelRay.ts`** marches the grid cell by cell (Amanatides and Woo). It never
samples a point twice, so it cannot step over a thin wall the way a fixed step
size does at a grazing angle. It skips the empty space before the volume with a
slab test, so the cost of a pick does not grow with how far back the camera sits.

One bug worth recording. A ray that entered the volume and met rock on its first
cell was reported as "starts buried" — zero distance, zero normal. That is a
shot at a cliff wall, and the caller could not tell which way the wall faced.
The buried case is now distinguished by whether the ray ORIGIN was inside.

**`voxelCollide.ts`** moves a vertical capsule. Three properties carry it:

- The move is sub-stepped, so a fast body cannot cross a thin wall between
  frames. The test drives a body 40 m in one call at a one-cell wall.
- The axes resolve separately, so sliding along a wall needs no special case.
- The body steps up a small lip. At 25 cm cells the ground is nothing but voxel
  lips, and a body that catches on each one reads as broken rather than solid.

`grounded` is a downward probe, not a memory of whether the last move was cut
short. Deriving it from the move is wrong on the first frame a body is placed and
wrong again whenever the vertical delta is zero — which is most frames a body
stands still.

**Proved on the surface, not only in tests.** `?step=volume` now casts a ray
from the pointer at the volume and reports what it struck; a walker capsule
falls, walks, steps and turns under real collision. The ray is cast at the
VOLUME, not at the triangles: picking the mesh would prove only that the mesh
exists, while this exercises the query a spell will make to place its cut.

---

## A material system, and the end of the hollow world (2026-08-08)

Three things landed together, because each needed the one before it.

### Materials are substances now, not color bands

`materials.ts` replaces the single hardcoded `FOREST_FLOOR_STACK`. Every voxel
value has a registry entry carrying `densityKgM3`, `hardness`,
`permeabilityMS`, `angleOfReposeDeg` and `friction`. Those are the questions the
world actually asks of the ground — how long to dig, does water sink, does a cut
wall stand — and a color could answer none of them.

The `Material` enum grew from 6 members to 18. A test asserts the enum and the
registry agree, because two hand-kept lists always drift.

`BIOME_GROUND` covers the closed FMG vocabulary 0 to 12 and THROWS on anything
else, matching `climateForBiomeId`. The old string switch — `'litter'` to
`Material.Litter`, everything else to bedrock — is gone. That silent default was
what made per-biome stacks impossible: adding sand produced granite and no error.

Permeability spans eight orders of magnitude on purpose. It is the difference
between a clay pan that holds a lake and a gravel bar that empties overnight,
and the water page below now demonstrates exactly that.

### The streamed world is no longer hollow

The live world was a sheet. Terrain was one triangle layer, drawn `FrontSide`,
with a wall only at the streaming frontier and no bottom at all. A camera below
grade looked straight through the ground at open sky.

Three changes close it:

- `GROUND_FLOOR_Y = -120` in `WORLD3D_CONFIG`. A GLOBAL constant, not a
  per-chunk depth — that is what makes the floor continuous, because every
  chunk's wall reaches the same plane and neighbors cannot leave a gap.
- Frontier walls drop TO that plane instead of by a per-chunk depth.
- `WorldUnderside`, one downward-facing plane at that Y, colored granite from
  the registry. Two triangles.
- Terrain and frontier walls became `DoubleSide`. Three.js flips the normal on a
  back face, so the underside faces down, the sun misses it, and it reads as
  dark rock rather than as grass on a ceiling.

### Water runs, on real ground, and every drop is accounted for

`?step=water` runs `ShallowWaterField` on the same GroundWorld the streamed
world meshes. A spring feeds the highest point. Measured on screen:

| biome | surface | soaked in 12 s |
|---|---|---|
| forest | leaf litter, 1e-3 m/s | 8.2 m³ |
| desert | sand, 1e-4 m/s | 0.4 m³ |
| glacier | snow, 1e-4 m/s | 0.5 m³ |
| wetland | peat, 1e-6 m/s | 0.0 m³ |

The biome changes the behavior, from the registry, with no water-specific
tuning anywhere.

Two faults were found by building the page rather than by reasoning about it.

**The soak was a silent mass sink.** Depth was subtracted and forgotten, which
is precisely the fault the solver's own tests exist to catch. Water that soaks
away has not stopped existing; it has become groundwater. It is booked now, and
the page shows `pool + runoff + soaked = poured` as an exact identity.

**A bed edit changed the physics but not the picture.** Cutting a channel moved
the solver's bed and left the ground mesh alone, so water ran along a trench
that was not drawn. A bed edit is not complete until the thing the player looks
at has changed with it.

---

## Water on the volume (2026-08-08)

The two halves now meet. Water ran on a heightfield bed sampled from
GroundWorld; the volume had no water at all.

**A column of voxels is not one surface.** That is the whole difficulty. Bore a
tunnel through a hill and the column has two places water can lie — the
hillside on top and the tunnel floor beneath, with rock between. Ask it for
"the ground height" and every answer is wrong: the topmost solid puts water on
the tunnel's ROOF, the lowest floods the rock.

`volumeSurface.ts` reads a column as a list of SPANS, each with a floor, a
ceiling and the substance underfoot. Water lives in a span, not on a height.
The topmost span is the open-sky one, so the existing 2D solver runs on its
floor and is correct everywhere a heightfield was, plus correct inside a crater
carved after the fill. Lower spans are where tunnel water goes.

Three details earn their place:

- **A gap with no solid beneath it is not a span.** It runs out of the bubble.
  Emitting it would hand the solver a floor that is not there.
- **`clampToCeiling` returns the overflow** rather than dropping it. The solver
  was written for open ground and knows nothing about roofs; without this a
  flooded tunnel fills past its ceiling and the surface draws inside rock. The
  excess is returned because water that cannot rise has not stopped existing.
- **Drainage comes from the voxel, not from a biome.** Each column soaks at the
  permeability of the substance its floor is made of. Carve down to granite and
  the pit stops leaking, because granite is what the pit floor now is.

**The bed is DERIVED, never kept alongside.** On the heightfield page a carve
had to be applied twice — once to the mesh, once to the solver — and when I
forgot the mesh, water ran along a trench that was never drawn. That class of
bug cannot occur here.

Measured at `?step=volume` with the crater on: the basin fills, overflows and
spills down the slope. Pool 44.85 + soaked 0.18 + ran off 1.09 = 46.12 m³
against 46.12 poured.

### The water sheet cut through the crater wall

Found by Remy, zoomed in on the crater. The water surface is one grid over the
whole patch. A quad with one corner in the flooded crater and three on the dry
rim spans from the crater floor to the rim, and it drew a pale blade straight
THROUGH the wall.

Fading opacity at dry vertices does not fix this, and that is the trap. Opacity
interpolates across a triangle, so a face with one wet corner still draws the
whole span as a fading wedge. The fault is the face existing, not its shading.

`waterSheet.ts` rebuilds the index buffer each frame and emits only the quads
that may be drawn. The first rule was "all four corners wet". It removed the
blade and cost too much: the shoreline snapped to cell boundaries and read as a
staircase, because it punished every edge for a fault only steep ones have.

The rule is RELIEF. A partly wet quad is drawn when its four bed heights are
close together, and dropped when they are not. Flat ground keeps a soft
waterline; a crater rim, where the bed falls away inside one cell, emits
nothing.

Two smaller faults came out of the same review:

- The preview kept its own enum-to-name table for the pointer probe. When the
  enum grew from 6 substances to 18, the table silently mapped value 4 to
  'bedrock' — and 4 had become topsoil. It reported bedrock while pointing at
  soil, which is worse than reporting nothing. It reads the registry now.
- Water roughness at 0.22 burned a white flare across the lake under the review
  light, which read as a hole in the surface. It is 0.42.

---

## The sandbox, and what "smaller triangles" actually means (2026-08-08)

`?step=volume` became a sandbox: sizes to 240 m, seven shaping tools, a
draggable spring, and a pour toggle separate from the water itself.

**Triangle size is not a knob.** The world is voxels; the triangles are a view
of them, one vertex per boundary cell. Halving the voxel is the only way to get
smaller triangles, and it costs eight times the cells:

| voxels | cells | triangles | mesh |
|---|---|---|---|
| 240 m @ 2 m | 120³ | 121k | 0.6 s |
| 240 m @ 1 m | 240³ | 484k | 3.0 s |
| 240 m @ 50 cm | 480³ | 1.9M | 20 s |

**Brick skipping.** The mesher walked every cell, so a bubble holding 13.8
million cells in half a megabyte paid for all of them. It now skips any brick
that is uniform with its six neighbors and runs the y loop over the surface
band. `VoxelVolume.brickMaterial` exposes the sparsity that made this possible
and that the mesher had been ignoring since it was written.

**The remaining cost cliff is the re-mesh, not the edit.** A brush stroke takes
1 to 5 ms; the whole-volume re-mesh after it takes 3 seconds at 240 m. Region
re-meshing is the fix, and `applyBrush` already returns the cell bounds it
touched.

### Three faults found by looking, in one session

**Depth was measured against the wrong surface.** Vertex color used the analytic
GroundWorld height while the mesh is quantized to the cell. At 1 m cells the two
disagree by up to a metre, that difference sweeps across the litter boundary at
12 cm, and the hillside drew itself in swirling false contours. Depth now comes
from the volume's own column top, with a deadband of three quarters of a cell so
the top surface reads as the top surface instead of banding.

**The water sheet climbed the bank.** The relief budget was `cellM * 1.4`, which
permits a quad dropping a whole cell — and a whole cell IS the bank. At 1 m
voxels every shoreline quad spans exactly one step, so all of them passed and the
sheet drew over the cut wall behind it. The budget is now `0.7` of a cell:
below one, so a full step is always rejected.

**The scene shift came from the mesh bounding box.** Any edit that changed the
bounds moved the whole world under the camera. It comes from the volume's center
now, which is fixed for the volume's lifetime.

### Reading a real capture (2026-08-08)

Remy's WebGL capture, 1442 frames over 35.2 s:

```
fps    41.0 mean · 18.9 at the 5% worst frames
frame  24.4 mean · 16.7 median · 52.8 p95 · 124.2 worst
stalls 315 frames over 33 ms (21.8%)
peak   5 draw calls · 552,854 triangles
```

**CPU-bound, not GPU-bound.** 552k triangles in five draw calls, no textures,
at 920x429, is nothing for a GPU. The shape is the tell: a median of 16.7 ms is
a clean sixty, so most frames are cheap, and a fifth do heavy extra work.

Three faults in the water frame, all mine:

**The solver budget was derived from the frame time.** `floor(dt / step)`, capped
at six, makes a slow frame do MORE solver work and therefore run slower still.
The cost of one frame fed the cost of the next, which is exactly how a bimodal
profile is produced. It is a constant now. Water runs at a fixed rate per frame
rather than per second — the right trade for a sandbox, where a predictable cost
beats wall-clock fidelity.

**`computeVertexNormals` ran every frame.** It walks the entire index buffer,
accumulates a face normal into three vertices per triangle, then normalizes
every vertex: 345,600 index reads and 57,600 normalizations per frame. It also
ignores `drawRange`, so it walked the stale quads beyond the current count. The
water surface is a height field, so its normal is exact from two central
differences. One pass, no index walk, no allocation.

**The whole index buffer was re-uploaded every frame.** `needsUpdate` alone sends
all 345,600 entries — 1.4 MB — most of it past the draw range and never read.
`addUpdateRange(0, count)` sends only what is drawn.

A note for the next capture: `resetFrames` deliberately keeps span attribution,
so a rebuild does not erase where the time went.

### Correction: two captures, two different tests (2026-08-08)

The section above compares two captures and credits the fixes with the
difference. That comparison is not valid, and the surface line says so:

| | first | second |
|---|---|---|
| surface | 920x429 at dpr 1 | 1853x1246 at dpr 1.5 |
| pixels | 395,000 | 2,310,000 |

Nearly six times the pixels. Any read of "before and after" across those two is
worthless, and I made one anyway by looking at the fps line and not the surface
line.

**What the second capture does say on its own**, without reference to the first:

- `gpu 11% · cpu 28%`. Neither path is busy. About 8.6 ms of measured work sits
  inside a 22.2 ms frame, so most of the frame is spent waiting on something
  that is not draw work and not solver work.
- Geometries rose from 5 to 9 and the heap from 214 MB to 447 MB.

**What is proven, and what is not.** The leak is proven: there was no `dispose`
call in either preview file, and a new `BufferGeometry` is built on every
re-mesh. That is a fact about the code, verified by reading it.

The link from that leak to the STALLS is NOT proven. No garbage-collection pause
was observed. The chain "leak, heap, collector, stall" fits the numbers and is
an inference, not a measurement. Three tests would settle it, and each can
falsify a claim rather than merely agree with one:

1. Capture with the water off. Stalls that survive that are not the water path.
2. Capture without touching a brush. No edit means no re-mesh and no new
   geometry; a heap that still climbs is not climbing because of this leak.
3. Read the spans. Small `solver` and `water mesh` against a 22 ms frame puts
   the time outside this code entirely.

The disposal fix stands on its own merits either way. Leaked geometry is wrong
whether or not it is the cause of these particular stalls.

### The stalls were the MOUSE (2026-08-08)

Remy found it, from feel rather than from a number: "moving the mouse over the
ground does a lot of changing in the fps."

Two causes, both mine, both in the input path rather than in any of the places I
had been looking.

**R3F pointer props on a 553,220-triangle mesh.** React Three Fiber raycasts the
scene on every `pointermove` to work out enter and leave, and `THREE.Mesh.raycast`
is a brute-force triangle walk with no acceleration structure. So every mouse
move scanned half a million triangles, and pointer events fire faster than
frames. It matches the profile exactly: a 16.7 ms median while the mouse is
still, a 48 ms p95 while it moves. Intermittent input, intermittent stalls.

The irony is that this page already had a fast ray. `raycastVoxels` marches the
voxel grid and touches a few hundred cells. No object in the scene carries a
pointer handler now — hover, brush clicks and the spring drag all run off one
DDA ray fired from a DOM listener. Grabbing the spring became a ray-versus-sphere
test, because a handler on the marker alone is enough to re-enable the
scene-wide raycast.

**A setState per pointer move.** Remy again: "it does the 'pointing at <ground
type>' at breakneck speeds." Each one re-rendered the page and made R3F
reconcile the whole scene graph. The reading goes into a ref now and reaches
React twice a second, at his suggestion. A material readout is something you
read, not something you watch.

**The lesson about method, not about three.js.** I spent two rounds on garbage
collection and geometry disposal — both real faults, neither the cause — because
I read aggregate numbers and never asked what the user was DOING when the
numbers moved. A capture says what happened. It does not say what triggered it.
The person holding the mouse knows.

---

## The four open items are closed (2026-08-09)

This record listed four consequences that were named but not built: two water
models with no seam, a fluid that collided against a height, a fill that blocked
the main thread, and a volume that existed only on a sandbox page. All four are
built, measured and proved on a live surface. Item 5 — sparse compute — is still
open, and is still the correct next step.

**Item 1, the two water models meet.** `waterHandoff.ts` is the contract, and it
is plain data: a sheet is any object with `n`, `cellM` and a `depth` array, so a
test can hand over three fields instead of building a solver. The rule that
carries the file is that **a particle is a quantum of volume**. The sheet is
debited in WHOLE particles and never by the amount requested, so a request for
1.7 quanta moves 1 and leaves 0.7 where it was; rounding the request would
manufacture or destroy the remainder at frame rate. Every particle carries that
quantum for its whole life, so the volume a domain holds is `live * quantum` — a
product, not a sum, and it cannot drift however long the domain runs. Volume
aimed off the grid is returned as `strandedM3` and booked against the boundary
ledger, never dropped. `mpmDomain.ts` is the bounded CPU MLS-MPM domain the
sheet feeds: it runs the same five kernels as the GPU sim and adds the one thing
the GPU sim does not need — a lifecycle, because a particle at rest hands its
mass back and a resting body of water is the sheet's job. Measured on
`?step=volume`, the printed identity equalled `poured` at all 24 samples across
three phases, and a domain parked mid-fall returned every cubic meter:
`toParticles 4.7188 = inFlight 0.0000 + toSheet 4.7188 + stranded 0.0000`.

**Item 2, the GPU fluid collides against the volume.** The sim read one float
per column, which is the heightfield assumption this record exists to break.
`spanField.ts` packs what `volumeSurface.columnSpans` already reads into one
flat array a storage buffer binds directly. A census over every world this repo
builds gave the width: **one span, plus one more for every void with rock over
it**, so a vertical shaft adds none and no measured world exceeds two.
`SPAN_SLOTS = 2` packs a column into exactly one vec4 — the same number of
buffer elements as the single float it replaced. The encoding needs no count: a
short column pads by REPLICATING its last real pair, so "take the first slot
whose floor is at or below y, else the last" resolves with no length, no branch
and no second buffer, identically on the CPU and in TSL. The lateral wall then
comes free, because the bilinear floor climbs from a tunnel floor to the
hillside inside one cell and its tangent plane points back into the passage. Two
bugs came with it, and the second is the one to remember: **capping the vertical
lift at one cell is a cliff**, and under a dam head 2,400 of 100,000 particles
slipped past it into rock. The fix asks the SURFACE, not the depth — `nrm.y`
near 1 is a floor and clamps vertically at any depth, near 0 is a wall and the
only honest response is to push out of it. Measured on the real GPU: about
**10,000 particles in a void with rock over it**, held for 35 simulated seconds,
the adit entered at one mouth and discharging at the other, at **+0.06 ms per
frame (+2.7%)**.

**Item 3, the fill runs in a worker.** `volumeBubbleCore.ts` holds the whole
build as pure functions — fill, datum capture, slab plan, slab mesh, rim blend,
transfer lists — with no worker, no three.js and no `GroundWorld` in it, so
vitest exercises all of it. `VoxelVolume.snapshot()` is what makes the crossing
cheap: the storage is an array of brick objects, which is exactly what
structured clone is worst at, so it flattens to two `Uint8Array`s — one byte per
brick, then the cells of every allocated brick concatenated in ascending brick
index. Order is implied, so no index table travels, and **nothing is cloned**:
every buffer is named in the transfer list. There is ONE owner and never two —
the worker fills, transfers, and is done; the main thread's `fromSnapshot`
produces the only live copy, so no edit channel and no second source of truth
can drift. Slabs are delivered in order of distance from the bubble's vertical
middle, where the terrain surface is, so the ground under the player is drawn
while the buried rock is still being walked. The slab size is a draw-call
decision and was measured: 64³ ships at 78 draw calls with the first ground
visible 37 ms in. **The main thread's entire share of a 256³ bubble is 28 ms, in
pieces of at most 1.1 ms**, against roughly 2.9 seconds of hard block before.

**Item 4, the volume is in the live world.** `VolumeGroundBubble` mounts in
`World3DScene` under the ground profile, builds a 64 m / 25 cm bubble around the
player from the same `GroundWorld` the streamed terrain meshes, and rebuilds
when the player has walked a quarter of the extent. **The seam is geometric and
needs nothing from the renderer.** The fill height is offset by radius: inside
24 m the bubble is lifted 1.2 cells (30 cm), because the fill makes a column
solid up to `floor(...)` and the drawn surface therefore lands up to one cell
below the height it was filled from; over the last 8 m the lift ramps down
through zero to −1.2 m, so the rim and its cut wall finish under the terrain.
What the camera sees is the higher of two continuous surfaces, and that is
continuous. Measured on cell 1240, the hard mountain case: 24,344 core columns,
mean +0.283 m, worst +0.155 m, **0 columns below the terrain**. The band where a
depth fight is even possible is about 0.5 m of radius wide. Cost on the page:
about 60 draw calls and 539,000 triangles.

### Three lessons worth more than the code

**Ledger honesty: a term that prints only when it is non-zero teaches the reader
to stop looking for it.** Every water figure on `?step=volume` prints at all
times, including the particles term and the unpictured clause, and including
"0.0" — because "0.0" and "not measured" must not look the same. The same
principle caught a subtler fault: the handoff had to run BEFORE the transit
ledger splits the field, not after, or one frame of particle volume would be
counted in the sheet AND in the domain — and the printed sum would still have
been right, which is exactly what would have let it survive. A picture must be
honest by the same rule: film-covered cells count as pictured only to two cells
of depth, so "0.0 m³ unpictured" over a thousand invisible cubic meters is now
structurally impossible.

**A dead kernel is fast.** The first cost measurement for item 2 reported +97%
and was garbage. The "before" variant emitted invalid WGSL, every dispatch was
dropped in silence, and four rounds of ablation chased a cost that did not
exist. Invalid WGSL produces a silent no-op plus an entry in the device error
list — never a JS exception. **Never report a GPU number unless the water moved
in the same run and the device error list is empty.** The harness refuses to
print one otherwise.

**The height a surface DRAWS is not the height it STORES.** `groundSurfaceY`
interpolates the 1.524 m cell grid; the streamed mesh samples that on an 8 m
lattice and draws flat triangles between. Over one bubble footprint the two
differ by mean 0.26 m and up to 1.30 m, so a bubble built from the detail
surface carries relief the world around it does not have, and tears at its edge.
`streamedTerrainSurfaceY` reproduces the lattice exactly. The first version of
it interpolated the lattice quad BILINEARLY, with a comment arguing the error
was far below the 25 cm quantization — true on a hillside, and wrong on a
mountain, where eight meters of relief sit inside one 8 m quad. **The first live
capture came back perforated**, a lace of holes with pale terrain poking
through. The sampler picks its triangle by `fx + fz` and evaluates that plane
now: the same arithmetic cost, exact instead of nearly right, 0.00% holes.

### One shader, one copy

The substance ground material grew over nine critic rounds inside
`PreviewVolumeGround.tsx`. The live world draws the same voxels, so the material
moved to `src/components/World3D/terrain/substanceGroundMaterial.ts` and both
surfaces call it. Two copies of a shader that is judged by eye cannot be kept in
step, and the first divergence would be a fault nobody could see, because both
pictures would look plausible.

### What is still open

**Item 5, sparse compute, is unchanged and is still the route out of 25 cm.**
Brick allocation on the GPU, dispatched over a live list of bricks that can hold
water, restores 64 m at 12 cm for roughly 100 MB.

**The bubble is the wrong color.** The join is geometrically seamless and
tonally a hard edge: the material's top band is the fixed `DEFAULT_STACK`
(forest litter) while the streamed terrain is biome-tinted, so a dark disc sits
on a pale mountain. Either the bubble imitates the heightfield — build the band
stack per column from `BIOME_GROUND`, which exists for this — or the heightfield
imitates the bubble, because the substance registry is the more honest ground
description. They point in opposite directions and the second is a look
decision. Remy's call.

**69% of the bubble's triangles are a seal nobody can see.** Of 686,120
triangles, 472,712 are the outer boundary cap. It is drawn because this record
holds a hard-won lesson about an unsealed volume, and that will not be quietly
re-opened. It can go if a camera can never get below grade near the player, or
it disappears entirely if the bubble stops being a cube and becomes 64 m wide by
about 16 m tall.

**0.5% of GPU particles sit inside rock at a bore wall.** Transient, about 90%
within one cell of the boundary, worst case five cells, zero on the CPU twin.
The options are to leave it (a 25 cm step is already an accepted limit here and
nothing is visible in any frame), to widen the standoff at the cost of tunnel
width, or to give the wall a real lateral test — which would be the first place
this design stops being one rule.

**Water inside a tunnel cannot be pictured yet.** The screen-space surface
shades against what is behind the water, so with rock in front it shows nothing;
the particle look shows the body plainly but only with the rock hidden. The
answer is a section cut through the volume mesh, so rock and the water inside it
appear in one frame. That is a look decision and new machinery.

**Particles are the splash, not the fall.** At 0.5 m spacing a particle is
0.031 m³, so a 1,200 budget holds 37 m³ against roughly 600 m³ in transit down a
100 m shaft. Coarser particles carry more and read less like droplets. What the
particles should BE is Remy's call.

**Smaller open calls, recorded so they are not re-derived:** the rim notches
steep faces and wants a slope-aware ramp; the player avatar plants on a third
surface again (`groundSurfaceY`) and should move onto `voxelCollide`;
`SPAN_SLOTS` is 2 and stacked passages would want 4; the visual blend where
particles meet the sheet has never been judged by eye; and the volume sandbox
loses its carved world to any fleet edit of its import graph, because Vite Fast
Refresh rebuilds the `useMemo` caches — a tripwire logs the cause now, but
persisting the world across a refresh is not built.

---

## The Land era (2026-08-10/11)

**One concept, one place; move, alias, delete.** Four consolidations landed in one rhythm. The water page extracted its costume into `waterLook.ts` — the whole nine-round tuning lives in one place, so the sandbox and pane cannot drift (`waterpage-relief.md`). The biomes step moved to the Land page as six tabs over real atlas cells (`biomes-move.md`), and `?step=biomes3d` now redirects to `?step=land&biome=forest`. The Volume Ground step renamed to Land; `?step=volume`, `?step=environment` and `?step=3d` are aliases. The glossary went Agora-live (`glossary-agora.md`), moving 18 material cards to the shared tile service. Every consolidation obeyed the rule: **move the one copy once, cut the rest**.

**The Land page holds tabs, sizes, types, spells, sky, trees, and water.** Six biome tabs land on real cells at real stacks — each one purity-measured and drawn from `BIOME_GROUND` with no hard-coded defaults. The Width and Height rows (`landsize.md`) yield independent dimensions: the sandbox defaults to 240 × 64 m (a slab), cutting the old cube's triangles by 31 percent with zero interior-surface loss. Land Types (`landtypes.md`) opens a panel of substance cards — each band's name, depth, and registry numbers turned to plain words, with a swatch renderer showing the real material under both presets and sandbox lights. The Mold Earth spell raises or lowers ground through the ordinary carve path, keeping the water ledger exact by construction. The Time slider drives `sunAtHour` in both light modes, anchoring noon to the biome's preset and sweeping dawn and dusk through azimuth alone. The Trees panel (`land-consolidation.md`) edits presets per-level, standing the tree on real ground under real lights. The Water toggle arms the thin layer or droplets in the same scene; the Settling toggle runs the avalanche solver or holds.

**The carve moved 1,951 ms to 73 ms; 360 m loads in 118 ms instead of 4,929.** The first ground draws in 6.5 seconds instead of 9–12 (`chunkperf.md`, `loadperf.md`). Attribution, by surviving block: the dev bundle compiles once on a cold tab (1.3 seconds, V8 parse, not this page). The substance ground's shader links off the main thread by 0.23 s through a warm set built during the worker's terrain wait. The water's own programs arrive in one 0.17 s block. Everything else resolved under 0.1 s per phase — chunk mounting, water solver steps, re-meshes — because chunk geometry left React, the water rig left the props to a stable pointer, and the ground world moved to the worker (`chunkperf.md` §1, `loadperf.md` §1–2, `hydroworker.md` §3).

**Two solver bugs surface when you run them.** The settle law reads meter-slopes on a non-cubic lattice (`granularSettle.ts` + `settle-hooks.md`); the combat arena's 0.15 m vertical cells were reading 17 degrees as 45 degrees until `cellHM` arrived. A column that sheds its cap over a void used to report its top on the void itself — one cell too high, the exact width of the activation threshold, so a carved arena reported rest while a fresh field found eight unstable columns. Droplets arrive with gravity calibrated per spacing (`voldroplets.md` §1): vendor MPM at 0.5 m spacing throws them at 8.8 *g*, at 2.5 m fires them at 432 m/s². The calibration reads **9.81 m/s²** at every size, proven by integrating a real free fall. Sparse bricks on the GPU (parked, `impl-8-checkpoint`) hold 0.23% of cells at 12.5 cm across 113 MB at full 64 fps — dense would cost 2.5 GB — with the property that an unallocated brick is a solid wall, so mass conserves to the bit whatever the allocator does.

**The page broke mid-reload because a lazy chunk appeared after the dep cache was written.** `?step=water`, click Droplets, click Start, and the design preview went blank. No exception, no error boundary trigger — the dev server discovered `three/webgpu` and `three/tsl` at runtime, re-bundled them, and broadcast a full reload. The reload landed while esbuild was still writing, so React never mounted (`waterfix.md`). The fix is one line in `vite.config.ts`: name the two in `optimizeDeps.include` and they join the FIRST optimize pass. The volume page's own mid-carve page loss was the same cause, caught live: an IMPL-1 worker file save forces a full reload; a tripwire logs it and HMR-survival is specced. A per-pane error boundary now wraps each water pane's scene, keeps the page alive, and records the crash on `window.__waterPaneCrash`.

**Open calls for Remy — the decision stack.** **D0**: Which water — thin layer at full presentation on relief terrain (the argument: frame 04 shows the legacy grid heaping water at the spring while the thin layer runs the gully, drops the cliff, pools the basin). **D1**: Ground palette direction — the tint shipped at full strength; re-shoot the rim with the winding bug fixed before ruling. **D2**: Particles as splash or fall — coarser quanta carry more but stop reading as droplets. **D3**: The 69% invisible seal — the slab cut 168,960 triangles, 99.85% of them seal; the floor is the next prize. **D4**: Picturing water behind rock — a section cut through the volume, an x-ray silhouette, or accept. **D5**: In-rock particle tolerance — 0.5% sit transiently inside the bore; widen standoff or real lateral test. **D6**: SPAN_SLOTS headroom — stay at 2 until overflow says otherwise. **D7**: Final Fable wow gates — one critic per piece or the record stands. **D8**: W2 grazing skim puff — look pass or accept as honest. **D9**: Registry look collisions — differentiate or accept. **D10**: Snow line unreachable — lower it or accept. **D11**: Preset sky vs sandbox light — keep both, keep one, or retune the presets. **D12**: Side-by-side solver budget — budget the thin solver in split view only, or elsewhere. **D13**: Nothing left under 100 ms except the bundle and the shader, so this is the ceiling for the tab's own work. **World hydrology** — the runoff and permeability model, specced, waiting on the work order. **Sparse-droplet repoint** — the census-sized brick allocation carries to the particle grid (50 MB vs 2 GB dense), the same path whether Remy picks thin layer or droplets. **WebGPU sandbox-port** — a second canvas overlay with shared-depth particles, rejected on the water page and marked as the right shape on a different page.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/adr/0002-volume-ground-and-gpu-fluid.md","sha256WithoutMarker":"3b9fc85c25c0481fe0edc99223afb951e46d75b4b5a1f743909396f7fce0c3db","markedAtUtc":"2026-08-09T20:24:28.240Z"} -->
