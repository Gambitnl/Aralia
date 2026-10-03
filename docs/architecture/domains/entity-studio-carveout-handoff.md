# Entity Generator carve-out - handoff

Written 2026-08-29. Companion to [entity-studio.md](entity-studio.md), which
holds the T1 non-mutating audit.

This file exists so the carve-out survives a context loss. It records what was
measured, what was decided, what is still open, and which work travels with the
engine when it moves to `F:\Repos\Entity-Generator`.

**Aralia is unchanged.** Nothing in the carve-out has removed or moved
production Aralia code. The current implementation stays operational as the
compatibility baseline.

Agora board: campaign `entity-studio-carveout`, wave `carveout-harden`.
Task ids below are the durable record; the Agora daemon is local state and can
be lost.

---

## 1. What the audit measured

Run 2026-08-29 against both trees. All numbers are counts, not estimates.

| Measure | Aralia | Standalone |
| --- | --- | --- |
| Engine source files (`src/systems/entities3d`) | 101 | 56 |
| Engine test files | 42 | 1 |
| Production imports that escape the engine | 9 (from 8 files) | - |
| `@/` alias imports leaving the engine | 0 | - |
| Engine modules imported from outside | 25 | - |
| Race entries | 116 source files | 109 mock entries |
| Tracked files in `public/` | - | 21 (30 MB) |

The headline: **the engine is well contained.** Nine threads to cut, not a knot
to untangle. The risks below are about the copy, not the architecture.

## 2. The nine production escapes

These define the entire coupling surface. Any new one is a regression.

```
src/data/classes                 <- classKits.ts, generateEntityBlueprint.ts, recipeFromCombatant.ts
src/data/races                   <- generateEntityBlueprint.ts, raceMap.ts
src/systems/worldforge/seedPath   <- generateEntityBlueprint.ts
src/types/character              <- recipeFromCharacter.ts
src/types/combat                 <- recipeFromCombatant.ts
src/types/creatures              <- creaturePlans.ts, creatureProfiles.ts, recipeFromCombatant.ts
src/types/items                  <- recipeFromCharacter.ts
src/types/world                  <- recipeFromCharacter.ts
src/utils/random/seededRandom     <- recipeFromOccupant.ts
```

They fall into two groups with opposite treatments.

**Group A - the adapters.** `recipeFromCharacter`, `recipeFromCombatant` and
`recipeFromOccupant` are the only files touching `types/character`,
`types/combat`, `types/items` and `types/world`. They are the whole
Aralia-only surface, they are already correctly named, and they are simply
filed inside the engine. They belong in Aralia. Task H9 records this; it is
deliberately **not ready**, because moving them touches production code.

**Group B - core reaching into content.** `generateEntityBlueprint`,
`raceMap`, `classKits`, `creaturePlans` and `creatureProfiles`. This is the
group that must change, and it is smaller than it looks. See section 4.

## 3. The four risks

### Risk 1 - the frozen determinism contract now lives in two repos

`generateEntityBlueprint.ts:14` imports `makeSeedPath`, `rngFromPath`,
`streamPath` and `fnv1a` from `src/systems/worldforge/seedPath.ts`. That file
declares its own path-to-seed mapping **frozen**, and says changing `fnv1a` or
the mapping after worlds ship is a save-breaking event pinned by golden tests.

The standalone copied it byte-identical - same SHA-256. Correct today. The
danger is later: the new repo is chartered to build from clearer architecture,
and tidying this one file silently regenerates every existing character and
creature in every Aralia save on reintegration.

A file-hash manifest cannot detect this. The copy is valid; the drift happens
afterwards. Treat `seedPath` as a published, versioned contract with exactly
one owner. **Task H2.**

### Risk 2 - the race and class data already forked

The standalone's `src/data/races/index.ts` and `src/data/classes/index.ts` are
not copies. They open with `// Mock races database for standalone Entity
Studio` and are hand-typed literals. Aralia loads the real data via
`import.meta.glob`.

The failure mode is worse than a crash. `raceMap.ts:257` resolves
`group = race.baseRace ?? race.id`, then looks up `GROUP_PROFILES[group]`:

- an unknown race id **throws**;
- a **wrong** `baseRace` does not throw - it selects a different anatomy
  profile and builds a different body.

The mock's `baseRace` values were typed by hand, and the mock has 109 entries
against 116 race source files. **Task `343e5f84` T8** (H3/H4 were duplicates, now closed - see section 9).

