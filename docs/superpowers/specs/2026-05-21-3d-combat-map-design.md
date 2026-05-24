# 3D Combat Map — BG3-Style Visual Overhaul

**Date:** 2026-05-21
**Branch:** `worktree-feature+3d-combat-map`
**Status:** Design approved, implementation pending

---

## Goal

Port Aralia's tactical combat map from a 2D HTML/CSS grid to a fully 3D, Baldur's Gate 3-style rendering layer. The 3D map must feature continuous sculpted terrain, hero-grade character models with animations, full environment simulation (swaying vegetation, water, dynamic lighting, weather, particles), dramatic combat VFX (weapon trails, spell zones, cinematic attack camera), and a free-orbiting perspective camera — all while preserving every existing combat mechanic unchanged. The existing 2D map remains available via a player toggle. Target: 60fps on desktop gaming hardware (GTX 1060+).

---

## Design Decisions (Locked In)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Camera | BG3-style tilted perspective, free 360° orbit | Maximizes 3D visual impact; matches reference material |
| Character models | Hero-grade glTF via Grok → Pixal3D → Mixamo pipeline | Free, art-directed, BG3 visual bar |
| Asset pipeline | Grok Imagine (concept art) → Pixal3D (image-to-3D) → Mixamo (rig + animate) | Fully free, custom look per character |
| Landscape | Full environment sim (vegetation, water, lighting, weather, particles) | User-selected; defines the "alive" world feel |
| Port strategy | Parallel toggle — 2D and 3D coexist | Shared hooks, two rendering frontends; low risk |
| Performance target | Desktop gaming PC, 60fps on GTX 1060+ | Unlocks full quality stack (SSAO, shadows, particles) |
| Terrain approach | Continuous sculpted landscape, hidden grid | BG3 reference: grid invisible until movement mode |
| Rendering engine | R3F + drei + custom GLSL shaders (Hybrid Approach C) | Best React integration; custom shaders for environment fidelity |

---

## Architecture

### Integration Model

```
CombatView.tsx
├── BattleMap.tsx        (existing 2D — HTML/CSS grid)
├── BattleMap3D.tsx      (NEW — R3F <Canvas>)
│   ├── TerrainSystem        → continuous heightfield mesh + splat textures
│   ├── CharacterSystem      → glTF models + AnimationMixer
│   ├── VFXSystem            → particles, trails, spell zones, decals
│   ├── CameraController     → orbit controls + cinematic attack cam
│   ├── GridOverlay          → shader-based, visible only in movement mode
│   ├── TargetingVisuals     → ray lines, AoE projections, hit% labels
│   └── UIOverlay            → Html components (HP bars, status, nameplates)
└── Toggle switch            (2D ↔ 3D)

Shared (UNCHANGED):
├── useBattleMap         → selected character, action mode, valid moves
├── useTurnManager       → turn state, action economy, turn order
├── useAbilitySystem     → targeting mode, ability selection, AoE preview
├── useGridMovement      → BFS reachability, A* pathfinding
├── useCombatEngine      → spell zones, reactive triggers, damage calc
├── useCombatVisuals     → damage number queue, animation events
├── combat.ts types      → BattleMapTile, CombatCharacter, CombatAction
├── battleMapGenerator   → procedural map generation (Perlin noise)
├── pathfinding.ts       → A* with D&D 5e diagonal rules
└── lineOfSight.ts       → Bresenham's algorithm
```

### Tech Stack

| Package | Purpose |
|---------|---------|
| `react-three-fiber` | 3D scene graph as React JSX |
| `@react-three/drei` | MapControls, useGLTF, Html overlays, environment maps |
| `@react-three/postprocessing` | SSAO, Bloom, Vignette (BG3 atmosphere) |
| `three` (r169+) | Core renderer |
| Custom GLSL shaders | Terrain splat map, grass sway, water, grid overlay |
| `gltf-pipeline` / `@gltf-transform` | Asset optimization and compression |
| Quaternius RPG pack | Character models (CC0, free) |
| Mixamo | Animation library (idle, walk, attack, death, cast) |

### Bridge: Hooks → 3D Scene

The bridge between existing game logic and the 3D renderer is intentionally thin:

