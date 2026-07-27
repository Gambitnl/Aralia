/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:30
 * Dependents: religionUtils.ts, world/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Deity, DivineFavor, DeityAction, Temple, TempleService, Blessing } from '../../types/religion';
import { BlessingDefinition } from '../../data/religion/blessings';
import { StatusEffect } from '../../types/combat';
/**
 * Calculates the new favor level based on an action.
 * Favor is clamped between -100 and 100.
 */
export declare const calculateFavorChange: (currentFavor: DivineFavor, action: DeityAction) => DivineFavor;
/**
 * Resolves the full definition for a given blessing ID.
 */
export declare const resolveBlessingDefinition: (blessingId: string) => BlessingDefinition | null;
/**
 * Grants a blessing to the favor record.
 */
export declare const grantBlessing: (currentFavor: DivineFavor, blessing: Blessing) => DivineFavor;
/**
 * Resolves the status effect for a given blessing ID.
 */
export declare const resolveBlessingEffect: (blessingId: string) => StatusEffect | null;
/**
 * Evaluates an action trigger against a deity's preferences.
 * Returns the DeityAction object if the deity cares about this trigger, or null.
 */
export declare const evaluateAction: (deityId: string, actionTrigger: string) => DeityAction | null;
/**
 * Returns the player's standing with a deity as a descriptive string.
 */
export declare const getDivineStanding: (favor: number) => string;
/**
 * Checks if a player qualifies for a specific temple service.
 */
export declare const canAffordService: (service: TempleService, playerGold: number, currentFavor: number) => {
    allowed: boolean;
    reason?: string;
};
/**
 * Returns available services for a given deity/temple based on favor.
 */
export declare const getAvailableServices: (temple: Temple, _currentFavor: number) => TempleService[];
/**
 * Gets a deity by ID.
 */
export declare const getDeity: (id: string) => Deity | undefined;
