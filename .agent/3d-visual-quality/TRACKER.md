# 3D Visual Quality — Task Tracker

> Single source of truth for all visual quality tasks.
> Read `.agent/GOAL-3d-visual-quality.md` for full context and process rules.

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

## Baseline

**Date:** 2026-05-22
**Screenshot:** Forest biome, 1920x1080, 3D mode via BattleMapDemo
**Assessment:** Monochrome vertex-colored heightmap. Characters invisible (only nameplates visible). No grass visible. Trees are sub-pixel cone primitives. No shadows visible. Grid lines too prominent. No atmosphere/fog. SSAO broken. Camera too far.

## Phase 2 Assessment

**Date:** 2026-05-22
**Screenshot:** Forest biome, BattleMapDemo 3D mode after Phase 1 fixes
**Assessment:** Trees recognizable. Grass visible. Characters visible. Shadows working. Fog at edges. But: terrain is flat-colored (no texture grain), nameplates overlap illegibly, every tree identical, no ground scatter, no skybox, grass uniform, lighting flat, no particles visible, SSAO still broken.

---

## Phase 1 Tasks (Complete)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Terrain textures (PBR tiling) | P0 | [ ] | **Carried forward to Phase 2 Tier 1.** TerrainMesh.tsx uses `meshStandardMaterial vertexColors` — zero textures. |
| 2 | Character visibility | P0 | [x] | Scaled to 2.5x. Emissive added. Visible humanoid shapes. |
| 3 | Grass layer debug | P0 | [x] | useMemo→useEffect ref timing fix. 40 blades/tile, natural green. |
| 4 | Tree/decoration quality | P0 | [x] | Multi-sphere canopy trees, organic boulders, saguaro cacti, mangrove roots. Also fixed useMemo→useEffect in InstancedPropMesh. |
| 5 | Shadow system | P1 | [x] | Shadow camera centered on map, directional light target via useEffect, shadow-bias. |
| 6 | SSAO fix | P1 | [!] | **Carried forward to Phase 2 Tier 3.** enableNormalPass present but errors persist. Version incompatibility suspected. |
| 7 | Camera closer | P1 | [x] | Offset (+5,7,+5), minDistance=5, maxDistance=20. |
| 8 | Fog/atmosphere | P1 | [x] | Tightened fog distances all biomes. Visible at edges. |
| 9 | Grid refinement | P2 | [x] | Line width 0.02, base opacity 0.12, mode-gated visibility. |
| 10 | Ground scatter | P2 | [ ] | **Carried forward to Phase 2 Tier 2.** |
| 11 | Decoration variety | P2 | [ ] | **Carried forward to Phase 2 Tier 3.** |
| 12 | Grass blade color contrast | P0 | [x] | Fixed with Task #3. Dark-to-medium green gradient. |
| 13 | Character model scale consistency | P0 | [ ] | **Carried forward to Phase 2 Tier 4.** |

---

## Phase 2 Tasks

### Tier 1 — Prototype killers

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 14 | Terrain PBR textures | P0 | [x] | | Replaced vertexColors with onBeforeCompile GLSL procedural texturing. 7 terrain types (grass/rock/dirt/sand/water/wall/floor) with FBM noise, voronoi cracks, edge blending, normal perturbation. |
| 15 | Nameplate overlap fix | P0 | [x] | | BG3-style: full nameplate on hover/selection/turn only. Minimal 3D HP pip (colored sphere) shown by default. Eliminates text wall. |
| 16 | Tree variety (2-3 species) | P0 | [x] | | 4 tree variants: oak (40%), pine/conifer (25%), wide/flat (25%), dead/bare (10%). Weighted random selection per instance via separate seed. |

### Tier 2 — Expected but missing

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 17 | Ground scatter objects | P1 | [x] | | GroundScatter.tsx: instanced pebbles, leaves, twigs, mushrooms. 4-8 per open grass tile, weighted random. ~3000-5000 instances in 4 draw calls. |
| 18 | Skybox / background | P1 | [x] | | SkyDome component: gradient shader (top→horizon→bottom) per biome. BackSide sphere, renderOrder -1. |
| 19 | Grass height/color variation | P1 | [x] | | Per-instance tint via instanceTint attribute. Cluster noise for height patches. Bare spots (40% blades) near rock/wall/water tiles. Warm-cool green tint variation. |

### Tier 3 — Makes it feel alive

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 20 | Lighting drama | P1 | [x] | | Sun 1.6→2.2, ambient 0.4→0.3. Warm sun (0xffe0a0) + cool fill (0x6080c0) for temperature split. |
| 21 | Visible ambient particles | P1 | [x] | | All biomes: particle size 3-4x larger, counts increased, opacity boosted. Firefly glow sphere 0.02→0.06, point light distance 2.5→4, intensity flicker range doubled. Dungeon now has torch ember fireflies. |
| 22 | Contact AO (SSAO or fake) | P1 | [x] | | drei ContactShadows component: opacity 0.4, blur 2, resolution 512. Soft ground darkening under all objects. |
| 23 | Decoration variety | P2 | [x] | | 3 new types: fallen logs, tree stumps, bushes. Added to BattleMapDecoration type + map generator. Bushes/stumps provide cover without blocking movement. |