| Hook output | 3D representation |
|-------------|-------------------|
| `handleTileClick(tileId)` | Raycaster hits terrain → reverse-map world position to grid coords → call handler |
| `handleCharacterClick(charId)` | Raycaster hits character mesh → call handler |
| `validMoves[]` | Green/blue highlight zones on terrain via grid overlay shader |
| `activePath[]` | 3D path line/arrow rendered on terrain surface |
| `selectedCharacterId` | Cyan selection decal ring projected on ground |
| `targetingMode` | Targeting ray line from caster to cursor/target |
| `abilityAoE` | Ground-projected AoE shape (circle, cone, line, square) |
| `damageNumbers[]` | `<Html>` floating labels positioned above characters |
| `turnOrder[]` | React UI component overlaid on canvas (top bar) |

---

## Terrain System

### Heightfield Generation

The existing `battleMapGenerator.ts` produces a `BattleMapTile[30][20]` grid. The terrain system consumes this and generates a continuous heightfield mesh:

1. Create a `PlaneGeometry(30, 20, 30*subdivisions, 20*subdivisions)` with vertex density ~4x tile resolution for smooth interpolation
2. Set vertex Y from tile `elevation` values, interpolated with bicubic smoothing across tile boundaries
3. Apply per-biome noise displacement for organic micro-detail (small bumps, cracks)
4. Generate normals and tangents for PBR lighting

### Splat Map Texturing

A procedurally generated RGBA texture encodes blend weights for 4 terrain materials per biome:

- **R channel**: Primary ground (grass/stone floor/sand)
- **G channel**: Secondary (rock/brick/sandstone)
- **B channel**: Tertiary (dirt/gravel/rubble)
- **A channel**: Special (water/mud/blood)

Tile boundaries blend smoothly (feathered over ~0.3 tile widths) so terrain transitions look natural.

### Per-Biome Material Sets

| Biome | R (primary) | G (secondary) | B (tertiary) | A (special) |
|-------|-------------|---------------|--------------|-------------|
| Forest | Lush grass | Mossy rock | Dirt path | Stream water |
| Cave | Stone floor | Stalagmite rock | Gravel | Underground pool |
| Dungeon | Flagstone | Brick wall base | Rubble | Blood pools |
| Desert | Sand | Sandstone | Cracked earth | Oasis water |
| Swamp | Marsh grass | Mud | Rotting wood | Murky water |

Each material is a PBR texture set (albedo + normal + roughness/metalness + AO).

### Decorations as 3D Props

Current tile decorations (`tree`, `boulder`, `stalagmite`, `pillar`, `cactus`, `mangrove`) become instanced glTF models. Placed at tile positions with seeded random jitter (offset ±0.3 tiles, random Y rotation) so they don't sit on grid centers.

Use `InstancedMesh` per prop type for draw call efficiency (one draw call per unique prop model).

### Vegetation Layer

Instanced grass blades scattered across grass-type tiles (~50-100 per tile). Custom vertex shader applies wind sway:

```glsl
float wind = sin(time * windSpeed + worldPos.x * 0.5 + worldPos.z * 0.3) * windStrength;
displaced.x += wind * vertexHeight; // tops sway, roots stay
```

Additional small plants (flowers, ferns) scattered via instanced mesh with LOD — full detail within camera radius, billboards beyond.

### Water System

Water tiles render as a separate planar mesh at tile elevation:
- Animated UV distortion for flowing appearance
- Environment cube map reflections (or SSR on high settings)
- Depth-based transparency (shallow = clear, deep = opaque)
- Caustic pattern projected onto terrain underneath
- Subtle vertex displacement for surface waves

### Grid Overlay (Movement Mode Only)

A screen-space shader on the terrain that activates when `actionMode === 'move'`:
- Faint grid lines at tile boundaries (world-space UV calculation)
- `validMoves` tiles: green/blue fill with 30% opacity
- `activePath` tiles: bright directional arrows
- Tiles with `blocksMovement`: red X or darkened
- Fades in/out with 200ms transition

---

## Character System

### Model Pipeline

