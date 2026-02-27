// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:31:15
 * Dependents: ArtificerFeatureSelection.tsx, CharacterCreator.tsx, CharacterOverview.tsx, CharacterSheetModal.tsx, DefensiveCommand.ts, EquipmentMannequin.tsx, InventoryList.tsx, LevelUpModal.tsx, NameAndReview.tsx, RacialSpellAbilitySelection.tsx, RestModal.tsx, SkillDetailDisplay.tsx, SkillsTab.tsx, appState.ts, characterCreatorState.ts, characterGenerator.ts, characterReducer.ts, dummyCharacter.ts, handleGeminiCustom.ts, handleItemInteraction.ts, handleResourceActions.ts, saveLoadService.ts, useCharacterAssembly.ts, useCharacterAssembly.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/character' instead.
 */
export * from './character/characterUtils';
