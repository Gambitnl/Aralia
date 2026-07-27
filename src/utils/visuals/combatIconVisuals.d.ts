/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 06:36:42
 * Dependents: components/BattleMap/AbilityButton.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/CombatIntentPreview.tsx, components/BattleMap/InitiativeTracker.tsx, components/BattleMap/PartyDisplay.tsx, utils/visuals/spellVisuals.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file connects the new battle-map SVG icon pack to live combat data.
 *
 * Spells, granted follow-up actions, and enemy tokens all arrive through
 * different runtime shapes. This helper keeps the visual matching in one place
 * so UI components can ask for a ready-to-render asset without learning every
 * spell-name or monster-name special case.
 *
 * Called by: AbilityButton, CharacterToken, and spellVisuals.
 * Depends on: the reusable SVG files under src/assets/icons/combat.
 */
import type { Ability, CombatCharacter } from '../../types/combat';
import type { Spell } from '../../types/spells';
import type { VisualAsset } from '../../types/visuals';
export declare const getSpellIconAsset: (spell: Pick<Spell, "id" | "name" | "school"> & {
    damageType?: string;
}) => string;
export declare const getSpellIconColor: (spell: Pick<Spell, "school"> & {
    damageType?: string;
}) => string;
export declare const getAbilityIconVisual: (ability: Ability) => VisualAsset;
export declare const getCreatureTokenVisual: (character: CombatCharacter) => VisualAsset;
