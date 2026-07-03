# Fight-in-Place Combat — Design Spec (2026-07-02)

**Status:** design agreed in session (Remy + Fable), not yet built. No slices started.

**Interview addendum (same day, grilling session):**
- **Sequencing decision: WORLD PROPS FIRST.** The streamed world is too visually
  sparse to be worth fighting in ("the current 3D world is really ugly").
  Campaign order: a props/density system (reproducible proc-gen props with
  real-object semantics — visual mesh + referee entry (cover/blocksLoS/movement)
  + logical placement rules) lands BEFORE combat slice 1.
- **Polish flows INTO the world** (decided looking at both renderers live): the
  battle map is currently the prettiest scene but only at conjured wilderness;
  its visual tech (tree quality, lighting, terrain drama) and biome-theming
  knowledge migrate into the streamed world. BattleMap3D heads to retirement,
  not convergence.
- **Placeless fights** (travel ambushes, story encounters): stream the real
  spot; believability comes from two levers — (1) ambush-worthy SITE SELECTION
  along the travel leg (fords, tree lines, defiles — the route already knows
  its terrain), (2) seeded justified SET DRESSING (props the ambushers
  "prepared"), which is where battle-map theming logic lives on.
- **Mesh-accurate LOS/cover: LOCKED (2026-07-02, interview resumed).**
  Line of sight and cover are answered by multi-point raycasts against real
  scene geometry (several sample points on shooter and target; fraction of
  clear rays maps to 5e cover tiers: clear / half (+2 AC) / three-quarters
  (+5) / total). This raycast oracle is the referee's SINGLE source of truth
  for LOS in ALL views (in-place 3D, 2D board displays its verdicts, and
  arena fights use the same oracle against their meshes). Movement and zones
  stay on the tile referee. Props ship with blocks-sight data this consumes
  (see 2026-07-02-world-beautification-wave.md).
- Roadmap home: these topics are seeded as nodes in the new plan-map
  (`public/planmap/`), world-props → slice-1 as an explicit dependency edge.

## Goal (player-visible)

Combat in the streamed 3D world starts **where you stand** — the camera never
leaves the town/wilderness, the same buildings and NPCs stay on screen, and the
fight plays out BG3-style: **no visible grid**, movement shown as a feet-radius
ring + path preview, spell areas as literal circles/cones/spheres draped on the
real terrain. Today's behavior (teleport into a separate themed battle-map
scene) is replaced whenever a streamed world is live.

## The four locked decisions

1. **Invisible 5-ft referee.** Combat RULES keep running on the existing
   tile engine — the same `BattleMapData` (40×30 patch of 5-ft cells), the same
   combat reducer, the same per-tile spell zones and targeting validation. The
   spell corpus and its verified behavior are untouched. Rationale: the ground
   world's walking-scale layer is already a square 5-ft lattice (row-major
   heightfield), and `extractLocalTerrainPatch` already rasterizes buildings/
   features/water into referee tiles. BG3 itself runs a lattice under a
   gridless skin; we do the same.

2. **Gridless presentation.** The player never sees squares. Movement = radius
   ring in feet + path preview line; AoE = true shape decals; actors glide
   (interpolate) between cell-resolved positions. A visible square grid draped
   over Voronoi-organic towns was explicitly rejected (looks like it fights the
   world; diagonal walls staircase visibly). The staircase artifact still
   exists in the referee data — that is graph-paper D&D fidelity and stays
   invisible.

3. **View surfaces are context-picked, never competing.**
   - **2D tactical board:** available for EVERY fight (deliberately abstract —
     no world-match expectation). Unchanged.
   - **3D, world live** (walking a streamed town/wilderness): the in-place view
     IS the 3D combat view. The dedicated BattleMap3D does not appear here.
   - **3D, no world** (story encounters, travel ambushes, combat-oriented
     openings): BattleMap3D keeps its themed-arena job unchanged.
   - Consequence: the known visual mismatch between BattleMap3D's diorama and
     the real streamed world is never on screen, and no "make the battle map
     reproduce the town" convergence project is needed.

4. **Units are already right.** World data is feet-canon; meters exist only at
   render time via the existing converter. Combat math stays in feet.

## What already exists (scout audit, 2026-07-02)

- **Trigger + extraction:** `World3DWrapper.tsx` ~526–607 — 4 m proximity to a
  `GroundHostile` → `extractLocalTerrainPatch(ground, x, z, theme, seed)`
  (`groundChunkLoader.ts` ~1663–1813) → 40×30 five-ft tiles with elevation,
  blocksMovement/blocksLoS, terrain type, decorations, building interiors as
  floor/wall → `START_BATTLE_MAP_ENCOUNTER` → phase swap (the part we remove).
  Player ground position is saved pre-fight and restored after.
- **Referee contract:** `src/types/combat.ts` ~1876–2035 (`BattleMapData`,
  `BattleMapTile`, `CombatState`); movement reachability via BFS in
  `useGridMovement.ts`.
