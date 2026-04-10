// @dependencies-start
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
// @dependencies-end

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
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LoadGameModal, SaveSlotSelector } from '../SaveLoad';
import { deleteSaveGame, getSaveSlots, SaveSlotSummary } from '../../services/saveLoadService';
import { VersionDisplay } from '../ui/VersionDisplay';
import { canUseDevTools } from '../../utils/permissions';
import { t } from '../../utils/i18n';
import { UI_ID } from '../../styles/uiIds';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: (slotId?: string) => void;
  onShowCompendium: () => void;
  hasSaveGame: boolean;
  latestSaveTimestamp: number | null;
  isDevDummyActive: boolean; // Retained for now because other call sites/tests still document the old quick-start capability.
  onSkipCharacterCreator: () => void; // Retained for now because App still owns the quick-start action routed through the Dev Menu.
  onClearAllSaves?: () => void; // New prop
  hasActiveRun?: boolean;
  onAbandonRun?: () => void;
  // Callback to trigger the developer menu from the main menu phase
  onOpenDevMenu?: () => void;
  onSaveGame?: (slotId: string, displayName?: string, isAutoSave?: boolean) => void;
  onGoBack?: () => void; // New prop for back navigation
  canGoBack?: boolean; // Whether there's a previous screen to go back to
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
const MainMenu: React.FC<MainMenuProps> = ({
  onNewGame,
  onLoadGame,
  onShowCompendium,
  hasSaveGame,
  latestSaveTimestamp,
  // This prop is intentionally retained even though the button moved into the Dev Menu.
  // Keeping it here avoids a broader signature cleanup while the quick-start action is
  // still part of the overall main-menu dev flow owned by App.tsx.
  isDevDummyActive: _isDevDummyActive,
  // Same story for the callback: App still passes the quick-start handler, but the
  // main menu no longer renders it directly after folding that action into Dev Menu.
  onSkipCharacterCreator: _onSkipCharacterCreator,
  onClearAllSaves,
  hasActiveRun = false,
  onAbandonRun,
  onOpenDevMenu,
  onSaveGame,
  onGoBack,
  canGoBack = false,
  onOpenWorldGeneration,
  isWorldGenerationLocked = false,
  worldGenerationLockedReason = null,
}) => {
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<'abandon' | 'wipe' | null>(null);

  useEffect(() => {
    // Load slot metadata up front so the menu can render previews and continue targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveSlots(getSaveSlots());
  }, []);

  const refreshSlots = () => {
    setSaveSlots(getSaveSlots());
  };

  const latestSlot = useMemo(() => {
    if (saveSlots.length > 0) {
      return [...saveSlots].sort((a, b) => b.lastSaved - a.lastSaved)[0];
    }
    return null;
  }, [saveSlots]);

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
    return t('main_menu.last_played', { date: formattedDate });
  };

  const handleLoadSlot = (slotId?: string) => {
    onLoadGame(slotId || undefined);
    setIsLoadModalOpen(false);
  };

  const handleDeleteSlot = (slotId: string) => {
    deleteSaveGame(slotId);
    refreshSlots();
  };

  const handleConfirm = () => {
    if (pendingConfirm === 'wipe') {
      onClearAllSaves?.();
      refreshSlots();
    } else if (pendingConfirm === 'abandon') {
      onAbandonRun?.();
    }
    setPendingConfirm(null);
  };

  const handleSaveSlot = (slotId: string, displayName?: string, isAutoSave?: boolean) => {
    if (!onSaveGame) {
      console.warn('Save requested but onSaveGame handler was not provided.');
      return;
    }
    onSaveGame(slotId, displayName || slotId, isAutoSave);
    refreshSlots();
  };

  return (
    <div id={UI_ID.MAIN_MENU} data-testid={UI_ID.MAIN_MENU} className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-8">
      <div className="bg-gray-800 p-8 md:p-12 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md text-center">
        <h1 className="text-5xl font-bold text-amber-400 mb-12 font-cinzel tracking-wider">
          {t('main_menu.title')}
        </h1>
        {canGoBack && onGoBack && (
          <button
            onClick={onGoBack}
            className="w-full mb-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg shadow-md text-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 flex items-center justify-center gap-2"
            aria-label={t('main_menu.back_aria')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('main_menu.back')}
          </button>
        )}
        <div className="space-y-4">
          {(hasSaveGame || !!latestSlot) && (
            <button
              onClick={() => handleLoadSlot(latestSlot?.slotId)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-opacity-75"
              aria-label={t('main_menu.continue')}
            >
              {t('main_menu.continue')}
              {(latestSlot?.lastSaved || latestSaveTimestamp) && (
                <span className="block text-xs text-emerald-200 mt-1">
                  {formatTimestamp(latestSlot?.lastSaved || latestSaveTimestamp)}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onNewGame}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
            aria-label={t('main_menu.new_game')}
          >
            {t('main_menu.new_game')}
          </button>
          {onOpenWorldGeneration && (
            <>
              <button
                onClick={onOpenWorldGeneration}
                className={`w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 ${isWorldGenerationLocked ? 'opacity-80' : ''}`}
                aria-label="Open world generation setup"
                title={isWorldGenerationLocked && worldGenerationLockedReason ? worldGenerationLockedReason : 'Open world generation setup'}
              >
                World Generation
              </button>
              {isWorldGenerationLocked && worldGenerationLockedReason && (
                <p className="text-xs text-amber-300 text-left px-1">
                  {worldGenerationLockedReason}
                </p>
              )}
            </>
          )}
          <button
            onClick={() => setIsSaveModalOpen(true)}
            disabled={!onSaveGame}
            className={`w-full bg-amber-600 hover:bg-amber-500 text-gray-900 font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-opacity-75 ${!onSaveGame ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={t('main_menu.save_to_slot')}
          >
            {t('main_menu.save_to_slot')}
          </button>
          {canUseDevTools() && (
            <>
              {/* The dev-only quick-start path now lives inside Dev Menu so this main-menu
                  surface only shows one developer entry point instead of two disjoint ones. */}
              {onOpenDevMenu && (
                <button
                  onClick={onOpenDevMenu}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
                  aria-label="Open Developer Menu"
                >
                  Dev Menu
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setIsLoadModalOpen(true)}
            disabled={!hasSaveGame && saveSlots.length === 0}
            className={`w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 ${(!hasSaveGame && saveSlots.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={hasSaveGame || saveSlots.length > 0 ? t('main_menu.load_game_aria') : t('main_menu.load_game_empty_aria')}
            title={hasSaveGame || saveSlots.length > 0 ? t('main_menu.load_game') : t('main_menu.load_game_empty_title')}
          >
            {t('main_menu.load_game')}
          </button>
          {hasActiveRun && onAbandonRun && (
            pendingConfirm === 'abandon' ? (
              <div className="w-full bg-gray-700 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-300 text-center">{t('main_menu.abandon_run_confirm')}</p>
                <div className="flex gap-2">
                  <button onClick={handleConfirm} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">Confirm</button>
                  <button onClick={() => setPendingConfirm(null)} className="flex-1 bg-gray-500 hover:bg-gray-400 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPendingConfirm('abandon')}
                className="w-full bg-orange-700 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-75"
                aria-label={t('main_menu.abandon_run')}
              >
                {t('main_menu.abandon_run')}
              </button>
            )
          )}
          {(hasSaveGame || saveSlots.length > 0) && (
            pendingConfirm === 'wipe' ? (
              <div className="w-full bg-gray-700 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-300 text-center">{t('main_menu.clear_save_confirm')}</p>
                <div className="flex gap-2">
                  <button onClick={handleConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">Confirm</button>
                  <button onClick={() => setPendingConfirm(null)} className="flex-1 bg-gray-500 hover:bg-gray-400 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPendingConfirm('wipe')}
                className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
                aria-label={t('main_menu.clear_save')}
              >
                {t('main_menu.clear_save')}
              </button>
            )
          )}
          <button
            onClick={onShowCompendium} // This prop now correctly opens the Glossary
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75"
            aria-label={t('main_menu.glossary_aria')}
            title={t('main_menu.glossary_title')}
          >
            {t('main_menu.glossary')}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-12">{t('main_menu.powered_by')}</p>
      </div>

      {isSaveModalOpen && (
        <SaveSlotSelector
          slots={saveSlots}
          onSaveSlot={handleSaveSlot}
          onClose={() => setIsSaveModalOpen(false)}
          allowAutoSave
          isSavingDisabled={!onSaveGame}
        />
      )}

      {isLoadModalOpen && (
        <LoadGameModal
          slots={saveSlots}
          onLoadSlot={handleLoadSlot}
          onDeleteSlot={handleDeleteSlot}
          onClose={() => setIsLoadModalOpen(false)}
        />
      )}

      <VersionDisplay position="main-menu" />
    </div>
  );
};

export default MainMenu;
