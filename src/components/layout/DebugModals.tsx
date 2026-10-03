/**
 * @file DebugModals.tsx
 * Categorized modal manager for developer/debug tooling, extracted from
 * `GameModals.tsx` (GG-20, first extraction as proof-of-pattern).
 *
 * Owns the dev-mode overlays and dev-tool modals that are only reachable in
 * dev mode or behind the Dev Tools gate, so the central `GameModals` component
 * no longer carries their lazy imports, focus-trap refs, and render blocks.
 *
 * Behavior is preserved verbatim: each block below was moved unchanged from
 * `GameModals.tsx`. The only intentional difference is that the four open-state
 * booleans (`isDevMenuModalOpen`, `isGeminiLogViewerOpen`,
 * `isUnifiedDebugLogViewerOpen`, `isNpcTestModalOpen`) are recomputed locally
 * from `gameState` here; `GameModals` still computes the same four booleans
 * independently to feed its background-scroll-lock effect.
 */
import React, { lazy, Suspense } from 'react';
import { GameState, Action, GamePhase } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { canUseDevTools } from '../../utils/core';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const DevMenu = lazy(() => import('../debug/DevMenu'));
const AgentSimDevOverlay = lazy(() => import('../debug/AgentSimDevOverlay'));
const TownHistoryDevOverlay = lazy(() => import('../debug/TownHistoryDevOverlay'));
const PartyEditorModal = lazy(() => import('../Party/PartyEditorModal'));
const GeminiLogViewer = lazy(() => import('../debug/GeminiLogViewer'));
const UnifiedDebugLogViewer = lazy(() => import('../debug/UnifiedDebugLogViewer').then(module => ({ default: module.UnifiedDebugLogViewer })));
const NpcInteractionTestModal = lazy(() => import('../debug/NpcInteractionTestModal'));
const NobleHouseList = lazy(() => import('../debug/NobleHouseList'));

interface DebugModalsProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    onAction: (action: Action) => void;
    handleDevMenuAction: (action: string) => void;
    handleModelChange: (model: string | null) => void;
    isBanterPaused?: boolean;
    toggleBanterPause?: () => void;
    onClearBanterLogs?: () => void;
    onForceBanterTrigger?: () => void;
}

