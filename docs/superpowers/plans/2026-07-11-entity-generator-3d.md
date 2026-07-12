# Procedural 3D Entity Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generator that turns `(race, class, seed)` or `(creature type, size, seed)` into an animated, walking 3D entity built from modular parts, covering every race × class combination.

**Architecture:** Three layers — pure-data blueprint generation (feet-canon, seedPath-deterministic), a modular part registry (field parts merge into a metaball body; mesh parts attach to gait-driven anchors), and a framework-agnostic three.js assembler porting blobfolk's marching-cubes toon look and phase-based gaits. A design.html showcase step renders any combination for eyeballing.

**Tech Stack:** TypeScript, three ^0.172 (`MarchingCubes` addon), React Three Fiber 9 (thin wrapper + showcase only), vitest 4, Playwright (screenshot proof).

**Spec:** `docs/superpowers/specs/2026-07-11-entity-generator-3d-design.md`

## Global Constraints

- **No git commits, branches, or worktrees.** Work directly in master; the 2 am auto-snapshot commits. (Remy directive + Agora rule 6.) Plan tasks therefore end at "tests green", never "commit".
- **Agora:** hold locks before editing shared files (`DesignPreviewPage.tsx`, `public/planmap/topics.json`); heartbeat during long work; `unlock --mine` when done. Agent id: `fable-entitygen`.
- **Feet canon:** all authored proportions in feet; only the assembler converts (× 0.3048) to meters.
- **Determinism:** all randomness via `rngFromPath(streamPath(base, '<concern>'))` from `src/systems/worldforge/seedPath.ts`; never `Math.random`.
- **No fallbacks:** unknown race id / class id / part id throws. One real path, fail honestly.
- **Writing:** GOV.UK plain English, US spelling, in all docs and UI copy.
- Test runner: `npx vitest run <path>`; typecheck: `npm run typecheck` (once, at the end — it builds the whole repo).

## File Structure

```
src/systems/entities3d/
  types.ts                 — all shared contracts (Gait, Frame, Palette, PartInstance, recipes, blueprint)
  registry.ts              — part registry (register/get/all, invariant helpers)
  parts/                   — one file per part family + parts/index.ts registering everything
    fieldParts.ts          —   organic metaball contributions (snout, tuskJaw, brow, belly, tails, beard, tentacles, antennae, crest)
    headParts.ts           —   mesh: ears (pointed/long), horns (curved/straight/ram), beak
    gearWeapons.ts         —   mesh: sword, axe, mace, dagger, staff, bow+quiver, orb focus, lute
    gearArmor.ts           —   mesh: shield, helmet, hood, wide-brim hat, cape, pauldrons, robe skirt, belt pouch
    wingParts.ts           —   mesh: feathered + membrane wings (flap-aware)
    index.ts               —   registerAllParts()
  speciesProfiles.ts       — ~20 authored profiles (frame ranges, features, palettes)
  raceMap.ts               — every race id → profile + overrides
  classKits.ts             — 13 class ids → gear part instances + accent
  creatureProfiles.ts      — creature type × size + cues → gait/frame/parts
  generateEntityBlueprint.ts — recipe → blueprint (deterministic streams)
  recipeFromCharacter.ts   — PlayerCharacter/RichNPC → humanoid recipe (equipped gear override)
  three/
    toon.ts                — shared toon ramp, outline material, blob-shadow texture
    ik.ts                  — solveKnee two-bone IK (blobfolk port, typed)
    legs.ts                — phase Leg (stance pin / swing arc to predicted plant)
    gaits.ts               — 6 gait drivers parameterized by Frame; produce Pose (anchor transforms)
    assembleEntity.ts      — blueprint → EntityHandle (field + mesh parts + update/dispose)
    Entity3D.tsx           — R3F wrapper (<primitive> + useFrame)
  __tests__/
    registry.test.ts, parts.test.ts, raceMap.test.ts, classKits.test.ts,
    creatureProfiles.test.ts, blueprint.test.ts, gaits.test.ts, assemble.test.ts
src/components/DesignPreview/steps/PreviewEntityForge.tsx   — showcase step (new)
src/components/DesignPreview/DesignPreviewPage.tsx          — MODIFY: steps array + render line (SHARED — lock first)
public/planmap/topics.json                                  — MODIFY: entity-generator-3d node (reserved; lock first)
```

