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

import { useEffect } from 'react';
import type { AppAction } from '../state/actionTypes';
import { subscribeOllamaLog } from '../services/ollama/ollamaLogSink';

export function useOllamaLogBridge(dispatch: React.Dispatch<AppAction>): void {
    useEffect(() => {
        return subscribeOllamaLog((event) => {
            if (event.phase === 'start') {
                dispatch({
                    type: 'ADD_OLLAMA_LOG_ENTRY',
                    payload: {
                        id: event.id,
                        timestamp: new Date(),
                        // Model isn't resolved yet at start; label with the task
                        // until the success/error update fills in the real model.
                        model: event.model ?? event.taskType,
                        prompt: event.prompt ?? '',
                        response: '',
                        isPending: true,
                        taskType: event.taskType,
                    },
                });
                return;
            }

            if (event.phase === 'success') {
                dispatch({
                    type: 'UPDATE_OLLAMA_LOG_ENTRY',
                    payload: { id: event.id, response: event.response ?? '', model: event.model },
                });
                return;
            }

            // error
            dispatch({
                type: 'UPDATE_OLLAMA_LOG_ENTRY',
                payload: {
                    id: event.id,
                    response: `ERROR: ${event.error ?? 'unknown failure'}`,
                    model: event.model,
                    isError: true,
                },
            });
        });
    }, [dispatch]);
}
