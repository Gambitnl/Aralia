/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 20:12:27
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file AbilityPalette.tsx
 * Displays the abilities for the currently selected character.
 * Supports pop-out into a draggable/resizable WindowFrame modal. The embedded
 * trigger uses a full touch-sized target so the combat command rail remains
 * usable when the 2D layout collapses into a narrow column.
 */
import React from 'react';
import { CombatCharacter, Ability, AbilityCost } from '../../types/combat';
interface AbilityPaletteProps {
    character: CombatCharacter | null;
    onSelectAbility: (ability: Ability) => void;
    selectedAbilityId?: string | null;
    onCancelAbility?: () => void;
    canAffordAction: (cost: AbilityCost) => boolean;
}
declare const AbilityPalette: React.FC<AbilityPaletteProps>;
export default AbilityPalette;
