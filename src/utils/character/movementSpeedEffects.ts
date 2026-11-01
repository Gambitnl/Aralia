/** Flat carried status riders shared by preparation and tactical movement.
 * The old combat stat/legacy fields retain their behavior. Overlapping copies
 * of Longstrider retain their source records but grant only the strongest
 * bonus, so two casters do not manufacture a second benefit. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:21:46
 * Dependents: utils/character/partyStatUtils.ts, utils/combat/actionEconomyUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

type MovementStatus = {
    name?: string;
    source?: string;
    effect?: { type: string; stat?: PropertyKey; value?: number };
    modifiers?: unknown;
};

export function sumMovementSpeedEffects(effects: readonly MovementStatus[]): number {
    let total = 0;
    let longstrider = 0;
    for (const effect of effects) {
        const statModifier = effect.effect?.type === 'stat_modifier' && effect.effect.stat === 'speed' && typeof effect.effect.value === 'number'
            ? effect.effect.value : 0;
        const modifiers = effect.modifiers;
        const legacyMovementBonus = modifiers && typeof modifiers === 'object' && 'movementSpeed' in modifiers
            && typeof modifiers.movementSpeed === 'number' ? modifiers.movementSpeed : 0;
        const delta = statModifier + legacyMovementBonus;
        if (effect.source === 'Longstrider' && effect.name === 'Longstrider' && delta > 0) {
            longstrider = Math.max(longstrider, delta);
        } else {
            total += delta;
        }
    }
    return total + longstrider;
}
