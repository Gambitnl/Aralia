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
