# Handover — Dungeon generator Pillar 1: history-first generation

**Date:** 2026-07-06
**Status: BUILT and READY.** 72 tests green in `src/systems/worldforge/dungeon/`. The final whole-feature review (Opus) returned READY with zero fix-first items. Remy live-iterated on the output and every feedback wave (circulation, room-through-room topology, glyph vocabulary, note capping, sprawl dial) is folded in. Nothing is blocked. Do not commit — the 2am cron snapshot handles that.

## What shipped

The dungeon generator no longer rolls a ruin from word bags. It builds the intact structure first — the way a builder would lay it out for a real purpose — then simulates centuries of seeded decay events on top of it. The playable dungeon is the output of that history. Every event leaves visible evidence on the map, and all text (name, blurb, keyed room notes, rumor hooks) is derived from the actual event log.

### Module map (all under `src/systems/worldforge/dungeon/`)

| File | Job |
|------|-----|
| `types.ts` | The data contract: `DungeonPlan`, event and evidence types, `RumorHook` (with `radiusFt`), `params.asOfYearsAgo`, `params.sprawl` |
| `archetypes.ts` | Builder archetype data for the 5 archetypes (mausoleum, mine, fortress, waterworks, hearth-cavern): room purposes, size rules, name patterns, `townPlaceholder`, `THEME_ARCHETYPE` theme-to-archetype mapping |
| `buildIntact.ts` | Purpose-driven intact layouts: wings, symmetry, room size by job, builder circulation and loops |
| `simulateHistory.ts` | The seeded event engine: rolls decay events, applies them as recorded deltas, replays a prefix for `asOfYearsAgo` |
| `lore.ts` | Derived text: builder name, dungeon name, blurb, capped room notes, rumor hooks — all read from the true event log |
| `generateDungeon.ts` | The pipeline orchestrator; emits the final `DungeonPlan` |
| `src/components/DesignPreview/steps/PreviewDungeon.tsx` | 2D parchment sheet: evidence overlays, bricked doors, tunnel wobble, keyed notes, title and blurb, History panel, asOf scrubber, Sprawl slider. Note: this file is gitignored (`src/components/DesignPreview/steps/*`), so it never shows in snapshot diffs — read it on disk |

### The pipeline in one paragraph

`generateDungeon` resolves the archetype from the theme (`THEME_ARCHETYPE`, or an explicit `params.archetype`), asks `buildIntact` for the purpose-driven intact structure on the 5 ft grid, then hands it to `simulateHistory`, which rolls a sequence of decay events (collapses, floods, brick-offs, tunnels, occupations, awakenings and so on) from a dedicated seed stream and applies each one as a concrete, recorded mutation with map evidence. `lore.ts` then reads the finished event log and derives every piece of text. The result is one pure-data `DungeonPlan` — deterministic per seed path, no THREE imports — that the 2D sheet draws today and the future 3D builder will raise.

### Key mechanisms

- **Record-and-replay `asOfYearsAgo`.** Every event's include/exclude decision is structural and identical regardless of the cutoff, and every applied change is recorded as a replayable delta. Setting `params.asOfYearsAgo > 0` restores the intact structure and replays only the strict prefix of events old enough to have happened — zero extra RNG draws. This is how an outdated bought map (Pillar 3) shows the dungeon as it was when the mapmaker walked it.
- **Evidence `eventRef`s.** Evidence props, door states (bricked, secret) and occupations each carry an `eventRef` pointing at the event that caused them. Built furniture and torches carry none. Tests enforce that every visible consequence traces to a real event and the reverse.
- **Rumor hooks.** The generator emits structured `RumorHook` data per event, each with a `radiusFt` (scaled by event loudness) saying how far away townsfolk plausibly heard about it. The NPC interaction system decides who says it and when — the player never reads the raw log.
- **Sprawl dial.** `params.sprawl` (0 tight to 1 sprawling) controls corridor length, junctions, negative space and size contrast — the Gozzys look at the high end. When omitted, it resolves per archetype with seeded jitter from its own `'sprawl'` stream, and the resolved value is echoed on the plan.

