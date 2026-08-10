# Junction Blend (Slice 1: Collars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** One 0–1 softness number per creature (and per appendage) that renders as smoothing collars where limbs meet the body — slime melts, golem stays sharp.

**Architecture:** Schema v1.3 adds `skin.blend` + `PlanAppendage.blend`; `compilePlan` resolves to `blendM` meters per chain; `PlanDriver.buildBody` emits a new `collar()` sink primitive per frame; the segment renderer updates pre-allocated collar geometry like the swept tubes. Slice 2 (fused skin) is specced, gated on the skeleton pivot, and NOT in this plan.

**Tech Stack:** TypeScript, three ^0.172, vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-23-junction-blend-design.md`

## Global Constraints

- **No git commits/branches/worktrees** (standing rule; 2am auto-snapshots). Tasks end at "tests green".
- **No fallbacks:** invalid blend values fail validation with named errors; no clamping.
- **Determinism:** compile stays pure; no randomness anywhere in this feature.
- **Budgets:** `perfBudget.test.ts` (30k plan budget) must stay green with collars.
- Test: `npx vitest run <path>`; typecheck filtered to touched files.
- US English, ASD-STE100 Simplified Technical English in copy and errors.

## File Structure

```
src/systems/entities3d/
  textPlan/planSchema.ts     — skin.blend + appendage blend + PLAN_LIMITS.blend
  textPlan/compilePlan.ts    — resolution to chain.blendM (+ skinBlend passthrough)
  textPlan/fixtures.ts       — ooze skin.blend 1; serpent skin.blend 0
  types.ts                   — PlanSpec chain blendM; SegmentSink.collar?
  three/gaits.ts             — PlanDriver emits collar() per frame
  three/segmentBody.ts       — collar primitive (pre-allocated, per-frame update)
  __tests__/planSchema.test.ts / compilePlan.test.ts / planDriver.test.ts / segmentBody collar test
scripts/vite-plugins/devhub/creaturePlanRoutes.ts — prompt gains the field
```

---

### Task 1: Schema v1.3 — the blend fields

**Files:** `textPlan/planSchema.ts`, test `__tests__/planSchema.test.ts`

**Produces:** `CreaturePlan.skin?: { blend: number }`; `PlanAppendage.blend?: number`; `PLAN_LIMITS.blend: [0, 1]`.

- [x] Failing tests: accepts `skin: { blend: 1 }` and `appendages[i].blend: 0.5`; rejects `skin.blend: 1.4` (`skin.blend 1.4 outside 0–1`), `blend: -0.1` on an appendage, `skin: { wobble: 1 }` (`unknown field skin.wobble`), non-object `skin`.
- [x] Run → FAIL. Implement (allowlist `skin` top-level key + `blend` in appendage key list; range checks). Run → PASS.

### Task 2: Compile — resolve to meters

**Files:** `textPlan/compilePlan.ts`, `types.ts`, test `__tests__/compilePlan.test.ts`

**Produces:** `PlanSpec.chains[].blendM: number` (0 when resolved blend is 0); `PlanSpec.skinBlend?: number`.

Resolution: appendage override → `skin.blend` → per-kind default (tentacle 0.5, neck 0.5, tail 0.4, leg 0.35, arm 0.35, wing 0.15; torso 0.35). Meters: `blend × min(rootLinkRM, hullRadiusAtAttachM) × 2`; torso-parented chains use the parent chain root radius as the second term.

- [x] Failing tests: per-kind default applied (dragon leg ≈ 0.35 path, hand-computed meters); `skin.blend 1` beats defaults; appendage `blend 0` kills its collar (`blendM === 0`); torso-parent case; determinism (two compiles identical).
- [x] Run → FAIL. Implement. Run → PASS.

### Task 3: Collar primitive — driver emission + renderer

**Files:** `types.ts` (SegmentSink), `three/gaits.ts` (PlanDriver), `three/segmentBody.ts`, tests `__tests__/planDriver.test.ts` + segment renderer test

**Produces:**

```ts
// SegmentSink
collar?(id: string, rootX: number, rootY: number, rootZ: number,
        axX: number, axY: number, axZ: number,
        limbR: number, reach: number): void;
```

Driver: for each chain with `blendM > 0.02`, emit `collar('col-' + chain.id, root joint pos, root link axis, root link rM, blendM)` every frame after limb emission. Renderer: pre-allocated ring-skirt geometry per collar id (10 radial × 3 rings ≈ 60 tris), vertices recomputed on update — skirt arcs from the limb wall (0.6 × reach up the axis) to the hull wall (reach outward at the root, perpendicular to the axis), body toon material.

- [x] Failing driver test: fixture dragon emits `col-leg0L` etc. with reach = its chain's blendM; serpent (blend 0 fixture after Task 4 — use an inline plan with `skin.blend: 0`) emits none.
- [x] Failing renderer test: collar vertices lie within [rootPos ± reach × 1.5]; update with a moved root repositions vertices; blend 0 chain produces no collar geometry.
- [x] Run → FAIL. Implement both sides. Run → PASS.
- [x] `npx vitest run src/systems/entities3d/__tests__/perfBudget.test.ts` → PASS (budgets hold).

### Task 4: Prompt, fixtures, visual proof

**Files:** `scripts/vite-plugins/devhub/creaturePlanRoutes.ts` (prompt text), `textPlan/fixtures.ts`

- [x] Prompt: document `skin.blend` + per-appendage `blend` with the semantic anchors (0 bony/chitinous … 1 amorphous), inside the existing schema block.
- [x] Fixtures: ooze gains `skin: { blend: 1 }`; serpent gains `skin: { blend: 0 }`; dragon untouched (per-kind defaults).
- [x] Full suite: `npx vitest run src/systems/entities3d scripts/vite-plugins/devhub` → all green.
- [x] Visual gate on :3000 — contact sheets of ooze (melted), dragon (muscled roots), serpent (sharp), plus a walking shoulder close-up in the debugger; Remy eyeballs.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-07-23-junction-blend.md","sha256WithoutMarker":"d360db3a0d7fb4d72a1a0980c3085fecd927ee3d6e10988a12ddbe2bd65b41bd","markedAtUtc":"2026-08-09T20:23:18.360Z"} -->
