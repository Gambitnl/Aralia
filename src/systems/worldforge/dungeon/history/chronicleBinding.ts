/**
 * @file history/chronicleBinding.ts
 * @description Chronicle binding (Pillar 2, Task 4) — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). Binds thematically-matching decay events to
 * real world zones near the site and quotes their names, snapping ages into the
 * ref's era while preserving strict oldest-first monotonicity. Move-only: bodies
 * are byte-identical; binding draws only the small era jitter and only on the
 * dedicated `jitter` stream, so the main history rng is untouched. Only
 * `bindChronicle` is exported (the entry point) — the rest stay module-internal,
 * exactly as they were file-internal in the monolith.
 */

import type { Rng } from '../buildIntact';
import type { ChronicleKind, ChronicleRef, DungeonEvent, EventKind } from '../types';

// ─── Chronicle binding (Pillar 2, Task 4) ────────────────────────────────────
//
// A chronicle ref is a REAL world event near the site (a war zone, a plague, an
// eruption). Binding rewrites a thematically-matching decay event so it QUOTES
// the ref's real name ("the hold burned in the Onerean Occupation") and snaps
// into the ref's era — turning anonymous decay into grounded history.

/**
 * Which decay-event kinds a chronicle kind may claim, in preference order. The
 * pairing is thematic:
 *  - war → the violent, structural scars of a siege: fire gutted it, masons
 *    bricked it up, the garrison sealed it.
 *  - plague → death and desecration: the dead woke, things denned in the
 *    corpse-fields, robbers stripped the plague-dead's goods.
 *  - eruption → the earth itself moving: floods and roof-falls (rare).
 * A later ref binding never steals an event an earlier ref already took (≤ 1
 * event per ref, ≤ 1 ref per event).
 */
const CHRONICLE_MATCH: Readonly<Record<ChronicleKind, readonly EventKind[]>> = {
  war: ['fire', 'brick-off', 'seal'],
  plague: ['awaken', 'den', 'plunder'],
  eruption: ['flood', 'collapse'],
  // World-chronicle inferences (Pillar 2 world layer):
  //  - schism → a faith bricked off / sealed / re-took these halls (war-like).
  //  - crusade → same violent register as a holy war.
  //  - migration → newcomers denned in or re-occupied the emptied structure.
  //  - fall → a predecessor polity's collapse: sealed, then collapsed, then plundered.
  schism: ['brick-off', 'seal', 'reoccupy'],
  crusade: ['fire', 'brick-off', 'seal'],
  migration: ['den', 'reoccupy'],
  fall: ['seal', 'collapse', 'plunder'],
};

/**
 * Snap a bound event's age into the ref's era while PRESERVING the log's strict
 * oldest-first monotonicity. The desired age is the ref's `yearsAgo` plus a small
 * seeded jitter, but it is then CLAMPED to the open interval strictly between its
 * neighbors' ages (older neighbor − 1 … newer neighbor + 1). Since the original
 * log is strictly decreasing, that interval is always non-empty, so the snapped
 * age keeps `events[i-1].yearsAgo > events[i].yearsAgo > events[i+1].yearsAgo` —
 * no re-sort, no id churn, no eventRef invalidation. Returns the new age.
 */
function snapAgeMonotonic(
  events: DungeonEvent[],
  index: number,
  refYearsAgo: number,
  jitter: Rng | undefined,
): number {
  const older = index > 0 ? events[index - 1].yearsAgo : Infinity;
  const newer = index < events.length - 1 ? events[index + 1].yearsAgo : 0;
  // Strict interval between neighbors (ages are strictly decreasing, so
  // older > newer and this interval is non-empty).
  const lo = newer + 1; // must stay strictly younger than the older neighbor
  const hi = older - 1; // must stay strictly older than the newer neighbor
  // Desired era = ref age ± up to 8 years of seeded jitter (deterministic; drawn
  // only when a chronicle is present, on the dedicated jitter stream).
  const wobble = jitter ? jitter.int(-8, 8) : 0;
  let want = refYearsAgo + wobble;
  if (want < lo) want = lo;
  if (want > hi) want = hi;
  return want;
}

