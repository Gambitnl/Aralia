/**
 * @file simulateHistory.ts
 * @description The seeded decay-event engine — Task 4 of the history-first
 * dungeon generator (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-
 * generator.md). Pure data, zero THREE imports, deterministic from a `SeedPath`.
 *
 * A dungeon is generated INTACT by `buildIntact` (Task 3): a purpose-built tree
 * of rooms and corridors, the entrance at graph degree 1. `simulateHistory`
 * then simulates centuries of events ON that structure — seals, collapses,
 * floods, tunnels dug by grave robbers, monsters denning in the deep — and the
 * playable ruin is the OUTPUT of that history. Every event leaves visible,
 * causal evidence: a rubble-choked passage, a flooded gallery, a back way dug
 * in, a nest in the boss room.
 *
 * DETERMINISM CONTRACT: one rng stream, drawn strictly in sequence. The FULL
 * canonical event log — kinds, dates, and evidence-less EXCLUSIONS — is decided
 * identically regardless of `asOfYearsAgo`, because every include/exclude choice
 * is STRUCTURAL (does a loop edge exist to collapse? a floodable room to drown?)
 * and structure is seed-fixed.
 *
 * PREFIX REPLAY (`asOfYearsAgo`): a map bought in town shows the dungeon as it
 * WAS at the year the map was drawn — events YOUNGER than the cutoff had not yet
 * happened, so NONE of their effects (structural OR surface) may appear. We honor
 * that with a snapshot-and-replay: the full chain is rolled and applied ONCE to
 * produce the canonical log (identical for every cutoff, since only this pass
 * draws rng and it draws identically). During that canonical pass every concrete
 * mutation each event makes — cells written, edges added/removed, overlay stamps,
 * door states, evidence props, occupations, plunders, tunnel bookkeeping — is
 * RECORDED as a replayable delta. When `asOfYearsAgo > 0` we restore the
 * pre-simulation snapshot and re-apply ONLY the recorded deltas of the events
 * with `yearsAgo >= asOfYearsAgo` (a strict PREFIX, since events are in
 * chronological oldest-first order). Replay consumes ZERO rng and re-runs no
 * appliers, so the cutoff state is exact by construction. The full log is still
 * returned in `events` (callers see all of history; only the map STATE is the
 * cutoff state).
 *
 * EVIDENCE RULE (no-fallback directive): an event that cannot leave real evidence
 * is never logged — the applier returns null and the roller re-rolls a
 * replacement kind or drops the slot. The one kept "failure" is the failed
 * tunnel: it scars a wall (real evidence), so it stays, flagged `failed`.
 *
 * SAFETY INVARIANTS this module protects (asserted, not merely hoped):
 *  - Every Floor cell stays reachable from the entrance (collapse only cuts
 *    connectivity-safe corridor cells; a final flood-fill assertion throws if a
 *    rule bug ever strands floor — honest failure over a shipped-broken map).
 *  - The entrance keeps graph degree 1 (tunnels/dens never touch it).
 *  - The apex occupant sits deep and not adjacent to the entrance.
 *
 * MODULE LAYOUT (packet W1-P6): this file is now a thin composition root. The
 * engine's parts were split, move-only (byte-identical bodies, so the single rng
 * stream is drawn in exactly the same order), into ./history/*:
 *   - ./history/graph            : adjacency/BFS/connectivity helpers.
 *   - ./history/context          : `HistoryResult`, actor vocabulary, `SimCtx`.
 *   - ./history/recorder         : the prefix-replay mutation recorder.
 *   - ./history/events           : event-kind picking (chain rolling).
 *   - ./history/chronicleBinding : Pillar-2 chronicle grounding.
 *   - ./history/appliers         : event dispatch + every decay-event applier.
 * `HistoryResult` is RE-EXPORTED below so this file keeps its original public
 * surface (generateDungeon.ts imports it from here).
 */
import { type BuilderArchetype, type ChronicleRef, type DungeonTheme } from './types';
import { type IntactState, type Rng } from './buildIntact';
import { type HistoryResult } from './history/context';
export type { HistoryResult };
/**
 * Optional Pillar-2 (Task 4) chronicle-binding input. When `chronicle` is a
 * non-empty list, a thematically-matching decay event binds to a ref and quotes
 * its real zone name (see {@link bindChronicle}). `jitter` seeds the small era
 * jitter — a DEDICATED stream so binding consumes ZERO draws from the main
 * history `rng` (a dungeon with no chronicle draws identically to before, and a
 * chronicled one keeps the same grid/props/spawns — only summaries and ages of
 * the bound events change). Both are omitted on the standalone preview path.
 */
export interface ChronicleBinding {
    chronicle?: ChronicleRef[];
    jitter?: Rng;
}
export declare function simulateHistory(st: IntactState, rng: Rng, archetype: BuilderArchetype, theme: DungeonTheme, asOfYearsAgo: number, binding?: ChronicleBinding): HistoryResult;
