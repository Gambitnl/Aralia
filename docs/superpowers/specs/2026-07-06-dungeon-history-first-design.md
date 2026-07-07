# Dungeon generator Pillar 1 — history-first generation (design)

**Status:** BUILT 2026-07-06 (72 tests green, final review READY; Remy iteration waves folded in: built circulation + room-through-room topology, note capping, glyph vocabulary, sprawl dial + Gozzys blend)
**Supersedes:** the layout/flavor sections of `2026-07-05-procedural-dungeon-generator.md` (contract, determinism, and rendering constraints there still hold)
**Mocks:** `.agent/scratch/dungeon-history-mock-event-logs.md` (event-log format), `.agent/scratch/dungeon-layout-mocks.html` (builder layout look)

## The idea in one paragraph

Stop generating a ruin directly. Generate the intact structure first — someone
built this place for a purpose, so lay it out the way a builder would. Then
simulate centuries as a sequence of seeded decay events applied to that
structure. The playable dungeon is the output of that history. Every event
leaves visible, causal evidence on the map, and all text (name, blurb, room
notes, rumor hooks) is derived from the actual event log — never rolled from
word bags.

## Decisions from the 2026-07-06 interview

1. **The event log is machinery, not player-facing text.** The player never
   reads the lore dump. The log exists so other systems can tell the story:
   - **Townsfolk rumors (primary channel).** Towns within a distance radius of
     the dungeon get rumor hooks derived from the log. Older residents,
     studious types, and young adventurers surface them in day-to-day
     interactions. The generator emits structured `RumorHook` data per event;
     the NPC interaction system decides who says it and when.
   - **Environmental evidence (always on).** The map and 3D scene ARE the
     story: rubble where the quake hit, a bricked door where the cult walled
     off the dead. This is the channel that never gets samey.
   - **In-dungeon findables (used with restraint).** Remy explicitly warned
     against "another rune, another parchment, another corpse with a note."
     Findables exist in the contract but the generator places few, and only
     where an event justifies one.
   - **DM/dev notes.** The keyed room notes from the mocks stay on the design
     workbench sheet — a dev and DM artifact, not in-game UI.
2. **Full builder layout, from scratch.** The intact structure gets a new
   purpose-driven layout generator (wings, symmetry, room size by job, builder
   circulation). This discards the growth layout for dungeons and therefore
   needs a fresh look-approval cycle: mock the target layouts, get them
   approved, then build (standing looks-first rule).
3. **Diegetic map + outdated bought maps (feeds Pillar 3).** In play the
   hand-drawn sheet starts blank and inks itself in room by room as the party
   explores (fog of war on the drawing). A map bought or found in town is a
   render of the event history replayed only up to the year that map was
   drawn — so it is honestly outdated where later events changed the dungeon.
   The history model makes this nearly free: `planAtYear(seed, year)`.

## Builder archetypes (one per theme)

| Theme | Builder archetype | Rooms with jobs (examples) |
|-------|-------------------|-----------------------------|
| crypt | mausoleum | processional stair, chapel, embalming room, burial galleries, ossuary, treasury |
| cavern | mine | adit, hoist chamber, tool store, barracks, vein galleries, sump |
| frost | border fortress | gatehouse, great hall, barracks, armory, granary, chapel wing, cellars |
| sewer | waterworks | storm channels, cisterns, junction chamber, maintenance walks |
| fungal | **not a builder — an event chain.** A spore-bloom event sequence can overtake any builder's structure. |

## Event vocabulary (first cut)

Each event = `{ kind, yearsAgo, where (roomIds/cells), params }` and MUST leave
map evidence. First-cut kinds:

- **seal** — structure closed up (snapped bar, barred gate)
- **collapse** — rubble seals a corridor or room; can orphan a wing
- **flood** — water fills low rooms (standing-water cells, movement hazard)
- **tunnel** — looters/monsters dig a rough shortcut (these become the loop
  edges; also can relocate the entrance)
- **brick-off** — a faction walls off a wing (bricked door; the forgotten far
  side is where secret doors come from)
- **den** — a monster faction claims specific rooms (spawn placement + nest
  debris; ecology from Pillar 2's atlas cell)
- **plunder** — treasure stripped/scattered (pried vaults, dropped coins)
- **fire** — scorched rooms
- **reoccupy** — a faction moves in and uses rooms for new purposes (cult in
  the chapel; fresh-use evidence)
- **awaken** — the dead stir / something moves in (crypt-flavored den)
- **subsidence** — floor drops; pits and weak floors (hooks Pillar 4 descent)
- **bloom** — fungal overgrowth chain (the fungal theme)

Existing mechanics re-cast: loop edges = tunnels/breaches; secret doors =
bricked or forgotten passages; traps = builder defenses or decay hazards;
spawns = whoever the den/awaken/reoccupy events put there.

## Contract additions (DungeonPlan)

- `history: DungeonEvent[]` — the ordered log, part of the plan contract so
  quests/loot/DM tooling can read it.
- `rooms[i].purpose` — what the room was built as (job vocabulary above).
- `rumorHooks: RumorHook[]` — per-event, structured: `{ eventRef, text,
  speakerBias: 'elder' | 'scholar' | 'adventurer', radiusFt }` for the town
  interaction system.
- Evidence links: props/traps/spawns/doors gain an optional `eventRef` so
  every piece of ruin points at the event that caused it.
- Name + blurb derived: name from the builder identity (+ Pillar 2 town name
  when attached), blurb composed from the two loudest events.

## Invariants (new tests, on top of the 11 green ones)

- Every event has at least one piece of on-map evidence (prop, cell fill,
  door state, or spawn) carrying its `eventRef`.
- Every rumor hook, the name, and the blurb reference real logged events.
- No debris/prop without a causal event (decorative-only placement banned).
- The dungeon stays 100% reachable after events mutate the layout (tunnels
  must reconnect what collapses orphan — or the event is rejected).
- Determinism: same seed ⇒ identical history; `planAtYear` is a pure replay.

## Build order

1. Layout look-mock → Remy approval (gate, in flight).
2. Intact builder layout generator (per-archetype programs), 2D sheet renders
   the intact structure.
3. Event simulation + evidence stamping; sheet renders the ruin.
4. Derived text (name/blurb/notes/rumor hooks) + contract/test wave.
5. Hand off to Pillar 2 (world attachment feeds builder identity + ecology).
