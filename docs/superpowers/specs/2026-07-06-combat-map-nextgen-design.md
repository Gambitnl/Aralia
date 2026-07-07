# Next-generation 2D combat map — design spec

**Date:** 2026-07-06
**Status:** design approved by Remy (this session); build not started
**Brief:** `docs/superpowers/specs/2026-07-06-combat-map-nextgen-brief.md`
**Plan-map node:** `combat-map-nextgen`

## What we decided (the short version)

1. **One renderer:** the board becomes a single PixiJS v8 scene, WebGPU-first
   (WebGL only on hardware without WebGPU). The 10,800-DOM-tile grid is
   deleted at the end of migration. React keeps the HUD.
2. **Battlefields are real places:** one pure generator (the **battlefield
   forge**) turns a **battlefield site** (where the fight is, in world terms)
   into a **battlefield plan** (mechanics + visuals from one source). Fights
   with a world position use their actual cell; placeless fights use canned
   real cells through the same generator. The generic "roll a forest"
   generator is deleted.
3. **Living board:** ambient life, cinematic turns, a narrated log written by
   templates (no AI calls), and a small sound layer.

Locked with Remy in this session:

- **Renderer technology: PixiJS v8, WebGPU backend preferred.** Raw WebGPU
  (hand-built engine) and three.js orthographic were considered and rejected:
  raw WebGPU means months of engine work before any visual gain; three.js
  wraps a 3D scene graph around a 2D board and has repeatedly broken Vite in
  this repo. Pixi v8 renders through WebGPU natively on Chrome/Edge, so we
  get the GPU-first direction without either cost. Pixi is lazy-loaded only
  when combat opens (same posture as the 3D lazy-split).
- **Pillar 2 scope: position-first, canned cells for the rest.** Every fight
  goes through the battlefield forge. No second generator survives. This
  honors the no-fallback directive: the canned site is real cell data,
  pre-picked, not a degraded path.

## Pillar 1 — the renderer

### Where it sits

React continues to own everything around the board: party and enemy rails,
turn order, actions, abilities, log, intent preview, toolbar. The board pane
mounts one Pixi canvas. Combat state flows in as props/store reads exactly as
today; the renderer is a *view* of the same engine.

### Layer model

The scene is a stack of layers (Pixi containers), each with one job and one
redraw rule. Back to front:

| # | Layer | Holds | Redraws |
|---|-------|-------|---------|
| 1 | Ground plate | the painted battlefield | once per battlefield |
| 2 | Battle scars | scorch, blood, trampled grass | incrementally, as events happen; persists all fight |
| 3 | Grid | the planning grid lines | alpha tween only: fades in while the player is choosing a move or target, fades out while watching |
| 4 | Tactical overlays | move-range perimeter stroke + quiet interior fill, dash tier, threat hatch, AoE shapes, path preview, hover cost readout | only when player intent changes (hover, selection, targeting) |
| 5 | Tokens | combatant sprites, faction rings, HP arcs, condition markers | every frame while animating; idle otherwise |
| 6 | Canopy | treetops drawn above tokens, slightly transparent | gentle sway every frame (shader/offset, cheap) |
| 7 | Effects | damage numbers, trails, projectiles, crit beats | every frame while active |
| 8 | Light and fog | vision pools, torch and spell light, darkness | when visibility changes, plus a cheap flicker tick |
| 9 | Weather and time of day | rain, fog banks, drifting cloud shadows, palette tint | every frame, shader-cheap |

The grid is a planning tool, not decor (brief requirement). Its fade
in/out is driven by interaction state: entering move/targeting mode fades it
in; committing or cancelling fades it out. This is the bridge to the
approved fight-in-place end state (gridless look): when that lands, the
default simply becomes "faded out unless planning".

### Big maps and crisp zoom

- **Chunked ground.** The ground plate is rasterized in chunks (blocks of
  tiles, e.g. 16×16) authored at 2× base resolution. Only chunks
  intersecting the viewport draw. 120×90 at 60fps is the floor, not the
  ceiling — chunk culling makes map size a memory question, not a frame-rate
  question.
