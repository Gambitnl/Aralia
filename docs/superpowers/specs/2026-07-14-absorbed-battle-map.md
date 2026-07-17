# Absorbed: Battle Map (docs/projects/battle-map)

Refreshed 2026-07-16 from the folder's post-codex state. Codex battlefield lane: resume against this spec and planmap topic battlemap-retirement.

Status: active reference — absorbed into planmap topic `battlemap-retirement` (first pass
2026-07-15, refreshed 2026-07-16 after the codex battlefield campaign re-populated the
folder). The living-project folder is deleted; git history is the archive. This doc keeps
the prose future agents still need: the WorldForge battlefield-authority contract and its
launcher ledger, the adversarial render-review contract, the D17 `generateBattleSetup`
utility contract, the 2D/3D parity gate, and the open gaps as of absorption.

## What this lane is

The tactical grid layer used by combat, with 2D (`BattleMap.tsx`) and 3D
(`BattleMap3D.tsx`) renderers sharing one interaction contract. `CombatView` owns
`mapData` and orchestrates `useTurnManager`, `useAbilitySystem`, `useBattleMap`, and the
renderer choice. Combat rules live in hooks/utilities, never in renderer components.
The arena retires only after fight-in-place passes the presentation-parity matrix
(see the `battlemap-retirement` topic deps); until then these contracts are live.

## WorldForge battlefield authority (the codex campaign's core amendment)

The product direction is world-first. Production tactical combat may NOT decorate an
encounter roster with an unrelated generated arena. Every launcher either provides a
deterministic tactical projection of the actual WorldForge location or reaches the
visible fail-closed state.

- `CombatView` is the global safety boundary: without `state.extractedBattleMap` it
  mounts `BattlefieldSourceGap`, gives combat AI no actors, and exposes only a safe
  return command.
- `generateWorldBattleSetup` requires `BattleMapData`; no optional map, no generator
  fallback. `generateProceduralSandboxBattleSetup` is the ONLY constructor importing
  `BattleMapGenerator`, and its callers must remain developer-only (`?dev_combat=1`,
  `BattleMapDemo`).
- A caller declaring a `sourceGap` must supply no monsters, combatants, source
  identities, or map — the encounter launcher rejects contradictory payloads before the
  reducer.
- WorldForge-provenance maps suppress synthetic object-like painter scatter: discrete
  roads, water crossings, vegetation, structures, props, occupants, and encounter
  anchors must trace to source facts; only continuous texture/lighting/readability may
  stay renderer-authored.
- Adding a new encounter launcher or direct combat-phase transition requires a ledger
  row (below), a migrated/withheld decision, and deterministic proof.

### Production launcher ledger (state at absorption, 2026-07-16)

All audited production launcher classes are source-backed or explicitly fail closed; no
class remains open or unclassified.

| Encounter class | Status | Notes |
|---|---|---|
| Ground hostile proximity | migrated | `World3DWrapper.handlePositionChange` → `extractLocalTerrainPatch`; exact player meters with full provenance. |
| Generated-settlement wanted watch | migrated | `handleNpcInteraction` → `projectLiveSettlementEncounter`; live crop, crime/standing evidence, regiment-derived actors. |
| Generated-state patrol world event | migrated | `findStatePatrolWorldEvent`; save-backed once-per-day receipt. |
| Land-travel ambush | migrated (road-backed) | `prepareTravelBattlefield` rebuilds the committed destination cell from saved seed/time/deltas and selects a real source road; roadless destinations fail closed. Fixture: `?dev_travel_ambush=1` (seed 42 / cell 373). |
| Hostile opening attack / failed de-escalation | migrated | Game-authored seed/cell/site receipt → mounted GroundWorld crop → save-backed v2 contact-scene receipt (exact monster world meters, approach, social roles, aged traces, activity site, four terrain imprints). Re-entry replays exactly or fails closed. Combat teardown reconciles every source enemy (downed/withdrew/holding, final position/HP, site condition, disturbance); resolved receipts cannot restart the fight; the return projector keeps bodies as map facts, not initiative actors. WebGL 3D consumes the same resolved anchors. |
| Static authored-town wanted watch | withheld, explicitly unsupported | No authored-town→WorldForge bridge; structured no-roster source gap. Fixture: `?dev_static_town_watch_source_gap=1`; Vistest `combat-world-authored-town-watch-gap`. |
| Daily sea encounter | withheld, explicitly unsupported | `useSeaEncounter` consumes the event once into a no-roster naval source gap (no sea surface/decks/headings/weather/boarding facts). Fixture: `?dev_sea_encounter_source_gap=1`; Vistest `combat-world-sea-encounter-gap`. |
| EncounterModal custom/bestiary/AI simulation | withheld, explicitly unsupported | Location-free proposals emit a mode/count diagnosis with no actors until an explicit WorldForge cell/crop/receipt is selected. Fixture: `?dev_location_free_encounter_source_gap=1`; Vistest `combat-world-location-free-encounter-gap`. |
| Generic `START_BATTLE_MAP_ENCOUNTER` dispatch | withheld by default | Reducer stores only an explicitly supplied `extractedBattleMap`; omission reaches the global source-gap state. New production callers need a ledger row + proof first. |

