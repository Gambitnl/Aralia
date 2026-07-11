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

import {
  CellKind,
  OverlayKind,
  type BuilderArchetype,
  type ChronicleRef,
  type DungeonEvent,
  type DungeonTheme,
  type EventKind,
} from './types';
import { ARCHETYPES } from './archetypes';
import { type IntactState, type Rng } from './buildIntact';
import { ACTORS, type HistoryResult, type SimCtx } from './history/context';
import { graphConnected } from './history/graph';
import {
  OCCUPYING,
  bestOccupyingKind,
  pickKind,
  pickReplacement,
  reassignApex,
} from './history/events';
import { bindChronicle } from './history/chronicleBinding';
import { applyEvent, assertReachable, builderNoun, structureNoun } from './history/appliers';

// ─── Public result re-export ─────────────────────────────────────────────────
// `HistoryResult` now lives in ./history/context but is re-exported HERE so
// `./simulateHistory` keeps its original public surface (generateDungeon.ts).
export type { HistoryResult };

// ─── The simulation ──────────────────────────────────────────────────────────

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

export function simulateHistory(
  st: IntactState,
  rng: Rng,
  archetype: BuilderArchetype,
  theme: DungeonTheme,
  asOfYearsAgo: number,
  binding?: ChronicleBinding,
): HistoryResult {
  const data = ARCHETYPES[archetype];
  const ctx: SimCtx = {
    st,
    rng,
    theme,
    archetype,
    actors: ACTORS[theme],
    overlay: new Uint8Array(st.grid.length),
    doorStates: new Map(),
    evidenceProps: [],
    occupations: [],
    plunderedRoomIds: new Set(),
    tunnels: [],
    builtLoops: null,
    builderName: builderNoun(archetype),
    structureNoun: structureNoun(archetype),
    rec: [],
    roomCellCache: null,
  };

  // ── Snapshot the pre-simulation state BEFORE any event mutates it. The prefix
  //    replay restores this exact state and re-applies only the un-cut events.
  //    Typed arrays are copied; the edges array is shallow-cloned (edge OBJECTS
  //    are shared — built edges persist, and loop edges added during the canonical
  //    pass are re-pushed on replay by their recorded thunks, restoring identity).
  const snap = {
    grid: st.grid.slice(),
    corridor: st.corridor.slice(),
    roomOf: st.roomOf.slice(),
    edges: st.edges.slice(),
  };

  // Built state: waterworks channels/cisterns start wet, eventRef-free, BEFORE
  // any event. Flood events add more water on top. This baseline is asOf-
  // independent (it predates all events), so it is stamped fresh both on the
  // canonical pass and after a snapshot restore.
  const stampBuiltWater = (): void => {
    for (const cell of st.builtWater) {
      if (st.grid[cell] === CellKind.Floor) ctx.overlay[cell] = OverlayKind.Water;
    }
  };
  stampBuiltWater();

  // ── Roll the FULL chain (kinds + dates) up front. This never touches the grid
  //    and is identical for every asOfYearsAgo. ───────────────────────────────
  const count = rng.int(3, 6);
  const kinds: EventKind[] = [];
  for (let i = 0; i < count; i++) {
    // fungal ALWAYS ends in bloom — reserve the last slot for it.
    if (theme === 'fungal' && i === count - 1) {
      kinds.push('bloom');
      continue;
    }
    const k = pickKind(ctx, data.eventWeights, kinds);
    // pickKind can only be null if NOTHING is eligible; the archetype weights
    // always include unconditional kinds (seal/flood/den/fire etc.), so on a
    // first pick something is always eligible. Guard defensively anyway.
    kinds.push(k ?? bestOccupyingKind(data.eventWeights));
  }

  // Force at least one occupation (the spec's "spawns exist" invariant). For
  // fungal the trailing bloom already occupies, so this only fires elsewhere.
  if (!kinds.some((k) => OCCUPYING.has(k))) {
    kinds[kinds.length - 1] = bestOccupyingKind(data.eventWeights);
  }

  // Dates: monotonic newest-last. First is 80–500 years ago; each later event is
  // 55–85% of the previous age (so ages strictly decrease), floored at 2.
  const ages: number[] = [];
  let age = rng.int(80, 500);
  ages.push(age);
  for (let i = 1; i < count; i++) {
    const frac = rng.float(0.55, 0.85);
    const next = Math.max(2, Math.floor(age * frac));
    // Guard strict monotonic decrease even when age*frac rounds up to age.
    age = next >= age ? age - 1 : next;
    if (age < 2) age = 2;
    ages.push(age);
  }

  // ── Apply events in log order, resolving evidence-less exclusions (F5).
  //    An event that cannot leave real evidence (a collapse/brick-off with no
  //    safe loop edge, a flood with no floodable room) must NOT appear in the
  //    final log — narrating ruin the map does not show violates the no-fallback
  //    directive. When an applier reports "no evidence" we deterministically
  //    RE-ROLL a replacement kind (eligible given the kinds kept so far) into
  //    that slot; if nothing lands, the slot is dropped and the log ends shorter.
  //    Protected slots that must never drop: an occupying event (so ≥1 occupation
  //    always survives) and — for fungal — the terminal bloom.
  //
  //    Kind selection is asOf-independent (the canonical log is the same for
  //    every cutoff). The CANONICAL pass below always applies every event (and
  //    records its concrete mutations); the cutoff STATE is produced afterward by
  //    restoring the snapshot and replaying only the prefix's recorded deltas.
  //
  //    `kept` accumulates the surviving kinds so replacement eligibility (and the
  //    apex identity) reflect the real log, not the pre-exclusion roll.
  const events: DungeonEvent[] = [];
  const kept: EventKind[] = [];
  // Recorded redo-thunks per KEPT event, index-aligned with `events`, used to
  // replay a prefix at a cutoff.
  const recorded: Array<Array<() => void>> = [];
  for (let i = 0; i < count; i++) {
    const yearsAgo = ages[i];
    const isFungalTerminal = theme === 'fungal' && i === count - 1;
    // Is this the last surviving occupation? Occupying appliers never fail, so a
    // slot rolled as occupying stays occupying — it is the apex iff no LATER slot
    // is occupying in the (post-force) roll.
    const laterOccupation = kinds.slice(i + 1).some((k) => OCCUPYING.has(k));

    let kind = kinds[i];
    let ev: DungeonEvent | null = null;
    // Try the rolled kind, then deterministic replacements until one leaves
    // evidence. Occupying kinds and the fungal terminal never return null.
    const tried = new Set<EventKind>();
    for (let attempt = 0; attempt < 6; attempt++) {
      tried.add(kind);
      const isApex = OCCUPYING.has(kind) && !laterOccupation;
      // The canonical pass always applies; capture the event's mutations in
      // `ctx.rec`. A rejected attempt (null) leaves nothing recorded, so clearing
      // `ctx.rec` before each try keeps the recording clean of dead attempts.
      ctx.rec = [];
      ev = applyEvent(ctx, { id: events.length, kind, yearsAgo, isApex, apply: true });
      if (ev) break;
      // Excluded (no evidence). Re-roll a replacement eligible given `kept`,
      // excluding kinds we already tried for this slot. Draw is deterministic.
      const replacement = pickReplacement(ctx, data.eventWeights, kept, tried);
      if (!replacement) break;
      kind = replacement;
    }

    if (!ev) {
      // Slot produced no evidence and no replacement did either → drop it, unless
      // it is a protected occupying/terminal slot (those cannot fail; guard only).
      if (isFungalTerminal || (OCCUPYING.has(kinds[i]) && !laterOccupation)) {
        // Should be unreachable (occupations always place); fail honestly if not.
        throw new Error('simulateHistory: protected occupation slot left no evidence');
      }
      continue;
    }
    events.push(ev);
    kept.push(ev.kind);
    recorded.push(ctx.rec);
    ctx.rec = [];
  }

  // ── Chronicle grounding (Pillar 2, Task 4). Bind thematically-matching events
  //    to the real world zones near this site and quote their names. This runs
  //    on the FINAL kept log, AFTER every rng-drawing decision above, so it can
  //    never perturb the grid/props/spawns; and it only draws (a small era
  //    jitter) when a chronicle is actually supplied — so a dungeon with no
  //    chronicle is byte-identical to before. The snapped ages preserve the log's
  //    strict oldest-first monotonicity (see bindChronicle). ──────────────────
  if (binding?.chronicle && binding.chronicle.length > 0) {
    bindChronicle(events, binding.chronicle, binding.jitter);
  }

  // ── Prefix replay for a map drawn `asOfYearsAgo` years back. Events YOUNGER
  //    than the cutoff had not happened yet, so restore the pre-simulation state
  //    and re-apply ONLY the recorded deltas of events with yearsAgo >= cutoff.
  //    No rng, no re-decision — an exact replay of the canonical prefix. ───────
  if (asOfYearsAgo > 0) {
    st.grid.set(snap.grid);
    st.corridor.set(snap.corridor);
    st.roomOf.set(snap.roomOf);
    st.edges.length = 0;
    for (const e of snap.edges) st.edges.push(e);
    ctx.overlay.fill(0);
    ctx.doorStates.clear();
    ctx.evidenceProps.length = 0;
    ctx.occupations.length = 0;
    ctx.plunderedRoomIds.clear();
    stampBuiltWater();
    for (let i = 0; i < events.length; i++) {
      if (events[i].yearsAgo < asOfYearsAgo) continue; // younger — not yet happened
      for (const op of recorded[i]) op();
    }
  }

  // Mark the apex: the LAST surviving occupation IN THE APPLIED STATE. (At a cutoff
  // the apex row may not have been re-applied — then no occupation carries the
  // crown, which is correct: the boss had not moved in yet.)
  reassignApex(ctx, events);

  // ── Reachability assertion — at the FINAL (cutoff) state. Prefix states are
  //    reachable by construction (they are earlier points of a valid history), so
  //    a throw here still means a real rule bug. ──────────────────────────────
  assertReachable(st);
  // Graph must still connect every room (protects entrance-degree-1 downstream).
  if (!graphConnected(st.rooms.length, st.entranceId, st.edges)) {
    throw new Error('simulateHistory: room graph disconnected after events');
  }

  return {
    events,
    overlay: ctx.overlay,
    doorStates: ctx.doorStates,
    evidenceProps: ctx.evidenceProps,
    occupations: ctx.occupations,
    plunderedRoomIds: ctx.plunderedRoomIds,
  };
}
