# Handover: Procedural 3D entity generator

**Date:** 2026-07-12
**Author:** agent `fable-entitygen` (for Remy)
**Status:** BUILT and live in every 3D surface.
**Update 2026-07-15 — body v2 shipped; the "real wireframe" job below is DONE.**
Metaballs (MarchingCubes) are deleted. Gait drivers now emit rigid tapered
segment lists (`SegmentSink` in `types.ts`); `three/segmentBody.ts` builds one
cylinder per segment id once and re-transforms it per frame, so bodies are
articulated humanoids (head, neck, shoulders, elbows, knees, hands) and
wireframe mode is clean `EdgesGeometry` edge lines (~784 triangles a figure).
Field parts became chain parts (`parts/chainParts.ts`) or plain mesh parts
(`parts/organicParts.ts`); part ids are unchanged. `stats()` now returns
`{segments, triangles, renderMode}`; `resolutionScale`/`fieldUpdateHz` options
are accepted but ignored (strip them from the five surfaces in a later slice).
Spec: `docs/superpowers/specs/2026-07-15-entity-body-v2-segments-design.md`.
The sections below describe the metaball era — still useful for the system map
(anchors, gaits, recipes, surfaces), but the body internals they describe are
gone.
**Update 2026-07-26 — grounded wing beat shipped; the dragon item below is DONE.**
Biped and quad/hexapod drivers now emit a gentle speed-scaled wing flap
(`groundedWingBeat()` in `three/gaits.ts`, the same formula the plan driver
already used), so dragons, celestials, fiends, fairies, and aarakocra move
their wings on the ground instead of freezing mid-spread. The plan driver's
blind spot — wings authored as garnish PARTS (the Emberwing dragon) rather
than chain appendages — is closed by a `winged` hint on `createGaitDriver`,
computed from `blueprint.parts` by the assembler and the crowd baker.
Hopper stays flap-0 (no winged hopper profiles exist). Pinned by driver
tests (beat envelope, idle-vs-walk amplitude, hopper zero) and an end-to-end
assembler test (walking Huge dragon: `wingL.rotation.z` sweeps ≈1.4 rad and
mirrors `wingR`).
**Update 2026-07-28 — "dachshund" proportion fix + wing-fold tune.**
User verdict on the wave-5 dragon: "still looks like a long dachshund." Root cause
was the ratio, not the lumps: torso `lengthFt 2.8h` on `reach 0.95h` legs ≈ 3:1
torso:leg (dachshund territory; big cats sit ~1.3–1.6:1). Dragon template now
2.0h torso on 1.02h legs (~2:1, taller stance; tail keeps the length). Idle wing
fold retuned through three render iterations to a steep 1.32 dihedral + 0.5
y-sweep — folded membranes hang vertical along the flank instead of curtaining
the legs or hiding the haunches. Walking fold=0, gait byte-untouched. Suite
416/416, tsc filtered clean, headers synced. Proof: `.agent/scratch/doxie4-*.png`
(+ doxie/doxie2/doxie3 iteration trail). Residuals: folded wing can't shrink
span (rigid rotation), neck-chest shelf remains, beast template keeps 2.3h torso
(same ratio argument applies if flagged).
**Update 2026-07-27 (late) — dragon body-plan rework: spine massing, hocks, wing fold.**
A user side-view screenshot proved the forge-1 dragon was still a hot-dog torso +
hose neck + suitcase-handle wings + bent-wire legs (prior "prettier" claims were
single-angle renders — verification failure admitted; multi-angle proof is now
standing policy). (1) Torso radius curve extracted from two duplicated copies into
`textPlan/spineProfile.ts` (`spineRadiusAt`) with optional `spine.mass[chest,waist,
hips]` three-lobe profile; dragon rolls [1.35, 0.78, 1.12], plans without mass stay
byte-identical, and the rigid-seg crowd fallback now honors bulge (deliberate
silhouette change). (2) Dragon neck 0.84h hose → 0.53h base-thick 3 links, head
1.28x, legs `quadLegs(reach, 0.55, 0.72)` with hind V-bend flipped (digitigrade
hocks), 'back' anchor moved waist→shoulders (u≈0.3). (3) Dragon wings scale 2.2
(span keyed off height vs 2.8x-height body) and now FOLD at idle: `wingFold` on
the drivers (`1 - speedFactor*3.5`, set at the three groundedWingBeat sites) maps
to mirrored dihedral + backward sweep in the assembler; walking restores prior
behavior byte-identical. Suite 416/416, tsc filtered clean, headers synced.
Proof: `.agent/scratch/bodyplan-side90.png` / `fold-side90.png` vs
`user-brutal-check.png`. Residuals: idle tips may clip short-legged winged bipeds
(untested on celestial/fiend/fairy), neck-chest shelf remains, wing CHAINS
(plan-language) don't fold, crowd-bake silhouette change unverified in-game.
**Update 2026-07-27 (eve) — beauty pass: proportion budgets, wing harmony, eyes.**
User-facing polish driven by rendered critique ("its ugly as F"). (1) The wave-3
per-link chain jitter stacked multiplicatively — forge seed 1 produced a
giraffe-necked dragon (~2x neck-vs-leg drift). `varyPlan` now renormalizes each
chain's TOTAL length to ±8% of template (segmentation still varies); 200-seed
budget test pins it, probe shows 0.88–1.14x. (2) Wing membranes/spars/feathers
derive from the skin palette (x0.55 / x0.32 / 72%-to-white tint) instead of
one-hex-fits-all mauve/cardboard; `params.colorHex` still overrides.
(3) Eyes de-googled (0.24hr planned / 0.25 legacy, warm off-white) plus a
luminance guard that darkens pupils when iris ≈ skin (gold-on-gold dragons).
Suite 416/416. Residuals: s7's tilted-back idle pose hides its own face from
the forge camera (pupil guard unit-proven, not pixel-proven); dragon necks are
long BY DESIGN — budgets only stop compounding.
**Update 2026-07-27 — beast head redesigned + seeded anatomy individuality.**
Two generator upgrades in one pass. (1) The `beast` head form is no longer a
featureless `BoxGeometry` crate that swallowed the eyes whole: it's now a
composed skull — shallow icosahedron cranium (front ≤0.78r so the
assembler-seated eyes clear it), a pointed octahedron muzzle wedge below the
eye line, and a brow pair above it (`three/headForms.ts`; the file documents
the face-plane rule). Dragons, beasts, fiends, and monstrosities all wear it.
(2) Generic monsters are no longer clones: a third seed stream `anatomy`
(`generateEntityBlueprint.ts`) drives `varyPlan` in `creaturePlans.ts` —
proportion jitter on every chain link/radius, spine bulge/taper, head size,
and snout, plus per-type identity picks (35% of dragons roll the `serpent`
head form; monstrosities roll goat/slit/round pupils) and seeded garnish
swaps from `CREATURE_PART_VARIANTS` (dragons/fiends roll straight/curved/ram
horns, beasts roll pointed/long ears). Humanoid race identities are
untouched — the variant table only runs in the creature path, and omitting
the rng keeps the historical fixed anatomy byte-identical (fixtures, tests,
dev tools). Streams stay independent: frame/palette draws did not move.
Pinned by `__tests__/headForms.test.ts` (composition + face-plane geometry)
and `__tests__/anatomyVariety.test.ts` (determinism, 20-seed individuality,
variant registry resolution, stream-free stability, tiefling identity guard).