- **Zoom without mush.** Vectors (grid, overlays, text, HP arcs) re-draw at
  the exact target scale every zoom change — they are never stretched
  bitmaps. Ground chunks re-rasterize at a higher density when zoom crosses
  a threshold, so zooming in reveals real detail instead of bilinear blur.
  Token labels and rings keep a minimum on-screen size at far zoom (the
  critique ledger's "token min-size floor").
- **Camera.** One world container carries pan/zoom. The existing −/+/Fit
  controls and ctrl+wheel drive it. Cinematic camera moves (ease to the
  acting combatant) are tweens on the same transform.
- **Device pixels.** The canvas is sized in device pixels
  (devicePixelRatio-aware) from day one — the current board's known blur
  cause.

### Interaction

Pointer events hit-test by arithmetic, not by DOM: pointer position → world
position → tile index. This is a pure function (same math the grid already
uses) and is unit-tested headless. Hover, click, drag-path preview, and
keyboard cursor all resolve through it.

### Accessibility (the DOM mirror)

Tiles stop being buttons, but the accessibility tree stays real DOM:

- An invisible DOM layer sits over the canvas holding actual buttons for
  *meaningful* targets only: every combatant, every reachable tile while the
  player is planning a move, every valid target while targeting, and
  interactive objects. That is a bounded set (hundreds at peak, not 10,800),
  positioned to match the canvas, carrying the same aria-labels as today's
  tiles.
- A live region announces turn events ("Goblin 1's turn", results) so
  screen-reader users get the narrated log's key beats without polling.
- Keyboard focus moves a virtual cursor over the same meaningful-target set;
  Enter commits, Escape cancels — matching today's semantics.

Existing Vitest suites migrate deliberately: assertions about tile visuals
move to the pure view-model functions (what *should* be drawn); assertions
about interaction and labels move to the DOM mirror. Nothing is silently
dropped — each retired test is either ported or replaced by an equivalent.

### Migration (shippable at every step)

1. **Prototype (deliverable 1).** New Pixi board behind a dev flag
   (`?pixiboard=1`), rendering ground plate + tokens + fog for one real
   battlefield. This is the eyeball gate — no further build until Remy
   approves the look.
2. **Parity.** Overlays, interaction, DOM mirror, zoom/fit controls, and the
   migrated test suites reach feature parity with the DOM board. The game is
   playable on either board during this step only.
3. **Flip and delete.** The Pixi board becomes the only board; the DOM tile
   grid (`BattleMapTile` as a rendered surface, per-tile buttons,
   `BattleMapGroundCanvas`, `BattleMapFogCanvas`) is deleted the same day the
   default flips. No long-lived second path.
4. **Living board.** Pillar 3 features land on the new renderer.

The combat engine, tile data, movement costs, and visibility model do not
change at any step. This is a rendering swap.

## Pillar 2 — the battlefield forge

One new pure module. One contract. Golden-tested like the town generator.

### Input: the battlefield site

A small record answering "where is this fight, in world terms":

- atlas seed, worldforge cell id, exact position (feet)
- travel heading, when the fight fires on a route (so the road enters and
  exits the board at the direction you were walking)
- world time of day and weather
- the cell's own data, clipped to the patch: biome, elevation samples,
  rivers, roads, coastline, vegetation density, nearby burg (if any)

Three producers, one consumer:

- **In-place fights** (streamed world live): built from the existing ground
  extraction (`extractLocalTerrainPatch` already derives referee tiles from
  the live world — the site record formalizes what it already knows).
- **Travel encounters:** built straight from worldforge cell data at the
  route point. The road you traveled is THE road on the map.
- **Placeless fights** (dev fixture, story encounters without a location
  yet): a small library of canned sites — real cells, pre-picked for variety
  (forest, river crossing, shore, road) — through the same generator. The
  dev fixture (`?dummy=1&dev_combat=1`) uses a canned site, so the map we
  eyeball most always shows the real system.

### Output: the battlefield plan

Two halves from one generator, so they can never disagree:

- **Mechanical half:** compiles to the exact tile structure the combat
  engine already consumes (terrain type, movement cost, cover, elevation,
  water). The engine does not know the forge exists.
- **Visual half:** an ordered list of paint instructions the renderer
  rasterizes into the ground plate (terrain washes, road and river strokes,
  vegetation placement, shore treatment), prop placements, and an ambience
  spec (time-of-day palette, weather, which sound bed).

### Roads and rivers are terrain

- Road tiles: normal/fast movement, vegetation cleared, worn-center visual.
  The road crosses the board along the travel heading.
- River tiles: real water — impassable or swim-cost per the engine's
  existing rules. Where a road meets a river, the forge generates a **ford**
  (shallow, crossable, visually distinct). This closes the parked plan-map
  node `combat-roads-real-terrain`.
- Shore cells produce a beach band; forest density comes from the cell's own
  vegetation value, not a global constant.

### Determinism

Seed = hash(atlas seed, cell id, patch origin). Same place, same
battlefield, forever. Golden tests pin canonical seeds to full plans.

## Pillar 3 — the living board

- **Ambient life:** canopy sway (layer 6), water shimmer (shader on the
  ground plate's water regions), drifting cloud shadows (scrolling noise on
  layer 9), rain and fog banks (layer 9), palette from world time (the
  forge's ambience spec), torch and spell light composited into the light
  map (layer 8) so light genuinely eats fog.
- **Cinematic turns:** tokens walk their committed path tile by tile; lunge
  on attack, stagger on hit, fall on death. The camera eases to whoever is
  acting. Crits get a visual beat (flash + brief slow-scale). Damage numbers
  and motion trails on the effects layer. Scars (scorch, blood, trampled
  grass) paint into layer 2 and persist for the whole fight.
- **Narrated log:** every line is generated by templates from data the
  engine already has — attacker, target, distance, compass direction, cover,
  result. Pure functions, unit-tested, zero AI calls. Example: "Goblin 1
  creeps 15 ft toward Kaelen, into the treeline."
- **Sound:** a small effect set keyed to the same events the log emits
  (attack, hit, miss, crit, death, turn start) plus one looping ambience bed
  per biome, through the browser's audio system. Assets sourced from CC0
  libraries (e.g. Kenney) so ownership is clean. Muted by default until the
  first user gesture (browser autoplay rules), with a visible toggle.

## Testing and verification

- **Forge:** golden tests (canonical site → identical plan), plus property
  tests (road continuity edge-to-edge, ford exists where road meets river).
- **Renderer view-model:** pure functions for hit-testing, overlay geometry
  (perimeter stroke, threat hatch), and camera fit math — unit-tested.
- **Accessibility:** DOM-mirror suites carry the label/role/keyboard
  assertions migrated from the tile suites.
- **Narration:** template output pinned per event type.
- **Looks:** headless screenshots (`.agent/scratch/` Playwright scripts, the
  proven path — `preview_screenshot` hangs on animated canvases) and Remy's
  eyeball at every deliverable gate.
- BattleMap suites stay green or are migrated deliberately; touched files
  pass tsc (pre-existing repo-wide errors are background noise).

## Deliverable order (unchanged from the brief)

1. Renderer architecture note (this spec's Pillar 1) + thin visual prototype
   (one map: ground + tokens + fog on Pixi) → **eyeball gate**.
2. Battlefield site/plan contract + one derived-battlefield mock (a road
   cell and a river cell) → **eyeball gate**.
3. Living-board storyboard (what moves, when, at what zoom) → **eyeball
   gate**.
4. Only after approvals: migration plan and build, smallest shippable
   slices, the game playable after every slice.

No estimates. Priority order only.

## Out of scope

- The 3D combat surfaces (BattleMap3D, fight-in-place in-scene rendering) —
  untouched. This renderer serves the 2D board only, built so the gridless
  fight-in-place presentation can adopt its overlay/fog/narration pieces
  later.
- Character portrait art — stays with the parked `svg-combatant-art` track.
  Tokens keep the current chip look (rings, HP arcs) until that track runs.
- Terrain-diffusion painted plates — optional future ingredient for the
  ground plate; the forge's paint-instruction contract leaves room for it,
  nothing depends on it.
- Combat engine changes of any kind.

## House rules that bind this work

Looks first (eyeball gates above); no estimates; no fallbacks (one
generator, one renderer after the flip); master only, changes left
uncommitted for the 2am snapshot; Agora locks checked before touching
contended files (`CombatView.tsx` has history); plan map updated in the same
turn as any decision; coined terms defined in `tools/agora/GLOSSARY.md` the
turn they appear.
