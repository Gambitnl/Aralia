# Skeleton Pivot Slice 4: Creature Skeletons Implementation Plan (DRAFT)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: DRAFT 2026-07-24 (kimi-skeleton-20260724, Agora parent task 31b275e7).** Written from spec slice 4 after smooth bodies (slice 3) verified complete. One design choice inside (decorative emissions stay on the anchor path) is flagged for Remy review before implementation starts. Do not implement from this draft without that review.

**Goal:** Every plan-driven creature (text-to-creature Describe/Library entries, `gait: 'plan'`) gets a real `THREE.Bone` hierarchy: each spine joint and each chain link becomes a bone, and the PlanDriver's existing tentacle/tail/wing/neck/leg/arm math writes bone rotations through the same sink-adapter pattern slice 1 proved for bipeds. Heads ride neck-tip bones. The segment renderer stays the default; the skeleton is opt-in via the existing `bodyTech: 'skinned'` switch.

**Architecture:** A new pure module `three/planSkeleton.ts` mirrors `skeletonBuilder.ts`'s three-part shape (rest pose → bone hierarchy → pose sink) for compiled `PlanSpec`s. Bone names reuse the driver's own emission ids (`spine.N`, `<chainId>.N`, terminal `head<N>` / `<chainId>.foot` / `<chainId>.palm`), so the pose sink can never drift from the driver. The pose sink implements `seg`/`ball`/`tube` — in smooth tube mode the driver's `tube(id, flat, radii)` polyline IS the joint list in order, so it decomposes into the same per-link bone transforms the seg path receives. Skinned bind geometry (rigid weights first) comes from the rest emissions, reusing `skinnedBody`'s materials, ink shell, and 2-draw-call shape.

**Ordering note:** Mixamo clips (spec slice 2) remain PARKED — Remy 2026-07-23; clip files need an Adobe login or a licensed pack, neither chosen. Do not start that slice and do not acquire assets to bypass the decision.

**Tech Stack:** TypeScript, three ^0.172, vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md` (slice 4)
**Prior art to reuse, not parallel:** `three/skeletonBuilder.ts` (biped rest pose, pose sink, bindWorld math), `three/skinnedBody.ts` (rigid bind geometry, skinned outline), `three/smoothBipedGeometry.ts` (chain loft approach for later creature smooth weights), `three/gaits.ts` `PlanDriver` (untouched — it re-emits every frame; the sink adapts), `textPlan/fixtures.ts` stress fixtures, `textPlan/budgets.ts` budgets.

## Global Constraints

- **No git commits/branches/worktrees**; tasks end at "tests green".
- **No fallbacks**; skinned bodies are SOLID SHADED (Remy 2026-07-21).
- **Determinism**: same PlanSpec in, same skeleton and geometry out.
- **Budgets**: `PLAN_TRIANGLE_BUDGET` (30k) holds; body stays 2 draw calls.
- **Driver untouched**: `PlanDriver`, `TreadmillLeg`, `solveKnee`, all chain math preserved. The sink adapts emissions; nothing reaches into the driver.
- Existing suites (`skeletonBuilder`, `skinnedBody`, `smoothBiped`, `assemble`, `planDriver`, `perfBudget`, `segmentCollar`) stay green — `bodyTech: 'segments'` remains the default on every surface.
- Fail loud, never fake: unknown emission ids throw; `bodyTech: 'skinned'` with a non-biped/non-plan gait (`quad`, `hexapod`, `hopper`, `flyer`, `float`) keeps throwing — species-gaits skeletons are NOT this slice.
- Test: `npx vitest run <path>`; typecheck filtered to touched files. US English.

## Design choice flagged for Remy (blocks Task 2)

`PlanDriver.buildBody` emits decorative pieces beyond the deformable body: junction **collars**, energy **rings**, finger segments, toe claws, **cilia** lashes, **snouts**, auto S-necks for neckless heads, and formed-head skulls. Slice 4 proposal: **only the body skins** (spine + chains + head/foot/palm terminals). Decorative emissions stay on the existing per-frame parts/anchor path as ordinary meshes — they are re-emitted every frame anyway, so they need no bones and keep today's exact look. Alternative (rejected for this slice): skin decorations too — larger blast radius, no visual payoff, and rings/cilia are effects, not flesh.

## File Structure

```
src/systems/entities3d/three/
  planSkeleton.ts        — NEW: plan rest pose + buildPlanSkeleton + createPlanPoseSink (pure)
  skinnedBody.ts         — createSkinnedPlan (or options.planSpec) builds the rigid bind body
  assembleEntity.ts      — bodyTech 'skinned' admits gait 'plan'; guard text updated honestly
