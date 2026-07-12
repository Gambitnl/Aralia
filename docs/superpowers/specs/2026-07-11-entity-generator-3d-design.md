# Procedural 3D entity generator — design

**Date:** 2026-07-11
**Status:** BUILT 2026-07-11 (same session): 49 tests green, showcase live at design.html?step=entityforge, proof screenshots sent. Remy reviews artifacts + screenshots after.
**Goal:** One procedural generator that creates 3D entities — creatures and humanoids (NPCs or the player character) — for any race and class combination, built from modular 3D components.

## What we're building

A generator that turns `(race, class, seed)` or `(creature type, size, seed)` into a walking, animated 3D figure. Bodies are seamless metaball blobs in the approved blobfolk style (toon shading, ink outlines, procedural gaits). Features and gear are modular parts — horns, ears, tails, snouts, wings, weapons, armor, hats — attached to named anchor points. Any of the game's 106 selectable races can be combined with any of its 13 classes. Monsters map through creature type and size to the same part system.

## Why now

- Every character render in the game today is a placeholder: the player is a cylinder with a sphere head, town commuters are unit boxes, interior occupants are two boxes, combat tokens are box-primitive archetypes.
- `public/blobfolk/index.html` proved the look Remy wants: metaball bodies, 5 procedural gaits (biped, quad, hexapod, hopper, flyer), two-bone IK legs with planted feet, squash-and-stretch. It is a standalone CDN page — none of it is usable by the game yet.
- `generateBody` (worldforge) was explicitly written as the data hook "for future AI-gen body rendering" — this generator is that future, for the geometry half.

## Approaches considered

**A. Metaball body + modular mesh attachments (chosen).** Industrialize blobfolk: each entity owns a small MarchingCubes field for the organic body (rebuilt per frame while animating), plus crisp toon meshes for parts that need edges (horns, weapons, hats, shields). Pros: the approved look; seamless bodies; organic size/bulk variation is free (change ball radii). Cons: per-frame field rebuild costs CPU — fine for a showcase and dozens of entities, needs baking/LOD before hundreds. Mitigation is designed in (blueprint/assembler split allows a static-pose bake later) but not built now.

**B. Primitive assembly v2 (extend combat CharacterActor).** Boxes and spheres per part. Cheapest, but keeps the boxy placeholder look the prototype was built to replace.

**C. Skinned glTF pipeline.** External assets, rigging, animation clips. Contradicts the owned-procedural direction and is far heavier than needed for the toon style.

Chosen: **A**, with B's part-taxonomy lessons (race cues × class archetypes × size scaling from `models.tsx`) folded into the part catalog.

## Architecture — three layers plus a showcase

### Layer 1: Blueprint (pure data, no three.js) — `src/systems/entities3d/`

`generateEntityBlueprint(recipe): EntityBlueprint`

- `EntityRecipe` — either `{ kind: 'humanoid', raceId, classId, seed, ageBand?, gearOverride? }` or `{ kind: 'creature', creatureType, size, seed, cues? }` (cues = name-derived hints like "spider", "wolf", "skeleton").
- `EntityBlueprint` — fully resolved: gait archetype (`biped`, `quad`, `hexapod`, `hopper`, `flyer`, or `float` — the first five ported from blobfolk, `float` a flyer variant with bobbing instead of wing flap), `Frame` (proportions **in feet** — same canon as `BodyPlan`; the assembler converts to meters at 1 ft = 0.3048 m), palette (skin/accent hexes), and a flat list of `PartInstance { partId, anchor, params }`.
- Determinism: seedPath streams (`rngFromPath(streamPath(base, 'frame'))`, `'palette'`, `'features'`, `'gear'`) so adding draws to one concern never shifts another. Same recipe → deep-equal blueprint, forever.

### Race and class mapping (the coverage story)