Developer/source-backed harness paths: fight-in-place probe (`?fipfight` /
`window.__fipTestFight`), missing-source fixture (`?dev_combat_source_gap=1`), and the
World Battle Lab (`misc/design.html?step=battlemaplab`) which rebuilds named real
WorldForge locations and mounts the real combat UI (Hostile Opening replays through
strict production re-entry; Opening Aftermath resolves that exact receipt). Naval combat
utilities (`src/utils/naval/navalCombatUtils.ts`) are a separate system, not a tactical
launcher. Permanent Vistest gates also include `combat-world-hostile-opening`,
`combat-world-hostile-opening-aftermath`, `combat-world-hostile-opening-aftermath-3d`,
`combat-world-river-elevation`, and `combat-world-live-watch`.

## Adversarial render review contract

Rendered output is judged as a game scene, not as proof that React mounted. Every
canonical scenario needs browser captures at a normal desktop viewport AND a constrained
viewport, reviewed as one image against source facts, tactical projection, monster
composition, and surrounding UI. Reject technically valid renders showing
compass-perfect or repeated spawn geometry, hodgepodge scatter, empty terrain, repeated
silhouettes, unreadable dark tokens, weak threat hierarchy, implausible group behavior,
or panels masking the engagement — and record the rejected state plus the correction,
not only the flattering final capture. Monster improvements extend WorldForge facts
(ecological wakes, social topology, staged perception, persistent terrain memory)
instead of pasting cosmetics; visual plausibility is not permission to invent history.
A specific trap on record: a passing pixel-contrast check with a flat `y=0` camera
looking through terrain whose site height was `11.194` — 3D proof now requires
ground-aware framing, named meshes, nonblank framebuffer, and a changed readback after
camera movement.

Elevation presentation rule (G14, proven on River Crossing): one shared WorldForge
feet conversion across extraction, WebGL terrain, and 2D UI; the hover inspector puts
`This tile`, the selected creature, and `Map floor 0 ft` on one arithmetic-consistent
ruler and states the relative result — never encoded floats or dual baselines. Hillshade
and five-foot contours sit below authored roads/water/props/overlays. Presentation must
not imply cliff/slope/climb/LoS mechanics that the referee model does not own yet.

## D17 utility contract: `generateBattleSetup` (Remy decision 2026-06-10, Option B)

`src/hooks/useBattleMapGeneration.ts` keeps its hook-shaped filename for caller
stability but exports ONE stateless helper — no rename, no caller sweep:

```ts
export const generateBattleSetup = (
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
    initialCharacters: CombatCharacter[],
    presetMapData?: BattleMapData
): { mapData: BattleMapData, positionedCharacters: CombatCharacter[] }
```

Invariants any change must preserve (or record a breaking migration):
- Determinism: identical inputs give byte-equivalent output. One `SeededRandom(seed)`
  instance, draws in fixed order (spawn-config pick, per-team zone shuffle, map-wide
  fallback shuffle). A second RNG, `Math.random()`, or reordered draws breaks it.
