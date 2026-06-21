/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/ollamaLogSink.ts
 *
 * A tiny in-process pub/sub that lets the OllamaClient emit a log event for
 * every task call WITHOUT depending on React or the reducer dispatch. The app
 * subscribes once (see useOllamaLogBridge) and mirrors these events into the
 * in-app Ollama log viewer (Dev Menu -> Banter & AI Inspector -> Ollama Raw Logs).
 *
 * This is the single source of AI-call logging: every generateForTask /
 * chatForTask call emits `start` then exactly one of `success` | `error`. Call
 * sites no longer log individually, so the viewer can never silently miss a
 * task again (the gap that hid opening-situation failures).
 */

export type OllamaLogPhase = 'start' | 'success' | 'error';

export interface OllamaLogEvent {
    /** Correlates the `start` event with its later `success`/`error` update. */
    id: string;
    phase: OllamaLogPhase;
    /** The task profile that drove this call (e.g. 'opening_situation'). */
    taskType: string;
    /** The resolved model name. Absent on `start` (resolved after emit). */
    model?: string;
    /** Present on `start`: the full prompt (or serialized chat messages). */
    prompt?: string;
    /** Present on `success`: the raw model response text (parsed or not). */
    response?: string;
    /** Present on `error`: the failure reason (e.g. NO_MODEL, timeout). */
    error?: string;
}

type Listener = (event: OllamaLogEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to AI-call log events. Returns an unsubscribe function. */
export function subscribeOllamaLog(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Emit a log event to all subscribers. */
export function emitOllamaLog(event: OllamaLogEvent): void {
    // Isolate listeners: a logging-sink failure must never break AI generation.
    // This is observability plumbing, not a feature fallback path.
    for (const listener of listeners) {
        try {
            listener(event);
        } catch (err) {
            console.error('[ollama-log-sink] listener threw:', err);
        }
    }
}
