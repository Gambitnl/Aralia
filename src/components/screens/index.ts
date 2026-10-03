// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 26/08/2026, 13:57:21
 * Dependents: App.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This index file exports all dedicated phase screen containers in the Aralia RPG.
 *
 * It serves as a central module entry point for:
 * - MainMenuScreen: Title screen, save loading, compendium, and dev menu entry.
 * - CharacterCreatorScreen: Full character creation wizard flow.
 * - BattleScreen: Combat encounter view, 2D/3D toggle, tactical HUD, and victory/defeat resolution.
 * - PlayingScreen: Overworld exploration, 2D layout, 3D world scene, and Atlas map view.
 *
 * Called by: App.tsx (top-level phase router)
 * Exports: Screen components and their corresponding prop types
 */

// ============================================================================
// Screen Exports
// ============================================================================
export { MainMenuScreen, type MainMenuScreenProps } from './MainMenuScreen';
export { CharacterCreatorScreen, type CharacterCreatorScreenProps } from './CharacterCreatorScreen';
export { BattleScreen, type BattleScreenProps } from './BattleScreen';
export { PlayingScreen, type PlayingScreenProps } from './PlayingScreen';
