# Procedural dungeon generator — design spec

**Status:** specced (not built) · **Date:** 2026-07-05 · **Campaign:** World

## What this is

A new worldforge layer that builds explorable, multi-room dungeons as pure data,
then renders them through the WebGPU battle-map path. It is the sibling of the
existing single-building interior generator (`src/systems/worldforge/interior/
generateInterior.ts`): same contracts (deterministic seed paths, plain data, zero
THREE imports, feet-canon 5 ft grid), wider payload (a branching complex of rooms
and corridors, seeded set-pieces, and D&D combat encounters keyed to graph depth).

The dungeon's fights use Aralia's fight-in-place combat: the invisible 5 ft tile
referee resolves the rules, the presentation is gridless BG3-style. Difficulty maps
to a real D&D encounter XP budget for the party level, not an abstract tier.

## Why

Remy's flagship is the proc-gen world pipeline: Voronoi world → 3D ground → owned
towns → enterable buildings → dungeons. Interiors (L4) proved the pure-data
generator pattern. Dungeons are the next content type that pattern unlocks, and the
first place fight-in-place combat gets a purpose-built home instead of a placeless
arena.

## The prompt (drop-in build brief)

> The generator brief below is written to be handed to a build agent. It is grounded
> in the real Aralia primitives — `SeededRandom` + hierarchical seed paths, the
> `generateInterior.ts` contract, the WebGPU/TSL baked-lighting battle-map scene.

### ROLE
You are a senior gameplay/graphics engineer on Aralia specializing in deterministic
procedural content generation and WebGPU. You write allocation-conscious TypeScript,
respect the worldforge seed-path determinism contract, and understand Three.js
`InstancedMesh`, TSL node materials, and baked-lighting draw-call budgets deeply. You
ship code that self-verifies with Vitest AND a rendered eyeball — numeric goldens
alone are never sufficient proof.

### CONTEXT
Target: Aralia — a D&D 5e tactical RPG in React 19 + TypeScript, built with Vite.
Combat is fight-in-place: an invisible 5 ft tile referee resolves the rules over a
gridless BG3-style presentation. World scale is feet-canon: 5 ft is the atomic grid
unit (`CELL_FT = 5`), D&D feet everywhere, Y-up, grid (x, y) → world (x, z). The 3D
path is Three.js via a WebGPU `WebGPURenderer` with TSL node materials (baked
hemisphere + directional Lambert in a `MeshBasicNodeMaterial.colorNode`, since the
node path has no `LightsNode` for R3F-added lights); the WebGL `BattleMap3D` remains
the default and WebGPU is gated behind `?gpu=1`. Camera is a tactical orbit rig, not
a fixed ortho. Generation runs on the main thread when a dungeon location is entered.

This is a NEW worldforge layer. It must obey the same contracts as the existing
`src/systems/worldforge/interior/generateInterior.ts`: a pure-data generator that
imports zero THREE, addresses everything by `SeedPath`, and returns plain objects +
typed arrays in plot-local feet.

### OBJECTIVE
Implement `generateDungeon(input: DungeonInput) → DungeonPlan` (pure data, zero THREE
imports, mirroring `generateInterior.ts`) plus `buildDungeonScene(plan) → THREE.Group`
for the WebGPU/TSL path (pure presentation). Dungeons must have:
- **Character** — irregular silhouettes, mixed room shapes, themed set-pieces,
  torch-lit atmosphere, a seeded name.
- **Depth** — branching with dead-end rewards, guaranteed loops (never a pure tree),
  secrets off the critical path, tension/release pacing.
- **Challenge** — a difficulty ramp keyed to graph distance from the entrance, elite
  gates on the critical path, a boss encounter at maximal depth. Difficulty maps to a
  D&D encounter CR/XP budget, not an abstract tier.

### NON-NEGOTIABLE CONSTRAINTS
1. **Determinism — use the worldforge RNG, NOT mulberry32.** Seed everything through
   `SeededRandom` (Park–Miller) via `rngFromPath(path)` / `streamPath(path, name)` /
   `childSeedPath` from `src/systems/worldforge/seedPath.ts`. A `DungeonInput` carries
   a `SeedPath` (e.g. `wf:1337/cell:71-8/dungeon:3`); same path ⇒ byte-identical plan.
   `Math.random`, `Date.now`, and iteration order over unordered Sets/Maps feeding
   logic are banned. `SeededRandom.nextInt(max)` is MAX-EXCLUSIVE — bugs here are a
   known trap. Draw independent concerns from named sub-streams (`streamPath(path,
   'rooms')`, `'graph'`, `'decor'`) so adding a draw to one never perturbs another.
