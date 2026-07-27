# Skeleton Pivot Slice 3: Smooth Bodies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The skinned biped stops being cylinders-plus-ball-joints: each limb and the torso become one continuous tube whose vertices blend between the two nearest bones near joints — elbows and knees crease like flesh instead of shearing apart.

**Architecture:** A new pure module lofts one tube per bone chain (torso pelvis→neck, each arm shoulder→wrist, each leg hip→ankle) from the existing `BipedRestPose`, writing ≤2-influence smoothstep-blended skin weights; terminal pieces (head, hands, feet) stay rigid and merge in. `skinnedBody` picks rigid or smooth geometry by option; skeleton, pose adapter, materials, and draw calls (2) are untouched. Segment renderer untouched.

**Ordering note:** Mixamo clips (spec slice 2) are deferred — Remy 2026-07-23; clip files need an Adobe login or a licensed pack, neither chosen. Smooth bodies (spec slice 3) run first.

**Tech Stack:** TypeScript, three ^0.172, vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md` (slice 3)

## Global Constraints

- **No git commits/branches/worktrees**; tasks end at "tests green".
- **No fallbacks**; deforming bodies are SOLID SHADED (Remy 2026-07-21 — no skinned wireframe path).
- **Determinism**: same Frame in, same geometry out.
- **Budgets**: `HUMANOID_TRIANGLE_BUDGET` (12k) holds; body stays 2 draw calls.
- Existing suites (`skinnedBody`, `skeletonBuilder`, `assemble`, `perfBudget`) stay green — rigid remains the default until Remy approves the smooth look.
- Test: `npx vitest run <path>`; typecheck filtered to touched files. US English.

## File Structure

```
src/systems/entities3d/three/
  smoothBipedGeometry.ts    — NEW: chain lofts + blended weights (pure, exported helpers)
  skinnedBody.ts            — options.weights: 'rigid' | 'smooth' picks the geometry builder
  assembleEntity.ts         — EntityRenderOptions.skinnedWeights pass-through
src/components/DesignPreview/steps/PreviewEntityForge.tsx — sidebyside honors ?weights=smooth
src/systems/entities3d/__tests__/smoothBiped.test.ts — NEW suite
```

---

### Task 1: Chain loft + blended weights (the module)

**Files:** create `three/smoothBipedGeometry.ts`, test `__tests__/smoothBiped.test.ts`

**Produces:**

```ts
export interface ChainDef { bones: BipedBoneName[]; segIds: string[] }  // rest segments per bone, in order
export function buildSmoothBipedGeometry(
  restPose: BipedRestPose, boneIndex: ReadonlyMap<BipedBoneName, number>,
): BufferGeometry;  // position/normal/skinIndex/skinWeight/index
```

Chains: torso `[pelvis, chest, neck]`; arms `[upperArmL, foreArmL]`, `[upperArmR, foreArmR]`; legs `[thighL, shinL]`, `[thighR, shinR]`. Each chain lofts rings (radial 12) along its rest segments' a→b path: one ring at every segment end, one mid-bone ring, and 5 rings across each interior joint's blend zone (width 0.42 × the shorter adjacent bone length, centered on the joint). Ring radius comes from the rest segment radii (r0→r1 lerped; at a joint, the larger of the two adjacent end radii so there is no step). Weights: rigid outside blend zones; inside, smoothstep t across the zone gives (1−t, t) on the two adjacent bones — never more than 2 influences. Head, hands, and feet rest pieces (balls and any remaining segments not covered by chains) merge in rigid, exactly as slice 1 built them. Interior joint spheres are NOT emitted (the tube replaces them). `computeVertexNormals()` at the end.

- [x] Failing tests: (a) every vertex's weights sum to 1 within 1e-5 and use ≤2 influences; (b) a ring at the elbow joint has both upperArm and foreArm influence, a mid-upperArm ring is rigid; (c) bounding box within 6% of the rigid geometry's box per axis; (d) CPU linear-blend skinning with foreArmL rotated 90° keeps every elbow-zone vertex at ≥0.35 × its rest distance from the joint (no collapse) — helper does plain LBS with the two bone matrices; (e) determinism: two builds byte-equal positions.
- [x] Run → FAIL (module missing). Implement. Run → PASS.

### Task 2: The weights option through the stack

**Files:** `three/skinnedBody.ts`, `three/assembleEntity.ts`, extend `__tests__/smoothBiped.test.ts`

- [x] `SkinnedBodyOptions.weights?: 'rigid' | 'smooth'` (default 'rigid'); `createSkinnedBiped` picks `buildBipedBindGeometry` vs `buildSmoothBipedGeometry`. `EntityRenderOptions` gains `skinnedWeights?: 'rigid' | 'smooth'`, passed through where `bodyTech: 'skinned'` builds the body.
- [x] Failing test: `assembleEntity(bp, { renderMode: 'solid', bodyTech: 'skinned', skinnedWeights: 'smooth' })` yields a body whose fill geometry has blended weights (some vertex with two nonzero weights) and still exactly 2 draw-call meshes; triangles < `HUMANOID_TRIANGLE_BUDGET`.
- [x] Run → FAIL. Implement. Run → PASS. Full neighbor suites green: `npx vitest run src/systems/entities3d`.

### Task 3: Eyeball surface + proof

**Files:** `src/components/DesignPreview/steps/PreviewEntityForge.tsx` (sidebyside reads `?weights=smooth`)

- [x] Sidebyside forge passes the param; `design.html?step=entityforge&race=human&class=fighter&sidebyside=1&weights=smooth` shows segments vs smooth-skinned.
- [x] Typecheck filtered to touched files clean.
- [x] A/B captures on :3000 (walk + idle at the default ¾ camera, segments vs rigid-skinned vs smooth-skinned), saved gitignored under `.agent/scratch/skeleton-smooth-20260724/`. NOTE (2026-07-24, kimi-skeleton-20260724): the full melee × side/¾/face contact-sheet matrix is not exposed by the forge URL params today, so the mounted proof covers walk+idle at the default camera only. Critique: rigid↔smooth difference is subtle at default zoom (clearest at the shoulder junction and the loaded sword-arm elbow); the rigid head ball still meets the neck tube with a mild seam (by design — terminal pieces stay rigid); no tearing, collapse, or inside-out faces observed; console clean. No in-slice nits required iteration. Rigid stays the default — Remy eyeball gate still OPEN.
- [ ] Remy gate (human eyeball approval before smooth becomes the default look).
