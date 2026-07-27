/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 23:31:43
 * Dependents: systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export declare class DiceRoller {
    /**
     * Roll a d20 (1-20)
     */
    static rollD20(rng?: () => number): number;
    /**
     * Roll dice from a string formula
     *
     * @param formula - Dice formula (e.g., "3d6", "1d8+2")
     * @returns Total rolled
     *
     * @example
     * const damage = DiceRoller.roll("3d6+2")
     * // Returns 5-20 (3d6 + 2)
     */
    static roll(formula: string, rng?: () => number): number;
    /**
     * Roll with advantage (roll twice, take higher)
     */
    static rollD20Advantage(rng?: () => number): {
        roll: number;
        rolls: [number, number];
    };
    /**
     * Roll with disadvantage (roll twice, take lower)
     */
    static rollD20Disadvantage(rng?: () => number): {
        roll: number;
        rolls: [number, number];
    };
}