---

### Task 1: Contracts + part registry

**Files:** Create `src/systems/entities3d/types.ts`, `registry.ts`, `__tests__/registry.test.ts`

**Interfaces (produced — later tasks depend on these exact names):**

```ts
export type Gait = 'biped' | 'quad' | 'hexapod' | 'hopper' | 'flyer' | 'float';
export type Anchor =
  | 'head' | 'browL' | 'browR' | 'earL' | 'earR' | 'jaw' | 'crown'
  | 'chest' | 'back' | 'hips' | 'tailRoot'
  | 'handL' | 'handR' | 'hipL' | 'hipR';
export interface Frame {            // ALL FEET
  heightFt: number;                 // heel to crown (or ground to back for quads)
  bulk: number;                     // 0.6 gaunt … 1.6 massive (radius multiplier)
  headScale: number;                // relative head size, 1 = human
  limbLengthFt: number;             // hip→heel
  armLengthFt: number;              // shoulder→fingertip (bipeds)
  shoulderWidthFt: number;
  stanceWidthFt: number;
}
export interface Palette { skinHex: string; accentHex: string; secondaryHex: string; eyeHex: string; }
export interface PartInstance { partId: string; anchor: Anchor; params?: Record<string, number | string>; }
export type EntityRecipe =
  | { kind: 'humanoid'; raceId: string; classId: string; seed: string; gearOverride?: PartInstance[] }
  | { kind: 'creature'; creatureType: string; size: 'Tiny'|'Small'|'Medium'|'Large'|'Huge'|'Gargantuan'; seed: string; cues?: string[] };
export interface EntityBlueprint {
  gait: Gait; frame: Frame; palette: Palette; parts: PartInstance[];
  label: string;                    // "Hill Dwarf Wizard" / "Large Beast"
}
export interface BallSink { ball(x: number, y: number, z: number, r: number): void; }
export interface PartDef {
  id: string;
  anchor: Anchor;                   // default anchor (instances may override)
  kind: 'field' | 'mesh';
  buildField?(sink: BallSink, frame: Frame, params: Record<string, number | string>, phase: PartPhase): void;
  buildMesh?(ctx: PartMeshCtx): { object: import('three').Object3D };
}
export interface PartPhase { t: number; gaitPhase: number; flap: number; }   // for animated field parts (tail wag)
```

`registry.ts`: `registerPart(def)` (throws on duplicate id), `getPart(id)` (throws if missing — no fallback), `allParts()`, `resetRegistryForTests()`.

- [x] Write failing `registry.test.ts`: duplicate id throws; missing id throws; register/get roundtrip; every registered part has `buildField` xor/or `buildMesh` consistent with `kind`.
- [x] Run `npx vitest run src/systems/entities3d/__tests__/registry.test.ts` → FAIL (module missing).
- [x] Implement `types.ts` + `registry.ts`. Re-run → PASS.

### Task 2: Part catalog

**Files:** Create `parts/fieldParts.ts`, `parts/headParts.ts`, `parts/gearWeapons.ts`, `parts/gearArmor.ts`, `parts/wingParts.ts`, `parts/index.ts`, `__tests__/parts.test.ts`

**Consumes:** Task 1 contracts. **Produces:** `registerAllParts()` and these part ids (referenced verbatim by profiles/kits):
`snout`, `muzzleShort`, `tuskJaw`, `brow`, `belly`, `tailThin`, `tailThick`, `beardField`, `tentacles`, `antennae`, `crest`,
`earsPointed`, `earsLong`, `hornsCurved`, `hornsStraight`, `hornsRam`, `beak`,
`swordMain`, `axeMain`, `maceMain`, `daggerMain`, `staffMain`, `bowMain`, `orbFocus`, `luteBack`,
`shieldOff`, `daggerOff`, `helmet`, `hoodUp`, `hatWide`, `capeCloak`, `pauldrons`, `robeSkirt`, `beltPouch`, `quiverBack`,
`wingsFeathered`, `wingsMembrane`.

