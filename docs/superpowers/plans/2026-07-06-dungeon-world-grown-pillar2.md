# Dungeon Pillar 2 — World-Grown Dungeons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Design: `docs/superpowers/specs/2026-07-06-dungeon-world-grown-design.md` (APPROVED, Level 4 full ambition). Recon map with all file:line integration points lives in the Pillar 2 section of `.superpowers/sdd/progress.md` — read it before dispatching any task.

**Goal:** Dungeons derive placement, identity, monsters, and history from the real atlas world (cells, burgs, states, wars); entrances are discoverable sealed doors in the 3D world; rumor hooks reach townsfolk; dungeon occupations feed back into the danger overlay and agent sim.

**Architecture:** New `src/systems/worldforge/dungeon/world/` layer between the atlas and the Pillar 1 generator: `dungeonSites.ts` (site enumeration), `deriveIdentity.ts` (site → DungeonParams + naming context), `chronicle.ts` (world-event grounding for lore), `bestiaryTable.ts` (biome×theme → real monster ids). Surfacing goes through the existing GroundWorld/hidden-site pattern; ecology through the pure danger-field function and townsim.

**Tech Stack:** TypeScript, Vitest, seed paths (frozen grammar), FMG pack arrays, existing bestiary data.

## Global Constraints

- All Pillar 1 constraints hold: determinism via seed paths only (`nextInt` max-EXCLUSIVE, no Math.random), feet-canon, no fallbacks, NO commits/branches (2 am cron), 72-test dungeon suite must stay green, eyeball every visual slice.
- Seed grammar: wilderness site `wf:<seed>/cell:<cellId>/dungeon:<idx>`; town crypt `wf:<seed>/burg:<burgId>/dungeon:crypt`. Identity anchors to the SITE's cell (marker cell / burg cell), NEVER the player's streamed cell (MapPane.tsx:594-600 trap).
- Burg loops always skip `i === 0 || removed` (phantom burg 0 trap).
- Any drill/entry signal copies the consume-once-ref StrictMode pattern (MapPane.tsx:627-641).
- New draws only on new named streams — existing worldforge goldens must not shift.
- Entry interim = sealed door discovery ONLY (no fake interiors).
- Plain US English in all player-facing strings.

---

### Task 1: Site enumeration — `world/dungeonSites.ts`
**Files:** create `src/systems/worldforge/dungeon/world/dungeonSites.ts` + `__tests__/dungeonSites.test.ts`.
**Produces:** `interface DungeonSite { sitePath: SeedPath; cellId: number; burgId?: number; entranceKind: 'ruin-door' | 'cave-mouth' | 'temple-stair' | 'sewer-grate'; theme: DungeonTheme; archetype: BuilderArchetype; origin: 'marker' | 'temple' | 'civ'; markerRef?: number; posFt: {x: Feet, y: Feet}; }`; `enumerateDungeonSites(worldSeed: number): DungeonSite[]` (cached per seed like getBridgeAtlas).
Level 1 sources: FMG markers of types dungeons/caves/necropolis/disturbed-burial (RegionArtifact.markers / markers-generator.ts:162); temple crypts = burgs with `temple === 1` (site under the temple; entranceKind 'temple-stair'); sewer sites = burgs with `walls===1 && population` above a threshold ('sewer-grate'). Theme mapping per design doc (necropolis→crypt, cave→cavern, dungeon marker→biome-weighted, temple→crypt, sewer→waterworks; frost variants in cold biomes via `grid.cells.temp`). Deterministic ordering (sort by cellId then kind). Tests: determinism, no burg-0, every site on land, themes legal, temple sites only for temple burgs.

### Task 2: Civilization archaeology — extend `dungeonSites.ts` with `origin: 'civ'` sites
Derive additional sites from world history data: war zones (`pack.zones` war/battle types) → border-fortress ruins on cells inside/adjacent to the zone; mountainous high cells near old capitals → mines; plague zones near burgs → necropolis crypts. Density controlled and deterministic (per-state stream `s:civ-sites`); cap total sites per state. Tests: civ sites only where the claimed precondition holds (fortress sites cite a war zone id, mines sit on high cells), count caps, determinism, zero overlap with Task 1 sites (same cell → marker wins).

