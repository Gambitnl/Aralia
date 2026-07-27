/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/03/2026, 23:48:00
 * Dependents: components/layout/GameModals.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file DevMenu.tsx
 * This file renders the shared developer tools modal used from both gameplay and
 * the main menu.
 *
 * The important 2026-03-24 change is that this modal now also exposes the same
 * Dev Mode state that used to feel separate from the main-menu entry point. That
 * keeps the "Dev Menu" launch surface and the actual "Dev Mode" switch tied to
 * the same UI instead of forcing the player to mentally model two unrelated systems.
 *
 * The 2026-03-25 follow-up change folds the old standalone "Quick Start (Dev)"
 * main-menu button into this shared modal. That keeps all developer-only entry
 * points in one surface instead of scattering them across the main menu.
 *
 * Called by: GameModals.tsx
 * Depends on: GameContext for direct dispatch-only tools, App.tsx for high-level
 * dev actions, and the central UI reducer for the actual Dev Mode state.
 */
import React from 'react';
import { GamePhase } from '../../types';
type DevMenuActionType = 'main_menu' | 'char_creator' | 'quick_start_dev' | 'save' | 'load' | 'toggle_log_viewer' | 'toggle_unified_log_viewer' | 'open_ai_provider_config' | 'combat_messaging_demo' | 'generate_encounter' | 'toggle_party_editor' | 'toggle_npc_test_plan' | 'inspect_noble_houses' | 'test_temple' | 'test_lockpicking' | 'test_dice_roller' | 'toggle_thieves_guild' | 'toggle_naval_dashboard' | 'toggle_trade_route_dashboard' | 'toggle_investment_board' | 'toggle_economy_ledger' | 'toggle_courier_pouch' | 'restart_dynamic_party';
interface DevMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onDevAction: (actionType: DevMenuActionType) => void;
    hasNewRateLimitError: boolean;
    currentModelOverride: string | null;
    onModelChange: (model: string | null) => void;
    isDevModeEnabled: boolean;
    onSetDevModeEnabled: (enabled: boolean) => void;
    gamePhase: GamePhase;
}
declare const DevMenu: React.FC<DevMenuProps>;
export default DevMenu;