1. **Source**: Quaternius RPG Character Pack (CC0) for initial implementation — 6 rigged fantasy characters
2. **Animations**: Mixamo animation library — download as FBX, convert to glTF
3. **Required animation states**: idle, walk, run, attack_melee, attack_ranged, cast_spell, hit_react, death, dodge
4. **Optimization**: `@gltf-transform` to compress textures (KTX2), draco-compress geometry, merge materials

### In-Scene Representation

Each `CombatCharacter` maps to a `CharacterActor` component:

```
CharacterActor
├── glTF Model (SkinnedMesh)
├── AnimationMixer (state-driven)
├── Selection Decal (cyan ring on ground, from BG3 ref)
├── Nameplate (<Html> overlay: name, HP bar, status icons)
├── Active Turn Indicator (golden ring animation, from BG3 ref)
└── Status Effect Particles (per active condition)
```

### Animation State Machine

```
idle ←──── default
  │
  ├── walk ←── movement action (lerp position along path)
  │     └── idle (on arrival)
  │
  ├── attack_melee ←── melee ability used
  │     ├── [trigger cinematic camera]
  │     ├── [spawn weapon trail VFX]
  │     ├── [on hit frame: spawn impact VFX + damage number]
  │     └── idle
  │
  ├── cast_spell ←── spell ability used
  │     ├── [trigger spell VFX at target]
  │     ├── [spawn projectile if ranged spell]
  │     └── idle
  │
  ├── hit_react ←── took damage
  │     └── idle
  │
  └── death ←── HP <= 0
        └── [stay in death pose]
```

### Character-to-Model Mapping

Map `CombatCharacter.class` (or race/equipment) to a glTF model file:

```typescript
const CHARACTER_MODELS: Record<string, string> = {
  fighter: '/models/characters/knight.glb',
  wizard: '/models/characters/mage.glb',
  cleric: '/models/characters/priest.glb',
  rogue: '/models/characters/rogue.glb',
  ranger: '/models/characters/ranger.glb',
  default: '/models/characters/adventurer.glb',
};
```

### Team Differentiation

- Player team: cyan selection circle, blue nameplate accent
- Enemy team: red selection circle, red nameplate accent
- Neutral: yellow selection circle

---

## VFX System

### Spell Zones

Active spell effects (fire, ice, acid, etc.) render as ground-projected 3D effects:

- **Emissive ground decal** — colored overlay on terrain within the zone radius
- **Particle emitters** — flames/frost/bubbles rising from the zone
- **Dynamic point light** — fire zones cast warm orange light, ice zones cast cool blue
- **Per-frame animation** — fire flickers, ice pulses, acid bubbles

Generated from `useCombatEngine`'s `spellZones[]` array.

### Weapon Trails

During melee attack animations:
- Track the weapon bone position each frame for the last ~10 frames
- Generate a ribbon/trail mesh from the position history
- Apply emissive material with the weapon's damage type color (fire=orange, radiant=gold, necrotic=purple)
- Fade out over 300ms after the swing completes

### Impact Effects

On hit (damage application):
- Particle burst at impact point (sparks for physical, element-colored for magical)
- Screen shake (subtle, 50ms)
- Blood decal projected onto terrain (physical damage)
- Flash on the target character model (100ms emissive pulse)

### Projectiles

Ranged attacks and spells:
- Spawn a projectile mesh/particle at caster position
- Lerp to target position over 200-400ms (speed varies by spell)
- On arrival: trigger impact effect
- Trail particles behind the projectile (magic trail for spells, arrow for ranged weapons)

### Targeting Visuals (from BG3 Bhaal Temple reference)

When in targeting mode:
- **Targeting ray**: white line from caster to cursor, projected through 3D space
- **Hit probability**: floating `<Html>` label at target showing "75%" etc.
- **Target highlight**: red outline/emissive pulse on targeted enemy model
- **AoE preview**: ground-projected shape (circle, cone, line, square) with pulsing edge

---

## Camera System

### Default: Tactical Orbit

```typescript
// OrbitControls (drei MapControls variant)
{
  target: partyCenter,           // auto-follow active character
  minDistance: 8,
  maxDistance: 25,
  minPolarAngle: Math.PI * 0.15, // prevent going under terrain
  maxPolarAngle: Math.PI * 0.45, // prevent going fully top-down
  enableDamping: true,
  dampingFactor: 0.08,
  // FOV: 50 (perspective, not orthographic)
}
```

