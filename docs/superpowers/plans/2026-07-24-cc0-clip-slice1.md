# CC0 Clip Animation — Slice 1: Humanoid Retarget Substrate

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Load a CC0 human clip pack, retarget one clip (Walk) onto our 17-bone biped, and play it on a skinned humanoid in the entity debugger.

**Architecture:** `SkeletonUtils.retargetClip` (three examples/jsm) bakes each source clip into a new clip whose tracks target OUR bone names, using world-space matrices so the source A-pose bind and our bind reconcile. Retarget once against a reference biped, cache globally (rotation retarget is proportion-independent; we strip root/hip translation for in-place). An `AnimationMixer` on each entity's own skeleton plays the cached clips. Opt-in via `animSource: 'clip'`; procedural stays default.

**Tech Stack:** TypeScript, three ^0.172 (`examples/jsm/utils/SkeletonUtils`, `examples/jsm/loaders/GLTFLoader`), vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-24-cc0-clip-animation-design.md`

## Global Constraints

- No git commits/branches/worktrees; tasks end at "tests green".
- No fallbacks; clips run only on `bodyTech: 'skinned'` (a clip needs bones) — requesting them on a segment body throws.
- Determinism where pure (bone map, track strip). Clip loading is async/browser — proven by the debugger, jsdom smoke where feasible.
- Assets are CC0; ship a NOTICES file.
- Test: `npx vitest run <path>`; typecheck filtered. US English.

## File Structure

```
public/anim/humanoid/human-base-animations.glb   (bundled, 5.4 MB)
public/anim/humanoid/human-addon-animations.glb  (bundled, 5.1 MB)
public/anim/NOTICES.md
src/systems/entities3d/anim/
  humanoidRetarget.ts   — HUMANOID_BONE_MAP (our→their) + stripToInPlace() (pure)
  clipStore.ts          — lazy GLTFLoader load + retarget + cache (three)
src/systems/entities3d/three/
  skinnedClipPlayer.ts  — AnimationMixer wrapper (play/setSpeed/sampleAtPhase/dispose)
  assembleEntity.ts     — animSource option, mixer drive path
src/systems/entities3d/__tests__/humanoidRetarget.test.ts  — pure map + strip
```

---

### Task 1: Bone map + in-place strip (pure)

**Files:** create `anim/humanoidRetarget.ts`, test `__tests__/humanoidRetarget.test.ts`

**Produces:**
```ts
export const HUMANOID_BONE_MAP: Readonly<Record<BipedBoneName, string>>;
// our bone → mesh2motion rig bone. root→root, pelvis→pelvis, chest→spine_03,
// neck→neck_01, head→head, upperArm{L,R}→upperarm_{l,r}, foreArm→lowerarm,
// hand→hand, thigh→thigh, shin→calf, foot→foot.
export function retargetNames(): Record<string, string>; // our→their, for SkeletonUtils options.names
export function stripToInPlace(clip: AnimationClip): AnimationClip; // drop every .position track (root incl.)
```

- [ ] Failing tests: every `HUMANOID_BONE_MAP` key is a real `BipedBoneName`; all 17 our-bones are keys; values are non-empty strings; `stripToInPlace` returns a clip with zero `.position`/`.scale` tracks and the same `.quaternion` track count.
- [ ] Run → FAIL. Implement (`stripToInPlace` filters `clip.tracks` by `.endsWith('.quaternion')`, returns `new AnimationClip(name, duration, kept)`). Run → PASS.

### Task 2: Clip store (retarget + cache)

**Files:** create `anim/clipStore.ts`

Interface:
```ts
export async function loadHumanoidClips(packUrl: string): Promise<Map<string, AnimationClip>>;
// GLTFLoader load → find source SkinnedMesh (its .skeleton is the rig) →
// build a reference biped (buildBipedSkeleton(deriveFrame('biped',6,1,1))) wrapped
// in a SkinnedMesh bound to it as the retarget target → for each source clip:
//   retargetClip(target, sourceObject, clip, { names: retargetNames(), hip: 'pelvis' })
//   → stripToInPlace → set .name → cache. Module-level cache keyed by packUrl.
```

- [ ] Manual/integration only (browser asset). Verified by the debugger in Task 4; a jsdom smoke test is optional and skipped if GLTFLoader needs WebGL.

### Task 3: Clip player

**Files:** create `three/skinnedClipPlayer.ts`

```ts
export interface SkinnedClipPlayer {
  play(clipName: string, opts?: { loop?: boolean; fadeSec?: number }): void;
  setSpeed(mps: number): void;      // scale timeScale off an authored base speed
  sampleAtPhase(phase01: number): void; // debugger scrub: pause + set mixer time
  update(dt: number): void;
  dispose(): void;
  clipNames(): string[];
}
export function createSkinnedClipPlayer(skeletonRoot: Object3D, clips: Map<string, AnimationClip>): SkinnedClipPlayer;
// AnimationMixer(skeletonRoot); clipAction per name; crossfade on play; walk base speed ~1.4 m/s.
```

- [ ] Implement; a lightweight vitest constructs a mixer over a tiny bone root + one hand-built quaternion clip, calls play/update/sampleAtPhase, asserts no throw and that time advances. (No GLTF needed.)

### Task 4: assembleEntity wiring + debugger proof

**Files:** `three/assembleEntity.ts`, `three/Entity3D.tsx`, `PreviewEntityDebug.tsx` (a `?clip=1` toggle)

- [ ] `AssembleOptions.animSource?: 'procedural' | 'clip'` (default procedural). `clip` requires `bodyTech: 'skinned'` (throw otherwise). When clip + a loaded clip map is provided, the handle drives the `AnimationMixer` in `update()` instead of posing bones from the driver; the driver still advances for locomotion/facing.
- [ ] Debugger: `?planId`-less humanoid with `&clip=1` loads the pack, mounts the player, plays `Walk`. Prove on :3000 — screenshot the skinned biped mid-stride under clip motion vs procedural.
- [ ] `npx vitest run src/systems/entities3d` green; typecheck clean; NOTICES.md written.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-07-24-cc0-clip-slice1.md","sha256WithoutMarker":"a75ce537f3782e1a8a2c92f783210fe9d77c5c59103620b79f0721a375bbc977","markedAtUtc":"2026-08-09T20:23:18.413Z"} -->
