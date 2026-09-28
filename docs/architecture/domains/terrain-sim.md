# Terrain Sim - ground scars and scar marks

Verified: 2026-09-09

How actor-made changes to the ground are stored, healed, and read NOW. The
vocabulary is fixed by `CONTEXT.md` ("Ground and terrain", "What a spell leaves
behind") and is not negotiable inside this system.

## What it is

`src/systems/worldforge/terrainsim/` owns the ground a spell, a siege engine, or
a shovel changed - as opposed to the ground the generator produced, which is
`region-terrain.md` and the battle-map generator.

Three things a spell can leave behind, and this system holds two of them:

| Thing | Home | Changes height? |
|---|---|---|
| Ground scar | this system, `TerrainSimState.scars` | yes |
| Scar mark (incl. surface treatments) | this system, `TerrainSimState.marks` | no, colour only |
| Conjured structure | NOT here - a world object on unchanged earth | no |

## Files

- `types.ts` - `GroundScar`, `ScarMark`, `ScarShape`, `TerrainSimState`,
  `TerrainSimRegistry`. Plain serializable records; no classes, no Three.js.
- `scarCauses.ts` - the per-cause table (`fire`, `blast`, `excavation`,
  `flood`): heal rate, weathering rate, mark tint. This file is CONTEXT.md's
  "two scars of the same shape and different causes grow back differently",
  in numbers.
- `groundScar.ts` - geometry. Footprint weight, depth at a point, the height
  offset field, the mark tint field. Pure math, no time.
- `terrainSim.ts` - time. `advanceTerrainSim(state, toDay)` and
  `advanceTerrainRegistry`.
- `spellScarFootprint.ts` - the spell -> ground table. The only place that
  decides "Fireball scorches, Shatter craters, Move Earth cuts".
- `index.ts` - the barrel every caller should import from.

## The model

A `GroundScar` has a shape (`bowl`, `channel`, or `patch`), a `depthM`, a
`cause`, and a `bornDay`. `depthM` is measured DOWNWARD, so a crater is positive
and a raised mound is negative.

Heal is linear: `depthM` loses `healMetersPerDay` per in-game day and moves
toward zero from either side. Linearity is deliberate - it makes healing
**chunking-independent**, so advancing 100 days in one call lands on exactly the
state two 50-day calls produce. A scar whose depth depended on how the player
spent their time would be a save-visible bug, and the town sim needed per-day
reseeding to get the same guarantee.

When a scar reaches zero depth its record ENDS and a `ScarMark` begins, dated
the day it actually finished - not the day the player reloaded. A mark does not
expire; what fades is its `weathering` (0 fresh -> 1 fully weathered), and even
a fully weathered mark keeps a faint tint. `pruneScarMarks` is an opt-in save
size valve, not an expiry: the sim never calls it.

A **surface treatment** (a scorch, grease, ice) skips the scar stage entirely
and is added straight to `marks` via `addScarMark`. That is why `spellTerrainFootprint`
returns a mark and no scar for Fire and Lightning: `CONTEXT.md` classifies a
scorch as a surface treatment, and giving it depth would merge two things the
glossary says not to merge.

## Local windows and catch-up

`TerrainSimState` covers ONE local window (the generated square of ground the
player occupies) and holds `lastSimDay`. `TerrainSimRegistry` keys states by
window id. This mirrors `../../../src/systems/worldforge/townsim/townSimRegistry.ts`
deliberately: same catch-up-on-load shape, same "pure functions return new
state" discipline.

## Reading it back

- Height: `makeScarHeightField(scars)` gives metres to ADD to the generated
  ground (negative inside a pit). `makeScarHeightFieldForGrid(scars, metersPerUnit)`
  is the same field sampled in a grid space - the battle map's height sampler
  takes TILE coordinates horizontally and returns metres vertically, so it needs
  the converting form.
- Colour: `scarMarkTintAt(marks, x, z)` gives a linear-RGB multiplier for the
  ground, `[1,1,1]` on clean ground.

Overlapping scars take the DEEPEST rather than summing. Summation is what turns
a busy battle into a canyon.

## Render integration status (2026-09-09)

`makeTerrainHeightSampler` (`src/components/BattleMap/terrain/terrainHeightSampler.ts`)
- the single source of the combat map's ground surface, shared by the
heightfield, the skirt, the grass and scatter layers, the water depth bake, and
the voxel arena fill - now takes an optional
`{ scarHeightOffsetM }`. Passing the terrain sim's field there moves every one of
those consumers at once, and a scar is added AFTER the bicubic filter so it is
not smeared and heals back to the exact generated height.

NOT wired yet, and the next slice:

- No call site passes `scarHeightOffsetM` yet. `BattleMap3D.tsx` and
  `BattleMap3DGpuScene.tsx` build their own samplers and need the window's scar
  list threaded in.
- The mark tint has no consumer. `terrainSurfaceMaterial.ts` needs a
  `scarMarkTintAt` sample folded into its ground colour.
- Nothing calls `spellTerrainFootprint` from combat resolution yet, so no scar
  is created in play. The seam is a spell landing with a resolved impact point.
- No `TerrainSimRegistry` lives in game state or a save yet, and nothing calls
  `advanceTerrainRegistry` on day change.