### Risk 3 - the compatibility baseline is unguarded

One of 42 test files was copied. "Focused compatibility tests passed" covers
about 2% of the suite. Those 42 files are the written specification of engine
behavior - `shellAssumptions`, `partVariants`, `rigDrive`, `skinnedBody`,
`gaits` and the rest encode invariants won over months. Port them first; they
will report what the copy actually broke. **Task H1.**

### Risk 4 - CC-BY assets committed under a bare MIT license

The standalone tracks 21 files in `public/` (30 MB of base meshes and
animation clips), carries `LICENSE` = MIT © 2026 Gambitnl, and has **no
CREDITS file**. Aralia has `CREDITS.md`. The base meshes are CC-BY 4.0
(Seifert, two Sketchfab packs) and require attribution.

This blocks the visibility decision. The assets are already in git history, so
a late fix means rewriting history rather than adding a file. **Task `c84414e3` T10** (H5 was a duplicate, now closed - see section 9).

## 4. The target boundary, discovered not invented

The engine reads exactly three fields plus one existence check from all of
Aralia's game content:

| What | Where |
| --- | --- |
| `race.name`, `cls.name` - a display label | `generateEntityBlueprint.ts:93` |
| `race.baseRace ?? race.id` - the anatomy group | `raceMap.ts:257` |
| `CLASSES_DATA[classId]` - an existence check | `classKits.ts:179` |

So roughly 29 KB of D&D content collapses to:

```ts
export interface SpeciesRef   { id: string; name: string; baseRace?: string }
export interface ArchetypeRef { id: string; name: string }
```

The engine does not need D&D data. It needs a **species registry the host
injects**. Deleting `src/data/**` from the standalone removes the mock, the
fork, and the 109-versus-116 problem in one move. **Task `343e5f84` T8.**

### Proposed packages

| Package | Contents | Class |
| --- | --- | --- |
| `core` | `types`, `registry`, `parts`, `textPlan`, `three/*` geometry, skeletons, gaits | portable |
| `contracts` | `SpeciesRef`, `ArchetypeRef`, recipe and blueprint schemas | shared-contract |
| `determinism` | `seedPath` - one owner, versioned, golden-pinned | shared-contract, frozen |
| `studio` | Entity Forge, Entity Debug, Part Lab, Hero Lab | portable, UI |
| `aralia-adapters` | `recipeFrom*` | Aralia-only |

The de-facto public surface is 25 modules across 6 consumer areas. Six carry
most of it: `generateEntityBlueprint`, `parts`, `three/assembleEntity`,
`three/gaits`, `three/toon`, `types`. Design Preview alone uses 20, so it needs
a deprecation path before the surface can shrink. **Task H6.**

## 5. Keeping Aralia internals out of the standalone

Four mechanisms, weakest to strongest:

1. **Drop the deep `main`.** It points at
   `src/systems/entities3d/three/Entity3D.tsx`. Replace it with an `exports`
   map - the only mechanism that blocks deep imports at the resolver.
2. **Flatten the tree.** The standalone preserves Aralia's directory shape,
   which cements Aralia's internal paths as the interface.
3. **ESLint `no-restricted-imports` zones**, so the UI cannot import engine
   internals and the engine cannot import the UI.
4. **Boundary tests in both repos**, with a checked-in allowlist of the nine
   escapes above. Any new escape fails CI. **Task H7.**

## 6. Work that travels with the engine

This is part-quality work living inside `src/systems/entities3d`. It moves
with the carve-out and must not be lost in the copy.

| Task | What |
| --- | --- |
| P1 | Four shipped changes awaiting Remy's eye |
| P2 | Six open decisions (question sheet round 1) |
| P3 | Chest grip: our-skeleton rigs bind the ribcage to the neck bone |
| P4 | 416 orphan vertices on figure A bound to their nearest bone |
| P5 | Stray Icosphere in figure A - remove it at the split step |
| P6 | Name the part-gate subject, then re-run the sweep |
| D1 | Record of work shipped 2026-08-23/29 (done, with evidence) |

Question sheet: <https://claude.ai/code/artifact/28dd42cf-559a-4f6d-bc75-d28cb7667a44>

**The sheet's answer channel is down.** The watch stopped and cannot be
re-armed from a background turn. Remy must send answers and then type any
message, or ask for the watch again.

