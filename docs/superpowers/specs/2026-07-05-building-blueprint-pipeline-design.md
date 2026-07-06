# Building blueprint pipeline — design

**Status:** draft for review (2026-07-05)
**Author:** Remy + Claude
**Related:** `src/systems/worldforge/interior/generateInterior.ts` (current 3D interior maker), `src/components/DesignPreview/steps/PreviewBlueprint.tsx` and `PreviewFloorplans.tsx` (preview surfaces built this session), `.agent/scratch/floorplan-critique.md` (34-point critique), [2026-07-05-procedural-dungeon-generator.md](2026-07-05-procedural-dungeon-generator.md)

---

## The idea in one line

Design each building as a clean 2D blueprint first, then build the 3D from that same blueprint.

## Why we are doing this

Willing a good 3D building into existence directly is hard. A flat 2D blueprint is much easier to get right, and once it looks good it becomes the single source of truth. Everything else — the 3D building, the tactical map, a printed map — is built from it.

Today we have two half-answers, neither of which is both tasteful and usable:

- A good-looking 2D drawer (the `Floorplans` preview screen). It makes varied, attractive plans, but its output is only a picture. Nothing else in the game can read it.
- A boxy 3D interior maker (`generateInterior`). Its output is real, usable information, and it already feeds the 3D world. But its buildings are plain rectangles with few rooms.

This session's "reverse experiment" — drawing a 2D blueprint *from* the 3D maker's data — proved the key point: one shared data shape plus one drawer can serve both the 2D blueprint and the 3D build. That is the pipeline we want.

## The goal

One building generator that outputs blueprint **data** (rooms, doors, windows, furniture, stairs, walls — all in feet on a 5 ft grid). The 2D blueprint view and the 3D build both read that same data. The blueprint is the source of truth; the 3D is downstream.

```
                     ┌────────────────────┐
   seed + type  ───▶ │ building generator │ ───▶  BlueprintPlan (data, in feet)
                     └────────────────────┘              │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                  2D blueprint drawer            3D building builder
                                  (module-map style)             (walls, floors, props)
```

## Scope of the first version

In:

- Above-ground buildings: cottage, shop, tavern, workshop, manor (the five preview types).
- Ground, upper floors, and a basement level.
- Irregular footprints (L-shapes, wings, a tower), raised in 3D from the same blueprint.
- The full blueprint data contract, so the 3D build can consume it.
- The 2D blueprint drawer in module-map style, wired to the shared data.
- The design-preview screen to roll and eyeball buildings (already built; keep iterating there).

Out (later versions):

- Dungeons and multi-building complexes (covered by the separate dungeon spec).
- Runtime AI-generated art/textures on the blueprint.
- Player-editable blueprints.

## Architecture

Four parts, each with one job:

1. **Building generator** — pure and deterministic. Same seed and type in, same plan out. Produces the blueprint data. No drawing, no 3D.
2. **Blueprint data** — the shared contract (below). Plain data in feet. This is the thing the 34 criticisms mostly care about getting right.
3. **2D blueprint drawer** — a pure view. Turns blueprint data into the module-map picture. No generation of its own.
4. **3D building builder** — reads the same blueprint data and raises the 3D walls, floors, doors, and props.

The design-preview screen stays the place to roll, switch floors, and eyeball. We keep it honest: the drawing shows exactly what the data says, warts and all.

## The blueprint data contract

The current 3D maker already emits a usable shape (rooms as rectangles, doorways, furniture, stairs, upper floors, all in feet). We keep what works and add what the richer look needs. Recommended shape:

