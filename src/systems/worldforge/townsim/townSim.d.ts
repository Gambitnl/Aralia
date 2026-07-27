/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 19:57:39
 * Dependents: components/Worldforge/LivingWorldPreview.tsx, components/debug/TownHistoryDevOverlay.tsx, systems/worldforge/roster/agentLife.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/townSimRegistry.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file townSim.ts — Life-event core: age a town's tracked villagers forward
 * day-by-day, emitting personal and town events plus exact saved changes on
 * occupied homes into an append-only chronicle (D7 diary + cached meters).
 *
 * PURE & DETERMINISTIC. rollTownDay/advanceTownDays return new state and never
 * mutate inputs; all randomness comes from the caller-supplied SeededRandom,
 * drawn in a fixed (sorted-id) order so a given (state, seed) always yields the
 * same result. Production seeds the RNG path-dependently (SPEC D6); tests pin a
 * fixed seed. Building evolution uses named hashes and prevalidated geometry,
 * so it does not consume or shift the established simulation draws.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import type { TownRoster } from '../roster/types';
import type { FamilyTies } from '../roster/family';
import type { InstitutionRole, LifeEvent, LivingVillager, TownSimState } from './types';
/** Integer age in years on the given gameDay. */
export declare function ageOf(v: LivingVillager, day: number): number;
/** Build a fresh sim state from a generated roster + family ties + key roles. */
export declare function initTownSimState(burgId: number, roster: TownRoster, families: Map<number, FamilyTies>, keyRoles: Map<number, InstitutionRole>, startDay: number, buildingEvolution?: TownSimState['buildingEvolution']): TownSimState;
export interface RollTownDayOptions {
    /**
     * Select the layers this day may advance. The default keeps the complete
     * living-world simulation. `life-events` is the smaller agent-sim spine:
     * aging, natural deaths, inheritance, succession, births, and coming of age
     * only. It deliberately leaves relationships, economy, town events, and
     * building history unchanged while reusing this file's canonical state and
     * chronicle contracts.
     */
    mode?: 'full' | 'life-events';
    /** World seed — seeds the raid-worry stream (kept off the life-event rng). */
    worldSeed?: number;
    /** Raid pressure (0..1) the burg feels from uncleared dungeons today. */
    raidPressure?: number;
}
/**
 * Advance one day and return a new state without touching the input. The
 * default runs every established town-sim layer. Callers that need only the
 * agent life spine can select `mode: 'life-events'`; raid pressure remains an
 * optional full-mode signal. Omitting options preserves the established draw
 * order and behavior exactly.
 */
export declare function rollTownDay(state: TownSimState, day: number, rng: SeededRandom, opts?: RollTownDayOptions): TownSimState;
/**
 * Advance the sim from its current lastSimDay up to and including `toDay`,
 * threading ONE caller-supplied RNG across the whole span.
 *
 * TEST-ONLY. Because it uses a single RNG stream, its result is chunking-
 * DEPENDENT (advancing 0→100 in one call ≠ 0→50 then 50→100). Production must
 * use {@link advanceTown}/advanceRegistry instead, which re-seed per
 * (worldSeed, burgId, day) and are therefore chunking-INDEPENDENT. This helper
 * exists only to exercise rollTownDay's per-day logic under a fixed seed in unit
 * tests; do not wire it into the real game.
 */
export declare function advanceTownDays(state: TownSimState, _fromDay: number, toDay: number, rng: SeededRandom): TownSimState;
/** All events touching a villager (as subject or related) — their personal diary. */
export declare function villagerDiary(state: TownSimState, occupantId: number): LifeEvent[];