Related docs (same feature):
- Spec: `docs/superpowers/specs/2026-07-11-entity-generator-3d-design.md`
- Plan (Tasks 1–16, all checked): `docs/superpowers/plans/2026-07-11-entity-generator-3d.md`
- Memory: `entity-generator-3d` (in the agent memory index)

---

## What this is

One generator turns `(race, class, seed)` or `(creature type, size, seed)` into
a walking, animated 3D figure built from modular parts. It covers every one of
the game's 106 selectable races × 13 classes, plus the 14 monster creature
types at any size. It replaced every placeholder body in the game (the player
was a cylinder, townsfolk were boxes, combat used box archetypes).

The body style is "blobfolk": a soft metaball surface (three.js `MarchingCubes`)
grown from a gait skeleton, with crisp mesh parts (horns, weapons, hats, wings)
attached to named anchor points that the walk cycle moves each frame.

**Try it:** dev server, then `…/Aralia/misc/design.html?step=entityforge`.
Dropdowns pick race/class or creature type/size; there are `walk` and
`wireframe` checkboxes and a seed reroll. Deep-link params:
`?step=entityforge&mode=creature&type=Dragon&size=Huge&cue=none&walk=0&wire=0&seed=3`.

---

## Making it a real wireframe system

**The problem with what shipped.** "Wireframe" is currently just
`material.wireframe = true` (a `MeshBasicMaterial`). That draws *every triangle*
of the geometry. For the low-poly mesh parts (weapons, hats) it looks fine, but
the body is a `MarchingCubes` isosurface with hundreds–thousands of tiny
triangles, so its "wireframe" is a dense mesh soup, not clean lines. It reads as
a cool hologram at a glance and awful up close (see the Huge dragon).