### Task 3: Identity derivation — `world/deriveIdentity.ts`
**Produces:** `deriveDungeonIdentity(worldSeed, site) → { params: DungeonParams; naming: { builderName: string; townName?: string } }`. roomCount + partyLevel from `computeDangerField` value + distance to nearest burg (nearBurgIdsForCell); sprawl per archetype default; builder names via `getBurgNamer` culture namer (replaces the fixed English `namePool` draw when a site has a culture — extend `deriveLore` to accept an injected builder name + townName resolving `{T}`); crypt under a town named for the town. generateDungeon gains an optional `world?: { builderName?: string; townName?: string; chronicle?: ChronicleRef[] }` input consumed by lore. Tests: same site ⇒ identical identity; town crypts embed the burg name; danger-scaled sizes monotone in danger.

### Task 4: Chronicle grounding — `world/chronicle.ts` + lore integration
**Produces:** `chronicleForSite(worldSeed, site) → ChronicleRef[]` where `ChronicleRef = { kind: 'war' | 'plague' | 'eruption'; name: string; zoneId: number; yearsAgo: number }` from `pack.zones` near the site (zone names are real atlas names). simulateHistory gains optional chronicle input: when an event kind matches a chronicle ref (fire/brick-off near a war; awaken/den after a plague), the event binds `chronicleRef` and its `summary`/lore templates quote the REAL name ("fell in the War of <name>"). Age alignment: chronicle-bound events take the chronicle's era (yearsAgo bands per zone recency), preserving monotonic ordering. Tests: bound events quote real zone names; two sites near the same zone produce logs referencing the same named event; unbound worlds (no zones near) still generate.

### Task 5: Real bestiary — `world/bestiaryTable.ts`
biome×theme → occupation templates with REAL `MONSTERS_DATA` ids (follow groundHostiles.ts:54-109 precedent; crypt undead, cavern vermin/oozes, frost wolves/trolls, sewer rats/otyugh, fungal myconids — per-biome variations). Replace `CR_TIERS` fictional keys in generateDungeon spawn resolution; spawns carry real ids + correct XP from `crToXp`. Async monster data is NOT loaded in the generator — the table is static ids/CR/XP authored against known bestiary keys, with a test that validates every id exists in the generated monster data (import the keys list in the test only, keep the generator sync). Existing spawn tests keep passing.

### Task 6: World surfacing — sealed-door discovery
Re-route dungeon-flavored markers from `generateGroundHostiles` consumption (groundChunkLoader.ts:262-265) into a new `GroundWorld.dungeonEntrances` array (no double-spawn: those markers stop feeding surface hostiles; other marker types unchanged). Entrance sites render in 3D as their entranceKind (reuse hidden-site discovery: proximity → REVEAL + log "You found The <name> — the way down is dark"; discovered entrances pin on the map pane like revealed hidden sites). Temple-stair sites surface at their town's temple plot. Sealed interaction only — no interior. Copy the consume-once StrictMode pattern for any signal. Eyeball: walk to a wilderness entrance in ?phase=world3d and to a town temple; capture proof screenshots (shoot.mjs or in-page rAF readback — preview_screenshot hangs on R3F).

### Task 7: Rumor wiring
Burgs within `radiusFt` of a site carry that dungeon's `rumorHooks` (a `rumorsForBurg(worldSeed, burgId)` selector, cached); surface through the existing townsfolk interaction/conversation system with speakerBias choosing the NPC archetype. Smallest honest slice: rumors appear in the existing NPC dialogue path the same way current town gossip does (find it — new-player-npc-interaction work landed 2026-06-28). Test: burg inside radius gets hooks, outside doesn't; determinism.

### Task 8: Living ecology
(a) `computeDangerField` gains a dungeon term: each site with an uncleared apex occupation contributes a BFS-bled danger bump around its cell (pure-field architecture — same pattern as event zones; flag-gated input `dungeonStates` so the pure function stays pure). (b) World state tracks per-site cleared/uncleared (`DUNGEON_CLEARED` action; default uncleared). (c) Agent-sim hook: uncleared den sites within radius of a burg register a raid pressure signal the townsim can consume (define the signal + one consumer: occasional raid rumor/log event — full raid behavior belongs to the agent-sim campaign, the SIGNAL lands here). (d) Clearing flips rumors: `rumorsForBurg` swaps to "cleared" variants (lore emits both). Tests: danger field with vs without an uncleared site differs by the bump; cleared site removes it; determinism; the pure function stays side-effect free.

### Task 9: Close-out
Plan-map node features update (pillar 2 → done), design doc status, handover append, memory update, final whole-feature review of the world/ layer + surfacing diffs.
