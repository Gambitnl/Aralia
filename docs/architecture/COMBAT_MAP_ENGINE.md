# Combat Map Engine

Single source of truth for Aralia's tactical-combat rendering stack and the related map systems that surround it. Synthesizes material previously scattered across the in-component README, the 3D design spec, and the domain docs.

Last consolidated: 2026-05-28.

---

## 1. Scope

This document covers:

- The browser 3D rendering stack used for combat ("the engine").
- The procedural combat-map generator that produces tile data.
- The two rendering frontends (2D HTML/CSS grid and 3D R3F canvas) that consume that data and share game logic.
- Adjacent map systems (world map / Azgaar, submap, town map, environment/physics) and how they relate to combat.
- A pointer index to every other doc that touches these surfaces.

For the *combat rules* themselves (action economy, abilities, conditions), see `docs/architecture/domains/combat.md`. This doc is the rendering and generation side.

---

## 2. The Engine

There is no separate "game engine" in the Unity/Unreal sense. The runtime is the browser, and the 3D layer is composed from libraries:

| Layer | Package | Role |
|-------|---------|------|
| Renderer | `three` (r170+) | WebGL scene graph, materials, lights |
| React bridge | `@react-three/fiber` | Three.js as React JSX (the `<Canvas>`) |
| Helpers | `@react-three/drei` | `ContactShadows`, `Html` overlays, controls, loaders |
| Post-FX | `@react-three/postprocessing` | SSAO, Bloom, Vignette |
| Atmosphere | `@takram/three-atmosphere`, `@takram/three-clouds`, `@takram/three-geospatial` | Physically based sky + clouds (used by the world-scale views) |

The 2D combat map uses no engine — it is HTML/CSS grid styled with Tailwind. Both frontends consume the same generator output and the same hooks.

---

## 3. Combat Map Generation

### 3.1 Generator service

`src/services/battleMapGenerator.ts` exports the `BattleMapGenerator` class. A single `generate(biome, seed)` call produces a `BattleMapData` object:

```ts
class BattleMapGenerator {
  constructor(width: number, height: number);
  generate(
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
  ): BattleMapData;
}
```

Inputs are `width`, `height`, `biome`, and `seed`. Output is deterministic for a given input.

### 3.2 Algorithm

1. **Base terrain** — `PerlinNoise(x/10, y/10)` produces a 2D noise field; the value is bucketed per biome into a terrain type (grass / wall / floor / sand / rock / mud / water / difficult).
2. **Elevation** — a separate Perlin noise field at `x/8`, `y/8` is mapped to integer height steps 0–3, centred around 1. Decorations bump elevation further (boulder +1, tree/pillar/mangrove/cactus +2).
3. **Obstacles** — per-biome decoration tables drive density (forest 15%, swamp 15%, cave 10%, desert 8%, dungeon 7%) and decoration mix. Tiles already marked `blocksMovement` are excluded; the rest are shuffled with the seeded RNG and the top N tiles are decorated.
4. **Connectivity guard** — for `cave` and `dungeon` biomes, `ensureConnectivity()` is a placeholder hook for path-carving (currently a stub).

Each tile carries `id`, `coordinates`, `terrain`, `elevation`, `movementCost`, `blocksLoS`, `blocksMovement`, `decoration`, `providesCover?`, `effects[]`.

### 3.3 Determinism contract

The generator uses `SeededRandom` from `@/utils/random` and `PerlinNoise` from `src/utils/perlinNoise`. Given the same `(biome, seed)` it must produce the same `BattleMapData`. Both rendering frontends rely on this so a 2D ↔ 3D toggle never reshuffles the battlefield.

### 3.4 Setup hook

`src/hooks/useBattleMapGeneration.ts` is named like a hook but exports stateless battle-setup helper logic (party placement, encounter prep). Keep that drift in mind — see the domain doc for context.

---

## 4. Rendering Frontends — 2D / 3D Parity

The system is intentionally a *single generator, two renderers*. Both consume the same `BattleMapData` and the same combat hooks.

```
                  battleMapGenerator.ts
                          │
                          ▼
                   BattleMapData
              ┌───────────┴───────────┐
              ▼                       ▼
        BattleMap.tsx           BattleMap3D.tsx
       (HTML/CSS grid)          (R3F <Canvas>)
              │                       │
              └──────────┬────────────┘
                         ▼
            Shared game-logic hooks
       (useBattleMap, useTurnManager,
        useAbilitySystem, pathfinding,
        lineOfSight, useGridMovement)
```

`CombatView.tsx` is the live combat host; it swaps between the two via a render-mode toggle. `BattleMapDemo.tsx` is a narrower demo lane reachable directly from `App.tsx`.

### 4.1 Shared hook contract (the bridge)

Every player-visible behaviour goes through the same hooks no matter which renderer is active:

