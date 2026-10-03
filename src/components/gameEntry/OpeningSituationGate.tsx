// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/08/2026, 03:08:26
 * Dependents: App.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/gameEntry/OpeningSituationGate.tsx
 *
 * Drives the opening-situation entry flow on PLAYING entry and renders its
 * transient surfaces:
 *  - `generating`        → a non-blocking "the world is taking shape…" overlay so
 *                          the player never sees a blank PLAYING frame.
 *  - `model-unavailable` → the honest Ollama dependency block, provider choice,
 *                          developer logs access, and a retry button.
 *                          NO canned scene is ever substituted (D-NOFB).
 *
 * Once `in-situation`, the seeded conversation (ConversationPanel) carries the
 * experience and this gate renders nothing.
 */

import React, { useEffect, useState } from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { useOpeningSituation, type UseOpeningSituationOptions } from '../../hooks/useOpeningSituation';
import { OllamaDependencyModal } from '../ui/OllamaDependencyModal';
import { Button } from '../ui/Button';

interface OpeningSituationGateProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    /** Persist the player's request to suppress automatic Ollama warnings. */
    onOllamaDontShowAgain?: (value: boolean) => void;
    /** Test seam: inject the situation generator. */
    options?: UseOpeningSituationOptions;
}

// ============================================================================
// Main Gate Component
// ============================================================================
// This component manages the opening scene overlay. If an AI model is writing
// the scene, it shows a subtle banner. If the model is offline, it provides
// an honest explanation with options to switch AI providers, retry, or
// continue straight into the game world to explore immediately.
// ============================================================================

export const OpeningSituationGate: React.FC<OpeningSituationGateProps> = ({
    gameState,
    dispatch,
    onOllamaDontShowAgain,
    options,
}) => {
    useOpeningSituation(gameState, dispatch, options);

    const status = gameState.gameEntry?.status ?? 'idle';
    // The general provider pane is normally suppressed while this gate owns the
    // screen. Keep a private copy closed until the player explicitly asks for it,
    // so an automatic Ollama warning cannot recreate the old stacked-window bug.
    const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);

    // While the gate owns the entry screen (generating / model-unavailable) it is
    // the single Ollama-status surface. Clear any co-occurring GLOBAL
    // OllamaDependencyModal (driven by useOllamaCheck) so the player never sees two
    // stacked windows, and so dismissing the block can't reveal a stale one. The
    // global modal resumes for all non-entry Ollama use.
    const gateOwnsScreen = status === 'generating' || status === 'model-unavailable';
    useEffect(() => {
        if (gateOwnsScreen && gameState.isOllamaDependencyModalVisible) {
            dispatch({ type: 'HIDE_OLLAMA_DEPENDENCY_MODAL' });
        }
    }, [gateOwnsScreen, gameState.isOllamaDependencyModalVisible, dispatch]);

    // Skip the opening generation and jump directly into gameplay exploration.
    const skipOpening = () => {
        setIsProviderMenuOpen(false);
        dispatch({ type: 'SKIP_OPENING_SITUATION' });
    };

    // Retry opening generation (e.g. after changing provider or restarting model).
    const retryOpening = () => {
        setIsProviderMenuOpen(false);
        dispatch({ type: 'BEGIN_OPENING_SITUATION' });
    };

    // When the opening scene is generating, display a non-blocking top banner
    // with an optional skip button so the player is never trapped waiting.
    if (status === 'generating') {
        return (
            <div
                data-testid="opening-situation-generating"
                className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none p-3"
            >
                <div className="pointer-events-auto bg-gray-900/90 border border-amber-500/50 rounded-full px-5 py-2 text-amber-200 text-sm shadow-lg flex items-center gap-3">
                    <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                    <span>The world is taking shape around you…</span>
                    <button
                        type="button"
                        data-testid="opening-situation-generating-skip"
                        onClick={skipOpening}
                        className="ml-2 text-xs text-amber-300 hover:text-amber-100 underline focus:outline-none"
                    >
                        Skip to Exploration →
                    </button>
                </div>
            </div>
        );
    }

    // When local AI is unreachable or fails to generate, present an honest modal
    // with clear recovery choices, including continuing directly into the game.
    if (status === 'model-unavailable') {
        return (
            <div
                data-testid="opening-situation-unavailable"
                className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none p-4"
            >
                <div className="pointer-events-auto bg-gray-900 border border-amber-500/60 rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-100">
                    <h2 className="text-lg font-bold text-amber-300 mb-2">The opening can&apos;t be written yet</h2>
                    <p className="text-sm text-gray-300 mb-2">
                        Aralia can generate a customized opening scene using a local AI model (Ollama).
                        That model isn&apos;t reachable right now, but you can jump straight into the world
                        and explore freely, or configure another provider.
                    </p>
                    {gameState.gameEntry?.error && (
                        <p className="text-xs text-gray-400 mb-4 break-words">
                            Details: {gameState.gameEntry.error}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        {/* Developer menu for diagnostics, prompts, and logs */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            data-testid="opening-situation-dev-menu"
                            onClick={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                            className="min-h-11"
                        >
                            Dev Menu
                        </Button>
                        {/* Provider selection pane (Ollama / Cloud providers) */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            data-testid="opening-situation-choose-llm"
                            onClick={() => setIsProviderMenuOpen(true)}
                            className="min-h-11 border-sky-500/70 text-sky-100"
                        >
                            Choose LLM
                        </Button>
                        {/* Retry generation button */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            data-testid="opening-situation-retry"
                            onClick={retryOpening}
                            className="min-h-11"
                        >
                            Retry
                        </Button>
                        {/* Continue straight to the game world without AI scene */}
                        <Button
                            type="button"
                            variant="action"
                            size="md"
                            data-testid="opening-situation-skip"
                            onClick={skipOpening}
                            className="min-h-11"
                        >
                            Continue to World →
                        </Button>
                    </div>
                </div>

                {/* Shared provider modal for configuring alternative LLMs */}
                <OllamaDependencyModal
                    isOpen={isProviderMenuOpen}
                    onClose={() => setIsProviderMenuOpen(false)}
                    onDontShowAgain={onOllamaDontShowAgain ?? (() => {})}
                    isDevModeEnabled={gameState.isDevModeEnabled}
                    onProviderChanged={retryOpening}
                />
            </div>
        );
    }

    return null;
};

export default OpeningSituationGate;
