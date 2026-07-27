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
import type { ChronicleRef, DungeonEvent } from '../types';
/**
 * Bind chronicle refs to matching events IN PLACE. For each ref (in order), find
 * the first still-unbound, non-failed event whose kind the ref may claim, and:
 *  1. attach `chronicleRef` (zoneId/zoneName/kind),
 *  2. snap its `yearsAgo` into the ref's era (monotonicity preserved), and
 *  3. rewrite its `summary` to quote the real zone name.
 * Deterministic: refs and events are walked in fixed order; jitter (if any) draws
 * on the dedicated stream. No-op when a ref matches nothing.
 */
export declare function bindChronicle(events: DungeonEvent[], chronicle: readonly ChronicleRef[], jitter: Rng | undefined): void;
