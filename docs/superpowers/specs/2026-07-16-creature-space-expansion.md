# Creature-space expansion: what we can't make yet, and the plan

**Date:** 2026-07-16
**Status:** goal-driven campaign (Remy /goal); builds on `2026-07-15-text-to-creature-design.md`
**Threads:** expressiveness gaps → language v1.2; visual quality; FPS techniques; D&D tile-size fit.

## Gap audit: the D&D monster space vs the body-plan language

What the language covers today: one spine (4 stances), free chains (leg/arm/tail/tentacle/neck/wing) with hands/rings, 1–5 heads (multi-eye, snout, cilia), palette, garnish parts. Sweeping the SRD bestiary against that:

| Creature class | Examples | Blocker | Verdict |
|---|---|---|---|
| Tauric (two bodies) | centaur, drider, lamia | ONE spine only — no upright torso rising from a horizontal body; arms/heads can only attach to the main spine | **Fix now: `torso` appendage kind + `parent` binding** |
| Box/object bodies | gelatinous cube, mimic, animated armor | spine segments are always tapered cylinders | **Fix now: `spine.shape: 'box'`** |
| Eyestalk clusters | beholder, spectator | heads cap at 5 (beholder = central eye + 10 stalks) | **Fix now: heads cap → 12** |
| Incorporeal | ghost, specter, vampiric mist | no translucency; bodies are opaque toon | **Fix now: `palette.opacity`** |
| Swarms | swarm of rats/bats | one creature = many bodies | Later (instanced mini-bodies; pairs with FPS work) |
| Branching plants | treant, shambling mound | chains cannot fork | Later (sub-chains); crest/spikes approximate canopy today |
| True shapeshift | mimic mid-shift, doppelganger | static plan per creature | Out of scope (two library entries + swap) |
| Elemental wisps | fire/water elementals | no particles; accent glow only | Partial today (rings/spikes); particles later |

Everything else — giants, fiends, dragons, aberrations with tentacles, multi-headed serpents, oozes, floaters — is already expressible (proven by fixtures + Vhal'Qereth).

## Language v1.2 (this campaign)

1. **`kind: 'torso'` appendage** — an upright sub-spine chain rising from the main spine at its `attach` point. Other appendages may declare `parent: <torso appendage index>` (arms, necks, wings) to root near that torso's tip instead of the main spine; heads may bind to a torso like they bind to necks (`neckIndex` accepts torso entries — renamed semantics documented, field name kept for compatibility). Unlocks centaur/drider/lamia and every "rider" silhouette.
2. **`spine.shape?: 'round' | 'box'`** (default round) — box renders spine segments as rectangular slabs. With `opacity`, the gelatinous cube becomes: box spine, bulk 1, opacity 0.35, no appendages, embedded head with one dim eye.
3. **Heads 1–5 → 1–12** — beholder: floating orb, 10 short necks each carrying a 1-eye head, central embedded 1-eye head with cilia.
4. **`palette.opacity?: 0.2–1`** — body + chain translucency (toon material transparent). Eyes stay solid; wireframe mode ignores opacity.

## Visual quality (cheap, this campaign)

- **Per-segment tinting**: `SegmentSink.seg` gains an optional `colorHex` — the renderer keys materials per color (small shared cache). Drivers use it: snouts/jaws darken (skin ×0.82), tail/tentacle tips blend toward accent, palms darken. Bodies stop being one flat hue without any shader work.
- **Pupil shapes**: `eyes.pupil?: 'round' | 'slit' | 'goat'` — pupil sphere scaled (slit = tall-thin, goat = wide-flat). Character per eye, zero cost.
- Parked (needs shader work): belly banding via vertex-blend gradient, rim light, SSS fakes. The Meshy hero-look slice remains the materials answer.

## FPS techniques

- **Shared geometry cache** (this campaign): every segment id currently builds its own `CylinderGeometry(r1, r0, 1, 10)`. Quantize radii to 2 mm and share unit geometries module-wide with refcounts — crowds of planned creatures stop duplicating identical cones/spheres/tori. Same for joint spheres and rings.
- **Triangle budget test** (this campaign): assembled humanoid < 12k triangles, the Lovecraftian stress creature < 30k — a regression gate, not a hope.
- Noted for later slices: instanced planned-creature crowds (crowdBake already proves the pattern), distance-based radial-segment LOD (10 → 6 sides), frozen-pose imposters beyond 40 m.

## D&D tile-size fit

Combat ground truth: 1 tile = 5 ft (1.524 m); `CharacterActor` converts meters → tile units (`UNITS_PER_M = 1/1.524`).

- **`sizeCategoryForPlan(plan)`** (this campaign): derive the D&D size from max(heightFt, lengthFt): ≤2.5 Tiny, ≤5 Small/Medium (height splits at 4), ≤10 Large, ≤15 Huge, else Gargantuan; export `footprintTiles(size)` (½, 1, 1, 2, 3, 4). Library entries store the derived size; the forge Library panel shows it.
- **Prompt guidance**: the CLI prompt gains the size table ("a Large monster is 10 ft — two tiles") so generated monsters land on sensible footprints instead of arbitrary dimensions.
- Combat spawn wiring (recipeFromCombatant reading library plans + footprint) is a later slice — the derivation ships now so the data is already on every entry.
