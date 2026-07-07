# Handover — Pillar 2: world-grown dungeons + reverse-generational chronicle

**Status: BUILT 2026-07-06.** Final whole-feature review READY (one fix-first item — the `raid_worry` rumor-type mapping — applied and verified same day). All work is uncommitted in master per the no-commit rule; the 2 am cron snapshots it.

**Read first:** the SDD ledger section "Dungeon Pillar 2" in `.superpowers/sdd/progress.md` — every task, review verdict, and fix wave is listed there. Recon map (integration points + traps): `.superpowers/sdd/dungeon-pillar2-recon.md`. Design: `docs/superpowers/specs/2026-07-06-dungeon-world-grown-design.md`. Plan: `docs/superpowers/plans/2026-07-06-dungeon-world-grown-pillar2.md`.

## What shipped

- **Sites** (`dungeon/world/dungeonSites.ts`): ~30-40 per world — atlas markers (dungeons/caves/necropolises/disturbed burials), temple crypts, one sewer per sizable state, plus civilization archaeology (war-zone fortress ruins on commanding cells, plague necropolises, ore mines) with `provenance` citing real zone ids/names.
- **Identity** (`world/deriveIdentity.ts`): culture-correct builder names via the burg namer ("the Anelferico Consortium"), real town names fill `{T}`, danger-scaled size (24-54 rooms) and party level (1-8), biome name for monster flavor. Plans seed from the site's frozen seed path (`DungeonInput.basePath`).
- **Chronicle** (`worldforge/chronicle/worldChronicle.ts` + `dungeon/world/chronicle.ts`): Remy's reverse-generational principle — history inferred BACKWARDS from the present atlas. Falls (ruins → predecessor polities), border wars (state adjacency), schisms/crusades (religion spans), migrations (culture overlaps), plus the adopted atlas zones (byte-compatible eras). ≤25 entries, each citing the present fact it explains; `renderChronicle(worldSeed)` prints it. Dungeon histories bind nearby entries and quote them by name, with event-vs-faction grammar ("fell in the Onerean Occupation" vs "fell to the Damunvilian Rebels").
- **Bestiary** (`world/bestiaryTable.ts`): real 5etools monster ids by theme × biome (validated id-by-id against the generated data); plus a 5e XP-budget pass — per-room budgets from the encounter thresholds table with mob multipliers, `partyLevel` genuinely consumed.
- **Surfacing** (`bridge/dungeonEntrances.ts`, `World3D/DungeonEntrances.tsx`): sealed-door discovery — dungeon markers stopped spawning surface monsters and now render as entrance objects (ruin door, cave mouth, temple stair, sewer grate); walking up discovers, names ("You found The Wrenfield Crypt — the way down is dark"), logs, and pins. Dev entry: `?dcell=` in the world3d demo.
- **Rumors** (`world/rumors.ts` → `useDungeonRumorsSync` → tavern gossip): burgs within each hook's radius hear the dungeon's rumors; two-stage distance filter so no eager world-wide generation; `speakerBias` carried for the future NPC-archetype seam.
- **Living ecology** (`overlays/dangerField.ts`, `world/dungeonStates.ts`, `world/raidPressure.ts`, townsim `raid_worry`): uncleared dungeons bump local map danger (0.10 → 0.51 at a site), push raid-worry lines into town news, and `DUNGEON_CLEARED` calms the region and flips rumor text to cleared variants.

## Verify

- `npx vitest run src/systems/worldforge/dungeon/ src/systems/worldforge/chronicle/` — green (known flakes under parallel load: the 60-room perf budget and cold-atlas 5s timeouts; both pass isolated).
- Chronicle read: see the rendered seed-7 chronicle in `.superpowers/sdd/dungeon-p2-worldchronicle-report.md`.

## Logged backlog (from reviews; none blocking)

- Tavern rumor id dedup keeps stale uncleared text until the 30-day window or a fresh visit (danger overlay and raid pressure flip immediately).
- World-chronicle name repetition (three near-identical crusade lines; "the fall of Old X" opener run) — variety pass later.
- `speakerBias` not yet used to pick the speaker NPC; Wave-C surfacing of world-chronicle entries in town lore UIs deferred.
- Temple-stair and sewer-grate entrances co-anchor at the burg center; high-party-level rooms underfill their XP budget (monster ladders cap at CR 3/5).
- groundHostiles display-name monster ids vs the bestiary's snake_case — align later.

## Where Pillar 3 hooks in

The 3D dungeon body (`buildDungeonScene`, WebGPU/TSL baked lighting — Gozzys tile reference in project memory) replaces the sealed door's "descent unlocks later": the entrance interaction hands off into the generated plan. The diegetic fog-of-war parchment consumes the same plan; `asOfYearsAgo` already supports honestly outdated bought maps. Multi-level descent (Pillar 4) extends `childSeedPath` from stairs/cellars already in the room vocabulary.
