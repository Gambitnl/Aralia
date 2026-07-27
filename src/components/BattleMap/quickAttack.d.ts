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
type CanAffordAction = (cost: AbilityCost) => boolean;
export declare const selectQuickAttack: (abilities: Ability[], canAffordAction: CanAffordAction) => Ability | null;
export {};