src/components/DesignPreview/steps/PreviewEntityForge.tsx — creature/describe/library A/B surface
src/systems/entities3d/__tests__/planSkeleton.test.ts — NEW suite
```

---

### Task 1: Plan rest pose + bone hierarchy + pose sink (the module)

**Files:** create `three/planSkeleton.ts`, test `__tests__/planSkeleton.test.ts`

**Produces (shape mirrors skeletonBuilder.ts):**

```ts
export interface PlanRestPose { /* spine links, chain links, terminal balls — ids match PlanDriver emissions */ }
export function buildPlanSkeleton(frame: Frame, spec: PlanSpec): BuiltPlanSkeleton;
export function createPlanPoseSink(skeleton: BuiltPlanSkeleton): PlanPoseSink; // { sink, finishFrame }
```

Bones: one per spine segment (`spine.0`…`spine.<n-1>`, parented root→tip), one per chain link (`<chainId>.<j>`, parented along the chain, chain root bone parented to its spine-attach bone — or to its parent chain's tip bone for tauric `parentId` chains), terminal ball bones (`head<i>`, `<chainId>.foot`, `<chainId>.palm`). The rest pose is computed by constructing a real `PlanDriver`, stepping it with dt = 0, and capturing its emissions through a collecting sink — the same parity trick `skeletonBuilder.test.ts` pins for bipeds, no re-derivation of driver math. The pose sink maps `seg`/`ball` by id; `tube(id, flat, radii)` decomposes to per-link transforms (points are joints in order: spine polyline front→rear, chain polyline root→tip). Unknown ids throw.

- [ ] Failing tests, run against the spec's stress fixtures from `textPlan/fixtures.ts` — Gladefoot Centaur (tauric parentId chains), Gelatinous Cube (box spine — bones only; see Task 2 scope), Tyrant Orb (floating, crown necks), Barrow Wisp (legless upright) — plus Emberwing Dragon (wings) and Threefold Fen Serpent (serpentine):
  (a) bone world positions at rest equal the driver's rest emissions within 1e-6, per fixture;
  (b) drift: after 120 stepped frames at walk speed, pose-sink bone world transforms match a fresh collecting-sink capture within 1e-6 (the slice-1 "0.0000 drift" contract, generalized);
  (c) `tube` and `seg` emission paths produce identical bone transforms for the same pose;
  (d) unknown emission id throws (fail loud);
  (e) determinism: two `buildPlanSkeleton` calls are structurally identical.
- [ ] Run → FAIL (module missing). Implement. Run → PASS.

### Task 2: Rigid-weight skinned plan body through the stack

**Files:** `three/skinnedBody.ts`, `three/assembleEntity.ts`, extend `__tests__/planSkeleton.test.ts`

- [ ] Rigid bind geometry from the rest emissions (every vertex owned by exactly one bone — the slice-1 parity strategy; creature SMOOTH weights are explicitly deferred, see below). Spine tubes/segments, chain tubes/segments, terminal balls bind per their owning bone. Box spines (cube) bind as rigid per-segment boxes owned by their spine bone — bones exist for every fixture; if the box bind path proves ugly, cube may be guarded out with a loud error instead, but that is a scope retreat to record in the Plan Map, not a silent fallback.
- [ ] `assembleEntity` admits `bodyTech: 'skinned'` when `gait === 'plan'`; guard message updated to name the gaits that still throw (`quad`, `hexapod`, `hopper`, `flyer`, `float`).
- [ ] Failing tests: (a) weights sum to 1, exactly 1 nonzero influence per vertex, indices in range; (b) body = exactly 2 draw-call meshes; triangles < `PLAN_TRIANGLE_BUDGET` for every stress fixture; (c) A/B parity: skinned-rigid joint positions match the segment renderer's per frame over a walk cycle (slice-1 contract); (d) decorative emissions (rings, collars, cilia, snouts, fingers, toes) still render through the anchor path — a creature with `jointRings`/`cilia`/`snout` assembles with zero dropped pieces; (e) guards: `bodyTech: 'skinned'` + `gait: 'quad'` throws.
- [ ] Run → FAIL. Implement. Run → PASS. Full neighbor suites green: `npx vitest run src/systems/entities3d`.

### Task 3: Heads and parts ride bones + eyeball surface

**Files:** `three/assembleEntity.ts` (head parenting), `src/components/DesignPreview/steps/PreviewEntityForge.tsx`

- [ ] Formed heads and head-ball meshes parent to their `head<i>` bone (neck-tip or socket bone for neckless heads); gear parts keep the existing anchor path — `Pose` anchors stay a read view (spec: "anchors stay as a read view for compatibility"). No part re-parenting beyond heads in this slice.
- [ ] Eyeball surface: creature mode and describe/library mode get the same A/B the humanoid sidebyside has (segments vs skinned-rigid), deep-linkable for headless capture.
- [ ] Typecheck filtered to touched files clean; scoped lint clean; `git diff --check` clean; dependency-header sync for every file whose imports/exports changed.
- [ ] Mounted A/B captures (gitignored under `.agent/scratch/`) for all six stress fixtures walking and idle; harsh critique list written; iterate nits within the slice; Remy gate.

## Explicitly deferred (do not smuggle in)

- Creature SMOOTH joint weights (reuse `smoothBipedGeometry`'s chain-loft approach in a later dial slice; the spec's "one-piece creased bodies" payoff for creatures).
- Species gaits (`quad`, `hexapod`, `hopper`, `flyer`, `float`) skeletons — required before slice 5's kill, not contracted anywhere yet; candidate for its own plan.
- Mixamo clip playback (PARKED, Remy 2026-07-23).
- Crowd bake from bone transforms and segment-renderer deletion (spec slice 5 — only after every surface and the wireframe/solid compatibility gates are proven).
- Part re-parenting beyond heads (anchors remain the compatibility view).
