/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:44
 * Dependents: components/Crafting/CreatureHarvestPanel.tsx, components/Crafting/GatheringPanel.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { PlayerCharacter } from '../../types';
import { Crafter } from '../../systems/crafting/craftingSystem';
interface CraftingStateSnapshot {
    party: PlayerCharacter[];
    characterSheetModal?: {
        isOpen: boolean;
        character: PlayerCharacter | null;
    };
}
export interface CraftingCrafterSelectionOptions {
    /**
     * Explicit character to prefer. Gathering can pass the character-sheet
     * selection here, while creature harvesting can leave it empty and stay on
     * the lead party member.
     */
    selectedCharacter?: PlayerCharacter | null;
    /**
     * When true, the helper may read from the open character sheet modal if no
     * explicit selected character was passed in.
     */
    allowCharacterSheetSelection?: boolean;
}
export interface CraftingCrafterResolution {
    crafter: Crafter;
    sourceCharacter: PlayerCharacter | null;
    sourceLabel: 'selected_character' | 'party_lead' | 'fallback';
}
/**
 * Turns a character into the lightweight Crafter contract expected by the
 * legacy gathering and harvest systems.
 */
export declare function createCraftingCrafter(character: PlayerCharacter): Crafter;
/**
 * Resolves the actual crafting actor from live game state.
 *
 * Gathering can prefer the selected character from the open sheet. Creature
 * harvesting intentionally stays on the party lead because the combat panel
 * does not expose a separate selection prop yet.
 */
export declare function resolveCraftingCrafter(state: CraftingStateSnapshot, options?: CraftingCrafterSelectionOptions): CraftingCrafterResolution;
export {};
