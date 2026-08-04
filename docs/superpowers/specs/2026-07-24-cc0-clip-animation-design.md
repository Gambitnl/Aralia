# CC0 clip animation: real motion from the Mesh2Motion library

**Date:** 2026-07-24
**Status:** approved design (Remy, this session: full 87-clip pack; humanoid retargeting first, then rigged creature bestiary via path A)
**Supersedes:** the Mixamo approach in the skeleton-pivot spec's slice 2 (`2026-07-17-entity-skeleton-pivot-design.md`). Same goal — clips play natively on a mixer — but the source is the CC0 Mesh2Motion library, and glTF clips need no FBX parser.
**Builds on:** skeleton pivot slice 1 (17-bone biped + `SkinnedMesh` + pose adapter) and slice 3 (smooth bodies), both built.

## Why this changed

The Mixamo path needed an Adobe login Remy does not have, so clip playback was deferred. The [Mesh2Motion library](https://github.com/Mesh2Motion/mesh2motion-app) (MIT code, **CC0** assets, from CMU mocap) ships the same motion as ready glTF clip packs — no login, no FBX conversion, free to bundle and ship commercially. It also ships rigged CC0 creature models (dragon, snake, spider, fox, horse, bird, shark, kaiju), which opens animated creatures far sooner than procedural creature skeletons could.

## Asset inventory (verified)

Per-skeleton glTF clip packs under the library's `static/animations/`:

| Pack | Clips | Size | Notes |
|---|---|---|---|
| human-base | 87 | 5.4 MB | Idle_A, Walk, Jog, Sprint, Sword_Attack, Spell_Simple_Shoot, Hit_Head, Death_D, Jump, plus emotes |
| human-addon | (more) | 5.1 MB | extra human clips |
| dragon | 5 | 735 KB | Fly Flap, Fly Glide, Idle, Walk, Rest Pose |
| snake | 8 | 352 KB | Bite, Coiled, Dance, Death, Hit, Idle, Side winding |
| spider | 10 | 584 KB | Attack, Bite, Death×2, Eating, Hit, Idle, Jump, Walk |
| fox / horse / bird / shark / kaiju | 5–12 each | 0.3–1.1 MB | quadruped, flyer, swimmer, biped-monster rigs |

Human rig bone names (Unreal-style, near 1:1 with ours): `root, pelvis, spine_01..03, neck_01, head, clavicle_l/r, upperarm_l/r, lowerarm_l/r, hand_l/r (+ finger chains), thigh_l/r, calf_l/r, foot_l/r, ball_l/r`. Our fingers/toe-balls have no equal and are ignored on import.

## Decisions

- **Full pack.** Ship all human clips (lazy-loaded, not in the first paint). Do not pre-trim — the whole library is the asset.
- **Path A for creatures.** Adopt the library's rigged creature models as a new **known-bestiary** entity source beside the procedural generator. A named monster with a matching rig (giant spider → their spider) spawns the rigged, animated model; everything else stays procedural. Two creature systems coexist by design; this is selection by priority, like accepted entities.
- **License.** Bundle both licenses; credit Mesh2Motion (Scott Petrovic) and CMU in a NOTICES file even though CC0 requires none.

## Architecture

### Humanoid clips (priority 1)

1. **Bundle:** copy the human GLB packs into `public/anim/humanoid/`. A build-time manifest lists clip names → pack file.
2. **Retarget map** (`src/systems/entities3d/anim/humanoidRetarget.ts`, pure): a frozen record from library bone name → `BipedBoneName` (`upperarm_l → upperArmL`, `calf_l → shinL`, `spine_03 → chest`, …). Unmapped tracks (fingers, ball, clavicle) drop.
3. **Clip store** (`anim/clipStore.ts`): lazy `GLTFLoader` load of a pack; cache parsed `AnimationClip`s; rename each track's target from the library bone to our bone via the map (`track.name = ourBone + '.' + property`). One load per pack, shared across entities.
4. **Player** (`three/skinnedClipPlayer.ts`): wraps `AnimationMixer` bound to the entity's `Skeleton`. `play(clipName, { loop, fadeSec })`; `setSpeed(mps)` scales `timeScale` off the clip's authored ground speed (the `cadence()` idea). In-place root: strip root-translation tracks (keep root rotation). Exposes `sampleAtPhase(phase)` so the debugger scrub maps `gaitPhase → clip time`.
5. **Ownership arbitration** in `assembleEntity`: a new `animSource: 'procedural' | 'clip'` (default procedural). `clip` on a skinned biped mounts the player and drives the bones from clips; the procedural driver still owns non-biped and unmapped bodies. Clips only run on `bodyTech: 'skinned'` (a clip needs bones); requesting clips on a segment body throws.
6. **Action mapping:** a small table from the debugger's action buttons (idle/walk/melee/ranged/cast/hit/death) to clip names (`melee → Sword_Attack`, `cast → Spell_Simple_Shoot`, `hit → Hit_Head`, `death → Death_D`, `walk → Walk` speed-synced). Missing action → hold idle.

### Rigged creature bestiary (priority 2, path A)

1. **Bundle:** the rigged model GLBs (`model-dragon.glb`, …) into `public/creatures3d/bestiary/<species>/` with their clip pack.
2. **Source module** (`src/systems/entities3d/bestiary/riggedBestiary.ts`): `bestiaryByName(name)` maps D&D monster names/keywords to a species (`giant spider|phase spider → spider`, `wyvern|dragon wyrmling → dragon`, `giant snake|serpent → snake`). Returns a recipe `{ kind: 'rigged', species }`.
3. **Assembly:** a `rigged` recipe path loads the model + clips, returns an `EntityHandle`-shaped object exposing the same `update/dispose/retain/release` surface so every 3D surface renders it unchanged. Its clip player reuses the humanoid player (skeleton-agnostic).
4. **Priority:** `recipeFromCombatant` consults `bestiaryByName` AFTER accepted entities but BEFORE the procedural profile — known rigged creatures beat generation, described monsters still generate.
5. **Tile-fit + palette:** scale the model to its D&D size tile like generated creatures; tint via material override where the rig allows (later polish, not slice 1).

## Slices (priority order)

1. **Humanoid retarget substrate:** bundle + retarget map + clip store + player, one clip (Walk) proven on the debugger biped. TDD on the pure map and the track-rename.
2. **Full humanoid action set:** all 87 clips loadable; action buttons wired; speed sync; debugger scrub. Eyeball gate.
3. **Rigged bestiary source:** spider first (10 clips) — load, name-map, spawn from `bestiaryByName`, render in the debugger and combat. Then dragon, snake, fox, horse.
4. **Game wiring:** clip humanoids in combat/dialogue where skinned bodies ship; bestiary creatures for matching monsters. Behind the existing `bodyTech` rollout.
5. **Polish:** additive layering (aim while walking), palette tint on rigged models, blend trees.

## What survives untouched

The procedural generator, the plan language, junction blend, segment renderer, and every existing recipe path. Clips and the bestiary are additive sources chosen by priority; nothing that works today changes.

## Non-goals

- Procedural creatures wearing clips (path B) — a later research slice.
- Editing/authoring new clips in-engine (the library's own job).
- Retargeting between different creature rigs (their spider clip never drives their dragon).

## Testing

- Retarget map: every mapped library bone resolves to a real `BipedBoneName`; unmapped tracks drop; the map is exhaustive over the human rig's mappable bones.
- Clip store: a loaded pack yields clips whose track targets are all our bone names; caching returns the same clip objects.
- Player: speed sync scales timeScale monotonically; in-place strip removes root translation; `sampleAtPhase(0.5)` is deterministic.
- Bestiary: name/keyword mapping table (giant spider → spider, etc.); priority order vs accepted + procedural; a rigged handle satisfies the `EntityHandle` surface.
- Perf: clip humanoid stays 2 draw calls; rigged models within a stated triangle ceiling; mixer update is O(bones).
- Visual: debugger A/B of procedural-gait vs clip walk; each bestiary species idle+walk; harsh critique.

## License and attribution

`public/anim/NOTICES.md`: Mesh2Motion (© 2025 Scott Petrovic, MIT code / CC0 assets), CMU Graphics Lab Motion Capture Database. CC0 needs no attribution; we credit anyway.
