# Dungeon generator Pillar 2 — world-grown dungeons (design)

**Status:** BUILT 2026-07-06 — all four levels + the reverse-generational world chronicle extension (Remy same-day directive). Final whole-feature review: READY after one fix (raid_worry rumor-type mapping, applied). ~135 new tests across dungeon/world, chronicle, overlays, townsim, bridge. Ledger: `.superpowers/sdd/progress.md` §"Dungeon Pillar 2". Chronicle sample: `.superpowers/sdd/dungeon-p2-worldchronicle-report.md`.

**The four levels (build in order, all committed):**
1. Markers + temple crypts become real enterable sites.
2. Civilization archaeology — placement derived from the world's own states, wars, plagues, biomes (fortresses on old frontlines, mines in ore mountains, necropolises near old capitals, sewers under big walled towns).
3. Shared chronicle — dungeon event logs quote REAL named world events/zones/states; rumor hooks become genuine world history.
4. Living ecology — dungeon occupations feed the danger overlay, uncleared dens raid nearby burgs in the agent sim, clearing a dungeon calms the region and changes townsfolk rumors.
**Builds on:** `2026-07-06-dungeon-history-first-design.md` (Pillar 1, BUILT)
**Recon:** full integration map with file:line refs in the session ledger (`.superpowers/sdd/progress.md`, Pillar 2 section)

## The idea in one paragraph

A dungeon knows where it is. Its theme, size, builder identity, monster
ecology, and name derive from the actual atlas cell it occupies (biome,
temperature, coast, danger) and the nearest town. Entrances exist in the world
— a ruin door in the 3D wilderness, a stair-down under a town temple — and the
player reaches them through the existing map and 3D flow. The rumor hooks
Pillar 1 already emits start reaching real townsfolk.

## What the recon found (the design leans on these)

1. **The atlas already places dungeons.** The map generator emits typed
   markers — "dungeons", "caves", "necropolis", "disturbed burial" — anchored
   to real cells. Today they only spawn surface monsters
   (`groundChunkLoader.ts:262-265` deliberately routes them away from
   discovery sites). These markers are the natural canonical dungeon sites.
2. **Temples already roll crypts.** `BASEMENT_CHANCE` has `temple: 0.6, //
   crypt`. The blueprint path builds a windowless basement with exactly one
   stair down. The town crypt hangs off that stair.
3. **A real bestiary exists** (`src/data/monsters.generated.ts`, 5etools stat
   blocks) and `groundHostiles.ts` already maps marker types to real monster
   ids — the pattern for replacing the dungeon's placeholder monster table.
4. **Culture-correct names**: `getBurgNamer(worldSeed, burgId)` yields a
   seeded namer in the local culture's style — builder names ("the {N}
   family") stop being a fixed English pool and start belonging to the region.
5. **`describeCell(atlas, cellId)`** returns biome, state, culture, religion,
   burg, and position in one call — the single identity input.

## Derivation rules (decided; no fork)

- **Site → theme**: necropolis/disturbed-burial marker → crypt; cave marker →
  cavern; dungeon marker → by biome (cold biomes → frost fortress ruin, else
  weighted crypt/cavern); town temple basement → crypt; town sewer → waterworks
  (only under walled/plaza towns of sufficient population). Fungal stays an
  event chain; its odds scale with wet/swamp biomes.
- **Builder identity**: drawn from the culture of the site's state via the burg
  namer (nearest burg's culture as proxy); the `{T}` town token resolves to the
  real nearest burg name. A crypt under a town's temple is named for that town
  or one of its seeded family names.
- **Size and party level**: roomCount scales with danger field value and
  distance from the nearest burg (remote + dangerous = bigger, deeper);
  partyLevel from the danger scalar (same ramp travel encounters use).
- **Monster ecology**: new biome×theme table mapping to REAL bestiary ids
  (replaces the fictional `crypt_rat` keys), following the groundHostiles
  mapping precedent. Occupation actorKeys resolve through it.
- **Seed paths** (frozen grammar): wilderness `wf:<seed>/cell:<cellId>/dungeon:<idx>`;
  town crypt `wf:<seed>/burg:<burgId>/dungeon:crypt`. Identity anchors to the
  MARKER's cell (or the burg's cell), never the player's streamed cell.
- **Rumor delivery**: hooks with `radiusFt` attach to burgs within radius;
  townsfolk surface them through the existing NPC interaction system
  (speakerBias picks elders/scholars/adventurers).

## Resolved forks (2026-07-06)

- **Placement**: Level 4 full ambition (see status block). Markers and temple
  crypts are the skeleton; civilization archaeology adds derived sites; the
  chronicle grounds histories in named world events; ecology closes the loop.
- **Entry interim**: discovery + sealed door. The entrance is a real
  discoverable site in 3D; finding it names the dungeon ("The Wrenfield Crypt
  — the way down is dark") and pins it on the world map; descent unlocks when
  Pillar 3 builds the 3D body. No fake interiors, no interim sheet view.

## Slices (build order)

1. `dungeonSites.ts`: enumerate a world's dungeon sites (markers + temple
   crypts) → `{ sitePath, cellId, burgId?, theme, archetype, entranceKind }`,
   pure data, golden-tested.
2. Identity derivation: `deriveDungeonIdentity(atlas, site)` → DungeonParams +
   builder naming context (culture namer, town name for {T}); wire into
   `generateDungeon` so a site's plan is fully world-derived.
3. Bestiary table: biome×theme → real monster ids; replace `CR_TIERS` keys;
   spawns carry real ids the encounter system can load.
4. World surfacing: entrances in the 3D ground (re-routed markers → hidden-
   site-style discoverables; temple stair link), per Fork 2's choice; map-pane
   pin once discovered.
5. Rumor wiring: burgs within radius carry the hooks; NPC interaction surfaces
   them (smallest honest slice: rumor available in the existing conversation
   system for townsfolk of the biased archetype).