- **Ground data:** `GroundWorld` (`groundChunkLoader.ts` ~140–230) — 5-ft cell
  heights + biomes, building footprints w/ interiors + style, roads, walls,
  rivers, water bodies, occupants w/ schedules, hostiles, town plans.
- **Reusable presentation tech:** `TargetingDecals.tsx` (terrain-conforming
  pulsing decals), spell artifact 3D labels (`spellMapArtifacts`), character
  actors/labels, `makeTerrainHeightSampler` pattern (BattleMap3D.tsx ~51).
- **Parity baseline:** `docs/projects/spells/subprojects/structured-spell-execution/COMBAT_MAP_PRESENTATION_MATRIX.md`
  enumerates every presentation state (instant feedback, targeting preview,
  persistent zone, token/object, status marker) with proof requirements. The
  in-place surface must pass this same checklist before the fallback is
  removed.

## Genuinely new work

- **3D ground picking** — click/hover a world position in the streamed scene
  (raycast → ground meters → referee cell). Does not exist yet anywhere.
- **In-scene combat rendering** — draw combat state (actors, zones, previews,
  labels, turn HUD) inside the ground scene; tile↔ground-meter mapping is
  1:1 arithmetic on the extracted patch's origin.
- **Turn-mode scene state** — freeze free-roam position dispatches/agent clock
  during combat. **Camera: DECIDED (2026-07-02) — tactical orbit + free
  toggle.** On initiative start the camera pulls up into a BG3-style orbit
  (rotate/zoom, centered on the combat area, focus snaps to the active actor
  each turn — fulfills the worldforge spec's tactical-orbit ambition); one
  key breaks into free camera at any time and back.
- **Bystander policy: DECIDED (2026-07-02, refined same day) —
  relationship × courage disposition.** Every NPC caught in the combat area
  reacts per their RELATIONSHIP to the combatants (both the NPC side and the
  player + party) crossed with a courage disposition: allies/friends may join,
  aid, or shelter the wounded; kin/faction of the enemy side may join against
  the player; guards side per law; neutral strangers flee home/indoors (town
  sim knows every occupant's house; reuse commuter motion) or cower/watch by
  courage. The living-world sim's existing relationship data is the input —
  this makes town fights socially consequential, not just spatially. Tracked
  as plan-map node `world-reactions` (slice 4).
- **Combat bounds: DECIDED (2026-07-02).** Patch is CONTEXT-SIZED at
  extraction: dense town fights keep a compact patch; open wilderness /
  ranged encounters extract large (up to ~120×120 cells / 600×600 ft so
  longbow + spell ranges fit; referee data stays tiny, the 2D board pans/
  zooms). EDGE = ESCAPE: crossing the boundary leaves the fight — fleeing
  NPCs despawn into the world sim (relationships remember the fight), player
  crossing = party retreat attempt. No invisible walls, no arena
  re-anchoring (revisit only if chase fights demand it).

- **Combat initiation: DECIDED (2026-07-02) — FULL FREEDOM from slice 1.**
  The player can initiate combat against ANY NPC (BG3-style total agency),
  not just designated hostiles. Consequences (guards, kin joining, reputation,
  economic fallout of dead shopkeepers) arrive with the relationship-driven
  world-reactions system — the interim consequence-light window is accepted,
  same posture as beauty-before-perf.

- **NPC death rules: DECIDED (2026-07-02) — permanent + cascading, but rare
  by rule.** (1) A named NPC's death is PERMANENT and CASCADES through the
  living-world sim: household grieves, business closes or passes to kin/
  apprentice, relationships update, the town remembers. (2) Civilians caught
  in the crossfire CANNOT be accidentally killed by NPC hostiles — EXCEPT
  when the AI arbiter deliberately rules a death as a story hook. (3) Player
  damage carries a NON-LETHAL TOGGLE (5e knock-out rule): killing a civilian
  is always a deliberate choice, never a whoopsie. Freedom stays total;
  tragedy stays authored.

## Slice order (each slice live-eyeballed before the next)

1. **Kill the teleport.** Trigger keeps building the same patch + encounter,
   but the phase stays in the world: render actors + a minimal turn HUD
   in-scene, resolve turns with the existing reducer. Old battle-map flow
   remains behind a toggle as fallback. Proof: a fight starts and ends in the
   town with the camera never cutting away.
2. **Movement, gridless.** Ground picking + feet-radius ring + path preview +
   glide animation (referee BFS underneath). Proof: walk-up attack in-place.
3. **Spell presentation port.** Zones/AoE previews/labels on the ground
   surface, verified row-by-row against the presentation matrix.
4. **World reactions.** Bystander policy, hostiles joining mid-fight,
   post-combat cleanup (bodies, loot, agent clock resume).
5. **Remove the fallback** once the matrix checklist passes on the new surface.

## Explicitly out of scope

- True continuous rules (real-geometry movement/zones) — rejected for now:
  forfeits the verified spell machinery for marginal fidelity.
- Making BattleMap3D visually reproduce streamed towns — obsoleted by the
  context-picked view model.
- Building-generator project (separate discussion; its walkability output
  should eventually feed the same referee rasterizer).