- Procedural path: seeded choice among `left-right` / `top-bottom` / `corners-tl-br` /
  `corners-tr-bl` zone rects; `cornerSize = floor(min(w,h) * 0.35)`, rects clamped.
- Tactical scoring (G6, built 2026-06-19): `coverScore + elevation*2 + chokepointScore
  + enemyDistanceScore`, integer weights, stable best-first sort AFTER the seeded
  shuffle so ties break deterministically. Player team places first against the enemy
  zone anchor; enemies place second against actual player tiles.
- `MIN_SEP = 2` (Chebyshev) between teammates on the first pass; same-zone fallback and
  map-wide nearest-walkable fallback drop it so every character gets a defined tile on
  any map with enough walkable tiles. Never fabricate a position — with too few
  walkable tiles, leftover roster entries return unchanged.
- Preset path (`presetMapData` supplied): generator skipped; nearest-walkable placement
  around anchors `(20, 15)` player / `(24, 18)` enemy.
- Budget: <=50 ms for a default 40x30 forest setup; re-run the budget test in
  `src/hooks/__tests__/useBattleMapGeneration.test.ts` after any scoring/zone change.

NOT owned by the helper (do not extend it to cover): renderer/overlay/VFX behavior,
LoS/targeting/movement, encounter content/difficulty/AI, save/load of `mapData`.

## 2D/3D parity gate

Before any behavior expansion touching movement, targeting, overlays, or visibility,
re-run the focused parity tests — they are the durable gate:
`src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`,
`BattleMap3D.parity.test.tsx`, `BattleMap.visibility.test.tsx`,
`BattleMap3D.visibility.test.tsx`. Checked areas: shared state updates, movement
highlight, target highlight, overlay families (spell zones, delayed effects, light
sources, AoE/teleport previews). Visual fallback substitutes are NOT parity — a
placeholder or hidden error boundary fails the gate.

Cave/dungeon connectivity: `ensureConnectivity()` in `battleMapGenerator.ts` carves
deterministic corridors when generation splits walkable regions; a focused seed-2
regression keeps that guarantee visible.

## Gap state at absorption (2026-07-16)

Closed (kept for the record):
- G6 deterministic tactical spawn scoring (2026-06-19, contract above).
- G8 hostile-opening/de-escalation WorldForge receipt chain (2026-07-16, 64/64 tests +
  adversarial captures; the full contact-scene/outcome/3D chain is proven at 72/72 +
  17/17).
- G9 authored-town watch, G10 sea encounter, G11 location-free simulation — each closed
  as explicitly unsupported no-roster boundaries with permanent Vistests (2026-07-16).

Open — tracked on the planmap:
- G12 (topic `combat-world-scenario-lab`): promote resolved contact outcomes into the
  broader WorldForge entity/event lifecycle — pursuit destinations, reinforcement
  policy, pre-contact history. The contact receipt is exact but not a creature
  simulation.
- G13 (topic `combat-world-scenario-lab`): monster ecology beyond a frozen tactical
  reconstruction (ecological time, weathering, scavengers, faction recovery), plus
  active-`CharacterActor` body-state parity and the WebGPU aftermath layer.
- G14 (topic `combat-elevation`): source-backed steep-terrain semantics — cliff vs
  slope, climb/fall cost, high ground, elevation-aware LoS — only after the referee
  model owns those facts; preserve the three-point River Crossing ruler.
- G15 (topic `combat-elevation`): the World Battle Lab collapses the combat grid to a
  ~90px nested scroller at 390x844; it needs a compact full-canvas inspection mode
  before map-bearing mobile proof is honest.
- G5, CMA-G15, G7 (topic `battlemap-retirement`): legacy renderer/module debt —
  `VFXSystem.tsx` split needs a renderer-boundary proof (`buildTileVisibilityOverlays`
  + spell-zone parity anchors), `CharacterActor.tsx`/`TerrainMesh.tsx` splits need
  actor/terrain render-parity proof, and control-option commands (approach, flee, drop,
  grovel, halt) need a non-blocking visual pose/variant contract.