const DebugModals: React.FC<DebugModalsProps> = ({
    gameState,
    dispatch,
    onAction,
    handleDevMenuAction,
    handleModelChange,
    isBanterPaused,
    toggleBanterPause,
    onClearBanterLogs,
    onForceBanterTrigger,
}) => {
    // Open-state booleans are recomputed locally for rendering. `GameModals`
    // keeps its own copies for the background-scroll-lock effect; the two are
    // trivially derivable from `gameState` and must stay in agreement.
    const isDevMenuModalOpen = Boolean(gameState.isDevMenuVisible && canUseDevTools());
    const isGeminiLogViewerOpen = gameState.isGeminiLogViewerVisible;
    const isUnifiedDebugLogViewerOpen = gameState.isUnifiedLogViewerVisible;
    const isNpcTestModalOpen = gameState.isNpcTestModalVisible;

    const devMenuFocusRef = useFocusTrap<HTMLDivElement>(isDevMenuModalOpen);
    const geminiLogFocusRef = useFocusTrap<HTMLDivElement>(isGeminiLogViewerOpen);
    const unifiedDebugLogFocusRef = useFocusTrap<HTMLDivElement>(isUnifiedDebugLogViewerOpen);
    const npcInteractionTestFocusRef = useFocusTrap<HTMLDivElement>(isNpcTestModalOpen);

    return (
        <>
            {/* Developer Tools Menu */}
            {isDevMenuModalOpen && (
                <div key="devmenu" ref={devMenuFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Developer Menu.">
                            <DevMenu
                                isOpen={gameState.isDevMenuVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                                onDevAction={handleDevMenuAction}
                                hasNewRateLimitError={gameState.hasNewRateLimitError}
                                currentModelOverride={gameState.devModelOverride}
                                onModelChange={handleModelChange}
                                isDevModeEnabled={gameState.isDevModeEnabled}
                                onSetDevModeEnabled={(enabled) => dispatch({ type: 'SET_DEV_MODE_ENABLED', payload: enabled })}
                                gamePhase={gameState.phase}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Agent-sim live dev overlay (dev mode, in-game only) — demo burg on the game clock. */}
            {/* Developer inspectors stay available during ordinary exploration, but
                disappear while a conversation owns the lower-right interaction area.
                Their fixed buttons otherwise sit over the player's Send button and make
                the opening scene look interactive while blocking pointer submission. */}
            {gameState.isDevModeEnabled && gameState.phase === GamePhase.PLAYING && !gameState.activeConversation && (
                <Suspense key="agentsim" fallback={null}>
                    <ErrorBoundary fallbackMessage="Error in Agent Sim overlay.">
                        <AgentSimDevOverlay />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Town-history live dev overlay (dev mode, in-game only) — the living-world chronicle of the town the player is standing in. */}
            {/* The town-history inspector follows the same ownership rule as the
                agent-sim inspector so neither debug control competes with dialogue. */}
            {gameState.isDevModeEnabled && gameState.phase === GamePhase.PLAYING && !gameState.activeConversation && (
                <Suspense key="townhistory" fallback={null}>
                    <ErrorBoundary fallbackMessage="Error in Town History overlay.">
                        <TownHistoryDevOverlay />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Party Editor (Dev Tool) */}
            {gameState.isPartyEditorVisible && canUseDevTools() && (
                <Suspense key="partyeditor" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Party Editor.">
                        <PartyEditorModal
                            isOpen={gameState.isPartyEditorVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' })}
                            initialParty={gameState.party}
                            onSave={(newParty) => dispatch({ type: 'SET_PARTY_COMPOSITION', payload: newParty })}
                            // WHAT CHANGED: Added onSaveFullParty callback.
                            // WHY IT CHANGED: To support deep cloning of premade characters
                            // (preserving custom spells/gear) during party editing.
                            // SET_FULL_PARTY in characterReducer handles the heavy lifting,
                            // and this exposes that logic to the dev tool interface.
                            onSaveFullParty={(fullParty) => dispatch({ type: 'SET_FULL_PARTY', payload: fullParty })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* AI Log Viewer (Dev Tool) */}
            {isGeminiLogViewerOpen && (
                <div key="geminilog" ref={geminiLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Gemini Log Viewer.">
                            <GeminiLogViewer
                                isOpen={gameState.isGeminiLogViewerVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
                                logEntries={gameState.geminiInteractionLog}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Unified Debug Log Viewer (Dev Tool) */}
            {isUnifiedDebugLogViewerOpen && (
                <div key="unifiedlog" ref={unifiedDebugLogFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in Unified Log Viewer.">
                            <UnifiedDebugLogViewer
                                isOpen={gameState.isUnifiedLogViewerVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_UNIFIED_LOG_VIEWER' })}
                                banterLogs={gameState.banterDebugLog || []}
                                onClearBanterLogs={onClearBanterLogs || (() => dispatch({ type: 'CLEAR_BANTER_DEBUG_LOG' }))}
                                onForceBanterTrigger={onForceBanterTrigger}
                                ollamaLogs={gameState.ollamaInteractionLog}
                                isBanterPaused={isBanterPaused}
                                onToggleBanterPause={toggleBanterPause}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* NPC AI Test Modal (Dev Tool) */}
            {isNpcTestModalOpen && canUseDevTools() && (
                <div key="npctest" ref={npcInteractionTestFocusRef} tabIndex={-1}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <ErrorBoundary fallbackMessage="Error in NPC Test Plan Modal.">
                            <NpcInteractionTestModal
                                isOpen={gameState.isNpcTestModalVisible}
                                onClose={() => dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' })}
                                onAction={onAction}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            )}

            {/* Noble House List (Dev Tool) */}
            {gameState.isNobleHouseListVisible && (
                <Suspense key="noblehouse" fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying Noble Houses.">
                        <NobleHouseList
                            worldSeed={gameState.worldSeed}
                            onClose={() => dispatch({ type: 'TOGGLE_NOBLE_HOUSE_LIST' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}
        </>
    );
};

export default DebugModals;
