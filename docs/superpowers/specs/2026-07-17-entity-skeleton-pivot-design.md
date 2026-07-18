# Entity body v3: real skeletons (SkinnedMesh pivot) — design

**Date:** 2026-07-17
**Status:** Direction approved by Remy (two calls, this session): (1) skinned bodies **replace** the segment renderer once proven — the metaball precedent, no zombie modes; (2) the first payoff after the substrate is **Mixamo clip playback**, before smooth bodies. Body v2's own spec named imported rigged models the north star and the segment skeleton its foundation — this pivot schedules that north star.

## The problem

Entity bodies are rigid tapered segments re-posed every frame (body v2). Nothing in `src` has a `Skeleton`, `SkinnedMesh`, `Bone`, or `AnimationMixer`, so standard animation clips cannot play at all. All motion is procedural. That caps us three ways:

- Mocap-quality walks and combat actions (Mixamo, FBX, glTF clips) are unreachable.
- Bodies are mannequins: joints gap instead of creasing, and the sculpted one-piece look (started for spines with swept tubes) cannot extend to limbs.
- A solid humanoid costs about 60 draw calls (every segment is a fill mesh plus an ink shell). A skinned body is 2.

## What we're building

A real `THREE.Bone` hierarchy and a skinned one-piece body for every generated entity, with the existing procedural gait math kept as one of two animation sources.

- **Skeleton builder** (`three/skeletonBuilder.ts`): `Frame` or compiled `PlanSpec` in, bone hierarchy out. Bipeds use the exact proportions `BipedDriver` hardcodes today. Plan creatures map one-to-one: every chain link becomes a bone, so tentacles, tails, necks, and tauric torsos all ride skeletons. This pivot is not humanoid-only.
- **Skinned body** (`three/skinnedBody.ts`): bind-pose geometry with skin indices and weights. Rigid weights first (each vertex owned by one bone — looks identical to segments, de-risks the chain). Smooth joint weights second (the one-piece creased body). Bind geometry is shared per species; each instance gets its own skeleton.
- **Drivers become bone-writers** through one adapter that converts their joint positions into local bone rotations (`setFromUnitVectors` along each link, times the parent inverse). `TreadmillLeg` and `solveKnee` survive untouched. All 7 gaits keep their math.
- **Clips play natively**: `AnimationMixer` plus a retargeted Mixamo set (idle, walk, run, attack, hit, death, cast). In-place root handling; playback rate synced to actual move speed the same way `cadence()` works now. Per-entity bone ownership: clips own humanoids, procedural drivers own creatures; additive layering can come later.
- **Parts parent to bones**: gear, organic parts, and heads attach to bones and inherit transforms for free, replacing per-frame anchor copying. The `Pose` anchors stay as a read view for compatibility.
- **The outline learns skinning**: `outlineMaterial` in `toon.ts` is a raw `ShaderMaterial` with no bone matrices — without the three.js skinning chunks the ink shell stays frozen in bind pose. Known, concrete fix.
- **Crowds keep the bake**: sample the skeleton at each walk phase, bake deformed vertices with `applyBoneTransform`, and merge — same output as today's snapshots.
- **End state — segments die.** Once skinned wins the eyeball on every surface, delete the segment renderer the way metaballs died. Wireframe needs its own answer first (see Open).

## Slices (priority order)

1. **Substrate:** skeleton builder plus a rigid-weight skinned biped behind a `bodyTech` switch. A/B contact sheet against segments must look identical. Proves skeleton, weights, skinned outline, and the retain/release lifecycle.
2. **Mixamo clips (first payoff):** offline FBX-to-clip conversion (no FBX parser in the game bundle), bone-name retarget map, mixer wiring, in-place root handling, speed sync. Walk, idle, run, and the combat set on humanoid tokens. Debugger scrub keeps working (`gaitPhase` maps to clip time).
3. **Smooth bodies:** joint-blended weights, creased elbows and knees, one-piece silhouette. Harsh eyeball gate.
4. **Creature skeletons:** plan chains become bone chains; tentacle, tail, wing, and neck math writes bone rotations; heads and parts ride bones.
5. **Crowds and the kill:** phase-baked crowd geometry from bone transforms, then delete the segment renderer once every surface is skinned and the wireframe answer is decided.

## What survives untouched

All pure data (races, kits, creature table, blueprints, recipes, plans), gait and IK math, the locomotion contract (speed-only, treadmill legs), the part catalog and anchor names as an API, the `EntityHandle` API with retain/release, all five game surfaces' wiring, and the harness, debugger, and contact-sheet tooling.

## Out of scope

Imported rigged hero meshes (the Meshy slice — this pivot builds the skeleton standard they will later bind to), texture and material richness, ragdoll or physics, and instanced GPU skinning for crowds (the bake path covers them).

## Open

- Wireframe on a deforming body: `EdgesGeometry` lines are static geometry and cannot deform. Keep segments as the wireframe tech until the kill, redefine the wireframe look, or build skinned line rendering? The game's current default look is wireframe, so this is a Remy decision before slice 5.
- Weight authoring quality: joint blend radii derived from `Frame` proportions need eyeball iteration to avoid candy-wrapper wrists and collapsed hips.
- Mixer versus procedural arbitration: whole-skeleton ownership first, or per-bone masks from the start?
- First clip pack: which Mixamo clips ship first, and do we store them as a compact owned JSON format or as converted three.js clip JSON?

## Testing

Skeleton builder: bone counts and lengths per `Frame` and per stress fixture (centaur, gelatinous cube, beholder, ghost). Skinned body: weights sum to 1; rigid-weight joint positions match segment joints exactly; a bind-pose-freeze regression proves the outline deforms. Clips: retargeted foot ground contact, speed sync, ownership arbitration. Perf gates extend to draw calls per entity (body = 2) alongside the existing triangle budgets. Visual: A/B contact sheets per slice, harsh critique pass, all 8 stress fixtures plus a race and class spread.
