# PROJECT: 3D Combat Map

> North-star document for the 3D tactical combat map feature.
> Read this first. Everything else flows from here.

## Objective

Build a 3D tactical combat map rendered with react-three-fiber that can be toggled alongside the existing 2D grid, reaching a Baldur's Gate 3 level of visual quality: atmospheric lighting, readable class-distinct characters, procedurally textured terrain, and a living world with particles, vegetation, and weather. All existing combat mechanics remain unchanged — this is purely a rendering layer swap.

## How We Achieve It

1. **Shared game logic** — both 2D and 3D views consume the same hooks (`useBattleMap`, `useTurnManager`, `useAbilitySystem`, `useTargetSelection`). Zero gameplay code duplication.
2. **R3F + drei + custom GLSL** — React-Three-Fiber for the scene graph, drei for camera controls and shadows, custom shaders for procedural terrain texturing and grass wind.
3. **Iterative visual quality passes** — build the scene, screenshot it, audit against the BG3 quality bar, fix what's wrong, repeat. Three full passes completed so far.
4. **Instanced rendering** — grass, trees, ground scatter, decorations all use `InstancedMesh` for draw-call efficiency. Target: 60fps on GTX 1060+.

## What We've Built

### Implementation (complete)

| Phase | What | Key Commit |
|-------|------|------------|
| 0 | R3F Canvas, lighting rig, camera controls, postprocessing, 2D/3D toggle | `ac5d8c95` |
| 1 | Terrain heightfield mesh, grid overlay, instanced grass, water system, decoration props | `ad7e99fc` |
| 2 | Character actors with humanoid models, animation states, BG3-style selection decals | `a3376801` |
| 3 | Camera controller — snap-to-character, cinematic attack cam, keyboard nav (Tab, 1-4) | `28364928` |
| 4 | VFX system — weapon trails, spell zones, projectiles, floating damage numbers | `ca255a7f` |
| 5 | Living world — vegetation sway, weather particles, fireflies, ambient effects | `ca255a7f` |
| 6 | UI polish — controls help overlay, action bar, viewport sizing | `8d8195b6`, `2af0bf3c` |

### Visual Quality Passes (complete)

| Pass | Focus | Key Fixes |
|------|-------|-----------|
| Phase 1 | Rendering bugs | Character scale 2.5x, grass layer timing fix, multi-sphere canopy trees, shadow system, fog, grid refinement |
| Phase 2 | Scene fidelity | Procedural GLSL terrain textures (7 types), 4 tree species, hover-only nameplates, sky dome, contact shadows, ambient particles, ground scatter, decoration variety |
| Phase 3 | Character identity | Class-based archetypes (fighter/caster/rogue), facing direction, grass height reduction, stump/log proportions, HP pip visibility, terrain elevation, emissive reduction |

### Recent Polish

| Change | Commit |
|--------|--------|
| Collapsible controls help overlay (3D mode) | `8d8195b6` |
| Canvas fills full available vertical space | `2af0bf3c` |
| Map enlarged to 40x30, camera/shadow/fog scaled | `08209451` |
| InstancedMesh frustum culling fix (props no longer vanish on rotation) | `08209451` |

## What's Left To Do

### Must (blocks merge)

- [ ] **CombatView 3D integration** — `BattleMap3D` silently fails inside `CombatView.tsx` ErrorBoundary. Only works via `BattleMapDemo`. R3F Canvas may need different error handling or lazy loading. (Tracker #24)

### Should (before or shortly after merge)

- [ ] **SSAO NormalPass error spam** — `enableNormalPass` present but throws console errors each frame. Version incompatibility suspected between `@react-three/postprocessing` and `postprocessing`. (Gap #1)
- [ ] **Terrain click height offset** — clicks on steep slopes may register on wrong tile because `Math.floor(px / TILE_SIZE)` ignores vertex displacement. (Gap #4)
- [ ] **CombatView pop-out 3D sync** — toggle state not synced when user switches while popped out. (Gap #2)

### Could (follow-up polish)

- [ ] **glTF character models** — replace procedural geometry with artist-grade models via Grok → Pixal3D → Mixamo pipeline (per design spec)
- [ ] **Per-biome decoration sets** — cave stalactites, desert rock formations, swamp dead trees
- [ ] **Animated character state machine** — idle, walk, attack, hit, death animations (currently static poses)
- [ ] **Weather system** — rain, snow, dust storms per biome

---

## File Locations

### Source Code

```
src/components/BattleMap/
  BattleMap3D.tsx              -- 3D scene root (Canvas, lighting, fog, postprocessing)
  BattleMapDemo.tsx            -- Demo/test harness with 2D/3D toggle
  camera/
    CameraController.tsx       -- BG3-style orbit, snap-to-character, cinematic cam
  characters/
    CharacterActor.tsx         -- Character models, archetypes, selection, HP pips
  terrain/
    TerrainMesh.tsx            -- Heightfield mesh with procedural GLSL texturing
    GridOverlay.tsx            -- Movement grid (visible only in move mode)
    GrassLayer.tsx             -- Instanced grass with wind shader
    WaterSystem.tsx            -- Water tile rendering
    DecorationProps.tsx        -- Trees, boulders, stumps, logs, bushes (instanced)
    GroundScatter.tsx          -- Pebbles, leaves, twigs, mushrooms (instanced)
  vfx/
    VFXSystem.tsx              -- Spell zones, weapon trails, damage numbers, AoE preview
    LivingWorld.tsx            -- Ambient particles, fireflies, weather effects
```

### Supporting Code

```
src/config/mapConfig.ts                    -- BATTLE_MAP_DIMENSIONS (40x30)
src/services/battleMapGenerator.ts         -- Procedural map generation (tiles, terrain, elevation)
src/hooks/useBattleMap.ts                  -- Shared game logic (selection, pathing, clicks)
src/hooks/useBattleMapGeneration.ts        -- Battle setup utility (map + character positioning)
src/hooks/combat/useTurnManager.ts         -- Turn order, action economy, AI turns
src/hooks/combat/useTargetSelection.ts     -- Ability targeting validation
src/hooks/useAbilitySystem.ts              -- Ability selection, AoE preview, execution
```

### Documentation

```
docs/superpowers/specs/2026-05-21-3d-combat-map-design.md   -- Technical design spec (architecture, decisions, component breakdown)
docs/architecture/domains/battle-map.md                      -- Domain overview (entry points, shape, drift notes)
docs/images/battle-map.svg                                   -- Architecture diagram
```

### Task Tracking

```
.agent/PROJECT-3d-combat-map.md            -- This file (north-star objective)
.agent/GOAL-3d-visual-quality.md           -- Phase 3 visual quality goal (completed)
.agent/3d-visual-quality/TRACKER.md        -- Visual quality task tracker (Phases 1-3, all complete)
.agent/3d-visual-quality/GAPS.md           -- Gap registry (out-of-scope issues found during quality work)
```

---

## Branch

**`worktree-feature+3d-combat-map`** — all work happens here. 20 commits since fork from main.