- **Species profiles:** one authored profile per race *group/visual family* (~20 profiles: human, elf, dwarf, halfling, gnome, greenskin-orc, greenskin-goblin, tiefling, dragonborn, goliath, aasimar, genasi, gith, beastfolk-feline, beastfolk-avian, beastfolk-reptilian, beastfolk-bulky, constructed, feyfolk, shapeshifter, planar…). A profile sets frame ranges (height/bulk in feet), head features (ear/horn/tusk/snout/tail/wing parts), and skin palette.
- **Race map:** every one of the 111 race ids maps to a profile plus small overrides (drow palette differs from high elf; red vs blue dragonborn hue; stout vs lightfoot halfling bulk). A vitest coverage test iterates `ALL_RACES_DATA` and fails if any race id lacks a mapping, and iterates all 106 selectable races × all 13 classes and fails if any combination produces an unresolvable part.
- **Class kits:** one authored kit per class id (13): main-hand weapon part, off-hand (shield/dagger/focus), armor overlay tier (none/leather/chain/plate — from armor proficiencies), headwear (helmet/hood/hat/none), extras (quiver, cape, belt pouch, instrument, holy symbol), and an accent color. Kits respect frames (a gnome wizard's staff scales to the gnome frame).
- **Creatures:** an authored table maps the 14 canonical creature types × size (Tiny→Gargantuan) + cues to gait + frame + parts: Beast→quad, Dragon→quad+wings+snout+tail, Ooze→boneless hopper (squash), Aberration→floater+tentacles, Giant→huge biped, Monstrosity→quad or hexapod by cue (spider→hexapod), Undead→gaunt biped or by-cue quad, Construct→blocky biped, Fey/Fiend/Celestial→biped+wing/horn variants, Elemental→floater, Plant→shambling biped, Humanoid→biped with race-cue parsing. Size drives the frame (Tiny 1.5 ft → Gargantuan 25 ft).
- **Player characters / rich NPCs:** `recipeFromCharacter(pc)` maps `race.id` + `class.id` + `equippedItems` (weapon category → weapon part, armorCategory → armor overlay, Head/Cloak/OffHand slots → parts) so a real PC renders with the gear they actually wear. NPCs without gear use the class kit.

### Layer 2: Part registry — `src/systems/entities3d/parts/`

The modularization. A part is one module registered in a central catalog ("add a part = one file + one registry entry", same pattern as the asset forge):

- `PartDef { id, anchor, kind: 'field' | 'mesh', fitsGaits, buildField?, buildMesh? }`
- **Field parts** merge extra metaballs into the body (snout, tusk-jaw, belly, tail, brow, muscle bulk) — seamless.
- **Mesh parts** are toon-shaded meshes with inverse-hull outlines (horns, pointed ears, weapons, shields, hats, capes, quivers) — crisp, attached to anchors.
- **Anchors** are named transforms the gait runtime updates every frame: `head`, `browL/R`, `earL/R`, `jaw`, `back`, `hips`, `tailRoot`, `handL/R`, `hipL/R`, `chest`. Gear anchors align with the game's `EquipmentSlotType` taxonomy.
- Registry invariants enforced by test: unique ids, valid anchors, every part buildable, every part id referenced by profiles/kits exists.

### Layer 3: Assembler + gait runtime (three.js, framework-agnostic) — `src/systems/entities3d/three/`

- Ports blobfolk's proven pieces as typed modules: `solveKnee` two-bone IK, the phase-based `Leg` (stance = pinned foot, swing = arc to predicted plant), and the five gait drivers — generalized from hardcoded numbers to `Frame`-proportional parameters.
- `assembleEntity(blueprint): EntityHandle { group, update(t, dt, locomotion), anchors, dispose }`. Locomotion (position/heading/speed) is supplied by the caller — a demo walk-in-circle driver ships for the showcase; the game's own movement systems plug in later.
- Rendering: one `MarchingCubes` field per entity (res ~44), `MeshToonMaterial` + 3-step ramp, inverse-hull outline, blob shadow. Uses the repo's three 0.172 (MarchingCubes addon ships with types).
- A thin R3F wrapper `<Entity3D blueprint locomotion?>` (`useFrame` → `handle.update`) so both design.html steps and the R3F game scenes can host entities.

### Showcase — `design.html?step=entityforge`

`PreviewEntityForge.tsx` + one steps-array entry in `DesignPreviewPage.tsx`. Controls: race dropdown (all 106 selectable), class dropdown (13), seed reroll, humanoid/creature tab (creature type × size), idle/walk toggle, and a lineup mode that renders a row of random race×class combos walking. Exposes `window.__entityforge` (scene/camera/renderer/handles) for deterministic Playwright captures.

## Testing

Vitest, all headless (three object graphs build fine in node without a renderer):

1. Blueprint determinism — same recipe twice → deep-equal.
2. Full coverage — every race id maps; 106 × 13 combos resolve; every referenced part id exists in the registry.
3. Frame sanity — heights within race bounds; size ordering (gnome < dwarf < human < goliath); creature size bands monotonic.
4. Registry invariants — unique ids, valid anchors, buildable.
5. Gait math — `solveKnee` returns a knee at distance l1 from hip and l2 from foot; foot stays planted through stance.
6. Assembler smoke — `assembleEntity` yields a group containing the field mesh + one node per mesh part; `dispose` releases geometries.

Visual verification per Remy's rules: run the showcase in the dev server, capture screenshots via the Playwright rig (`tools/agora/shoot-page.mjs`), eyeball, and send Remy proof during the work — not just at the end.

## Out of scope (follow-ups, parked)

- Swapping the generator into game scenes (PlayerAvatar/GroundAgents/SceneCast/InteriorOccupants/CharacterActor) — the seams are ready (`recipeFromCharacter`, BodyPlan-compatible feet frames, pluggable locomotion), the swaps are their own slices with their own eyeballs.
- Static-pose baking and LOD for crowds (design allows it; not needed for the showcase).
- Subclass visual accents; AI-generated face/clothing textures (`BodyAssetKeys` seam remains).
- Per-race structured appearance banks (`RACE_PHYSICAL_TRAITS` covers only 6 races — profiles carry palettes instead).