| Hook | Owns |
|------|------|
| `useBattleMap` | selected character, action mode, valid moves, active path, click routing |
| `useTurnManager` | initiative order, action economy reset/spend, turn validation |
| `useAbilitySystem` | targeting mode, range/LoS checks, AoE preview, effect application |
| `useGridMovement` | BFS reachability, A* pathfinding |
| `useTargetSelection` | derives the valid-target set from the current ability + AoE preview |
| `pathfinding.ts` | A* with D&D 5e diagonal rules |
| `lineOfSight.ts` | Bresenham's line algorithm |

The 3D renderer translates these outputs into world-space visuals (raycast hits → tile coords, `validMoves[]` → green highlight zones, `activePath[]` → ground arrow, `aoePreview` → ground decal), but does not own any of the rules. If a rule needs changing, change the hook — both renderers update.

### 4.2 The 2D frontend

`src/components/BattleMap/BattleMap.tsx` plus `BattleMapTile.tsx`, `CharacterToken.tsx`, `InitiativeTracker.tsx`, `AbilityPalette.tsx`, `CombatLog.tsx`, `ActionEconomyBar.tsx`, `PartyDisplay.tsx`, `DamageNumberOverlay.tsx`, `AISpellInputModal.tsx`, `CombatCharacterInspector.tsx`. CSS grid for the tiles, absolutely positioned tokens, Tailwind overlays for move/path/AoE state.

### 4.3 The 3D frontend

`src/components/BattleMap/BattleMap3D.tsx` is the top-level R3F component. Its subtree:

```
BattleMap3D
├── SkyDome              custom ShaderMaterial, per-biome gradient (prevents fade-to-void)
├── <fog>                per-biome colour/near/far
├── SceneLighting        ambient + hemisphere + directional (sun, shadow-casting) + cool fill
├── CameraController     BG3-style orbit with snap-to-character + cinematic cam
├── TerrainMesh          continuous heightfield mesh from BattleMapData
├── GridOverlay          shader-based grid, visible in movement mode
├── GrassLayer           instanced grass with wind-sway vertex shader
├── WaterSystem          animated water tiles
├── DecorationProps      instanced 3D obstacles (boulder, pillar, etc.)
├── EzTreeLayer          tree placement for forest/swamp
├── GroundScatter        small foliage / debris
├── ContactShadows       soft ground darkening under objects
├── CharacterActor[]     glTF SkinnedMesh + AnimationMixer per CombatCharacter
├── VFXSystem            spell zones, weapon trails, damage numbers, AoE preview
├── LivingWorld          ambient particles (fireflies, embers, dust)
└── PostProcessingStack  SSAO + Bloom + Vignette + ACES tone mapping
```

All terrain pieces live in `src/components/BattleMap/terrain/`, camera in `camera/`, characters in `characters/`, VFX in `vfx/`. Each subdirectory has an `index.ts` barrel.

### 4.4 Per-biome presentation

The 3D frontend ships five biome presets, each one a tuple of `(BIOME_LIGHTING, sky preset, fog params)`:

| Biome | Lighting mood | Sky | Fog |
|-------|---------------|-----|-----|
| forest | warm gold sun, soft green ambient | blue/green | light haze, 12–32 |
| cave | no sun, deep blue ambient, dim point light | near-black | dense, 6–20 |
| dungeon | dim amber, cool gray ambient | desaturated purple-gray | medium, 8–24 |
| desert | harsh white sun, warm sand ambient | sand-tan | heat shimmer, 14–35 |
| swamp | filtered green, murky teal | green-gray | heavy, 8–22 |

---

## 5. Adjacent Map Systems

These are *not* the combat map but they share data, services, or screen real estate with it. Each links to its dedicated domain doc.

### 5.1 World map (Azgaar bridge)

- Code: `src/components/MapPane.tsx`, `WorldPane.tsx`, `Minimap.tsx`, `src/services/mapService.ts`, `src/services/azgaarDerivedMapService.ts`.
- Doc: `docs/architecture/domains/world-map.md`.
- Shape: a modal overlay whose default mode is an **embedded Azgaar atlas**, with a click-to-world-cell bridge that maps Azgaar geometry back to Aralia travel state. Tiles carry biome IDs that downstream systems (submap, combat) consume.
- Combat link: the biome ID of the player's current world-map cell is the input that selects the combat-map biome and the submap visuals.

### 5.2 Submap (local exploration)

- Code: `src/components/Submap/SubmapPane.tsx`, `src/hooks/useSubmapProceduralData.ts`, `src/services/cellularAutomataService.ts`, `src/services/wfcService.ts`.
- Doc: `docs/architecture/domains/submap.md`.
- Shape: deterministic local-exploration grid. Procedural data layer produces hash-seeded features, paths, optional cellular-automata caves for `cave`/`dungeon` biomes, and WFC-based generation for some terrain types.
- Combat link: the submap is the layer the combat map *transitions out of*. The same world biome and seed flow through so a forest submap leads into a forest combat map.