## How to verify

1. Run the suite: `npx vitest run src/systems/worldforge/dungeon/` — expect 72 passed.
2. Eyeball the sheet: open `misc/design.html?step=dungeon&dseed=42` on the dev server. Try the archetype picker, the asOf scrubber and the Sprawl slider.

## Progress ledger

The full build history lives in `.superpowers/sdd/progress.md`, section "**Dungeon Pillar 1 — history-first generation (started 2026-07-06)**". It records every task, every review wave and its verdict, and the logged-for-later backlog. Warning when reading it: concurrent sessions interleaved entries, so several dungeon lines (Tasks 4–7, the composition and circulation waves, the Remy wave 2 and sprawl entries) sit physically inside the neighboring "Combat map next-gen D1" and "Building Generator v2" sections — search for the dungeon file names, not the section boundary.

## Logged backlog (verbatim from the ledger)

These are logged-only items — none block anything:

- "Logged polish: lengthen channel connectors (data tweak), waterworks@60 seed 99999 aspect 2.22 marginal."
- "Minors carried to final review: fortress repeat anchor 'prev' intent, hearth countPerCells:40 magic, drawer-side tunnel-cell BFS heuristic (export sim tunnel cells later), awaken notes repetitive across galleries, asOf sheet keeps full-canon notes/name (design decision pending), mausoleum 70%-floor margin at count 60"
- Final review: "Log-only backlog: export sim tunnelCells (drawer heuristic), setError-in-useMemo tidy, archetype data nits, awaken note variety, crypt/fungal same-seed name collision (archetype-keyed, by design but note to Remy), spawn-count balance outlier (331 spawns crypt seed 6), asOf full-canon notes by design."
- Circulation wave: "Polish backlog: awaken/bloom key too many rooms (wall-to-wall numbering), purpose noun in notes list is dev clutter"
- Remy wave 2: "Follow-ups logged: chapel at end of axis not center (bidirectional spine later), loopWallStrands duplication w/ simulateHistory, torch glyph near threshold at zoom-out"
- Sprawl wave: "Perf note: sprawl-1 mausoleum ~45-48ms vs 50ms ceiling"

## Where Pillars 2–4 hook in

- **Pillar 2 (world-grown).** `lore.ts` builds the builder name from archetype patterns; patterns with a `{T}` town token fill in `archetypes.ts`'s `townPlaceholder` today. Pillar 2 replaces that placeholder with the real nearby burg name. `THEME_ARCHETYPE` is the seam for deriving the archetype from the atlas cell instead of a hardcoded theme. `RumorHook.radiusFt` is ready for real town-distance filtering.
- **Pillar 3 (diegetic map + 3D).** `asOfYearsAgo` already produces the outdated-bought-map plan. For the 3D level look, the saved reference is the Gozzys memory (`reference-gozzys-dungeon-battlemap`, image in `.agent/scratch`), plus the Dungeon Forge poach list for textures, instancing and lighting.
- **Pillar 4 (multi-level).** The `cellar` and `stair` (and `ladder-shaft`) room purposes are the natural descent anchors for deeper seedPath levels.

## Standing directives

- **No commits.** The 2am cron makes the daily snapshot. Never suggest committing.
- **No branches or worktrees.** Work only in master. Coordinate concurrent sessions through Agora locks.
- **Determinism.** All randomness flows from named seed streams off the dungeon's seed path (for example the `'history'` and `'sprawl'` streams). Never add an RNG draw that shifts existing streams; new draws get their own stream.
- **Looks-first with approval gates.** Any visual change to layouts or the sheet gets mocked and approved by Remy before build, and every visual slice gets rendered and eyeballed — green tests alone are not enough.
