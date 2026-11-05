# Character body proportions and GPU cloth

Verified: 2026-11-05 for every section below, against `src/systems/entities3d/`.

## Purpose

This doc says how a biped body gets its sizes and how a worn garment moves as cloth.
Plan and status: `public/planmap/topics.json`, topic `character-cloth-armor`. Open work:
GG-621 to GG-627 in `docs/projects/GLOBAL_GAPS.md`.

## Body sizes

- A `Frame` (`types.ts`) holds the authored knobs: height, bulk, head scale, limb, arm,
  shoulder and stance lengths, the optional hunch, and the optional `style`.
- `bipedBodyRadii(frame)` (`three/skeletonBuilder.ts`) is the ONE source of every limb,
  hand and foot radius. `bipedRestPose` (the bind pose of the skinned loft) and
  `BipedDriver.buildBody` (`three/gaits/bipedDriver.ts`) both read it. Before
  2026-11-05 each file kept a mirrored copy of the formulas.
- `heroicFrame(frame)` sets `style: 'heroic'` and scales the knobs to the target look
  (about 5 heads tall, 2.8-head shoulders, short legs). The style also turns on these
  rules in `bipedBodyRadii`: a club forearm (wrist 0.82 of the elbow), a larger deltoid, a
  larger hand floor and a larger boot. The loft (`three/smoothBipedGeometry.ts`) uses the
  soft pec ladder on heroic frames, and `assembleEntity.ts` widens the jaw by 1.25.
- Today only the Entity Forge applies `heroicFrame` (body A/B, `?body=1`). Game surfaces
  use the plain frame (GG-627).
- `__tests__/heroicBody.test.ts` measures the bind pose in head-units against the target.

## GPU cloth

- Code: `three/cloth/`. A garment is a `ClothGarment` (a world-space mesh plus its pins
  and colliders). One `ClothSystem` per WebGL renderer steps every garment on the GPU,
  from the garment mesh's `onBeforeRender`, so the bones are current.
- Turn it on with `assembleEntity(..., { garments: 'cloth' })` (the `Entity3D` prop
  `garments`). It needs a skinned smooth biped and throws on any other body.
- Colliders (`bodyColliders.ts`): 20 rounded sections fitted to the drawn skin. Each keeps
  the section exponent (2 = ellipse to 4 = rounded box) that floats least over its skin,
  and carries its cloth margin. A point inside two colliders takes the shortest exit that
  is clear of all of them; the body outranks a hand.
- Time: up to 8 substeps per frame; pins and colliders blend across the substeps. A frame
  longer than 0.25 s, or a pin jump over 2 m, restarts the garment from its rest drape.
- Only the cape exists (`garmentPanels.ts`, GG-623). The rendered check is
  `node scripts/verification/clothClearance.mjs` (it needs the dev server). It fails when
  a cloth point goes more than 1 mm through the drawn skin.