2. **Connectivity.** Flood fill from the entrance must reach 100% of floor cells. On
   failure, re-roll internally against a derived path (`childSeedPath(path, 'retry:1')`,
   max 5 attempts) — never ship a broken layout, and per Aralia's no-fallback
   directive, never "fix" islands with teleporters. Fail honestly if all attempts fail.
3. **Performance.** ≤ 50 ms generation at 60 rooms. Level geometry in ≤ 10 draw calls
   via `InstancedMesh` — zero per-tile `Mesh`. Lighting is BAKED into TSL colorNodes
   (no `LightsNode` on the node path); real point lights are limited to key
   torch/entrance/shrine/boss accents, ≤ 12, no shadow maps.
4. **Separation of concerns.** The generator returns typed arrays + POJOs only, in
   feet, exactly like `InteriorPlan`. The renderer consumes that and owns all THREE
   objects, with a `dispose()` that frees geometry/materials/instances on regenerate.

### PIPELINE — implement as discrete, individually testable stages
All cell coordinates are in 5 ft units; convert to feet (`× CELL_FT`) only at the plan
boundary. Thread the `SeedPath` explicitly through every stage.
1. **RNG.** Wrap `rngFromPath` with helpers: `float(a,b)`, `int(a,b)` (respecting
   MAX-EXCLUSIVE), `pick(arr)`, `chance(p)`, `gaussian(mu,sigma)` (Box–Muller). One
   named sub-stream per stage.
2. **Room scatter.** Spawn `roomCount × 1.4` candidates inside an ellipse (radius ∝
   √roomCount so density stays constant). Archetype table — small 5–7 (45%), medium
   8–12 (40%), large 13–18 (15%), sizes in 5 ft cells. Shape table — rectangle 60%,
   ellipse 22%, chamfered octagon 18%. Force ≥ 2 large rooms.
3. **Separation.** Iterative AABB push-apart with 2-cell padding until stable (cap 300
   iterations), snap centers to the 5 ft grid (reuse the `snap`/`snapDown` idiom), cull
   the smallest overflow down to `roomCount`.
4. **Connectivity graph.** Bowyer–Watson Delaunay over room centers → Prim MST as the
   skeleton → re-add non-MST Delaunay edges with probability `loopChance` (default
   0.15), rejecting edges longer than 2.2× the mean MST edge. Loops are mandatory for
   tactical flow: report the cyclomatic number (E − V + 1) and require ≥ 1 at defaults.
5. **Semantics before carving.** Boss = largest-area room. Entrance = degree-1 room
   maximizing graph distance from the boss. Critical path = BFS entrance→boss;
   remaining leaves → treasure (cap 4); 1–2 shrines mid-depth off-path; 1–2 elite
   arenas on the critical path at 55–85% depth; everything else combat. `difficulty =
   0.15 + 0.85 × (depth / maxDepth)`, boss = 1.0. Map `difficulty` to a target encounter
   XP budget for the party level so spawns are CR-appropriate, not free-floating tiers.
6. **Corridor carve.** L-corridors center-to-center with seeded elbow direction (skip
   the elbow when spans overlap enough for a straight run). Width 3 cells on the
   critical path, 2 default, 1 permitted on treasure spurs. Stamp FLOOR; tag corridor
   cells for styling and doorway detection.
7. **Rasterize.** `Uint8Array` grid of {VOID, FLOOR, WALL}; WALL = any VOID cell with
   an 8-neighbor FLOOR (render only these — back rows stay void and vanish into fog).
   Doorway = corridor cell 4-adjacent to room floor (same doorway-on-a-wall notion as
   `InteriorDoorway`). Compute a per-cell BFS distance field from the entrance
   (`Int16Array`, −1 for non-floor) — reused for pacing, reveal animation, validation.
