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
 * Semantic button color system for the main menu (M1/X2).
 * One primary CTA (amber, matches the title accent) — "Begin Legend".
 * Everything else is a neutral secondary, except genuinely destructive
 * actions (red) which keep their own meaning. This replaces the previous
 * rainbow of unrelated hues where every button competed for attention.
 */
const BTN_BASE =
  'w-full font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-opacity-75';

/** The single primary call-to-action. */
const BTN_PRIMARY =
  `${BTN_BASE} bg-amber-500 hover:bg-amber-400 text-gray-900 hover:scale-105 focus:ring-amber-300`;

/** Neutral secondary action — the default for most menu entries. */
const BTN_SECONDARY =
  `${BTN_BASE} bg-slate-700 hover:bg-slate-600 text-gray-100 hover:scale-105 focus:ring-slate-400`;

/** Destructive action (abandon / wipe). */
const BTN_DANGER =
  `${BTN_BASE} bg-red-800 hover:bg-red-700 text-red-50 hover:scale-105 focus:ring-red-400`;

/**
 * Disabled styling (M2): genuinely reads as unavailable — desaturated,
 * dimmed, no hover lift, not-allowed cursor. Append to a base style and
 * gate the hover/scale classes off via the variant constants below.
 */
const BTN_DISABLED = 'opacity-40 saturate-0 cursor-not-allowed hover:scale-100';

/**
 * True only in a shipped production bundle. `import.meta.env.PROD` is false in
 * both local dev and the test runner, so dev/test still see developer surfaces
 * while a production build hides them. Guarded for non-Vite/SSR contexts.
 */
const IS_PRODUCTION_BUILD: boolean =
  typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? Boolean((import.meta as ImportMeta).env.PROD)
    : false;

/** Secondary action that may be disabled — drops the hover affordances when off. */
const btnSecondary = (disabled: boolean): string =>
  disabled
    ? `${BTN_BASE} bg-slate-700 text-gray-100 ${BTN_DISABLED} focus:ring-slate-400`
    : BTN_SECONDARY;

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
    <main id={UI_ID.MAIN_MENU} data-testid={UI_ID.MAIN_MENU} className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-8">
      <div className="bg-gray-800 p-8 md:p-12 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md text-center">
        <h1 className="text-5xl font-bold text-amber-400 mb-12 font-cinzel tracking-wider">
          {t('main_menu.title')}
        </h1>
        {canGoBack && onGoBack && (
          <button
            onClick={onGoBack}
            className="w-full mb-4 bg-slate-700 hover:bg-slate-600 text-gray-100 font-bold py-2 px-4 rounded-lg shadow-md text-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75 flex items-center justify-center gap-2"
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
              className={BTN_SECONDARY}
            >
              {t('main_menu.continue')}
              {(latestSlot?.lastSaved || latestSaveTimestamp) && (
                <span className="block text-xs text-gray-400 mt-1">
                  {formatTimestamp(latestSlot?.lastSaved || latestSaveTimestamp)}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onNewGame}
            className={BTN_PRIMARY}
            aria-label={t('main_menu.new_game_aria')}
            title={t('main_menu.new_game_title')}
          >
            {t('main_menu.new_game')}
          </button>
          {onOpenWorldGeneration && (
            <>
              <button
                onClick={onOpenWorldGeneration}
                className={btnSecondary(isWorldGenerationLocked)}
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
            className={btnSecondary(!onSaveGame)}
          >
            {t('main_menu.save_to_slot')}
          </button>
          {/* M5: the "Dev Menu" button is a developer affordance and must NOT appear on the
              shipped player landing screen. canUseDevTools() is currently hardcoded-true
              ("Force enable for testing"), so it alone is not a real gate. We additionally
              require that this is NOT a production build — in the shipped player bundle
              import.meta.env.PROD is true, so players never see this button, while dev and
              the test runner (both PROD=false) keep it. */}
          {!IS_PRODUCTION_BUILD && canUseDevTools() && (
            <>
              {/* The dev-only quick-start path now lives inside Dev Menu so this main-menu
                  surface only shows one developer entry point instead of two disjoint ones. */}
              {onOpenDevMenu && (
                <button
                  onClick={onOpenDevMenu}
                  className={BTN_SECONDARY}
                >
                  Dev Menu
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setIsLoadModalOpen(true)}
            disabled={!hasSaveGame && saveSlots.length === 0}
            className={btnSecondary(!hasSaveGame && saveSlots.length === 0)}
            title={hasSaveGame || saveSlots.length > 0 ? t('main_menu.load_game') : t('main_menu.load_game_empty_title')}
          >
            {t('main_menu.load_game')}
          </button>
          {hasActiveRun && onAbandonRun && (
            pendingConfirm === 'abandon' ? (
              <div className="w-full bg-gray-700 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-300 text-center">{t('main_menu.abandon_run_confirm')}</p>
                <div className="flex gap-2">
                  <button onClick={handleConfirm} className="flex-1 bg-red-700 hover:bg-red-600 text-red-50 font-bold py-2 px-3 rounded-lg text-sm transition-colors">Confirm</button>
                  <button onClick={() => setPendingConfirm(null)} className="flex-1 bg-slate-600 hover:bg-slate-500 text-gray-100 font-bold py-2 px-3 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPendingConfirm('abandon')}
                className={BTN_DANGER}
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
                  <button onClick={handleConfirm} className="flex-1 bg-red-700 hover:bg-red-600 text-red-50 font-bold py-2 px-3 rounded-lg text-sm transition-colors">Confirm</button>
                  <button onClick={() => setPendingConfirm(null)} className="flex-1 bg-slate-600 hover:bg-slate-500 text-gray-100 font-bold py-2 px-3 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPendingConfirm('wipe')}
                className={BTN_DANGER}
              >
                {t('main_menu.clear_save')}
              </button>
            )
          )}
          <button
            onClick={onShowCompendium} // This prop now correctly opens the Glossary
            className={BTN_SECONDARY}
            title={t('main_menu.glossary_title')}
            aria-label={t('main_menu.glossary_aria')}
          >
            {t('main_menu.glossary')}
          </button>
        </div>
        {/* M4: removed the player-facing "Powered by Gemini" branding line — an
            engineering/vendor detail that should not leak into the shipped menu. */}
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
    </main>
  );
};

export default MainMenu;
