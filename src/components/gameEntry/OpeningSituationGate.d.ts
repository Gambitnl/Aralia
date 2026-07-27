/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 08:20:56
 * Dependents: App.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
 *  - `model-unavailable` → the honest Ollama dependency block + a retry button.
 *                          NO canned scene is ever substituted (D-NOFB).
 *
 * Once `in-situation`, the seeded conversation (ConversationPanel) carries the
 * experience and this gate renders nothing.
 */
import React from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { type UseOpeningSituationOptions } from '../../hooks/useOpeningSituation';
interface OpeningSituationGateProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    /** Test seam: inject the situation generator. */
    options?: UseOpeningSituationOptions;
}
export declare const OpeningSituationGate: React.FC<OpeningSituationGateProps>;
export default OpeningSituationGate;
