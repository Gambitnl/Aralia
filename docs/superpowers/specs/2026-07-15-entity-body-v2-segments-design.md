# Entity body v2: segmented humanoids (kill the metaballs) — design

**Date:** 2026-07-15
**Status:** Approved by Remy ("the blob people vibe should really be scrubbed out… normal humanoid shape with proper arms and legs"; full redo chosen over humanoids-first). North star: AAA-style character work (Remy's reference screenshot); this slice builds the correct procedural foundation for it.

## The problem

Entity bodies are marching-cubes metaball fields. Everything melts into one soft mass, so figures read as pears and sausages ("blob people") no matter how the parts improve, wireframe mode is triangle soup (a smooth isosurface has no clean edges), and the field must re-polygonize at runtime (the single biggest entity cost).

## What we're building

Replace the metaball body with a **segmented body**: each skeletal segment is its own small rigid mesh, positioned between its joints every frame.

- **The gait drivers already compute the joints** (hips, knees, feet, shoulders, elbows, hands, spine, head) via the ported IK — today they melt them into ball chains. They will instead emit a **segment list**: `{ id, a, b, r0, r1 }` per bone (tapered), plus joint spheres for rounded elbows/knees and a head sphere. Humanoids get: pelvis, waist, chest, neck, head, upper arm + forearm + hand ×2, thigh + shin + foot ×2. Quads/hexapods: spine segments + legs + neck. Hoppers/floaters: stacked torso segments (squash via scale). Radii come from the existing frame (bulk, head scale) — race variety survives unchanged.
- **Organic parts stop being field balls.** The `field` part kind dies. Tails, tentacles, and antennae become **`chain` parts** (per-frame tapered segment chains, same renderer as limbs — they keep wagging). Snouts, muzzles, tusk jaws, brows, bellies, and crests become ordinary **mesh parts** at their anchors. The 37-part catalog, anchors, profiles, kits, and recipes are otherwise untouched.
- **Both looks become correct.** Solid = toon-shaded segments with inverse-hull ink outlines (they work again — rigid geometry). Wireframe = **clean edge lines** via `EdgesGeometry` + `LineSegments` per mesh — the "typical wireframe" — not `material.wireframe` triangle soup. `ENTITY_RENDER_MODE` stays the one global switch.
- **Performance strictly improves.** No polygonization at runtime: segment geometries are built once at assemble; per frame is transform updates only. The field machinery (`MarchingCubes`, `FieldSink`, resolution tiers, poly budgets, field throttling) is deleted. `AssembleOptions.resolutionScale/fieldUpdateHz` stay accepted as deprecated no-ops so the five game surfaces need no edits this slice. `crowdBake` merges the segment meshes per walk phase (simpler and budget-proof).

## What survives untouched

All pure data (races, kits, creature table, blueprints, recipe builders), the anchor system and mesh parts, gait/IK math and locomotion contracts, all five game surfaces' wiring, the combat overlays, the harness/debugger (the iteration surface for this work), and the `EntityHandle` API (`update/retain/release/pose/setGaitPhase/stats` — stats fields change to segment/triangle counts).

## Out of scope

Imported sculpted/rigged models (the north-star asset pipeline — the segment skeleton is its foundation); texture/material richness beyond toon + lines; changing proportions data (tuning happens visually on the debugger as polish, not as schema change).

## Testing

Gait tests extend to segment emission (finite, connected: each limb chain's joints touch; per-gait counts). Part tests cover the new chain kind and converted mesh parts. Assembler tests: segment mesh counts, wireframe = lines-only (no fill meshes, no `material.wireframe`), solid = outlines present, dispose clean. Crowd bake keeps its keyframe assertions. Visual: debugger + forge scenarios via the new runner, every gait and a race/class spread, proof set to Remy.
