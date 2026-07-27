/**
 * @file keyNpcs.ts — Plan B: tag a town's "key NPCs" (SPEC D9).
 *
 * Key NPCs are the institution-holders who stay alive in the sim even when the
 * player is far away (Tier B): the lord (keep), priest (temple), and
 * marketmaster (market/plaza), plus 1–2 "wildcards" scaled by town size.
 *
 * Pure & additive: this reads a generated artifact TownPlan + roster and returns
 * a Map<occupantId, InstitutionRole>. It does NOT modify the roster.
 *
 * Why proximity, not workPlotId: generateTownRoster only staffs market/workshop
 * plots — it never assigns a worker to a temple or keep. So institution holders
 * are chosen as the adult living nearest the institution (preferring an actual
 * on-plot worker when one exists, i.e. for markets).
 */
import type { SeededRandom } from '../../../utils/random/seededRandom';
import type { TownPlan } from '../artifacts';
import type { TownRoster } from '../roster/types';
import type { InstitutionRole } from './types';
export interface KeyNpcOptions {
    /** RNG for deterministic wildcard selection. */
    rng: SeededRandom;
    /** Override the auto-scaled wildcard count. */
    wildcards?: number;
}
/**
 * Assign institution roles + wildcards to a town's occupants.
 * Returns occupantId → InstitutionRole for the key NPCs only.
 */
export declare function assignKeyNpcs(plan: TownPlan, roster: TownRoster, opts: KeyNpcOptions): Map<number, InstitutionRole>;
