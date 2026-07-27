/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ai/textProviderRouter.ts
 *
 * The provider router. Every task-aware text call (generateForTask /
 * chatForTask) consults this before doing Ollama work: if the player has
 * chosen `groq`, the call is served by the Groq provider instead — adapted to
 * the identical return shape so callers never change.
 *
 * Logging is CENTRAL: the Groq path emits the same start/success/error events
 * through the same `emitOllamaLog` sink the Ollama client uses, so the in-app
 * AI log viewer shows Groq calls exactly like local ones. Call sites do not log
 * (that would double-log).
 *
 * NO-FALLBACK: with `groq` selected, a Groq failure is returned honestly; this
 * router never falls back to Ollama on error.
 */
import type { OllamaGenerateResponse, OllamaChatResponse, ResponseFormat, ModelParams, TaskType } from '../../types/ollama';
/** True when the active provider is Groq (drives whether the client delegates). */
export declare function isGroqActive(): boolean;
/**
 * Route a task-aware generate. Emits central log events (start + success/error)
 * for the Groq path, mirroring what OllamaClient.generateForTask emits for the
 * local path, so the viewer never misses a Groq call.
 */
export declare function routeGenerateForTask(options: {
    taskType: TaskType;
    prompt: string;
    format?: ResponseFormat;
    overrides?: ModelParams;
}): Promise<{
    ok: true;
    data: OllamaGenerateResponse;
    model: string;
} | {
    ok: false;
    error: string;
    model?: string;
}>;
/**
 * Route a task-aware chat. Same central-logging contract as
 * routeGenerateForTask, including serializing the chat turns as the logged
 * prompt (matching OllamaClient.chatForTask).
 */
export declare function routeChatForTask(options: {
    taskType: TaskType;
    messages: {
        role: string;
        content: string;
    }[];
    format?: ResponseFormat;
    overrides?: ModelParams;
}): Promise<{
    ok: true;
    data: OllamaChatResponse;
    model: string;
} | {
    ok: false;
    error: string;
    model?: string;
    statusCode?: number;
}>;
