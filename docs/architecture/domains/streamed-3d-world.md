# Streamed 3D World

Verified: 2026-08-05

## Purpose

The Streamed 3D World domain covers the walkable world the player explores in
three dimensions: terrain surface, water, town walls, roads, decks, vegetation
and the far-distance backdrop. It excludes the tactical battle map, which has
its own domain doc, and it excludes building interiors, which belong to the
interior generator.

This domain is where "what is the world made of" is answered.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/systems/world3d/chunkGeometry.ts        (terrain surface + border skirt)
- src/systems/world3d/waterGeometry.ts        (lakes and river ribbons)
- src/systems/world3d/wallGeometry.ts         (town rampart runs)
- src/systems/world3d/roadGeometry.ts         (road and street ribbons)
- src/systems/world3d/deckGeometry.ts         (dock and bridge slabs)
- src/systems/worldforge/bridge/groundChunkLoader.ts  (assembles the ground world)
- src/systems/worldforge/bridge/farShells.ts  (static distant backdrop)
- src/components/World3D/World3DScene.tsx     (the scene root)

## Surface inventory

A **facade** means a surface with nothing behind it. The player can reach a
place where the object stops being what it claims to be.

This inventory is the domain's core fact. Re-verify it against the source when
any entry point above changes. Every entry below was read in the code.

## Summary

| Surface | Verdict | Cost to fix |
|---|---|---|
| Town walls | Facade. Zero thickness | Low |
| Roads | Facade. Sheet over terrain | Medium |
| Decks and quays | Facade. Same as roads | Low |
| Terrain | Facade below grade | Medium |
| Water | Half fixed today | Low |
| Grass | Facade by design | Leave |
| Understory | Facade by design | Leave |
| Far distance | Facade by design | Leave |
| Buildings | Honest | None |
| Gatehouses | Honest | None |
| Interiors | Honest | None |
| Trees | Honest | None |

Three real faults. Three deliberate cheats that should stay. Four things that
were built properly.

---

## Faults

### Town walls are paper

`src/systems/world3d/wallGeometry.ts` emits **four vertices per segment**. One
vertical quad, 3.2 m tall, zero thickness.

The data carries `widthM: 1.2`. The geometry discards it.

This is the worst entry in the audit, for three reasons.

A rampart is a defensive structure. Aralia has sieges, settlement defenses and
stationed regiments. A wall you cannot stand on and cannot shelter behind
undercuts all of it.

A gatehouse rises to 5.5 m beside it and is a real tower. The two are
inconsistent, and standing next to both makes the wall look worse.

The mesh also emits both windings. That is the exact z-fight pattern this
codebase already recorded once, in the note about walls and gates chipping open.

**Fix:** extrude to the width the data already carries. Cap the top. Give it an
inner face. The wall walk then exists as a real surface.

### Roads are ribbons floating over the ground

`src/systems/world3d/roadGeometry.ts` lays a flat strip "raised slightly above"
the terrain.

This is the sheet-on-sheet complaint in its purest form. Two surfaces occupy
nearly the same place, one hovering over the other.

It causes the hard material seams, the z-fight risk, and the read of a decal
laid on a landscape rather than a track worn into it.

**Fix:** stop laying a second surface. Sample the road into the terrain itself.
The road becomes part of the ground rather than a thing on top of it.

### Terrain has no underside

`buildTerrainMesh` produces one triangle layer. A skirt exists, but only around
chunk borders, at `SKIRT_MIN_DEPTH_M = 40`.

The interior of every chunk has nothing behind it. Below grade, the world is
void.

This is the fault that the spells make urgent. A spell that digs a pit exposes
exactly this.

**Fix:** close the shell, and give the ground layers so a cut shows what it cut
through. See the ground-scar decisions in `CONTEXT.md`.

### Water was a lid

`buildWaterMesh` earcuts each body and emits upward-facing triangles only. No
underside, no bank walls, no thickness.

Half fixed on 2026-08-05. Water now carries per-vertex depth, drives its own
alpha and color from it, and renders double-sided.

**Remaining:** the shoreline reads correctly, but nothing was verified from
under the surface. That view is the proof and it has not been captured.

---

## Deliberate cheats that should stay

### Grass

Three tapered curved blades per cluster. Flat geometry.

This is correct. Grass is drawn by the hundred thousand, it is knee high, and
nobody inspects a single blade. The earlier version used two crossed quads and
was upgraded to three curved blades because the silhouette mattered. The
thickness never will.

### Understory

Fern fronds and leaflets are flat, drawn double-sided. Same reasoning as grass.

A leaf is genuinely thin. The cheat matches the subject.

### The far distance

`farShells.ts` builds two static coarse meshes and states its own nature: no
streaming, no per-frame cost.

This is a painted backdrop and it should stay one. The player never reaches it.
A backdrop that admits it is a backdrop is not a facade.

---

## Things that were built properly

### Buildings

Every building receives real interior parts from the same canonical blueprint
the occupancy system uses. The renderer builds walls rather than a solid box
whenever parts are present, and they are present for generated towns.

Wall width and depth are carried and used. Roofs are solved per style.

### Gatehouses

Real towers, 5.5 m, styled per culture family.

### Interiors

`interior/` generates rooms, doors, walls and furnishings, and the 3D bake
consumes them. Doors have real openings on a grid line. Windows track a live
clock.

### Trees

ez-tree branches are tubes with real cross-sections. A trunk is solid geometry,
not a billboard. Leaves are flat, which is correct for leaves.

---

## The pattern

Every facade here was flattened to save geometry at a time when nobody could
reach it.

Walls were scenery on a map. Roads were a line on a landscape seen from above.
Terrain was never walked below. Water was looked at from one side.

All four assumptions have since broken. The player walks the ground, the camera
goes where it likes, and spells cut into the world.

The cheats that remain correct — grass, leaves, the far horizon — are the ones
where the assumption still holds.

## Recommended order

1. **Town walls.** Smallest fix, largest visible gain, and the most
   embarrassing gap given what the game does with sieges.
2. **Terrain underside and layers.** The foundation the ground spells need.
3. **Roads into the surface.** Kills the seams and the z-fight risk together.
4. **Water from below.** Capture the proof and close it out.

Decks follow roads for free, since they share a shape.

## Last verified

2026-08-05, against the working tree. Verified by reading each geometry builder
listed under Verified Current Entry Points.

Re-verify when a geometry builder changes. A stale inventory is worse than none,
because a reader trusts it.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/streamed-3d-world.md","sha256WithoutMarker":"79f00ec35d49c4a80c5f3053c31f2e2a0949c0893549b4c9514abdd4adafcfe5","markedAtUtc":"2026-08-09T20:24:28.242Z"} -->
