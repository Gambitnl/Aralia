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
| 17 | Ground scatter objects | P1 | [ ] | | Instanced fallen leaves (flat quads), small rock clusters, twig bundles. 5-10 per open tile. Cheap instanced draw. |
| 18 | Skybox / background | P1 | [ ] | | Map fades to void. Add gradient hemisphere sky or simple skybox with distant treeline silhouette. |
| 19 | Grass height/color variation | P1 | [ ] | | Too uniform. Add per-instance color tinting, height variation clusters, bare spots near rocks. |

### Tier 3 — Makes it feel alive

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 20 | Lighting drama | P1 | [ ] | | Increase sun/fill contrast. Crisper shadows. Visible light direction. Warm/cool color temperature split. |
| 21 | Visible ambient particles | P1 | [ ] | | LivingWorld particles too small/few. Make dust motes larger and brighter. 20-30 visible at any time. |
| 22 | Contact AO (SSAO or fake) | P1 | [ ] | | If SSAO can't be fixed, add dark circle/gradient at base of trees and characters. Objects look like they're floating without it. |
| 23 | Decoration variety | P2 | [ ] | | Fallen logs, tree stumps, bushes, rock formations. 2-3 new types minimum. |

### Tier 4 — Polish

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 24 | CombatView 3D mode broken | P1 | [ ] | | R3F Canvas silently fails in CombatView ErrorBoundary. Only works via BattleMapDemo. Debug mounting issue. |
| 25 | Character/decal scale ratio | P2 | [ ] | | Selection ring (0.36-0.39) larger than character body (0.11 half-width). Proportions need matching. |

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
