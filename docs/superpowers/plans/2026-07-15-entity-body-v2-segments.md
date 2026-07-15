# Entity Body v2 (Segmented Humanoids) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace metaball blob bodies with articulated segment meshes (proper arms, legs, torso, neck) across every gait and surface; wireframe becomes clean edge lines.

**Architecture:** Gait drivers emit a per-frame segment list (joints they already compute) instead of metaballs; the assembler builds one tapered mesh per segment once and re-transforms them per frame. Organic field parts become chain parts (animated segment chains) or plain mesh parts. `EdgesGeometry` line rendering replaces `material.wireframe`. MarchingCubes and all field machinery are deleted.

**Tech Stack:** TypeScript, three ^0.172 (CylinderGeometry/SphereGeometry/EdgesGeometry/LineSegments), vitest 4; verified on the new vistest runner + entity debugger.

**Spec:** `docs/superpowers/specs/2026-07-15-entity-body-v2-segments-design.md`

## Global Constraints

- No git commits/branches/worktrees; tasks end at "tests green". Agora locks held on `src/systems/entities3d/**` (agent `fable-entitygen`).
- `EntityHandle` public contract unchanged except `stats()` fields; `AssembleOptions.resolutionScale/fieldUpdateHz` accepted as deprecated no-ops (surfaces untouched this slice).
- No fallbacks; GOV.UK plain English, US spelling.

## File Structure

```
src/systems/entities3d/
  types.ts                — BallSink/PartPhase survive for chains? NO: BodySegment + SegmentSink types added; BallSink + field types deleted
  three/gaits.ts          — drivers emit segments via SegmentSink (buildBody(sink: SegmentSink))
  three/segmentBody.ts    — NEW: build-once segment meshes + per-frame transform sync + joint spheres + head
  three/assembleEntity.ts — REWRITE body block: segmentBody + EdgesGeometry wireframe; MarchingCubes/FieldSink deleted
  three/crowdBake.ts      — bake = merge segment+part meshes per phase (mc extraction deleted)
  parts/fieldParts.ts     — → parts/chainParts.ts (tails/tentacles/antennae as 'chain') + organic mesh parts move to parts/organicParts.ts
  registry/types          — PartDef kind: 'mesh' | 'chain'; buildChain(frame, params, phase, anchors) → BodySegment[]
  __tests__/*             — gaits/parts/assemble/crowdBake updated to segment world
```

---

### Task 1: Segment contracts + gait emission

**Files:** Modify `types.ts`, `three/gaits.ts`, `__tests__/gaits.test.ts`

**Produces:**
```ts
// types.ts
export interface BodySegment { id: string; ax: number; ay: number; az: number; bx: number; by: number; bz: number; r0: number; r1: number; }
export interface SegmentSink { seg(id: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1: number): void; ball(id: string, x: number, y: number, z: number, r: number): void; }
// gaits.ts — GaitDriver.buildBody(sink: SegmentSink) — same joints, segments instead of metaballs; head via sink.ball('head', …)
```
Biped emits: torso `pelvis|waist|chest`, `neck`, head ball, per side `upperArm|forearm` + `hand` ball, `thigh|shin` + `foot` ball. Quad/hexa: `spineA|spineB`, `neck`, head ball, per-leg `legU|legL` + foot ball. Hopper/float/flyer: stacked torso segments + head ball (+ flyer tail/feet balls). Segment ids stable across frames (`armL.upper` etc.) so the renderer can map mesh↔segment once.

- [x] Rewrite gait tests: every gait emits ≥6 segments + 1 head ball, all coords finite, radii > 0; biped limb chains CONNECT (forearm.a == upperArm.b within 1e-6; shin.a == thigh.b); ids stable between two updates; hands swing (existing behavior tests keep passing).
- [x] Implement; `npx vitest run src/systems/entities3d/__tests__/gaits.test.ts` → PASS.

### Task 2: Chain + organic parts (field kind dies)

**Files:** Rename/rewrite `parts/fieldParts.ts` → `parts/chainParts.ts` + new `parts/organicParts.ts`; modify `types.ts` (PartDef), `registry.ts` validation, `parts/index.ts`, `__tests__/parts.test.ts`