- **Footprint** — the building outline, allowed to be irregular (a set of grid cells, not just one rectangle). This is the biggest change from today.
- **Rooms** — each with a purpose (hall, kitchen, bedroom, and so on), its cells, and whether it is a corridor.
- **Doorways** — which two rooms they join, where they sit, and which way the door opens.
- **Windows** — on outer walls only, facing true open air (not into the building's own notch).
- **Furniture** — kind, position, and turn, clamped to the room it belongs to.
- **Stairs** — where they sit, and which floors they join.
- **Walls** — carried as edges between cells. Each wall sits on the grid line and has real thickness (thick for outer walls, thin for interior) that grows outward from the line. A wall never eats a playable tile, so rooms stay full size and the combat referee sees the same tiles that are drawn; standing against a wall edge gives cover.
- **Entrance** — the front door, on an outer wall of the building's main public room.

The existing 3D build reads a subset of this today. We extend the shape so the 3D build keeps working while the blueprint gets richer. Where the 3D build assumes a plain rectangle (it does today), we decide how it handles irregular footprints — see open decisions.

## What we are fixing (from the 34-point critique)

The full critique lives in `.agent/scratch/floorplan-critique.md`. It sorts into three buckets. This spec commits to fixing the first two in the first version and treats the third as steady polish.

**Bucket 1 — the building must be believable (in scope):**

- Rooms get sensible purposes. No building is half storeroom. A tavern has one common room, a kitchen, maybe a cellar, then guest rooms.
- The main room stays big. A hall, common room, or nave is one dominant space, not shredded into equal boxes.
- The front door lands on the main public room and leads somewhere sensible.
- Footprints vary and are not plain rectangles. No two taverns feel stamped from the same mold.
- Windows and the entrance face true open air, never into the building's own inner corner.
- Corridors are real hallways when a building wants them, not leftover slivers.

**Bucket 2 — the drawing must read right (in scope):**

- Doors are a normal 3 ft wide, not full 5 ft barn doors, and their swings never cross each other or the walls.
- Furniture stays inside its own room, even L-shaped rooms.
- Room labels never spill over walls; long names wrap or shorten; no room is silently left blank.
- The floor lighting does not black out the corners of the building.
- The stairs and the floor medallion agree with each other and sit on real floor.
- The sheet carries a scale bar and room numbers, so it reads as a real map.

**Bucket 3 — tooling and code health (steady polish, not gating):**

- A seed you can type in and a link you can share, so a good building can be found again.
- The drawing consumes the data through the normal render path, not by hand-injecting markup.
- Golden data tests for the generator; a visual eyeball for the drawing.

## Relationship to the existing 3D interior maker

We do **not** throw away the existing 3D maker. It already knows how to raise walls, floors, doors, and props from plan data, and it is tested and wired in. Two candidate paths, and the spec recommends the first:

- **Recommended — grow the existing maker into the shared generator.** Extend it to emit the richer blueprint data (irregular footprints, better purposes, corridors, windows). The 3D build keeps reading the same source. One maker, no duplicate. The good-looking 2D drawer built this session becomes the *drawer*, pointed at this data.
- **Alternative — new generator, adapter to the old shape.** Build a fresh generator for the richer look and translate its output into the shape the 3D build expects. More freedom, but two things to keep in step.

## Decisions made (2026-07-05)

- **Walls carry real thickness, on the line between tiles.** A wall sits on the grid line and grows outward from it as a real-thickness band — thick for outer walls, thin for interior. It does not eat a playable tile, so rooms stay full size and the combat referee sees the same tiles that are drawn; standing against a wall edge gives cover. (Rejected: a wall filling the middle of a tile, which wastes a 5 ft strip per interior wall and forbids thin rooms — that model is dungeon-only.)
- **Basements are in the first version.** Ground, upper floors, and a basement level.
- **Irregular footprints are in the first version.** L-shapes, wings, and a tower, raised in 3D from the same blueprint, so the full module look carries into 3D from the start. This makes the first version bigger: the 3D build no longer assumes a plain rectangle, so raising non-rectangular shells is part of the build plan.

No open decisions remain.

## How we prove it works

- Golden tests pin the generator's data for a fixed set of seeds, so the look can not drift silently.
- We roll and eyeball every building type on the design-preview screen, across many seeds and every floor, before calling it done. Numbers alone are not proof.

---

*Next step after this document is agreed: turn it into a step-by-step build plan.*