**Why a one-line fix does not exist.** The usual clean-wireframe tool is
`THREE.EdgesGeometry(geometry, thresholdAngle)`, which keeps only edges where
two faces meet at more than the threshold angle — silhouette + hard creases.
That gives a beautiful CAD/blueprint look **on hard-surface meshes**. But the
metaball body is *smooth by construction* — it has almost no hard creases — so
`EdgesGeometry` on it yields nearly nothing (just a faint rim). The body is the
hard part precisely because it is a soft blob.

**Three ways to get a "typical" wireframe, cheapest first:**

1. **Hybrid (fast, partial).** Keep the body as-is (or as a faint silhouette)
   and give the **mesh parts** clean edges via `EdgesGeometry` +
   `LineSegments` + `LineBasicMaterial`. Weapons, armor, hats, horns, wings then
   read as crisp wireframe. Body still soupy. ~1–2 hours. Only improves half the
   figure.

2. **Real answer: give the body a low-poly mesh.** Replace the metaball body
   with an actual low-poly parametric mesh — capsule/cylinder torso + limbs +
   head, merged like the parts already are — so the whole figure is one
   hard-surface mesh whose edges extract cleanly. The gait/anchor system, all 37
   parts, the recipes, and the render-mode seam **stay unchanged**; you only swap
   what `GaitDriver.buildBody()` / the body geometry produces (it currently emits
   metaballs via `buildBody(sink)`). This is the honest "wireframe system" and
   also fixes the up-close blob look for the solid mode. Bigger job (a day-ish),
   but it is the direction if wireframe is the real art target.

3. **Screen-space edge pass.** A post-process outline (normal/depth edge
   detect) over the whole scene. Different look (silhouettes + creases,
   engine-wide), heavier, and it styles terrain/buildings too — probably not
   what's wanted for just the characters.

**Recommendation:** if wireframe is the keeper look, do #2 (low-poly body mesh);
if it is a stylistic experiment, do #1 for a quick better-looking pass. Either
way, the plumbing below is already the single control point — you change *what
geometry/material the body uses*, not *how the look is selected*.

**Where you'd make the change:** `src/systems/entities3d/three/assembleEntity.ts`
(body construction + the `renderMode` branch) and
`src/systems/entities3d/three/toon.ts` (add an `EntityRenderMode` variant like
`'wireframe-edges'`, or a body-geometry strategy). Nothing outside `entities3d`
needs to know.

---

## The render-mode seam (the single look lever)

All look selection funnels through **`src/systems/entities3d/three/toon.ts`**:

```ts
export type EntityRenderMode = 'solid' | 'wireframe';
export const ENTITY_RENDER_MODE: EntityRenderMode = 'wireframe'; // global default
export function wireframeMaterial(hex): MeshBasicMaterial            // {wireframe:true}
export function entityMaterial(mode): (hex) => Material              // solid→toon, wire→wireframe
```

- **`ENTITY_RENDER_MODE` is the master switch.** Set it to `'solid'` and the
  whole game reverts to the toon blobs, in one line. Every surface that does not
  pass its own mode inherits this.
- **`assembleEntity(blueprint, { renderMode? })`** (assembleEntity.ts) applies it:
  wireframe mode swaps in `wireframeMaterial` for body + parts, **skips both
  outlines** (the body inverse-hull `metaballOutline` and the per-part ink
  `partOutline` — there is no filled surface to hull), and **coarsens the field
  0.6×**. Eyes and the ground shadow stay solid in both modes (the eyes give the
  figure a face).
- **`Entity3D`** (the R3F wrapper) exposes `renderMode?` and forwards it.
- **`GroundAgents`** (the street crowd) reads `ENTITY_RENDER_MODE` directly to
  set `wireframe` on its instanced material.