**Produces:** `PartDef.kind: 'mesh' | 'chain'`; `buildChain(frame, params, phase, anchors): BodySegment[]` for `tailThin`, `tailThick`, `tentacles`, `antennae` (same wag math, segments instead of balls). Converted to MESH parts in `organicParts.ts`: `snout`, `muzzleShort`, `tuskJaw`, `brow`, `belly`, `crest`, `beardField` (cones/spheres/boxes at their anchors, palette-colored; same ids so profiles/kits need zero changes).

- [x] Update parts tests: all 37 ids still registered; chain parts return connected finite segments; mesh parts build Objects with meshes; field kind gone from the registry validator.
- [x] Implement; parts + raceMap + classKits + creatureProfiles + blueprint suites all PASS unchanged (ids preserved).

### Task 3: Segment body renderer + assembler rewrite

**Files:** Create `three/segmentBody.ts`; rewrite the body block of `three/assembleEntity.ts`; modify `three/toon.ts` (line material helper); update `__tests__/assemble.test.ts`

**Produces:**
```ts
// segmentBody.ts
export interface SegmentBodyOptions { renderMode: EntityRenderMode; colorHex: string; outlineThickness: number }
export function createSegmentBody(opts): { root: Group; sink: SegmentSink; finishFrame(): void; dispose(): void; triangles(): number }
```
Build-once-per-id: tapered `CylinderGeometry(r1, r0, 1)` per segment id (scale.y = live length each frame; radii frame-constant), `SphereGeometry` per ball id and at segment joints; orientation via quaternion from +Y to (b−a). Solid mode: toon material + inverse-hull outline shell per mesh. Wireframe mode: `LineSegments(new EdgesGeometry(geo, 25))` ONLY (no fill), line color = brightened body/part color; ALSO applied to mesh parts in `assembleEntity` (replacing `material.wireframe`). Assembler deletes: MarchingCubes, FieldSink, ISO/SUBTRACT, resolution tiers, poly budget, field throttling; keeps: eyes, shadow, parts anchoring, wings flap, pose/setGaitPhase; `stats()` → `{ segments, triangles, renderMode, lastFieldRebuildMs: 0 }` (field field kept for API compat, always 0).

- [x] Update assemble tests: body root contains one mesh (or line) per segment id + joint spheres; wireframe → zero `Mesh` fill for the body & parts and zero outlines, all body/part visuals are `LineSegments`; solid → outlines present; gear re-anchors while walking (unchanged test); dispose empty; debug API tests keep passing (pose/setGaitPhase).
- [x] Implement; `npx vitest run src/systems/entities3d` → all PASS.

### Task 4: Crowd bake v2

**Files:** Modify `three/crowdBake.ts`, `__tests__/crowdBake.test.ts` expectations unchanged (7→9 keyframes API same)

Bake = drive the driver to the phase, run the segment sink into a throwaway `createSegmentBody` (solid mode), snapshot every mesh's transformed geometry (+ parts, as today) via `mergeGeometries` with vertex colors. Delete the mc/`fieldToGeometry` path.

- [x] Tests green with identical assertions (positions/normals/colors present; phases differ; cache works).

### Task 5: Full verification + look iteration

- [x] Full suites: `npx vitest run src/systems/entities3d src/components/World3D src/components/BattleMap src/devtools/vistest`; typecheck filtered to touched files.
- [x] Debugger iteration (the real gate): dwarf wizard idle+walk (front/side), human fighter walk, goliath, fairy; Dragon Huge quad; spider hexapod; Ooze hopper; anchors overlay sanity. Fix proportions until humanoid reads: distinct head/neck/shoulders, visible elbows/knees, no sausage merging. Wireframe: clean lines.
- [x] Proof: debugger/forge captures (fighter solid+wire, dwarf, dragon, lineup) eyeballed + shown; in-game cast scenario needs a gentler zoom tune (scenarios.ts locked by the lab agent — follow-up).
- [x] Closeout: planmap (feature under `entity-generator-3d`: "Body v2: segmented humanoids (metaballs removed)" done — lock topics.json when free), memory update (entity-generator-3d + handover doc addendum), Agora say + unlock.
