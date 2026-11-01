# 9. The game's 3D world moves to WebGPU, so the live river's water can run in it

Date: 2026-10-26

## Status

**Accepted.** Remy chose option 1 of three on 2026-10-26 ("1"), during the water campaign whose goal is: water that looks and moves like water everywhere, that players can reshape with spells, inside a quarter of each frame, then in the game's 3D world.

## Context

The game's 3D world (`src/components/World3D/World3DScene.tsx`) draws with an R3F canvas on three's WebGL renderer. Its water is static ribbons and lake polygons at a fixed waterline, with a scrolling ripple and no flow (GG-327).

The live river draws with three's WebGPURenderer and TSL node materials since 2026-09-30 (`riverReachScene.ts`, `riverWaterMaterial.ts`). Its solver, its falling sheet, its landing spray, its warm start and the spells that reshape its ground (`riverSpells.ts`, 2026-10-25) all exist only on that path. ADR 0006 already named the world's WebGL renderer as the obstacle to one water.

Three ways were put to Remy:

1. Move the game world to WebGPU. The river then runs there as it is: one water system.
2. Build a WebGL copy of the river's water drawing. Smaller now, but two copies of the water look must then be kept in step, against the one-water rule.
3. Use the battle map's simpler shallow-water field in the world. It runs on WebGL and keeps mass, but it does not look like the river.

## Decision

The game's 3D world moves to WebGPURenderer. The live river's water, its solver and its spells mount inside the world unchanged. There is one water drawing and one solver for the whole game.

- The move is staged. A URL flag selects the WebGPU world while each custom WebGL shader is ported to a TSL node material. When every part draws, the WebGL path is removed; the end state has one renderer, not a fallback.
- Built-in three materials convert by themselves. Each custom GLSL shader (`ShaderMaterial`, `onBeforeCompile`, postprocessing passes) is ported to TSL, one group at a time, with a rendered check of each group.
- The frame budget of the water campaign holds in the world too: a steady 60 fps at 2560 x 1440, with the water inside a quarter of each frame.

## Consequences

- Every custom shader in the world's render path must be rewritten in TSL. The inventory of those shaders and the order of work are recorded in `docs/architecture/domains/world3d-river-water.md` ("Spells, water cost and the game world on WebGPU").
- The known three r172 WebGPU faults apply to the world (fog applied twice, hemisphere-light space, alpha-to-coverage, shadow alpha, per-camera shadows, instance count, MSAA mip maps, read-back padding). Each ported group is checked for them.
- Surfaces that share World3D components (the battle map 3D view, the town view, Design Preview steps) move with it or keep a WebGL copy until their own move. Each such copy is listed as a gap, not left silent.
- Option 2 is rejected because two water drawings drift apart. Option 3 is rejected because it does not give the river's look, behavior or spells.

## Amendment: the live water is the only water (2026-10-30)

Remy saw two different rivers in the game world on 2026-10-30. The world draws a static water sheet on every river (`waterGeometry.ts`, drawn by `WaterPiece`), and under `?gpu=1&riverSite=world` the live river replaces it in one 350 m x 140 m box. Remy ruled: "the physics realistic water" of the river and waterfall pages "is the only water that realistically should be used", and agreed to make one water system.

- The static sheet is a staging part, not a second water. It is removed, not improved. Until then it only gets fixes that keep it from breaking.
- Every river, lake and town channel in the game world comes from the live solver and draws with the live water layer (`RiverWaterLayer`). The sea joins it by ADR 0006.
- Far water is the same solver on coarser cells, not a cheaper look-alike: one look and one physics at every distance.
- The order of work is in `docs/architecture/domains/world3d-river-water.md`, "One water in the game world".
