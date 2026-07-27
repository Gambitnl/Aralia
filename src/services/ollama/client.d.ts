/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/client.ts
 * HTTP client for Ollama API communication.
 */
import type { OllamaConfig, OllamaModel, OllamaGenerateResponse, OllamaChatResponse, OllamaError, OllamaMetadata, OllamaResult, ModelParams, ResponseFormat, TaskType } from '../../types/ollama';
/**
 * Low-level HTTP client for Ollama API.
 */
export declare class OllamaClient {
    private cachedModel;
    private cachedModelList;
    private cachedModelListTimestamp;
    /** Cache duration for `/tags` responses. Short enough that newly pulled
     * models become visible quickly, long enough to fold the
     * `isAvailable + resolveModel` sequence into a single fetch. */
    private static readonly MODEL_LIST_TTL_MS;
    private config;
    constructor(config?: Partial<OllamaConfig>);
    /**
     * Helper to perform fetch with a timeout.
     */
    private fetchWithTimeout;
    /**
     * Create a standardized error result.
     */
    createErrorResult<T>(error: OllamaError, metadata?: Partial<OllamaMetadata>): OllamaResult<T>;
    /**
     * Create a network error result.
     */
    createNetworkError<T>(message: string, prompt: string, model: string, id?: string): OllamaResult<T>;
    /**
     * Create a parse error result.
     */
    createParseError<T>(message: string, rawResponse: string, prompt: string, model: string, id?: string): OllamaResult<T>;
    /**
     * Handle caught errors and convert to OllamaResult.
     */
    handleError<T>(error: any, prompt: string, model: string, id?: string): OllamaResult<T>;
    /**
     * Checks if the Ollama service is reachable. Piggybacks on the cached
     * model list so a subsequent `resolveModel` call doesn't refetch `/tags`.
     */
    isAvailable(): Promise<boolean>;
    /**
     * Finds a suitable model, preferring faster/smaller ones for banter.
     */
    getModel(): Promise<string | null>;
    /**
     * Returns the full list of installed models, or null if the Ollama server
     * is unreachable. Used by the router to score against task-specific
     * preferred lists. Results are cached for MODEL_LIST_TTL_MS so back-to-back
     * isAvailable + resolveModel calls only hit /tags once.
     */
    listModels(): Promise<OllamaModel[] | null>;
    /**
     * Returns the global preferred-model fallback chain from this client's config.
     * Consumed by the router for tier-2 fallback after the task profile's own list.
     */
    getPreferredModels(): string[];
    /**
     * Resolve a model name for a given TaskType. Convenience wrapper around the
     * standalone `resolveModelForTask` to keep call sites tidy.
     */
    resolveModel(taskType: TaskType): Promise<string | null>;
    /**
     * Clear the cached model (useful for testing).
     */
    clearModelCache(): void;
    /**
     * Build the Ollama `options` object from ModelParams + legacy fields.
     * Only emits keys when callers (or task profiles) provided an explicit value,
     * so we don't silently override Ollama's per-model defaults.
     */
    private buildOptions;
    /**
     * Call the generate endpoint.
     */
    generate(options: {
        model: string;
        prompt: string;
        format?: ResponseFormat;
        temperature?: number;
        numPredict?: number;
        topP?: number;
        repeatPenalty?: number;
        numCtx?: number;
        keepAlive?: string | number;
    }): Promise<{
        ok: true;
        data: OllamaGenerateResponse;
    } | {
        ok: false;
        error: string;
    }>;
    /**
     * Call the chat endpoint.
     */
    chat(options: {
        model: string;
        messages: {
            role: string;
            content: string;
        }[];
        format?: ResponseFormat;
        temperature?: number;
        numPredict?: number;
        topP?: number;
        repeatPenalty?: number;
        numCtx?: number;
        keepAlive?: string | number;
    }): Promise<{
        ok: true;
        data: OllamaChatResponse;
    } | {
        ok: false;
        error: string;
        statusCode?: number;
    }>;
    /**
     * Task-aware generate. Resolves the model via the router and merges the
     * task profile's params with the caller's overrides (overrides win).
     *
     * Returns `{ ok: false, error: 'NO_MODEL' }` if no installed model matched.
     */
    generateForTask(options: {
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
     * Task-aware chat. Same semantics as generateForTask but for /chat endpoint.
     */
    chatForTask(options: {
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
}
export declare function getDefaultClient(): OllamaClient;
export declare function resetDefaultClient(): void;