### Shipped 2026-08-23/29 - the reasoning, not just the diff

1. **Clip pretzel fixed.** The clip path retold motion twice (66-bone pack
   skeleton -> our 39-bone biped -> Blender rig); each hop re-guessed roll and
   the deltas compounded. The proof that isolated it: the same mesh and clip on
   `pose=pack:` played clean with zero translations, ruling out the mesh and
   its weights. The exact bug - `applyWorldPose` composed the clip delta onto
   `alignedBind` (frames aimed along rest segments) while the bones hold
   joint-target frames. A quats pose now composes onto `skeleton.bindWorldQuat`.
   Locked by `rigDrive.test.ts`: reference biped at its bind ⇒ every rig joint
   within 1e-4 of its own bind.
2. **Neck refit.** The pack fit pinned `neck_01` at our chest-top landmark
   (0.781h). Our chest bone deliberately stops low - that is why our skeleton
   needs clavicles at all - and the fit copied that low point by mistake.
   `neck_01` now roots at the neck segment tail (0.830h); clavicles stay at the
   chest top. Three lowpoly bodies re-rigged.
3. **Stylized pack rigs (A and B).** Blocked because the pack fit needs a
   T-pose and both figures hang their arms. Built
   `tools/blender/tpose_basemesh.py`. Two lessons: aim each arm link by joint
   vectors (head -> child head), never by the bone tail, because the glTF
   importer synthesizes tails that do not run along the limb; and drop
   unskinned strays first.
4. **Playback controls.** Speed select (1 / 0.5 / 0.25 / 0.1 / 0) and a frame
   slider, both deep-linked (`?speed=`, `?t=`), so a frozen pose is a
   capturable URL for the part gate.
5. **Bones toggle fix.** The helper was handed the SkinnedMesh, but a Blender
   GLB hangs bones under the Armature node beside the mesh, so it found zero
   bones. It now gets the rig root.

`BASE_MESH_RIG_VERSION` is at `2026-08-23e`. All 682 entities3d tests pass.

**Caution for pickup:** a concurrent fork edited `PartLabScene.tsx` at the same
time as this session. It merged cleanly, but no Agora lock was held. Re-check
that file before assuming either version is whole.

## 7. Sequence

1. Port the 42 test files (H1). Fix what they break.
2. Add the differential blueprint test (H3); pin current output as golden.
3. Delete `src/data/**` from the standalone; inject the registry (H4).
4. Add the boundary test and the `exports` map (H6, H7).
5. Fix licensing and attribution (H5).
6. Only then decide the remote and visibility (H10).

## 8. Still missing

- **Direction of authority during the parallel period.** Both repos are
  editable and nothing detects divergence. Decide which is canonical per
  package and add a scheduled drift check. Without it the trees fork exactly as
  `src/data` already did. Folded into H10.
- **Configuration contract.** The standalone reads `process.env.HF_TOKEN`
  (`scripts/vite-plugins/devhub/heroLabRoutes.ts:379`). No key is hardcoded -
  it is a redaction routine - but env vars are part of a library's public API.
  **Task H8.**
- **Vendored third-party code.** `vendor/img2threejs` needs a license review
  before publication. Folded into H5.

---

## 9. Reconciliation with the existing board

**Read this before starting anything above.** The audit was seeded as tasks
H1-H10 *before* the pre-existing board (T6-T17, R1-R5) was visible. Several
overlapped, and in places the older tasks are better. That is corrected here.

### Closed as superseded

| Mine | Survivor | Why |
| --- | --- | --- |
| H3 | `40f154dd` T12 - Dual-run compatibility CI | T12 already specifies the differential run and adds the mid-clip frame lesson |
| H4 | `343e5f84` T8 - VisualSpecies contract | T8 already owns the "engine stops importing game data" work |
| H5 | `c84414e3` T10 - Asset + license manifest | T10 already owns assets, licensing and gitignored inputs |

No code was written for any of the three.

### Corrections to existing tasks

**T7 (`6a242aae`) is factually wrong and should be re-scoped.** It calls the
engine's `components/World3D/sceneCastUtils` import "the ONLY true violation of
the one-way boundary". It is **test-only** - the sole occurrence is
`src/systems/entities3d/__tests__/recipeFromNpc.test.ts`. The production engine
has **zero** `components/*` imports. Still worth fixing, because it blocks a
clean test copy, but it is a test-fixture problem, not a boundary violation.