- **Forge toggle:** `PreviewEntityForge` has a `wireframe` checkbox → passes
  `renderMode` to `EntityForgeScene`; `?wire=0` in the URL forces solid.

---

## System map

Three layers, all under `src/systems/entities3d/`:

### 1. Blueprint (pure data, deterministic, no three.js)
- `types.ts` — contracts: `Gait`, `Anchor`, `Frame` (proportions in FEET),
  `Palette`, `PartInstance`, `EntityRecipe`, `EntityBlueprint`, `AgeBand`.
- `generateEntityBlueprint.ts` — `recipe → EntityBlueprint`. Randomness only via
  seedPath streams (`frame`, `palette`), so the same recipe is byte-stable.
- **Recipe builders (identity → recipe), one per caller kind:**
  - `recipeFromCharacter.ts` — `recipeFromCharacter(pc)` (player/party) and
    `recipeFromRichNpc(npc)` (generated NPCs; race defaults human because the NPC
    generator doesn't persist a race).
  - `recipeFromCombatant.ts` — combat map: `recipeFromCombatant(c)` +
    `raceIdFromTags()` (race from `creatureTypes` tags/name keywords; monsters →
    canonical type × size + cues).
  - `recipeFromOccupant.ts` — interior villagers: ancestry GROUP → concrete race
    id, `ageBand` scaling.

### 2. Part registry (the modular components)
- `registry.ts` — `registerPart` / `getPart` (throws on unknown — no fallback).
- `parts/` — 37 parts across `fieldParts.ts` (organic metaballs: snouts, tails,
  bellies, tentacles…), `headParts.ts` (ears, horns, beak, `beardMesh`),
  `gearWeapons.ts`, `gearArmor.ts`, `wingParts.ts` (feather fans + membrane
  sails). `parts/index.ts` → `registerAllParts()` (idempotent; every render
  entry point calls it).
- **Adding a part = one file/array entry + a reference from a profile/kit.**
- Mapping: `speciesProfiles.ts` (≈28 body profiles) + `raceMap.ts` (all 111 race
  ids → profile + overrides) + `classKits.ts` (13 gear kits) +
  `creatureProfiles.ts` (type × size × cues → gait/frame/parts).

### 3. Assembler + gaits (three.js, framework-agnostic)
- `three/toon.ts` — materials + the render-mode seam (above).
- `three/ik.ts`, `three/legs.ts`, `three/gaits.ts` — two-bone IK, treadmill legs,
  and 6 gait drivers (biped, quad, hexapod, hopper, flyer, float). A driver owns
  `buildBody(sink)` (emits the body metaballs) and the per-frame `pose` (anchor
  transforms parts ride).
- `three/assembleEntity.ts` — `assembleEntity(blueprint, options) → EntityHandle`.
  Builds the `MarchingCubes` body + outlines + mesh parts + eyes + shadow; the
  `update(t, dt, loco)` loop advances the gait, throttles the field rebuild, and
  re-anchors parts. **`options`: `resolutionScale`, `fieldUpdateHz`, `renderMode`.**
- `three/Entity3D.tsx` — thin R3F wrapper (owns the handle lifecycle + clock).
- `three/crowdBake.ts` — bakes an entity into `[idle + 8 walk-phase]` merged
  vertex-colored geometries, one archetype per ancestry group (for the crowd).

---

## Where entities appear (the 5 game surfaces)

Each calls `assembleEntity`/`Entity3D` (inheriting the global render mode) with
its own perf tuning. Swapping any of these back to placeholders is local.

| Surface | File | Recipe source | Tuning |
|---|---|---|---|
| Player avatar | `components/World3D/PlayerAvatar.tsx` | `recipeFromCharacter(party[0])` | `res 0.7, 10 Hz`; gait speed from glide |
| Opening cast | `components/World3D/SceneCast.tsx` | `recipeFromCharacter` / `recipeFromRichNpc` / commoner default (`castMemberRecipe`) | `res 0.6, 6 Hz` |
| Combat tokens | `components/BattleMap/characters/characterActor/{CharacterActor,EntityModel,entityOverlays}.tsx` | `recipeFromCombatant` | `res 0.7, 10 Hz`; combat overlays (lunge/recoil/cast/death) |
| Interior villagers | `components/World3D/{OccupantFigure,InteriorOccupants}.tsx` | `recipeFromOccupant` | `res 0.5, 3 Hz`; **camera-distance mount gate 42/50 m** |
| Street crowd | `components/World3D/{GroundAgents,crowdInstancePlan}.tsx` | `crowdArchetypeForGroup` + `crowdInstancePlan` | baked keyframes, instanced |

Race/class/gear plumbing that had to be widened: `World3DScene`/`World3DWrapper`
pass `playerCharacter` (was `playerIdentity`); `groundChunkLoader` bakes
`member.race` into `BuildingOccupantRender.race`.

---

## Critical gotchas (read before you touch it)

- **Handle lifecycle = retain/release, NOT dispose-in-cleanup.** React StrictMode
  double-invokes effects (mount → cleanup → remount); a naive
  `useEffect(() => () => handle.dispose())` disposes a still-rendered memoized
  handle and you get empty `entity:*` groups. `EntityHandle` has
  `retain()`/`release()` (microtask-deferred dispose). Every consumer must use
  `useEffect(() => { h.retain(); return () => h.release(); }, [h])`.
- **MarchingCubes poly budget must floor ≥30k** or a full biped truncates into a
  torn spiky mass (assembleEntity `maxPolys`).
- **R3F canvases do NOT initialize in the in-app "Browser pane"** (stuck at
  300×150) — true for ALL design 3D steps, not just this one. Use the Playwright
  rigs below for screenshots.
- **Design URL is `/Aralia/misc/design.html`** (not `/Aralia/design.html`).
- **Headless combat 3D runs ~0.14 fps on SwiftShader with OR without entities**
  (pre-existing; proved by removing the bodies). Not a regression from this work.

---

## Tests and proof rigs

- **Unit tests (all green, run with `npx vitest run <path>`):**
  `src/systems/entities3d/__tests__/` — registry, parts, raceMap (full 111-race
  coverage), classKits, creatureProfiles, blueprint (1,378 race×class combos),
  gaits, assemble (both render modes), recipeFromNpc, recipeFromCombatant,
  recipeFromOccupant, crowdBake. Plus `components/World3D/__tests__/crowdInstancePlan`
  and `components/BattleMap/characters/characterActor/__tests__/entityOverlays`.
  Whole feature ≈ 285 tests.
- **Screenshot rigs (Playwright, hit localhost directly):**
  - Forge: `node tools/agora/shoot-page.mjs "<forge-url>" out.png --wait 7000`.
    Window hook `window.__entityforge`.
  - Combat 3D: `.agent/scratch/shoot-combat3d-readback.mjs` — framebuffer readback
    inside rAF (compositor screenshots time out under the R3F loop). Camera hook
    `window.__bm3dCam.poseTeam('player'|'enemy', d, polarDeg, azimuthDeg)`.
  - World3D (player/cast/interiors/crowd): `.agent/scratch/probe-interior-occupants.mjs`,
    `.agent/scratch/probe-crowd*.mjs`, `.agent/scratch/shoot-cast-wire.mjs`. Hooks:
    `window.__wf3dScene`, `window.__wf3dSetPose(camXYZ, targetXYZ)`,
    `window.__wfGroundWorld`, `window.__wfAgentClock` (scrub the town clock — the
    populated town window is `?gx=16&gy=4&wfseed=42`; commuters walk ~07:00–07:30).

---

## Known issues / parked polish

- **Wireframe density on the body** — the headline item above.
- Interior villagers stand *inside* furniture at night (station placement quirk,
  predates this work).
- Crowd walkers snap between the 8 baked keyframes (no cross-fade).
- Street commuters use a *seeded* ancestry (the roster doesn't persist race —
  plumb it like households did if you want real ones).
- ~~Quad wings (dragon) don't flap while walking~~ **RESOLVED 2026-07-26** —
  grounded wing beat on biped/quad/hexapod + plan drivers (see the update at
  the top); hopper intentionally stays still.
- Forge lineup mode frames many figures from behind.
- Combat HP pip/turn-beam scale versus the new bodies is only lightly reviewed.

---

## To revert or re-style

- **All solid again:** `ENTITY_RENDER_MODE = 'solid'` in `three/toon.ts`.
- **Back to placeholders on one surface:** the swap is local to that surface's
  file (table above) — restore its prior primitive body; nothing else depends on
  it.
- **A new look (e.g. real wireframe):** add an `EntityRenderMode` variant + branch
  in `assembleEntity`/`toon.ts`; no consumer changes needed.
