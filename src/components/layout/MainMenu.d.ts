/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/03/2026, 23:48:00
 * Dependents: App.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file MainMenu.tsx
 * This component renders the main menu screen for the Aralia RPG.
 * It provides options to start a new game, load a saved game (placeholder),
 * and view a game compendium (placeholder).
 *
 * The 2026-03-25 change removes the standalone "Quick Start (Dev)" button from the
 * main menu and folds that action into the shared Dev Menu modal instead. This keeps
 * developer-only entry points grouped together instead of splitting them across the
 * main menu surface.
 *
 * The 2026-07-05 layout pass keeps the same menu choices but gives phone-height
 * viewports tighter spacing and their own scroll area. Players who return from an
 * active run should not land on a title screen where lower options are half hidden.
 * Confirmation panels now also scroll themselves into view when opened, preserving
 * the existing destructive-action safeguards without making cramped players hunt
 * for Confirm and Cancel below the fold.
 */
import React from 'react';
interface MainMenuProps {
    onNewGame: () => void;
    onLoadGame: (slotId?: string) => void;
    onShowCompendium: () => void;
    hasSaveGame: boolean;
    latestSaveTimestamp: number | null;
    isDevDummyActive: boolean;
    onSkipCharacterCreator: () => void;
    onClearAllSaves?: () => void | Promise<void>;
    hasActiveRun?: boolean;
    onAbandonRun?: () => void;
    onOpenDevMenu?: () => void;
    onSaveGame?: (slotId: string, displayName?: string, isAutoSave?: boolean) => void;
    onGoBack?: () => void;
    canGoBack?: boolean;
    onOpenWorldGeneration?: () => void;
    isWorldGenerationLocked?: boolean;
    worldGenerationLockedReason?: string | null;
}
/**
 * MainMenu component.
 * Displays the main title and navigation buttons for the game.
 * @param {MainMenuProps} props - Props for the component, including callbacks for menu actions.
 * @returns {React.FC} The rendered MainMenu component.
 */
declare const MainMenu: React.FC<MainMenuProps>;
export default MainMenu;
