# Targets — World3D ground mode

**BG3 counterpart:** overworld exteriors — wilderness, roads, rivers, forests, cliffs,
mountains, distant vistas.

**Reference used:** `references/bg3/world3d-ground/cliff-mountain-pass-1.jpg` — a mountain
pass at our camera family (high 3rd-person, looking down and out) in daylight. 27 reference
files in that folder.

**Ours judged:** `captures/bg3-baseline/wilds-ancient-forest.png`, captured 2026-07-30 from
the live surface via `tools/vistest/shoot.ts`.

Written by the orchestrator while the critic fleet was halted by a session limit. The
world3d-ground critic should challenge, correct and extend this on resume — treat it as a
first pass, not settled.

---

## How to judge

Each target is checkable from a captured frame. Exit condition for this surface is every
target PASS, confirmed by screenshot. Not "critic prefers ours".

Aralia is procedural; BG3 is hand-placed. Every fix below must be something a **generator**
can do. Never resolve a target by hand-authoring a scene.

---

## 1. Terrain surface detail

**Target:** No flat triangle facets visible on any ground or slope at walking distance.
Slopes carry surface detail (normal map, height detail, or triplanar texture) that reads as
rock, soil, or grass rather than as shaded polygons.

**Status: FAIL.** Our frame shows large flat-shaded triangles across the whole ground
plane; you can count the individual tris and read the mesh topology directly. The BG3
reference shows rock with fine displacement and a distinct material at every scale, and
you cannot locate a single polygon edge.

## 2. Ground cover, layered and moving

**Target:** At least three depth layers — ground texture, low scatter (pebbles, roots,
detritus), and taller growth — with wind motion on the growth layer.

**Status: FAIL.** Our ground cover is one layer of small flat cones, evenly scattered and
static. They read as scattered spikes, not cover. BG3's reference floor carries litter,
low plants and bushes at three or more heights, with silhouettes that overlap and break
the ground plane.

## 3. Tree and foliage material

**Target:** Bark and canopy carry texture at mid distance. Canopy edges break up against
the sky rather than reading as solid geometric shapes. No visible LOD pop when distance
changes.

**Status: FAIL.** Our trees are untextured flat-shaded cones and spheres in two greens.
Canopy silhouettes are hard geometric outlines. The reference trees show branch structure,
leaf clusters that break the outline, and bark that reads as bark.

## 4. Water

**Target:** Water shows reflection, depth-tinted transparency (shallow reads different
from deep), a shoreline transition rather than a hard polygon edge, and surface normal
motion.

**Status: FAIL.** Our water is a single opaque flat blue polygon with a hard straight edge
against the land, no reflection, no depth, no motion. This is the single largest single-
feature gap in the frame.

## 5. Shadows

**Target:** Soft shadows with visible penumbra that widens with distance from the contact
point. Shadow direction consistent with the sun.

**Status: FAIL.** Our frame has a few flat dark patches with hard uniform edges and no
penumbra. The reference shows soft-edged shadows from foliage with dappled light through
the canopy.

## 6. Ambient occlusion / contact

**Target:** Every object–ground contact darkens. A tree, rock, or bush must not appear to
hover; the base is visibly seated.

**Status: FAIL.** No ambient occlusion anywhere. Tree trunks and rocks meet the ground with
no darkening, so several read as floating decals on the terrain.

## 7. Distance and aerial perspective

**Target:** Distant terrain desaturates and lightens toward the sky so depth reads. Far
ground must not carry the same contrast and saturation as near ground.

**Status: FAIL.** Our distant terrain has the same flat tone as the foreground, so the
scene reads as one flat plane. The reference shows clear haze in the ravine and progressive
desaturation with distance.

## 8. Sky

**Target:** Sun disc or directional source, a cloud layer, and a sky that responds to the
hour rather than a fixed gradient.

**Status: FAIL.** Our sky is a flat two-stop vertical gradient with no sun, no clouds, and
no visible time-of-day response in the frame.

---

## Honest scoring, first pass

**0 of 8 PASS.** Nothing here is close yet. That is not a reason to soften the bar — it is
the starting point, and it means almost any of these fixes is visible progress.

Highest visual return per unit of work, judged from the two frames:

1. **Ambient occlusion (#6)** — cheapest large readability win; fixes the floating look
2. **Water (#4)** — the most conspicuously wrong single element in frame
3. **Terrain surface detail (#1)** — removes the "untextured prototype" read
4. **Aerial perspective (#7)** — cheap, and instantly creates depth
5. **Ground cover layers (#2)** and **foliage material (#3)** — the biggest jobs, most transformative