### 5.3 Town map

- Code: `src/components/Town/TownCanvas.tsx`, `VillageScene.tsx`, `useTownController.ts`, `src/services/RealmSmithTownGenerator.ts` + `BuildingGenerator`, `RoadGenerator`, `TerrainGenerator`, `DoodadGenerator`, `src/state/reducers/townReducer.ts`.
- Doc: `docs/architecture/domains/town-map.md`.
- Shape: canvas-based renderer (not R3F) driven through `AssetPainter`. Deterministic town layouts with movement, zoom, pan, ambient life, NPC clicks, merchant entry.
- Combat link: town does not directly trigger combat, but transitions back to the submap layer when the player leaves.

### 5.4 Environment & physics

- Code: `src/systems/environment/EnvironmentSystem.ts`, `TerrainSystem.ts`, `WeatherSystem.ts`, `hazards.ts`; `src/systems/physics/ElementalInteractionSystem.ts`; `src/utils/combat/physicsUtils.ts`; `src/systems/visibility/VisibilitySystem.ts`.
- Doc: `docs/architecture/domains/environment-physics.md`.
- Shape: world-state behaviour (weather, hazards, elemental interactions, visibility). These act *on top of* the combat-map tiles — for example, a fire spell zone lives in `useCombatEngine`'s `spellZones[]` and is consumed both by combat rules and by the 3D `VFXSystem`.
- Combat link: direct. Visibility checks read tile `blocksLoS`; hazards apply per-tile effects; weather influences lighting presets.

---

## 6. Documentation Map

When you need to know X, look here first:

| Topic | Document |
|-------|----------|
| Combat-map engine overview (this doc) | `docs/architecture/COMBAT_MAP_ENGINE.md` |
| Battle-map domain boundary + ownership | `docs/architecture/domains/battle-map.md` |
| Combat rules / action economy | `docs/architecture/domains/combat.md` |
| 3D design rationale + asset pipeline | `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md` |
| 2D feature reference / turn flow | `src/components/BattleMap/BattleMap.README.md` |
| Combat-system refactor history | `src/components/BattleMap/CHANGELOG.md` |
| World map / Azgaar bridge | `docs/architecture/domains/world-map.md` |
| Submap procedural generation | `src/hooks/useSubmapProceduralData.README.md` + domain doc |
| Town generation | `docs/architecture/domains/town-map.md` |
| Environment / weather / hazards | `docs/architecture/domains/environment-physics.md` |
| Visibility system | `docs/architecture/VISIBILITY_SYSTEM.md` |
| Biome data shape | `docs/architecture/BIOME_DNA_API.md` |

---

## 7. Known Drift & Status Notes

Recorded so future readers don't trip on the same things:

- **3D design spec status.** `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md` was originally marked "implementation pending." The R3F frontend, terrain/grass/water/tree/decoration layers, character actors, camera controller, VFX system, and post-processing stack are all live in `src/components/BattleMap/`. Treat the spec as a design rationale and reference, not a forward plan. The header has been updated to reflect this.
- **Battle-map domain doc.** `docs/architecture/domains/battle-map.md` previously described only the 2D map. It now points at this document for the 3D engine.
- **In-component README link.** `BattleMap.README.md` previously linked to a non-existent `docs/changelogs/BATTLEMAP_CHANGELOG.md`. It now points at the colocated `./CHANGELOG.md`.
- **`useBattleMapGeneration.ts` naming.** Exports stateless setup logic despite the hook-shaped filename. Tracked in the battle-map domain doc.
- **`ensureConnectivity()` in the generator.** This is no longer a known stub gap. `docs/projects/battle-map/NORTH_STAR.md` and `docs/projects/battle-map/GAPS.md` record the G2 proof that cave/dungeon maps now repair disconnected walkable regions with focused seed coverage. Re-check that project proof if generation density or pathability rules change.

---

## 8. Cross-Cutting Constraints

- **Determinism.** Every generator on these surfaces must be deterministic from `(seed, world-coord, biome)`. This is the contract that lets the 2D ↔ 3D toggle, save/load, and the test suite all work. Don't add `Math.random()` calls to generation code.
- **Rendering is a thin layer.** Game logic lives in hooks. If a behaviour is only correct in one renderer, that is a bug — fix it in the hook, not in the renderer.
- **Asset locality.** 3D assets (glTF models, KTX2 textures) are loaded from `/models/` and `/textures/`. Keep them out of the JS bundle.
- **Performance target.** 60fps on GTX 1060+. Prefer `InstancedMesh` for any repeated geometry. Profile before optimising.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/COMBAT_MAP_ENGINE.md","sha256WithoutMarker":"783cccdbca2b3a984f7740ea3f28941db9034624962f283deff774f34bc5eeee","markedAtUtc":"2026-06-26T00:12:35.430Z"} -->
