// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 23:50:59
 * Dependents: components/BattleMap/BattleMap.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file chooses the attack represented by the battle map's quick Attack button.
 *
 * The full ability palette remains the authoritative place for choosing any
 * action. This helper only finds a truthful direct attack shortcut: an
 * affordable main Action that targets one creature and is not depleted or on
 * cooldown. BattleMap calls it every render so action-economy changes are
 * reflected immediately, while focused tests protect the selection policy.
 */
import type { Ability, AbilityCost } from '../../types/combat';

// ============================================================================
// Quick Attack Selection
// ============================================================================
// Preserve the character's authored loadout order instead of guessing which
// attack is strongest. The open Plan Map decision covers whether a future
// version should remember the player's last explicit attack choice.
// ============================================================================

type CanAffordAction = (cost: AbilityCost) => boolean;

export const selectQuickAttack = (
  abilities: Ability[],
  canAffordAction: CanAffordAction,
): Ability | null => {
  const attack = abilities.find((ability) => {
    // The shortcut means a direct main-action attack. Bonus attacks, area
    // attacks, movement, utility, and spells remain explicit palette choices.
    const isDirectActionAttack = ability.type === 'attack'
      && ability.cost.type === 'action'
      && (ability.targeting === 'single_enemy' || ability.targeting === 'single_any');
    if (!isDirectActionAttack) return false;

    // Cooldown and use limits are ability-specific availability rules that the
    // action-economy affordability check does not know about.
    const isOnCooldown = (ability.currentCooldown ?? 0) > 0;
    const isExhausted = ability.maxUses !== undefined
      && (ability.usesRemaining ?? ability.maxUses) <= 0;

    return !isOnCooldown && !isExhausted && canAffordAction(ability.cost);
  });

  return attack ?? null;
};