Mesh parts build from primitive geometries with `MeshToonMaterial` + inverse-hull outline (shared helper from Task 7's `toon.ts` — for this task, parts return geometry-building closures; materials injected by the assembler ctx so parts stay renderer-agnostic). Field parts emit balls proportional to `frame.bulk` and `frame.heightFt`.

- [x] Write failing `parts.test.ts`: after `registerAllParts()`, all ids above exist; field parts emit ≥1 ball into a recording `BallSink`; mesh parts produce an `Object3D` with ≥1 child mesh; calling `registerAllParts()` twice does not double-register (idempotent guard).
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 3: Species profiles + race map (full race coverage)

**Files:** Create `speciesProfiles.ts`, `raceMap.ts`, `__tests__/raceMap.test.ts`

**Consumes:** part ids (Task 2). **Produces:**

```ts
export interface SpeciesProfile {
  id: string;
  gait: Gait;                                  // humanoid profiles: 'biped' (fairy: 'flyer' hover — still biped frame)
  heightRangeFt: [number, number];
  bulkRange: [number, number];
  headScale: number;
  features: PartInstance[];                    // ears/horns/snout/tail/wings…
  skinTones: string[];                         // hex bank
  eyeTones: string[];
}
export function profileForRace(raceId: string): { profile: SpeciesProfile; overrides: Partial<SpeciesProfile> };
```

~20 profiles: `human, elf, dwarf, halfling, gnome, orcish, goblinoid, tiefling, dragonborn, kobold, goliath, aasimar, genasi, gith, feline, avian, reptilian, bulky-beastfolk (loxodon/minotaur/giff/tortle), insectoid (thri-kreen), constructed, feyfolk (satyr/firbolg/centaur/fairy), shapeshifter, planar (triton/vedalken/kalashtar/kender/plasmoid/simic)`. `raceMap.ts` maps **all 111 race ids** (including the 5 non-selectable bases) with per-race overrides (palette shifts, bulk, feature swaps — e.g. `drow` obsidian skin, `red_dragonborn` crimson, `stout_halfling` bulk+).

- [x] Write failing `raceMap.test.ts` (imports `ALL_RACES_DATA` from `src/data/races`): every race id resolves via `profileForRace` without throwing; every referenced part id exists in the registry; height ranges positive and inside 1–30 ft; ordering assertions `gnome < dwarf < human < goliath` (midpoints).
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 4: Class kits

**Files:** Create `classKits.ts`, `__tests__/classKits.test.ts`

**Produces:** `export function kitForClass(classId: string): { gear: PartInstance[]; accentHex: string; secondaryHex: string }` — 13 kits (fighter, barbarian, bard, cleric, druid, ranger, rogue, paladin, monk, sorcerer, warlock, wizard, artificer). Armor tier from proficiencies (plate → `pauldrons`+`helmet`; light → hood/cape; none → `robeSkirt`+`hatWide` for wizard, sash for monk), iconic main/off-hand, extras (`quiverBack` for ranger, `luteBack` for bard, `beltPouch` for artificer/rogue).

- [x] Write failing `classKits.test.ts` (imports `CLASSES_DATA` from `src/data/classes`): every class id resolves; every part id exists; every kit has a MainHand-anchored (`handR`) part; accent hexes are valid `#rrggbb`.
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 5: Creature profiles

**Files:** Create `creatureProfiles.ts`, `__tests__/creatureProfiles.test.ts`

**Produces:** `export function profileForCreature(creatureType: string, size: SizeCat, cues?: string[]): CreatureResolved` — gait/frame/features/palette per the spec table (Beast→quad, Dragon→quad+`wingsMembrane`+`snout`+`tailThick`, Ooze→hopper squash, Aberration→float+`tentacles`, Monstrosity→quad (`hexapod` on cue 'spider'|'insect'), Undead→biped gaunt (quad on cue 'beast'), Construct→biped, Elemental→float, Plant→biped shambler, Fey/Fiend/Celestial→biped variants (+`hornsCurved`/`wingsFeathered`), Giant→biped, Humanoid→biped). Size bands: Tiny 1.5 ft, Small 3, Medium 5.5, Large 9, Huge 15, Gargantuan 25 (± jitter range).

- [x] Write failing `creatureProfiles.test.ts` (imports `CreatureType` values from `src/types/creatures`): all 14 types × 6 sizes resolve; frames monotonic in size; spider cue flips Monstrosity to hexapod; unknown type throws.
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 6: Blueprint generator + character mapper

**Files:** Create `generateEntityBlueprint.ts`, `recipeFromCharacter.ts`, `__tests__/blueprint.test.ts`

**Produces:**
```ts
export function generateEntityBlueprint(recipe: EntityRecipe): EntityBlueprint;
export function recipeFromCharacter(pc: PlayerCharacter, seed?: string): EntityRecipe; // gearOverride from equippedItems
```
Streams: base path `makeSeedPath(fnv1a(seed) as world, 'entity')` equivalent — use `rootSeedPath` + `childSeedPath` with the seed string, then `streamPath(base,'frame'|'palette'|'features'|'gear')`. Gear mapping in `recipeFromCharacter`: weapon `category` contains 'Ranged'→`bowMain`, name contains axe→`axeMain`, mace/hammer/club→`maceMain`, dagger→`daggerMain`, staff→`staffMain`, else `swordMain`; OffHand shield→`shieldOff`; armorCategory Heavy→`pauldrons`+`helmet`, Medium→`pauldrons`, Light→`capeCloak`; Head/Cloak slot items → `helmet`/`capeCloak`.

- [x] Write failing `blueprint.test.ts`:
  - determinism: two calls, deep-equal result;
  - stream independence: blueprints for same seed with different classId share identical `frame` and `palette.skinHex`;
  - **full coverage: for every selectable race × every class, `generateEntityBlueprint` resolves and every `parts[].partId` exists in the registry** (106 × 13 = 1,378 combos);
  - creature path: `{kind:'creature', creatureType:'Beast', size:'Large'}` → gait 'quad';
  - `recipeFromCharacter` maps a plate-and-shield fighter to `pauldrons`+`helmet`+`shieldOff`.
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 7: Gait runtime (IK, legs, gaits, toon)

**Files:** Create `three/toon.ts`, `three/ik.ts`, `three/legs.ts`, `three/gaits.ts`, `__tests__/gaits.test.ts`

**Produces:**
```ts
// ik.ts — straight port of blobfolk solveKnee, typed, no globals
export function solveKnee(hip: Vector3, foot: Vector3, l1: number, l2: number, bendDir: Vector3, out: Vector3): Vector3;
// legs.ts
export class PhaseLeg { constructor(restLocal: Vector3, phaseOffset: number, opts?: { duty?: number; liftH?: number });
  update(ctx: LegCtx): void; readonly pos: Vector3; }
// gaits.ts
export interface Pose { anchors: Record<Anchor, { pos: Vector3; quat: Quaternion }>; }
export interface LocomotionState { position: Vector3; heading: Vector3; speed: number; airborneY?: number; }
export interface GaitDriver { update(t: number, dt: number, loco: LocomotionState): void;
  buildBody(sink: BallSink): void;     // emits torso/limb balls for this frame
  readonly pose: Pose; readonly gaitPhase: number; readonly flap: number; }
export function createGaitDriver(gait: Gait, frame: Frame): GaitDriver;
```
All six drivers scale blobfolk's hardcoded numbers by `frame` (heights ∝ `heightFt`, radii ∝ `bulk`, leg IK segment lengths from `limbLengthFt/2`). `toon.ts`: 3-step ramp `DataTexture`, `outlineMaterial(color, thickness)` (BackSide normal-push shader), radial blob-shadow canvas texture.

- [x] Write failing `gaits.test.ts` (pure three math, no renderer): `solveKnee` knee is `l1` from hip and `l2` from foot (±1e-4) for reachable targets, clamps at full extension; biped driver exposes all `Anchor` keys in pose; `handR` moves between t=0 and t=0.4 (arm swing); hopper's `airborneY ≥ 0` cycle; each of the 6 gaits `buildBody` emits >4 balls into a recording sink.
- [x] Run → FAIL. Implement. Re-run → PASS.

### Task 8: Assembler + R3F wrapper

**Files:** Create `three/assembleEntity.ts`, `three/Entity3D.tsx`, `__tests__/assemble.test.ts`

**Produces:**
```ts
export interface EntityHandle { group: Group; update(t: number, dt: number, loco?: LocomotionState): void;
  readonly blueprint: EntityBlueprint; dispose(): void; }
export function assembleEntity(blueprint: EntityBlueprint): EntityHandle;
export function Entity3D(props: { blueprint: EntityBlueprint; walking?: boolean; position?: [number,number,number] }): JSX.Element;
```
Construction: `MarchingCubes(44, toonMat, false, false, 30000)`, `isolation 80`, field scale `S` sized so the frame fits (`S = heightM * 0.62` pattern from blobfolk with `heightM = heightFt * 0.3048`); ball mapping `strength = (12 + 80) * (r/(2S))²` via a `BallSink` adapter; outline mesh sharing the field geometry; mesh parts built once at assemble time, re-anchored every frame from `driver.pose`; field parts re-emitted every frame after `mc.reset()`. Default locomotion: standing idle (speed 0, gaitPhase still ticks at idle cadence for breathing bob). `dispose()` releases geometries/materials.

- [x] Write failing `assemble.test.ts` (headless three, no WebGL): group contains exactly 1 marching-cubes object + 1 outline + one Object3D per mesh part; `update(0, 1/60)` then `update(0.5, 1/60)` moves `handR`-anchored gear when walking; dispose leaves no children.
- [x] Run → FAIL. Implement. Re-run → PASS.
- [x] Run the whole suite `npx vitest run src/systems/entities3d` → all green.

### Task 9: Showcase step + visual proof

**Files:** Create `src/components/DesignPreview/steps/PreviewEntityForge.tsx`; **Modify** `src/components/DesignPreview/DesignPreviewPage.tsx` (steps array entry `{ id: 'entityforge', label: 'Entity Forge', group: '3D' }` + render line). **Lock `DesignPreviewPage.tsx` via Agora first.**

UI: R3F canvas (ground disc + hemisphere/directional light, blobfolk sky `#bfe8ff`); left panel: mode tab (Humanoid / Creature / Lineup), race `<select>` (all `ACTIVE_RACES`), class `<select>` (13), creature type + size selects, seed input + Reroll, Idle/Walk toggle. Lineup mode: 8 seeded random race×class entities walking a circle. Expose `window.__entityforge = { scene, camera, handles }`.

- [x] Wire step; `npm run typecheck`-clean for touched files (fold into final typecheck).
- [x] Start dev server (launch.json config), open `design.html?step=entityforge`.
- [x] Capture proof: `node tools/agora/shoot-page.mjs "http://localhost:<port>/design.html?step=entityforge" .agent/scratch/entityforge-<combo>.png --wait 2500` for: human fighter, hill dwarf wizard, infernal tiefling warlock, gold dragonborn paladin, fairy bard, loxodon monk, Large Beast, Huge Dragon, Medium Ooze, lineup.
- [x] Eyeball each capture (visual inspection rule); fix what looks wrong; re-shoot.
- [x] Send Remy the proof screenshots (visual proof cadence).

### Task 10: Wrap-up

- [x] `npm run typecheck` → clean (pre-existing dev_hub failure is known background noise).
- [x] Full entities3d suite green; run adjacent touched suites (`DesignPreview` tests if any).
- [x] Retry plan-map node append (reservation held): lock `public/planmap/topics.json`, `node tools/agora/planmap-add.mjs --new-topic entity-generator-3d …`, unlock.
- [x] Glossary check: no new coined terms (plain names used); add entries only if any slipped in.
- [x] Agora: `task done`-style note via `say` (WORKFLOW line), `unlock --mine`.
- [x] Memory: write `entity-generator-3d` project memory + MEMORY.md index line.

## Self-review

- **Spec coverage:** blueprint layer (T1,3–6), part registry/modularization (T1–2), assembler+gaits (T7–8), showcase (T9), coverage tests (T3–6), visual proof (T9), determinism (T6), feet canon (T1/T8), recipeFromCharacter (T6), creature table (T5). Out-of-scope items from spec stay out. ✓
- **Placeholders:** none — every task names exact files, ids, signatures, run commands. ✓
- **Type consistency:** `PartInstance.anchor` used by kits (T4) matches `Anchor` union (T1); `GaitDriver.pose` anchors (T7) consumed by assembler (T8); `BallSink` shared T1/T2/T7/T8. ✓

---

### Task 11 (slice 2, approved by Remy 2026-07-11): swap player avatar + opening-scene cast to generated entities

**Files:**
- Modify: `src/systems/entities3d/recipeFromCharacter.ts` (+`recipeFromRichNpc`)
- Modify: `src/components/World3D/PlayerAvatar.tsx` (cylinder+sphere → assembled entity; glide-derived locomotion)
- Modify: `src/components/World3D/SceneCast.tsx` (figures → generated entities; `recipe?` on member + exported `castMemberRecipe` default = unarmed human commoner seeded by member id)
- Modify: `src/components/World3D/World3DScene.tsx` (`playerIdentity` → `playerCharacter`), `World3DWrapper.tsx` (pass `state.party[0]`; cast recipes from `recipeFromCharacter`/`recipeFromRichNpc`)
- Test: `src/systems/entities3d/__tests__/recipeFromNpc.test.ts`, extend `src/components/World3D/__tests__/SceneCast.layout.test.ts`

**Interfaces:** `recipeFromRichNpc(npc: RichNPC): EntityRecipe` (classId from biography, gear from equippedItems, seed `npc:${id}`, race defaults human — mirrors npcGenerator's own default); `castMemberRecipe(member: SceneCastMember): EntityRecipe`.

- [x] Failing tests: recipe mapping (classId, axe→axeMain etc., seed stable) + castMemberRecipe default + layout preserves `recipe`.
- [x] Implement; suite green; keep `groundSurfaceYM` export intact (3 consumers).
- [x] Wire scene + wrapper; typecheck clean on touched files.
- [x] Visual proof via Playwright (dev entry with a real/dummy party), eyeball, send Remy.
- [x] Plan-map feature status + memory update; unlock.

### Task 12 (slice 3, approved by Remy 2026-07-11): swap combat tokens to generated entities

**Files:** Create `src/systems/entities3d/recipeFromCombatant.ts` (+ `raceIdFromTags`), `characterActor/EntityModel.tsx`, `characterActor/entityOverlays.ts` (+ tests). Modify `characterActor/CharacterActor.tsx` (body → EntityModel at MODEL_SCALE = units-per-meter × 1.25 readability; size from the frame, no separate size-category multiplier; pip/nameplate ride the real head height), `three/assembleEntity.ts` (AssembleOptions: resolutionScale, fieldUpdateHz — combat runs 0.7 / 10 Hz).

- [x] TDD: combatant→recipe mapping (PCs + humanoid monsters via creatureTypes tags/name keywords → real race ids; monsters via canonical type × size + cues; unknown type throws) and combat overlay poses (melee lunge, hit recoil, cast rise, death fall + settle-freeze).
- [x] All suites green (253 across entities3d + BattleMap + World3D); typecheck clean on touched files (SummoningCommand errors pre-existing on master).
- [x] Perf verified honestly: headless combat 3D runs ~0.14 fps WITH OR WITHOUT entity bodies (pre-existing SwiftShader pathology, probed with bodies removed); field throttling + resolution scale added anyway as cheap insurance for real GPUs.
- [x] Visual proof via framebuffer-readback rig (compositor screenshots starve under the R3F loop) + `__bm3dCam.poseTeam` framing; party + enemy close-ups sent to Remy.

### Task 13 (slice 4, approved by Remy 2026-07-11): interior villagers become generated entities

**Files:** Modify `world3d/types.ts` (+`race?` on BuildingOccupantRender), `groundChunkLoader.ts` (bake `member.race` into occupant packets), `OccupantFigure.tsx` (boxes → generated entity), `InteriorOccupants.tsx` (3D camera-distance mount gate, 42 m enter / 50 m exit at 2 Hz), `entities3d/types.ts` (+`ageBand` on humanoid recipes), `generateEntityBlueprint.ts` (child/elder frame scaling), `assembleEntity.ts` (poly budget scales with resolution, floor 30k; retain/release lifecycle). Create `recipeFromOccupant.ts` (+ test).

- [x] TDD: ancestry GROUP → concrete race id (deterministic per member, mixed groups vary), child scaling, unknown group throws, older bakes default to human commoner.
- [x] Crowd-scale guard: a town at 20:00 mounted 892 full entities (gigabytes) — 3D-distance mount gate cut it to ~127 near a low camera; geometry budget now scales with field resolution.
- [x] Fixed a latent lifecycle bug affecting ALL entity consumers: StrictMode's mount → cleanup → remount gutted memoized handles (dispose cleared children while still rendered — found as empty `entity:*` groups in the scene scrub). EntityHandle now retain()/release() with microtask-deferred dispose; all four consumers switched.
- [x] Proof by scene-graph scrub (the living-interiors campaign's recipe): 127 gated wrappers with full bodies at hour 20 in the gx=16/gy=4 town window, labels showing resolved ancestries ("Half-Elf", "Mountain Dwarf", "Orc" households); interior close-up shows the outlined body at its furniture station.
- [x] Suites green (273 combined bridge + entities3d; 259 entities/World3D/BattleMap), typecheck clean on touched files.

### Task 14 (slice 5, approved by Remy 2026-07-11): crowd groundwork + street commuter swap — ALL FIVE SURFACES DONE

**Files:** Create `entities3d/three/crowdBake.ts` (bake an entity to [idle + 6 walk-phase] merged vertex-colored geometries; exact-phase poses work because TreadmillLeg is a pure function of gait phase; per-ancestry-group archetype cache), `World3D/crowdInstancePlan.ts` (pure bucketing: weighted ancestry per occupant, idle/walk phase, heading from tick deltas, seeded size jitter) + tests. Modify `GroundAgents.tsx` (unit-box instancedMesh → per-(group, phase) instanced buckets over baked keyframes, 12 groups × 7 keyframes, toon vertex-color material), `assembleEntity.ts` (export FieldSink/ISO for the baker).

- [x] TDD: bake produces 7 keyframe geometries with position/normal/color and moving legs between phases; archetypes cache per group; plan buckets idle vs walk, derives headings, jitters deterministically.
- [x] Proof by scene scrub + clock sweep: 360 townsfolk instanced; at 7.0–7.4 am 41 walk across ~28 live phase buckets (commute), evening wave at 18.2; screenshots show mid-stride bodies in the town square.
- [x] 270 tests green across entities3d + World3D + BattleMap; typecheck clean.

### Task 15 (look-polish batch, approved by Remy 2026-07-11)

- [x] Wings reshaped: feathered = fan of rounded capsule feather-boards; membrane = triangular sails between finger spars (custom two-sided BufferGeometry). Fairies, aarakocra, dragons, fiends all read.
- [x] Dwarf beard: new `beardMesh` part (auburn wedge + mustache lobes, pushed forward clear of the chest metaball); dwarf profile switched off the skin-colored field beard.
- [x] Dragon tail: `arc` param on tails — sweeps up over the rear legs then falls (side view verified). Loxodon trunk: `droop` param on snouts — curls down the face.
- [x] Combat HP pip and team ring trimmed (~25%) for the new body scale.
- [x] Crowd walk cycle 6 → 8 baked keyframes.
- [x] 70 entities3d tests green (raceMap beard assertion updated); typecheck clean; before/after screenshots eyeballed and sent.