8. **Encounter & decoration (data only).** Pillar grids in large rooms (only cells
   whose 8 neighbors are all floor, ≥ 2 cells from any doorway). Torches on
   floor-facing walls with min Chebyshev spacing 4. Debris density ∝ `decorDensity`,
   higher in low-difficulty rooms. Braziers ringing the boss arena; one chest per
   treasure room; shrine crystal; entrance portal ring. Creature spawns sized to the
   room's XP budget: pick a monster set whose combined CR/XP fits `difficulty`, place
   `round(area / 18 × (0.5 + difficulty))` tokens, none in entrance/treasure/shrine,
   never on a prop, wall, void, or doorway cell.
9. **Presentation metadata.** Seeded dungeon name from syllable tables ("The Ashen
   Vaults of Vor'gul"), per-room tint, stats block `{rooms, edges, loops,
   criticalLength, floorTiles, wallTiles, props, encounterXp, genMs}`.

### RENDERING SPEC (WebGPU / TSL node path)
- One `InstancedMesh` per kind: floor, wall, pillar, torch bracket, flame, debris,
  chest, spawn marker, crystal.
- **Baked per-instance AO + lighting.** Since the node path has no `LightsNode`, bake
  form into the `MeshBasicNodeMaterial.colorNode`: dim blue hemisphere + faint
  directional Lambert against a constant sun. Floor color = base × (1 − 0.09 ×
  min(adjacentWalls₈, 4)) ± 5% value noise, blended ~18% toward the room tint;
  corridors darker and untinted. Wall height 10 ft ± 1.25 ft seeded jitter for a
  ruined silhouette. NOTE the known InstanceNode trap: on `InstancedMesh` the node path
  multiplies `instanceColor` into the color pipeline unconditionally, so a dark
  per-instance tint crushes lit geometry to black — leave `instanceColor` null or bake
  the tint into the colorNode instead.
- **Accent lights only.** A small farthest-point-sampled subset of torches within
  budget (warm 0xff8c3a, distance ≈ 45 ft, decay 2) plus entrance/shrine/boss key
  lights — ≤ 12 total, no shadow maps. Per-frame flicker via intensity noise + flame
  scale jitter driven from the manual `frameloop="never"` render loop.
- `FogExp2` over a near-black clear color for tactical-orbit depth falloff.
- **Materials:** unlit baked-TSL `MeshBasicNodeMaterial` for level geometry; emissive
  node materials for flames, crystals, markers.
- **Debug overlays (toggleable):** Delaunay (faint), MST (white), loop edges (cyan),
  critical path (red), difficulty heatmap recolor.

### DATA CONTRACT (mirror InteriorPlan; plot-local feet)
```ts
import type { Feet } from '../units';
import type { SeedPath } from '../seedPath';

interface DungeonInput { seedPath: SeedPath; params: DungeonParams; partyLevel: number; }