Free 360° orbit, zoom, pan. Tracks the active character by default but the player can pan freely.

### Cinematic Attack Camera

On attack action:
1. Save current camera state
2. Lerp camera to close-up position (behind attacker, angled toward target)
3. Hold for attack animation duration (~1-2 seconds)
4. Lerp back to saved tactical position

Optional: player setting to disable cinematic camera (for faster gameplay).

### Camera Transitions

All camera movements use smooth lerp/slerp with easing curves. No hard cuts except when toggling 2D↔3D.

---

## UI Overlay System

Existing React UI components stay as HTML overlaid on the 3D canvas. R3F's `<Html>` from drei handles world-space anchoring.

### World-Space UI (anchored to 3D positions)

| Element | Anchor | Component |
|---------|--------|-----------|
| Character nameplate | Above character head bone | `CharacterNameplate3D` |
| HP bar | Below nameplate | Part of `CharacterNameplate3D` |
| Status effect icons | Below HP bar | Part of `CharacterNameplate3D` |
| Damage numbers | Above character, float upward | `DamageNumber3D` |
| Hit probability | At target position | `HitChanceLabel3D` |

### Screen-Space UI (fixed position, existing components adapted)

| Element | Position | Component |
|---------|----------|-----------|
| Party portraits + HP | Left edge | `PartyDisplay` (existing) |
| Initiative tracker | Top center | `InitiativeTracker` (existing) |
| Ability palette / action bar | Bottom center | `AbilityPalette` (existing, restyled) |
| Action economy bar | Near action bar | `ActionEconomyBar` (existing) |
| Combat log | Bottom-left or collapsible | `CombatLog` (existing) |
| Minimap | Top-right | `Minimap3D` (new — orthographic top-down render) |
| 2D/3D toggle | Settings/corner | `RenderModeToggle` (new) |
| End Turn button | Bottom-right | `EndTurnButton` (existing, restyled) |

---

## Lighting & Post-Processing

### Lighting Rig

```
Scene Lights:
├── DirectionalLight (sun/moon)    — shadows, primary illumination
│     shadow map: 2048×2048, PCFSoft
├── AmbientLight                   — fill (cool blue-teal tint)
├── HemisphereLight                — sky/ground color gradient
├── PointLight[] (per torch/fire)  — warm, attenuated, no shadows
├── PointLight[] (per spell zone)  — dynamic, colored by effect type
└── SpotLight (optional)           — dramatic accent on active character
```

### Post-Processing Stack

```
EffectComposer:
├── SSAO              — deep corner shadows (BG3's moody interiors)
├── Bloom             — magical glow on spells, emissive materials
├── Vignette          — darkened edges for cinematic framing
├── ToneMapping       — ACES Filmic (warm, cinematic color response)
└── ChromaticAberration (subtle) — optional polish pass
```

### Per-Biome Lighting Presets

| Biome | Sun color | Ambient | Fog | Mood |
|-------|-----------|---------|-----|------|
| Forest | Warm gold | Soft green | Light haze | Bright, natural |
| Cave | None (no sun) | Deep blue | Dense, close | Dark, claustrophobic |
| Dungeon | Dim amber | Cool gray | Medium | Moody, menacing |
| Desert | Harsh white | Warm sand | Heat shimmer | Bright, harsh |
| Swamp | Filtered green | Murky teal | Heavy fog | Eerie, damp |

---

## Development Process: Research-First Implementation

**Every phase must begin with a research step.** Before writing code for any 3D system, the implementer must search for and study how game developers have solved the same problem. This is not optional — browser-based 3D game development has deep, non-obvious gotchas that only become apparent from others' experience.

### Per-Phase Research Protocol

