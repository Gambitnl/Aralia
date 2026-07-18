# Entity skeleton pivot — slice 1 implementation plan (substrate + side-by-side)

**Date:** 2026-07-18
**Spec:** `docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md` (slice 1 only; slices 2–5 out of scope)
**System map:** `docs/superpowers/handovers/2026-07-12-entity-generator-3d.md`

## Goal

A real `THREE.Bone` hierarchy and a rigid-weight skinned biped body behind an opt-in
`bodyTech: 'segments' | 'skinned'` switch (default `'segments'`, zero behavior change),
plus a side-by-side forge surface so Remy can eyeball segment vs skinned on the same
recipe with one camera.

## Design decisions (recorded up front)

- **Bind pose = the biped driver's rest state** (gaitPhase 0, speed 0, bob 0, sway 0).
  Driving a real `BipedDriver` with `update(0, 0, {speed: 0})` reproduces exactly this
  state, so tests can pin parity without touching driver math.
- **Bones are rigid** (position + rotation only, no per-frame scale). Link lengths are
  constant in normal animation (solveKnee returns exact 0.52-limb links); the only
  divergences are sub-millimeter torso sway stretch and rare IK overstretch at full
  stride, both hidden inside joint spheres. Rigid bones are what slice 2 (Mixamo
  retarget) requires.
- **The pose adapter is a `SegmentSink`.** The driver's `buildBody(sink)` already emits
  every joint position each frame; in skinned mode that same emission stream feeds the
  skeleton instead of the segment renderer. The adapter can never drift from driver
  math because it consumes the identical numbers. Unknown segment ids throw (no
  fallback).
- **17 bones:** root (origin), pelvis, chest, neck, head, upperArm/foreArm/hand × L/R,
  thigh/shin/foot × L/R. Each rendered piece (tapered cylinder, its two joint spheres,
  or a ball) is 100% owned by one bone — rigid weights, looks identical to segments.
- **Chain parts (tails, beards) keep the segment renderer** in skinned mode — they are
  procedural wagging chains, out of skeleton scope until slice 4. Eyes, shadow, and
  mesh parts ride the untouched anchor pathway.
- **Skinned + wireframe throws.** Slice 1 has no skinned wireframe path (open decision
  in the spec — not inventing one). The side-by-side forces solid rendering.
- **Non-biped + skinned throws.** Slice 1 is the biped substrate; creature skeletons
  are slice 4. The forge only offers the side-by-side for biped recipes.

## Tasks

1. **Plan doc** (this file). ✅
2. **`three/skeletonBuilder.ts`** — pure. `bipedRestPose(frame)` computes the exact
   rest emissions `BipedDriver.buildBody` would produce (same constants: pelvis =
   legLen, chest = pelvis + (h − legLen)·0.45, head = h − 0.7·headR, shoulder
   half-width, 0.52-limb links via `solveKnee`, stance width). `buildBipedSkeleton`
   turns that into the bone hierarchy. `createBipedPoseSink(skeleton)` is the per-frame
   adapter (world transforms from emissions → local bone transforms, parents first).
3. **`three/toon.ts`** — add the three.js skinning chunks to `outlineMaterial`'s vertex
   shader (`skinning_pars_vertex`, `skinbase_vertex`, `skinning_vertex`). All chunks
   are `#ifdef USE_SKINNING`-guarded, so existing non-skinned uses compile to the same
   shader as before; on a `SkinnedMesh` the shell deforms instead of freezing in bind
   pose.
4. **`three/skinnedBody.ts`** — builds one bind-pose `BufferGeometry` (same tapered
   cylinders + joint spheres + balls as `segmentBody` solid mode, same radii and
   tessellation), rigid `skinIndex`/`skinWeight` (one bone per vertex, weight 1), one
   fill `SkinnedMesh` (toon material) + one outline shell `SkinnedMesh`
   (skinning-aware `outlineMaterial`), both bound to one shared skeleton.
5. **`three/assembleEntity.ts`** — `bodyTech` option. `'segments'` (default): exactly
   today's path. `'skinned'`: driver emissions go to the pose adapter; the segment
   renderer stays alive for chain parts only; stats() adds the skinned triangles;
   dispose/retain/release cover the new objects.
6. **`three/Entity3D.tsx`** — pass-through `bodyTech` prop (optional, default
   segments).
7. **Forge side-by-side** — `PreviewEntityForge.tsx`: `&sidebyside=1` URL param + a
   checkbox; renders the SAME recipe twice (segments at −x/left, skinned at +x/right),
   solid mode forced, walking in place (no circle) so both drivers stay phase-locked;
   overlay legend names the sides. `EntityForgeScene.tsx`: per-entity `bodyTech`,
   camera widened for the two-figure spread.
8. **Tests** (`src/systems/entities3d/__tests__/`):
   - `skeletonBuilder.test.ts`: bone count/names/hierarchy; bone-to-bone link lengths
     equal the driver's 0.52-limb formulas across 20 deterministic frames; rest
     emissions match a real driver at `update(0, 0, speed 0)` within 1e-6; adapter
     round trip — feed the driver's `update(0, 1/60)` emissions through the pose sink
     and check every bind endpoint lands on the driver's emitted endpoints within 1e-3.
   - `skinnedBody.test.ts`: every vertex has weights summing to 1 with a single owning
     bone; skin indices in range; bind-pose piece endpoints match segment-body first
     frame within 1e-3; geometry deterministic across rebuilds.
   - `bodyTech` default: assemble with no option === assemble with `'segments'`
     (identical node names/transform bytes, no SkinnedMesh present); skinned mode has
     the two SkinnedMeshes and no body segment nodes; wireframe+skinned and
     non-biped+skinned throw.
9. **Proof:** focused vitest run + `npx tsc --noEmit`; Playwright capture of
   `…/misc/design.html?step=entityforge&race=human&class=fighter&sidebyside=1` at
   1600×900 into `.agent/scratch/entity-skel-slice1/` (gitignored, verified).

## Known micro-divergences (documented, accepted for slice 1)

- Outline shell thickness on tapered slopes: segmentBody inflates a unit cylinder and
  scales, the skinned body inflates real-length geometry — sub-outline-width
  difference, silhouette dominated by radial normals which match exactly.
- Torso segments stretch ~0.1 mm with sway; limbs overstretch only past normal stride.
  Both invisible at eyeball range; joint spheres cover the seams.

## Deferred (later slices per spec)

Mixamo clips (2), smooth weights (3), creature/plan skeletons + parts on bones (4),
crowd bake + segment-renderer kill + wireframe answer (5).
