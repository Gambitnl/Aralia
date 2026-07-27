/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ai/groqTextProvider.ts
 *
 * Groq (OpenAI-compatible cloud chat) text provider. It speaks the OpenAI
 * `/chat/completions` schema to Groq and ADAPTS every response back into the
 * exact shapes the OllamaClient's task-aware methods return, so the router can
 * swap it in without any caller changing.
 *
 * Returned shapes matched against the real OllamaClient interface:
 *   - generateForTask -> { ok: true; data: OllamaGenerateResponse; model }
 *                     |  { ok: false; error: string; model? }
 *   - chatForTask     -> { ok: true; data: OllamaChatResponse; model }
 *                     |  { ok: false; error: string; model?; statusCode? }
 *
 * NO-FALLBACK: when the player has chosen Groq, failures (missing key, 401,
 * rate limit, no network, unreachable proxy) surface honestly through the same
 * `{ ok: false }` error path — this module NEVER silently swaps back to Ollama.
 *
 * KEY-HANDLING MODES (chosen by the player, passed in via GroqCallContext):
 *   - local/session — the key comes from the browser store; we send it as
 *     `Authorization: Bearer <key>` to Groq's own endpoint.
 *   - proxy — the browser holds NO key; we POST keyless (no Authorization
 *     header) to a local OpenAI-compatible proxy URL, which injects the key
 *     server-side. XSS-proof for the key.
 *
 * SECURITY: the API key is passed in by the router from the browser store
 * (aiProviderSettings). It is never read from import.meta.env or the bundle,
 * and in proxy mode it never touches the browser at all.
 */
import type { OllamaGenerateResponse, OllamaChatResponse, ResponseFormat, ModelParams, TaskType } from '../../types/ollama';
/** Groq's OpenAI-compatible chat completions endpoint. */
export declare const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
/** Minimal shape of a successful OpenAI-compatible chat completion response. */
interface OpenAiChatCompletion {
    choices?: Array<{
        message?: {
            role?: string;
            content?: string;
        };
        finish_reason?: string;
    }>;
    error?: {
        message?: string;
        type?: string;
        code?: string;
    };
}
export interface GroqCallContext {
    /**
     * The API key for `local`/`session` modes. In `proxy` mode this is empty and
     * unused — the proxy injects the real key server-side.
     */
    apiKey: string;
    model: string;
    timeoutMs?: number;
    /**
     * Key-handling mode. Defaults to a direct Bearer call when omitted (matching
     * the original behavior). `proxy` sends a keyless request to {@link proxyUrl}.
     */
    keyStorage?: 'local' | 'session' | 'proxy';
    /**
     * Base URL of the local OpenAI-compatible proxy, used only in `proxy` mode.
     * `/chat/completions` is appended.
     */
    proxyUrl?: string;
}
/**
 * Resolve the endpoint URL and request headers for a call, branching on the
 * key-handling mode:
 *   - proxy — `${proxyUrl}/chat/completions`, NO Authorization header.
 *   - local/session (or unset) — Groq's own endpoint with `Bearer <apiKey>`.
 * Returns an error string when a mode's prerequisite is missing (no key for a
 * key-bearing mode, or no proxy URL for proxy mode) so the caller can fail
 * honestly without a network round-trip.
 */
export declare function resolveEndpoint(ctx: GroqCallContext): {
    ok: true;
    url: string;
    headers: Record<string, string>;
} | {
    ok: false;
    error: string;
};
/**
 * Extract the assistant text from an OpenAI-compatible completion. Exported so
 * the response-adaptation is independently unit-testable against a sample
 * payload.
 */
export declare function extractCompletionText(json: OpenAiChatCompletion): string;
/**
 * Adapt an OpenAI-compatible completion into the OllamaGenerateResponse shape
 * ({ response: string }).
 */
export declare function adaptToGenerateResponse(json: OpenAiChatCompletion): OllamaGenerateResponse;
/**
 * Adapt an OpenAI-compatible completion into the OllamaChatResponse shape
 * ({ message: { role, content }, done: true }).
 */
export declare function adaptToChatResponse(json: OpenAiChatCompletion): OllamaChatResponse;
/**
 * Task-aware generate via Groq. Mirrors OllamaClient.generateForTask's return
 * contract exactly. The single-prompt Ollama call is expressed to Groq as one
 * user message (matching how generate() folds system+prompt into `prompt`).
 */
export declare function groqGenerateForTask(ctx: GroqCallContext, options: {
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
 * Task-aware chat via Groq. Mirrors OllamaClient.chatForTask's return contract
 * exactly, including the optional statusCode on failure.
 */
export declare function groqChatForTask(ctx: GroqCallContext, options: {
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
export {};
