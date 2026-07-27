/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 01:17:38
 * Dependents: App.tsx
 * Imports: 55 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component is the 'Modal Manager' for the Aralia RPG. It centralizes
 * conditional rendering for all overlays (Map, Quest Log, Submap, Character Sheets).
 *
 * By extracting modal state management from App.tsx, we keep the main render
 * loop lean and ensure a consistent stacking order (via z-index).
 *
 * Most components are lazy-loaded to optimize initial bundle size, as many
 * modals (like Trade or Heist) are only accessed after significant gameplay.
 *
 * @file src/components/layout/GameModals.tsx
 *
 * 2026-03-24 note:
 * The shared DevMenu modal now also carries the real Dev Mode toggle state so the
 * main-menu "Dev Menu" entry and the in-game Dev Mode controls no longer feel like
 * two disconnected systems. This file is the bridge that feeds that shared modal
 * the current flag and the reducer action that changes it.
 *
 * 2026-03-25 note:
 * The old main-menu "Quick Start (Dev)" button is now folded into that same shared
 * modal, so we also pass the current game phase down. The modal decides whether the
 * quick-start action should appear instead of the main menu rendering a separate
 * developer-only launch button.
 */
import React from 'react';
import { GameState, Action, Location, NPC, Item, PlayerCharacter, MissingChoice, MapTile } from '../../types';
import { AppAction } from '../../state/actionTypes';
interface GameModalsProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    onAction: (action: Action) => void;
    onTileClick: (x: number, y: number, tile: MapTile, travelMeta?: import('../../types/travelMeta').TravelMeta) => void;
    onEnter3DAtCell?: (x: number, y: number, tile: MapTile) => void;
    playerWorldPos?: GameState['playerWorldPos'];
    allow3DEntry?: boolean;
    currentLocation: Location;
    npcsInLocation: NPC[];
    itemsInLocation: Item[];
    isUIInteractive: boolean;
    missingChoiceModal: {
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    };
    onCloseMissingChoice: () => void;
    onConfirmMissingChoice: (choiceId: string, extraData?: unknown) => void;
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    handleCloseCharacterSheet: () => void;
    handleClosePartyOverlay: () => void;
    handleDismissMember: (id: string) => void;
    handleDevMenuAction: (action: string) => void;
    handleModelChange: (model: string | null) => void;
    handleNavigateToGlossaryFromTooltip: (termId: string) => void;
    handleOpenGlossary: (initialTermId?: string) => void;
    handleOpenCharacterSheet: (character: PlayerCharacter) => void;
    onOllamaDontShowAgain?: (value: boolean) => void;
    isBanterPaused?: boolean;
    toggleBanterPause?: () => void;
    onForceBanterTrigger?: () => void;
    onClearBanterLogs?: () => void;
    canRegenerateWorldMap: boolean;
    worldGenerationLockedReason: string | null;
    onRegenerateWorldMap: (seed?: number) => void;
}
declare const GameModals: React.FC<GameModalsProps>;
export default GameModals;