interface DungeonPlan {
  params: DungeonParams; name: string;
  widthFt: Feet; depthFt: Feet;             // 5 ft aligned, derived like InteriorPlan
  grid: Uint8Array;                          // VOID | FLOOR | WALL (in 5 ft cells)
  bfs: Int16Array;                           // per-cell distance from entrance, −1 = non-floor
  rooms: DungeonRoom[];                       // { id, cx, cy, w, h, shape, type, depth, difficulty, degree }
  edges: DungeonEdge[];                       // { a, b, isLoop, isCritical }
  doorways: Cell[]; corridorCells: Cell[];
  props: DungeonProp[];                       // { kind, x, y, rotation, scale, roomId }  // feet, quarter-turn rot
  spawns: DungeonSpawn[];                      // { x, y, cr, xp, monsterKey, roomId }
  stats: DungeonStats;
}
```

### ACCEPTANCE TESTS — Vitest, run in CI AND eyeballed
Per Aralia's visual-inspection rule, numeric goldens are necessary but NOT sufficient:
also render a seed through the preview and eyeball it.
- Flood-fill reachability = 100% of floor cells.
- Same `seedPath` + params ⇒ identical grid checksum across 3 consecutive runs (and
  stable across a process restart — the seed-path contract is frozen).
- Boss depth ≥ 60% of max BFS depth; entrance degree = 1; entrance ≠ boss-adjacent.
- ≥ 3 leaf rooms at 40+ rooms; loop count = cyclomatic number = E − V + 1.
- No prop or spawn on a doorway, wall, or void cell; light count ≤ 12.
- Every spawn's CR is legal for its room and total room XP is within ±20% of the
  `difficulty`-derived budget for `partyLevel`.
- 60-room generation < 50 ms (report the measured value).

### TUNABLES (expose with defaults)
`seedPath`, `roomCount = 42`, `loopChance = 0.15`, `decorDensity = 0.6`,
`theme = 'crypt'`, `partyLevel`.

### ANTI-GOALS
Uniform room sizes; corridor spaghetti (> 2 elbows per link); boss reachable in < 60%
of max depth; per-tile `Mesh`; shadow-mapped point lights; `Math.random` / mulberry32
/ any RNG outside the seed-path system; iteration-order nondeterminism; a pure-tree
layout with zero cycles; teleporter / graceful-degradation "fixes" for disconnected
islands (fail honestly instead); a renderer that imports THREE into the generator or
diverges from the shared plan.

### DELIVERABLE (Aralia layout, NOT a single HTML file)
- `src/systems/worldforge/dungeon/generateDungeon.ts` — pure generator + `types.ts`,
  same shape and doc-comment discipline as `interior/generateInterior.ts`.
- `src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts` — the acceptance
  tests above, Vitest.
- A WebGPU/TSL scene builder under the battle-map GPU tree
  (`src/components/BattleMap/gpu/…`) consuming `DungeonPlan`, with `dispose()`.
- A dev preview: a `?phase=dungeonpreview` route (matching the existing preview-route
  pattern) with a control panel — seed input, dice re-roll, sliders for roomCount /
  loopChance / decorDensity, overlay toggles, live stats, legend.
- Optional staged build animation gated behind `animateBuild` — rooms
  scatter→separate, graph resolves Delaunay→MST+loops, floors flood outward along the
  BFS field, walls rise, props pop — so the algorithm is legible on screen.

## Open questions

- Where do dungeons attach in the world? (Hidden-place leaf on the atlas, a building
  interior that opens into a stair-down, or a standalone travel destination.)
- Monster set sourcing: which existing bestiary / stat-block table feeds the CR/XP
  budget picker.
- Multi-level dungeons (stair-down to a deeper `childSeedPath` complex) — v1 or later.

## Proposed plan-map node (append when the plan-map settles)

The roadmap-capture rule wants a `public/planmap/topics.json` node for this work, but
the plan-map is being actively reworked (another session + a codex swarm), so the node
is parked here instead of edited in directly. Append it to the `topics` array once the
plan-map settles — and **reconcile first**: a `dungeon-generator` node was already added
to `topics.json` earlier in this session, so update that one rather than double-adding.

```json
{
  "id": "dungeon-generator",
  "title": "Procedural dungeon generator",
  "sub": "explorable multi-room complex; pure data (mirrors L4 interior contract), CR-budgeted encounters, renders on the WebGPU battle-map path",
  "campaign": "world",
  "status": "specced",
  "deps": [
    {
      "id": "wf-interiors",
      "kind": "chosen",
      "why": "Mirrors the L4 interior generator's contract 1:1 — deterministic seed paths, pure-data POJO output, zero THREE imports, feet-canon 5 ft grid; interiors proved the pattern this reuses"
    },
    {
      "id": "world-props",
      "kind": "hard",
      "feature": "prop-schema-placement-engine",
      "why": "Dungeon decoration IS props: pillars, torches, chests, braziers and set-dressing place through the prop schema + placement engine (with referee data) — no prop system, no dressing"
    },
    {
      "id": "fip-slice1",
      "kind": "chosen",
      "why": "Dungeon rooms are combat encounters: fights resolve through the fight-in-place 5 ft tile referee, and difficulty maps to a real D&D XP budget — the dungeon is the purpose-built home for in-place combat"
    }
  ],
  "link": "docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md"
}
```

- **`wf-interiors` (chosen):** not a technical block — a chosen pattern reuse. The L4
  interior generator already proved the deterministic pure-data contract this copies.
- **`world-props` → `prop-schema-placement-engine` (hard):** a real requirement.
  Decoration is placed as props through that engine (same path ambush dressing uses);
  no prop system, no dungeon dressing.
- **`fip-slice1` (chosen):** thematic sequencing — the dungeon is the purpose-built home
  for fight-in-place combat, and difficulty maps to the referee's D&D XP budget.