**T8 (`343e5f84`) can be smaller than planned.** It assumes the engine needs
the visual fields of races and classes - frame proportions, palette hints, part
flags. It does not. Measured, the engine reads three fields plus one existence
check (section 4). Nothing reads proportions or palette from game data.
Design `VisualSpecies` against the measured surface, not the assumed one.

**T10 (`c84414e3`) is more urgent than written.** Attribution does not merely
need to travel: the assets are *already committed* under a bare MIT license
with no CREDITS file, so the fix now requires a git history rewrite.

**T6 (`379068c7`) has a mirror problem.** T6 covers over-copy - `worldforge`
and `BattleMap` rode in. The copy also **under-copies**: 56 of 101 engine files
and 1 of 42 test files. A manifest that fails closed in both directions should
assert test-file coverage too, or the baseline stays unguarded.

### Surviving new tasks

| Task | Relationship to the existing board |
| --- | --- |
| H1 - port the 41 missing test files | Mirror of T6; T6 removes over-copy, H1 adds under-copy |
| H2 - `seedPath` frozen-contract ownership | Narrower than T8's "SeededRandom offset discipline"; this is about one frozen file copied byte-identical |
| H6 - exports map, deep `main`, flatten | Do T15 (split `Entity3D.tsx`) first; H6 is the resolver-level surface |
| H7 - forward boundary tests | Complements T3 (done), which blocks the reverse direction only |
| H8 - configuration contract | Check `679fb5d2` (WP-DOCTOR) first; the env-var contract may belong there |
| H9 - move `recipeFrom*` out | Parked by Remy's constraint on production code |
| H10 - remote, visibility, sync | The decision plus the drift check; T10 and T12 are its prerequisites |
| P1-P6 | Sit under `e842adbc` T17, which holds campaign-level state (hands passed, feet fail strict-solo, heads/necks/tails open) |

Checkpoints could not be attached to the pre-existing tasks - the daemon
requires a claim, and claiming another agent's open task would be intrusive.
The corrections were broadcast instead (Agora seq 2370) and recorded here.

---

## 10. What is parked, and what is not

Decided by Remy, 2026-08-29.

**The rule: park anything that changes the engine's insides. Do not park
anything that changes what gets frozen or what gets exported.**

### Parked until after the carve-out - `blocked`

| Task | Why parked | Re-pin? |
| --- | --- | --- |
| P3 `0d642a93` chest grip | A fix to `rig_basemesh.py` - the code the new architecture is meant to redo | Yes |
| P4 `52e100a3` 416 orphan vertices | Same; still a real no-fallback violation, parked not resolved | Yes |
| P5 `f7c922c2` stray Icosphere | Belongs to the asset pipeline T10 is re-specifying | Yes |
| P6 `99243483` gate subject | Free to park - changes no engine behavior | No |

The first three change engine **output**. Once T12 (`40f154dd`) pins golden
fixtures, each one forces a **re-pin**. Budget that now, or they resurface
later looking like compatibility breaks.

The reasoning is Remy's own principle #3: keep the old implementation as
reference, not authority. Fixing `rig_basemesh.py` today polishes work that is
planned to be rebuilt.

### Not parked - these gate the carve-out

**P1 `25ad2fa6` - the eyeball backlog. Order this first.**

T12 will snapshot blueprint JSON and assembled-mesh byte layout as the
definition of correct. Verified 2026-08-29: `compatibilityFixtures.ts` today
pins only **input** mocks (combatants, characters, occupants), so that output
freeze **has not happened yet**.

Whatever has not been looked at when it does becomes the baseline. If the neck
refit or the clip fix is wrong, the standalone inherits the error *and*
enshrines it as the contract - and every later correction then reads as a
compatibility break. Four changes, minutes of looking, before a freeze that is
hard to undo.

**P2 `8c3cd5fd` - re-scoped to Q1 only** (Q6 is covered by P1).

Q1 asks whether both animation paths survive. It is the only decision that
changes **which modules exist**: if the translation path goes, `applyWorldPose`,
`clipStore` and `humanoidRetarget` leave the exported surface, and both H6 and
T15 shrink. It must land before the public API is drawn, or the API gets drawn
twice.

### Revised sequence

1. Eyeball the four shipped changes (P1).
2. Port the 41 missing test files (H1).
3. Settle Q1 (P2) before any API work.
4. Pin the golden fixtures (T12).
5. Everything else in the new repo.