### Tier 4 — Polish

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 24 | CombatView 3D mode broken | P1 | [!] | | R3F Canvas silently fails in CombatView ErrorBoundary. Only works via BattleMapDemo. Spawned as separate task for debugging. |
| 25 | Character/decal scale ratio | P2 | [x] | | Selection ring 0.28-0.35→0.42-0.48, turn ring 0.36-0.44→0.50-0.60. Rings now properly encompass 2.5x-scaled character body. |

---

## Phase 3 Tasks

### Tier 1 — P0 (Breaks the illusion)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 26 | Class-based character models | P0 | [x] | 3 archetypes: fighter (armor+sword+shield), caster (robes+staff+wizard hat), rogue (leather+hood+dual daggers). getArchetype() maps class name to visual loadout. |
| 27 | Reduce grass height | P0 | [x] | BLADE_HEIGHT_MAX 0.50→0.25, MIN 0.15→0.08. Ankle-to-shin height. GrassLayer.tsx. |

### Tier 2 — P1 (Hurts polish)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 28 | Character facing direction | P1 | [x] | atan2 toward nearest living enemy. Seeded hash fallback for no-enemy case. Rotation applied to character model group. |
| 29 | Reduce stump/log scale | P1 | [x] | Fallen log: radius 0.12→0.07, length 1.0→0.6. Stump: radius 0.14→0.08, height 0.25→0.15. ~40% size reduction. |
| 30 | Enlarge HP pip spheres | P1 | [x] | Sphere 0.06→0.12 radius. Added team-colored ring (0.14-0.18 radius) around pip. Visible at tactical zoom. |

### Tier 3 — P2 (Nice to have)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 31 | Debug terrain elevation | P2 | [x] | Generator noise scale x/15→x/8, elevation formula `round(rawElev*2.5+1.0)` for range 0-3. Characters now use `tileElevation * ELEVATION_SCALE` for Y position. |
| 32 | Reduce character emissive | P2 | [x] | All 3 archetype torsos: emissiveIntensity 0.15→0.05. Skin has zero emissive (was already 0). |

---

## Progress Log

| Date | Task # | Action | Result |
|------|--------|--------|--------|
| 2026-05-22 | — | Initial audit + baseline screenshot | Tracker created. 13 tasks identified. |
| 2026-05-22 | 2, 7 | Camera closer + character scale up | Camera offset (+5,7,+5). Characters 2.5x, emissive. |
| 2026-05-22 | 3, 12 | Grass layer fix + color tuning | useMemo→useEffect. Green palette. Grass visible. |
| 2026-05-22 | 4 | Tree/decoration overhaul | Multi-sphere canopy, organic boulders, saguaro cacti. useMemo→useEffect fix in InstancedPropMesh. |
| 2026-05-22 | 5 | Shadow system fix | Light positioned relative to map center, target via useEffect, shadow-bias. |
| 2026-05-22 | 8 | Fog tightening | All biome fog distances reduced. Visible at map edges. |
| 2026-05-22 | 9 | Grid refinement | Width/opacity reduced, mode-gated. |
| 2026-05-22 | — | Phase 2 critical assessment | 12 new tasks identified. Terrain textures, nameplate overlap, tree variety are top priority. |
| 2026-05-22 | 14 | Procedural terrain texturing | Replaced flat vertexColors with GLSL procedural noise (FBM, voronoi). 7 terrain types with distinct patterns. Edge blending + normal perturbation. |
| 2026-05-22 | 16 | Tree variety | 4 species: oak, pine, wide/flat, dead/bare. Weighted random per instance. Visually distinct silhouettes. |
| 2026-05-22 | 15 | Nameplate overlap fix | Hover-only full nameplates. Minimal HP pip spheres for non-selected chars. Scene much cleaner. |
| 2026-05-22 | 18,20,22 | Skybox, lighting, contact AO | SkyDome gradient shader. Sun 2.2 warm + cool fill. drei ContactShadows for ground AO. |
| 2026-05-22 | 21 | Ambient particle visibility | All biomes: larger particles (3-4x), more count, brighter. Firefly glow spheres enlarged, point lights stronger + wider range. Dungeon gets torch ember fireflies. |
| 2026-05-22 | 19 | Grass height/color variation | Per-instance tint attribute (warm→cool green). Cluster noise height patches. Bare spots near rocks/walls. Height range widened (0.15-0.50). |
| 2026-05-22 | 17,23 | Ground scatter + decoration variety | GroundScatter.tsx: pebbles, leaves, twigs, mushrooms on open tiles. DecorationProps: fallen logs, stumps, bushes. Map generator updated for forest/swamp biomes. |
| 2026-05-22 | 25 | Character/decal scale fix | Selection ring 0.42-0.48, turn ring 0.50-0.60. Arrows orbit at 0.58. Proportions match 2.5x character body. |
| 2026-05-22 | — | Phase 3 critical review | 7 issues identified. Goal updated. Phase 3 tasks added. |
| 2026-05-22 | 26,27 | Class-based chars + grass height | 3 archetypes (fighter/caster/rogue) with distinct silhouettes. Grass MAX 0.50→0.25. |
| 2026-05-22 | 28,30 | Facing + HP pip | Characters face nearest enemy via atan2. HP pip 0.06→0.12 + team ring. |
| 2026-05-22 | 29 | Stump/log scale | ~40% size reduction for fallen logs and stumps. |
| 2026-05-22 | 31,32 | Elevation + emissive | Generator elevation range 0-3, chars sit at tile elevation. emissiveIntensity 0.15→0.05. |