1. **Search** for tutorials, blog posts, and open-source implementations of the specific technique (e.g., "three.js terrain splat map tutorial", "r3f weapon trail effect", "webgl grass shader wind")
2. **Study** at least 2-3 reference implementations before writing code — note which approaches work at scale and which have known performance pitfalls
3. **Check Three.js examples** (`threejs.org/examples`) and the Three.js discourse forum for the canonical way to achieve the effect
4. **Review ShaderToy** for shader techniques (grass sway, water, fire) — these are often the highest-quality references for GLSL approaches
5. **Document** the chosen approach and why alternatives were rejected, in a brief comment block at the top of each new file

### Key Research Sources

| Source | Use For |
|--------|---------|
| [Three.js Examples](https://threejs.org/examples/) | Canonical implementations of terrain, instancing, shadows, postprocessing |
| [Three.js Discourse](https://discourse.threejs.org/) | Community solutions to specific problems, performance advice |
| [ShaderToy](https://www.shadertoy.com/) | GLSL shader techniques (grass, water, fire, fog, particles) |
| [Catlike Coding](https://catlikecoding.com/unity/tutorials/) | Unity tutorials with transferable concepts (terrain, rendering, shaders) |
| [Red Blob Games](https://www.redblobgames.com/) | Grid systems, pathfinding visualization, hex/square grids in 3D |
| [GDC Vault / YouTube](https://www.gdcvault.com/) | AAA game dev talks on lighting, VFX, camera systems |
| [Larian Studios tech talks](https://www.youtube.com/results?search_query=larian+studios+gdc) | BG3-specific rendering and art direction insights |
| [pmndrs/drei source code](https://github.com/pmndrs/drei) | R3F ecosystem patterns, how existing abstractions work |
| [Pixal3D](https://github.com/TencentARC/Pixal3D) | Image-to-3D pipeline for character asset generation |
| [Polyhaven](https://polyhaven.com/) / [AmbientCG](https://ambientcg.com/) | Free CC0 PBR textures for terrain and props |

### Anti-Patterns to Avoid

- **Don't invent shader techniques from scratch** — someone has already solved it, probably better
- **Don't skip the Three.js examples check** — many "custom" solutions are just worse versions of existing examples
- **Don't cargo-cult Unity/Unreal tutorials** — the concepts transfer but the API calls don't; always adapt to Three.js/R3F idioms
- **Don't optimize prematurely** — get it working visibly first, then profile, then optimize the actual bottleneck

---

## Implementation Plan

### Phase 0: Foundation (Week 1-2)
**Goal: Empty 3D scene with camera controls, togglable from CombatView**

- [ ] **Research**: Study R3F + drei setup patterns, MapControls configuration, postprocessing pipeline examples
- [ ] Install R3F, drei, postprocessing packages
- [ ] Create `BattleMap3D.tsx` — empty `<Canvas>` with basic lighting
- [ ] Add `MapControls` with BG3-style orbit constraints (15°-75° pitch, full 360° yaw)
- [ ] Implement snap-to-character: click portrait → camera lerps to character; Tab cycles party; 1-4 hotkeys; double-click model → close-up
- [ ] Wire toggle in `CombatView.tsx` — switch between `BattleMap` and `BattleMap3D`
- [ ] Add ground plane placeholder (flat, single color)
- [ ] Verify all existing hooks still work when 3D mode is active
- [ ] Add postprocessing stack (SSAO + Bloom + Vignette) with quality presets

### Phase 1: Terrain (Week 3-4)
**Goal: Procedural terrain mesh generated from BattleMapTile data**

- [ ] **Research**: Study terrain splat map techniques (Three.js examples, ShaderToy), heightfield generation, PBR texture blending
- [ ] Build `TerrainMeshGenerator` — heightfield from tile elevation data
- [ ] Implement splat map generation from tile terrain types
- [ ] Write terrain fragment shader (4-material blend with tiling PBR textures)
- [ ] Source/create PBR texture sets for forest biome (first biome)
- [ ] Add decoration prop loading (glTF) with instanced placement
- [ ] Implement grid overlay shader (movement mode only)
- [ ] Wire `validMoves` and `activePath` to grid overlay highlights
- [ ] Add per-biome lighting presets

### Phase 2: Characters (Week 5-7)
**Goal: Characters rendered as 3D models with basic animations**

- [ ] **Research**: Study Three.js SkinnedMesh, AnimationMixer, and glTF loading best practices
- [ ] Set up Grok → Pixal3D → Mixamo asset pipeline (generate first character end-to-end)
- [ ] Generate initial character set: 6 player classes + 4-6 enemy types via pipeline
- [ ] Optimize all models with gltf-transform (Draco geometry, KTX2 textures)
- [ ] Download Mixamo animations (idle, walk, attack_melee, attack_ranged, cast_spell, hit_react, death, dodge)
- [ ] Build `CharacterActor` component — model + AnimationMixer
- [ ] Implement animation state machine (idle → walk → attack → etc.)
- [ ] Map character class/race/creature to model files
- [ ] Add selection decal (cyan ring for player, red for enemy — ground-projected)
- [ ] Add active turn indicator (golden ring animation)
- [ ] Implement character movement — lerp along `activePath` with walk animation
- [ ] Wire raycaster click → `handleCharacterClick`

### Phase 3: Combat Interaction (Week 8-9)
**Goal: Full combat loop playable in 3D**

- [ ] **Research**: Study R3F raycasting patterns, drei Html component positioning, BG3 UI/UX design breakdowns
- [ ] Wire raycaster terrain click → grid coordinate → `handleTileClick`
- [ ] Implement targeting visuals (ray line, AoE ground projection, hit% label)
- [ ] Add `<Html>` nameplates (name, HP bar, status icons)
- [ ] Add floating damage numbers (positioned above character, float up + fade)
- [ ] Implement turn transition camera (auto-focus on active character)
- [ ] Add End Turn button and ability palette as screen-space overlay
- [ ] Connect initiative tracker UI
- [ ] Full combat round playable: move, attack, cast, end turn

### Phase 4: VFX (Week 10-12)
**Goal: Combat feels dramatic and impactful (world-space drama, screen-space restraint — BG3 philosophy)**

- [ ] **Research**: Study weapon trail implementations (ribbon geometry), particle systems in R3F, decal projection techniques, Three.js cinematic camera examples
- [ ] Weapon trail system (ribbon mesh on weapon bone, colored by damage type)
- [ ] Impact effects (particle burst, screen shake, blood decals)
- [ ] Spell zone rendering (fire, ice, acid with particles + dynamic lights)
- [ ] Projectile system (ranged attacks, spell bolts)
- [ ] Cinematic attack camera (zoom in on attack, zoom out after)
- [ ] Hit reaction animations triggered on damage
- [ ] Death animation + ragdoll or death pose

### Phase 5: Living World (Week 13-15)
**Goal: Environment feels alive, BG3-level atmosphere**

- [ ] **Research**: Study grass shader techniques (ShaderToy, GPU Gems), water rendering in WebGL, weather particle systems, Larian GDC talks on BG3 environment art
- [ ] Instanced grass system with wind sway shader
- [ ] Water system (animated surface, reflections, caustics)
- [ ] Additional biome texture sets (cave, dungeon, desert, swamp)
- [ ] Weather effects (rain particles, fog density, dust motes)
- [ ] Ambient particles (fireflies for forest, embers for dungeon, spores for swamp)
- [ ] Dynamic time-of-day lighting (optional: day/night cycle during combat)
- [ ] Environmental audio hooks (optional: spatial audio triggers)

### Phase 6: Polish & Optimization (Week 16-17)
**Goal: 60fps stable, visual polish, edge cases handled**

- [ ] **Research**: Study Three.js performance profiling tools, InstancedMesh best practices, LOD strategies, texture compression formats (KTX2/Basis)
- [ ] Performance profiling — ensure 60fps on GTX 1060
- [ ] InstancedMesh for all repeated geometry (tiles, grass, props)
- [ ] LOD system for distant objects
- [ ] Texture compression (KTX2/Basis Universal)
- [ ] Large creature multi-tile positioning in 3D
- [ ] Minimap (orthographic top-down render-to-texture)
- [ ] Settings panel (quality presets: Low/Medium/High/Ultra)
- [ ] 2D↔3D toggle preserves full combat state
- [ ] Edge cases: prone characters, grappled, invisible, flying elevation

---

## Asset Requirements

### Character Models (glTF)
- 6 base humanoid models (fighter, wizard, cleric, rogue, ranger, generic)
- 4-6 enemy/monster models (goblin, skeleton, wolf, dragon, elemental, etc.)
- Pipeline: Grok Imagine (concept art) → Pixal3D (image-to-3D, local/free) → Mixamo (auto-rig + animations)
- Optimization: gltf-transform (Draco compress geometry, KTX2 compress textures)

### Animations (per character rig)
- idle, walk, run, attack_melee (×2 variants), attack_ranged, cast_spell, hit_react, death, dodge
- Source: Mixamo (free, FBX → glTF conversion)

### Terrain Textures (per biome, 4 PBR sets)
- Albedo + Normal + ARM (AO/Roughness/Metalness) per material
- Tiling: 1024×1024 or 2048×2048
- Source: Polyhaven (CC0), AmbientCG (CC0), or custom-authored

### Decoration Props (glTF, per biome)
- Tree (×3 variants), boulder (×2), stalagmite, pillar, cactus, mangrove
- Bush, barrel, crate, torch sconce, rubble pile
- Source: Quaternius nature pack (CC0), Kenney assets, Sketchfab

### VFX Textures
- Particle atlases: fire, smoke, sparks, magic, blood
- Noise textures for shader effects
- Caustic pattern for water
- Source: Custom-authored or opengameart.org

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance below 60fps on target hardware | Medium | High | InstancedMesh everywhere, LOD, quality presets, profile early |
| glTF model quality insufficient at close zoom | Medium | Medium | Cinematic camera has min distance; source higher-poly models if needed |
| Splat map terrain looks "painterly" not realistic | Medium | Medium | High-res tiling textures + detail normal maps; reference BG3 terrain closely |
| Custom shaders hard to maintain | Low | Medium | Document thoroughly; keep shader code modular; use ShaderMaterial with #include |
| Animation retargeting issues between rigs | Medium | Low | Standardize on Mixamo rig; use same skeleton for all humanoids |
| Browser memory limits with large asset sets | Low | Medium | Lazy-load models per encounter; dispose after combat; texture compression |

---

## Out of Scope (for this project)

- Multiplayer / networked combat
- Mobile / tablet support
- VR / AR rendering modes
- Custom character creation (RPM integration is a stretch goal)
- Procedural animation (IK foot placement, etc.)
- Ray tracing (WebGPU RT not yet viable in browsers)
- Audio system (separate project)

---

## References

### Visual References (BG3)
- [BG3 Weapon Attack Gameplay Animations](https://www.youtube.com/watch?v=ZL91_JyB5A4)
- BG3 screenshots: Waning Moon (interior lighting), Risen Road (outdoor combat), Bhaal Temple (targeting/VFX), Goblin Camp (fire AoE + cinematic camera)

### Tech Stack
- [react-three-fiber](https://github.com/pmndrs/react-three-fiber)
- [@react-three/drei](https://github.com/pmndrs/drei)
- [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)

### Asset Pipeline
- [Grok Imagine Agent](https://grok.com/imagine/agent) — AI concept art generation
- [Pixal3D (SIGGRAPH 2026)](https://github.com/TencentARC/Pixal3D) — pixel-aligned image-to-3D, outputs .glb directly
- [Pixal3D HuggingFace Demo](https://huggingface.co/spaces/TencentARC/Pixal3D)
- [Mixamo Animation Library](https://www.mixamo.com/) — auto-rigging + animation packs
- [Polyhaven](https://polyhaven.com/) / [AmbientCG](https://ambientcg.com/) — free CC0 PBR textures

### Game Dev Resources
- [Three.js Examples](https://threejs.org/examples/) — canonical technique implementations
- [Three.js Discourse](https://discourse.threejs.org/) — community problem-solving
- [ShaderToy](https://www.shadertoy.com/) — GLSL shader reference
- [Red Blob Games](https://www.redblobgames.com/) — grid and pathfinding visualization
- [Three.js Terrain Splat Map Example](https://threejs.org/examples/#webgl_terrain_dynamic)
- [von-grid: Square/Hex Grid for Three.js](https://github.com/vonWolfehaus/von-grid)
- [t5c: 3D RPG with Babylon.js](https://github.com/orion3dgames/t5c)
