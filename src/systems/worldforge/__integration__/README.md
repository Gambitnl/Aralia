# Worldforge Integration Suite

This folder guards the full procedural chain, not one generator at a time.
The unit suites for atlas, region, local, delta, and world storage can all be
green while a boundary between them drifts. `pipeline.test.ts` catches that by
running a fixed world through:

1. `createWorld`
2. `generateFmgWorld`
3. `generateRegion`
4. `generateLocal`
5. `WorldStore.serialize()` / `WorldStore.deserialize()`

## Frozen Chain Golden

The primary chain uses:

- seed string: `world-42`
- world seed: `42`
- template: `continents`
- cells desired: `10000`
- anchor cell: `110`
- feet per FMG pixel: `1000`

The frozen values are the atlas cell count, a strided region-heightfield hash,
and the full local material-index hash. If a layer legitimately changes its
deterministic output, update these numbers only after checking the layer-level
tests and confirming the chain change is intentional.

## Continuity Tolerances

Water continuity samples atlas water cells that fall inside the anchor-110
region. The default local center does not currently include those water cells,
so the test centers a local artifact on the sampled water point and requires:

- nearest region sample height `< 0.2`
- local 5 ft cell material exactly `water`

Road continuity uses the same fixed world but anchor cell `476`, because anchor
`110` currently produces no region roads. The tolerance is material-level:
at least one region road centerline sample inside local bounds must land on a
local `paved` or `dirt` cell.

## Regenerating Goldens

Run:

```powershell
npx vitest run src/systems/worldforge/__integration__/
```

If the chain golden fails, do not update it as routine cleanup. First verify
which layer changed, confirm the change is intended, and record the reason in
the lane or project report that owns the change. The chain golden freezes at
acceptance just like the layer goldens.