/**
 * Bind chronicle refs to matching events IN PLACE. For each ref (in order), find
 * the first still-unbound, non-failed event whose kind the ref may claim, and:
 *  1. attach `chronicleRef` (zoneId/zoneName/kind),
 *  2. snap its `yearsAgo` into the ref's era (monotonicity preserved), and
 *  3. rewrite its `summary` to quote the real zone name.
 * Deterministic: refs and events are walked in fixed order; jitter (if any) draws
 * on the dedicated stream. No-op when a ref matches nothing.
 */
export function bindChronicle(
  events: DungeonEvent[],
  chronicle: readonly ChronicleRef[],
  jitter: Rng | undefined,
): void {
  const bound = new Set<number>(); // event ids already claimed by a ref
  for (const ref of chronicle) {
    const kinds = CHRONICLE_MATCH[ref.kind];
    let target = -1;
    // Preference order: try each candidate kind, earliest matching event first.
    for (const k of kinds) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (bound.has(ev.id)) continue;
        if (ev.failed) continue; // a failed dig is no grounding for real history
        if (ev.kind !== k) continue;
        target = i;
        break;
      }
      if (target >= 0) break;
    }
    if (target < 0) continue; // this war/plague/eruption touched no logged event
    const ev = events[target];
    bound.add(ev.id);
    ev.chronicleRef = { zoneId: ref.zoneId, zoneName: ref.name, kind: ref.kind, shape: ref.shape };
    ev.yearsAgo = snapAgeMonotonic(events, target, ref.yearsAgo, jitter);
    ev.summary = chronicleSummary(ev.kind, ref, ev.id);
  }
}

/**
 * Faction-shaped war summaries (Rebels-family zones — the name is a GROUP, not a
 * happening, so a hold falls TO them, never *in* them). Two variants per event
 * kind; `pick` selects one. Same tone bar as the event family: front-loaded,
 * laconic, US English, every clause TRUE of the event.
 */
const FACTION_SUMMARY: Readonly<Record<string, readonly [(n: string) => string, (n: string) => string]>> = {
  fire: [
    (n) => `the ${n} put the hold to the torch`,
    (n) => `the ${n} burned the hold and moved on`,
  ],
  'brick-off': [
    (n) => `the survivors of the siege by the ${n} bricked the way shut`,
    (n) => `masons walled the deep shut after the ${n} came through`,
  ],
  seal: [
    (n) => `the garrison sealed the hold against the ${n}`,
    (n) => `the hold was sealed with the ${n} at the gates`,
  ],
  default: [
    (n) => `the ${n} overran the hold`,
    (n) => `it fell to the ${n}`,
  ],
};

/**
 * Rewrite a bound event's summary to quote the real zone name. Front-loaded and
 * laconic (the dungeon tone bar), US English. Every clause is TRUE of the event:
 * a `fire` bound to a war really did burn in that war; an `awaken` bound to a
 * plague really did wake the plague's dead.
 *
 * The template family branches on the ref's grammatical SHAPE: event-shaped
 * names ("Onerean Occupation") keep the "in the {name}" family; faction-shaped
 * names (Rebels-family zones, "Damunvilian Rebels") use {@link FACTION_SUMMARY}
 * — a hold falls TO the Rebels, it cannot fall *in* them. Faction refs only
 * ever arrive with kind 'war' (chronicle.ts maps Rebels → war), so the faction
 * family covers exactly the war-bindable event kinds (fire/brick-off/seal) plus
 * a fallback. Variant selection is seedless arithmetic (eventId + zoneId) —
 * ZERO rng draws, so the draw-count discipline is untouched.
 */
function chronicleSummary(kind: EventKind, ref: ChronicleRef, eventId: number): string {
  if (ref.shape === 'faction') {
    const n = ref.name || 'rebels';
    const pair = FACTION_SUMMARY[kind] ?? FACTION_SUMMARY.default;
    return pair[(eventId + ref.zoneId) % 2](n);
  }
  const n = ref.name || 'the war';
  switch (kind) {
    case 'fire': return `the hold burned in the ${n}`;
    case 'brick-off': return `the survivors of the ${n} bricked the way shut`;
    case 'seal': return `the garrison sealed the hold against the ${n}`;
    case 'awaken': return `the ${n} filled these vaults, and its dead woke`;
    case 'den': return `beasts denned here after the ${n} emptied the land`;
    case 'plunder': return `robbers stripped the dead of the ${n}`;
    case 'flood': return `the ${n} shook the earth and the deep flooded`;
    case 'collapse': return `the ${n} brought the passage down`;
    default: return `it fell in the ${n}`;
  }
}
