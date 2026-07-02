# Styled Procedural Town Architecture — Design

**Date:** 2026-07-01
**Status:** Approved by Remy (brainstorm 2026-07-01)
**Program:** Worldforge canonical-town, deferred follow-up #1 (from
`docs/superpowers/plans/2026-06-27-retire-legacy-generateTownPlan-HANDOVER.md`),
expanded by decision to full-town architectural styling.

## Problem

The 3D ground renderer draws every town the same way regardless of who built it:

- Every building is one oriented box with a pyramid (hip) roof in a hardcoded
  brown (`World3DScene.tsx` SiteBuilding), door slab + windows. No shape variety,
  no regional identity.
- The town wall is an extruded ribbon (`wallGeometry.ts`) that opens only for
  river water-gates. The plan's **gatehouses** (`adapted.walls.gatehouses`,
  produced by `townEngine.buildWalls`) are never rendered and the wall is SOLID
  where main streets enter — streets dead-end into stone.
- Docks and bridges render as flat tinted deck slabs (`deckGeometry.ts`) with no
  support posts, piers, or railings — floating planks.

## Decisions (interview, 2026-07-01)

1. **Scope:** all three — road gates, gatehouse structures, dock/bridge polish —
   PLUS architectural shape/look variety for ordinary buildings, all in this slice.
2. **Buildings must not be single-form.** Multiple looks and shapes, varying by
   region and architecture style.
3. **Approach: real modeled assets** (not renderer-only styling, not data-only
   color tables).
4. **Asset source: procedural model builder** — code assembles multi-part models
   parametrically. No external files, no AI backend dependency, deterministic,
   unlimited variants. (An AI-gen mesh provider is NOT part of this slice.)

## Design

### 1. Architecture style families

New data module `src/systems/worldforge/town/architectureStyle.ts` (sibling of
`buildingStyle.ts`, same shared-by-2D-and-3D contract).

- Input: the burg's culture **type** from the FMG atlas
  (`atlas.pack.cultures[burg.culture].type` — values: `Highland`, `Naval`,
  `River`, `Lake`, `Nomadic`, `Hunting`, `Generic`; same lookup path
  `getBurgNamer` already uses, and per the no-fallback directive an unresolvable
  culture THROWS, it does not default).
- Output: a `StyleFamily` record:
  - `wallPalette` / `roofPalette` (arrays; per-building pick by deterministic hash)
  - `roofForms`: subset of `gable | hip | flat | steep` with weights
  - `gatehouseForms`: subset of `twinTowers | tunnelBlock | singleTower`
  - `deckDetail`: post/piling style, railing on/off, arch rise for bridges
  - `wallMaterialTint` for the town rampart
- Mapping (initial): Highland → stone/slate, Naval + Lake → weathered coastal
  timber, River → half-timbered riverland, Hunting + Nomadic → rough log/hide,
  Generic → temperate timber-frame. Table-driven so families are easy to add.
- Determinism: family from culture type only; per-building variant from the
  existing centroid-hash pattern (`townPlanAdapter.centroidHash01`). Same world
  seed + burg → identical town forever.

### 2. Procedural model builder

New `src/systems/world3d/buildingModels.ts` (+ `gateGeometry.ts`, and extensions
to `deckGeometry.ts`): assembles multi-part models as plain geometry arrays
(`positions/indices/normals/colors`), the format the chunk pipeline already
consumes.

- **Buildings:** wall block(s) + roof mesh per form (gable = ridge prism, hip =
  pyramid, steep = tall gable, flat = parapet slab) + chimney + family accents
  (e.g. exposed-beam strips for half-timber via vertex-color banding). Storeys
  and footprint continue to come from the canonical plan — massing stays
  identical to 2D; only the shell gets shape.
- **Caching:** models keyed by `(family, buildingKind, variant)`; a town reuses
  cached variants rather than building one mesh per plot.
- **Integration:** `World3DScene`'s SiteBuilding renders the built model instead
  of `boxGeometry + coneGeometry` for solid-shell buildings. Interior-parts
  buildings (enterable) keep their parts walls but adopt the styled roof + palette.
  Door/window dressing and the roof auto-hide behavior are preserved.

### 3. Road gates (functional fix)

In `groundChunkLoader.groundTowns`, split the wall ring at
`adapted.walls.gatehouses` in addition to `waterGates`, reusing
`splitWallRingAtGates`. Gap width = street width plus shoulder (min ~4 m).
Streets pass through the wall.

### 4. Gatehouse structures

At each road-gate point, emit a gatehouse model (from `gateGeometry.ts`) in the
town's style family, oriented along the local wall tangent, taller than
`WALL_HEIGHT_M`:

- `twinTowers`: two square towers flanking the gap + lintel beam spanning it
- `tunnelBlock`: one block straddling the road with a tunnel opening
- `singleTower`: one tower beside the gap

Carried through the chunk data the same way walls/decks are (new
`gatehouses` field on the ground payload → chunk bundle → mesh builder).

### 5. Dock & bridge upgrade

`deckGeometry.ts` grows per-family detail, driven by `deckDetail`:

- **Docks:** vertical pilings from deck underside into the water at regular
  spacing, corner bollards.
- **Bridges:** piers descending into the channel, side railings, optional slight
  arch (deck vertices lifted by a parabolic rise).
- Placement, footprint, and the existing dock/bridge tint distinction (TG5)
  are unchanged.

### 6. 2D map parity

`TownPlanView` reads the same family palettes for plot fills/roof tones so a
Highland town reads stone-grey on the 2D map too. Shapes remain 3D-only.
`buildingStyle.ts` tables become the Generic family's palette rather than the
universal one.

### 7. Testing & verification

- Unit: style resolution is deterministic and total over culture types (and
  throws on unresolvable culture); gate-splitting preserves run continuity and
  leaves ≥2-point runs; each model builder emits well-formed geometry
  (index bounds, non-NaN, normals length) for every (family, kind, variant).
- Regression: existing wall/deck/site geometry tests keep passing; the
  plot-ID binding regression test (`groundChunkLoader.test.ts`) untouched.
- Visual (visual-inspection rule): re-run `townIdentityProof.mjs` (2D↔3D
  identity guardrail); 3D screenshots via the headless shoot rig of one
  Highland, one coastal, one river town — three visibly distinct styles, open
  gates with gatehouses, docks on posts, bridges with piers.

## Out of scope

- AI-generated mesh assets (future provider behind the same builder seam).
- Interior styling; roster/household parity (deferred follow-up #2).
- Collision/walkability physics for gates (walls are visual-only today; the
  gap itself is the walkable opening).

## Guardrails (inherited)

- 2D↔3D town identity must hold — re-run and eyeball the identity proof.
- World3DWrapper and groundTowns stay on the same `canonicalArtifactTownForSite`.
- Master only, no branches/worktrees. Leave work uncommitted (2am snapshots).
- No fallback paths: unresolvable culture type is an error, not a default style.
