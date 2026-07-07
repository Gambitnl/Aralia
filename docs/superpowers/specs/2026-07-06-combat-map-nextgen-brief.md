# Design brief — next-generation 2D combat map

**Date:** 2026-07-06
**Requested by:** Remy
**Status:** brief for a fresh design agent. Design first, build second. Do not start coding until the design is approved (see "How to work" below).

---

## Copy-paste prompt for the agent

You are designing the next generation of Aralia's 2D combat map. Aralia is a
D&D 5e-style RPG in React + TypeScript (repo `F:\Repos\Aralia`). The current
2D combat map was recently reskinned to a premium Roll20/Foundry-style
tactical screen and is good — but it has hit an architectural ceiling. Your
mission has three pillars, in dependency order.

### Pillar 1 — One renderer (the structural bet)

Today the board is ~10,800 DOM elements (one per tile) stacked over two
`<canvas>` layers (painted ground, fog). This caps map size, blurs at zoom,
draws grid lines over tree art, and leaves no animation budget.

Design a single rendered scene — layered canvas (or WebGL/PixiJS if
justified) — that draws EVERYTHING: ground, grid, movement/targeting
overlays, fog-of-war, tokens, effects. Requirements:

- Battlefields of at least 120×90 tiles at 60fps, with headroom for more.
- Crisp at any zoom (re-render at the target resolution; no bilinear mush).
- The grid is a planning tool, not decor: it fades in when the player is
  choosing a move or target and fades out when they are watching. The
  approved fight-in-place design (gridless BG3 look, invisible 5-ft referee —
  `docs/superpowers/specs/2026-07-02-fight-in-place-combat-design.md`) is the
  end state; this renderer must be built to serve it.
- Interaction (hover, click, keyboard focus, screen-reader labels) must not
  regress: today every tile is a real button with an aria-label. Propose how
  accessibility works when tiles stop being DOM (e.g. a11y tree overlay or
  offscreen DOM mirror), and keep the existing Vitest suites passing or
  replaced with equivalents.
- Keep the mechanical model untouched: tiles, movement costs, visibility
  data, and the combat engine do not change. This is a rendering swap.

### Pillar 2 — The battlefield is a real place

Today combat rolls a generic "forest" map from a seed. Aralia's North Star is
one world seen at different zoom levels (Worldforge: FMG/Voronoi atlas → 3D
ground → towns → interiors). Combat must join that chain.

Design battlefield generation DERIVED from the player's actual location:

- Input: the Worldforge cell (biome, elevation, rivers, roads, coastline,
  nearby burg) where the encounter fires. The world data layer exists — see
  `src/systems/worldforge/` and the ground-chunk bridge
  (`src/systems/worldforge/bridge/groundChunkLoader.ts`).
- Output: a battle map where the road you traveled is THE road on the map,
  a river cell gives you the ford, a forest cell gives forest density from
  the cell's own vegetation, shore cells give a beach. Ambush-on-the-road
  should feel like the road.
- Roads/rivers must be mechanical terrain, not paint (movement effects,
  crossings). There is a parked plan-map node for this:
  `combat-roads-real-terrain`.
- Same seed + same cell = same battlefield, forever (canonical, like the
  town generator).

### Pillar 3 — A living, watchable board

- Ambient life: canopy sway, water shimmer, drifting cloud shadows, weather
  (rain, fog banks), time-of-day palettes that come from world time, torch
  and spell light feeding the fog-of-war.
- Cinematic turns: tokens walk their path tile by tile, lunge on attack,
  stagger on hit, fall on death; the camera eases to whoever is acting; crits
  get a visual beat. Damage numbers, trails, and persistent battle scars
  (scorch marks, trampled grass, blood) that remain for the whole fight.
- A narrated combat log: every line is generated from data the engine already
  has (attacker, target, distance, direction, cover, result) — no AI calls.
- A minimal sound layer keyed to events the log already emits, plus one
  ambience bed per biome. Silent combat is a spreadsheet.

### What already exists (read these first)

- Handover with full current state:
  `docs/superpowers/handovers/2026-07-06-combat-map-reskin-handover.md`
- 50-point critique ledger (5 harsh reviews of the current map):
  `.agent/scratch/2026-07-06-combat-map-critique.md`
- Current implementation: `src/components/BattleMap/` (BattleMap.tsx,
  BattleMapTile.tsx, BattleMapGroundCanvas.tsx, BattleMapFogCanvas.tsx,
  CharacterToken.tsx, combatUiTheme.ts) and
  `src/components/Combat/CombatView.tsx`.
- Fight-in-place spec (agreed, not built):
  `docs/superpowers/specs/2026-07-02-fight-in-place-combat-design.md`
- Terrain-diffusion idea (MIT diffusion model conditioned on our map data)
  is an optional ingredient for painted ground plates.

### How to work (house rules — not optional)

- **Looks first.** Produce visual mocks (HTML/canvas prototypes are fine) and
  get Remy's eyeball approval on the LOOK before building systems. A previous
  dungeon generator was rejected and rewritten because layout was built
  before the look was approved.
- **Design doc before code.** Deliver: (1) an architecture note for the
  renderer (layers, what redraws when, a11y story, migration steps that keep
  the game shippable at every step), (2) the worldforge→battlefield data
  contract, (3) a mock or storyboard for the living-board look. Use plain
  English (GOV.UK style, US spelling); define any coined term in
  `tools/agora/GLOSSARY.md` in the same turn.
- **No estimates, no feasibility-shrinking.** Full vision, priority order.
- **No fallbacks.** One real path; fail honestly.
- **Work only in master.** No branches, no worktrees. Leave changes
  uncommitted (a 2am snapshot commits daily). Coordinate through Agora
  (daemon on :4319 — check locks before touching contended files;
  `CombatView.tsx` has been contended before).
- **Verify visually, headless.** Reach the 2D map without any LLM backend via
  `?dummy=1&dev_combat=1`. Playwright scripts live in `.agent/scratch/`
  (`shoot-combat2.mjs`, `shoot-bigmap.mjs`). The dev server is
  `node -r ./scripts/dev-crash-logger.cjs node_modules/vite/bin/vite.js
  --port <p> --strictPort`, app served under `/Aralia/`. `preview_screenshot`
  hangs on animated canvases — use the headless scripts.
- **Tests.** BattleMap suites: `npx vitest run src/components/BattleMap`.
  Keep them green or migrate them deliberately. Pre-existing repo-wide tsc
  errors are background noise (see memory `known-preexisting-issues`);
  your touched files must be clean.
- **Update the plan map** (`public/planmap/topics.json`) in the same turn as
  any plan/build decision. The node for this work is `combat-map-nextgen`.

### Deliverable order

1. Renderer architecture note + a thin visual prototype (one map, ground +
   tokens + fog on the new renderer) for eyeball approval.
2. Worldforge→battlefield data contract + one derived-battlefield mock
   (road cell and river cell).
3. Living-board storyboard (what moves, when, at what zoom).
4. Only after approvals: migration plan and build, smallest shippable slices,
   the game playable after every slice.
