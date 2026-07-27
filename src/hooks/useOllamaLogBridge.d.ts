/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useOllamaLogBridge.ts
 *
 * Bridges the framework-agnostic Ollama log sink (emitted by OllamaClient for
 * every task call) into the reducer's `ollamaInteractionLog`, which the in-app
 * viewer renders. Mounted once at the app root so a single subscription mirrors
 * all AI calls. Because the client emits centrally, individual call sites no
 * longer log — this is the one place model traffic becomes viewer state.
 */
import type { AppAction } from '../state/actionTypes';
export declare function useOllamaLogBridge(dispatch: React.Dispatch<AppAction>): void;
