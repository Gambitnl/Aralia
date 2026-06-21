/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/client.ts
 * HTTP client for Ollama API communication.
 */

import type {
    OllamaConfig,
    OllamaModel,
    OllamaGenerateResponse,
    OllamaChatResponse,
    OllamaError,
    OllamaMetadata,
    OllamaResult,
    ModelParams,
    ResponseFormat,
    TaskType
} from '../../types/ollama';
import { DEFAULT_OLLAMA_CONFIG } from '../../types/ollama';
import { getTaskProfile } from './taskProfiles';
import { resolveModelForTask, resetRouterCache } from './router';
import { emitOllamaLog } from './ollamaLogSink';
import { generateId } from '../../utils/core/idGenerator';

/**
 * Low-level HTTP client for Ollama API.
 */
export class OllamaClient {
    private cachedModel: string | null = null;
    private cachedModelList: OllamaModel[] | null = null;
    private cachedModelListTimestamp = 0;
    /** Cache duration for `/tags` responses. Short enough that newly pulled
     * models become visible quickly, long enough to fold the
     * `isAvailable + resolveModel` sequence into a single fetch. */
    private static readonly MODEL_LIST_TTL_MS = 60_000;
    private config: OllamaConfig;

    constructor(config: Partial<OllamaConfig> = {}) {
        this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config };
    }

    /**
     * Helper to perform fetch with a timeout.
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeoutMs: number = this.config.timeoutMs
    ): Promise<Response> {
        const startTime = Date.now();
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error: any) {
            clearTimeout(id);
            const elapsed = Date.now() - startTime;
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${elapsed}ms (timeout set to ${timeoutMs}ms).`);
            }
            throw error;
        }
    }

    /**
     * Create a standardized error result.
     */
    createErrorResult<T>(
        error: OllamaError,
        metadata?: Partial<OllamaMetadata>
    ): OllamaResult<T> {
        return {
            success: false,
            error,
            metadata: metadata ? {
                prompt: metadata.prompt || '',
                response: metadata.response,
                model: metadata.model || 'unknown',
                id: metadata.id
            } : undefined
        };
    }

    /**
     * Create a network error result.
     */
    createNetworkError<T>(
        message: string,
        prompt: string,
        model: string,
        id?: string
    ): OllamaResult<T> {
        return this.createErrorResult<T>(
            { type: 'NETWORK_ERROR', message },
            { prompt, response: `[NETWORK ERROR] ${message}`, model, id }
        );
    }

    /**
     * Create a parse error result.
     */
    createParseError<T>(
        message: string,
        rawResponse: string,
        prompt: string,
        model: string,
        id?: string
    ): OllamaResult<T> {
        return this.createErrorResult<T>(
            { type: 'PARSE_ERROR', message, rawResponse },
            { prompt, response: `[PARSE ERROR] ${rawResponse}`, model, id }
        );
    }

    /**
     * Handle caught errors and convert to OllamaResult.
     */
    handleError<T>(
        error: any,
        prompt: string,
        model: string,
        id?: string
    ): OllamaResult<T> {
        const errorType = (error.message && error.message.includes('timed out')) ? 'TIMEOUT' : 'UNKNOWN';
        const errorMessage = error.message || String(error);
        return this.createErrorResult<T>(
            { type: errorType, message: errorMessage },
            { prompt, response: `[${errorType} ERROR] ${errorMessage}`, model, id }
        );
    }

    /**
     * Checks if the Ollama service is reachable. Piggybacks on the cached
     * model list so a subsequent `resolveModel` call doesn't refetch `/tags`.
     */
    async isAvailable(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        const models = await this.listModels();
        // The dev proxy returns an empty list when Ollama is not running so the
        // startup heartbeat can fail as a normal optional-dependency state
        // instead of a browser-visible 500. A reachable server with no usable
        // models should still open the setup modal, so availability requires at
        // least one installed model.
        return models !== null && models.length > 0;
    }

    /**
     * Finds a suitable model, preferring faster/smaller ones for banter.
     */
    async getModel(): Promise<string | null> {
        if (this.cachedModel) return this.cachedModel;
        try {
            const res = await fetch(`${this.config.apiBase}/tags`);
            if (!res.ok) return null;

            const data = await res.json() as { models: OllamaModel[] };

            for (const p of this.config.preferredModels) {
                const found = data.models.find(m => m.name.includes(p));
                if (found) {
                    this.cachedModel = found.name;
                    return found.name;
                }
            }

            // Fallback to first available if none of the preferred match
            if (data.models.length > 0) {
                this.cachedModel = data.models[0].name;
                return this.cachedModel;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Returns the full list of installed models, or null if the Ollama server
     * is unreachable. Used by the router to score against task-specific
     * preferred lists. Results are cached for MODEL_LIST_TTL_MS so back-to-back
     * isAvailable + resolveModel calls only hit /tags once.
     */
    async listModels(): Promise<OllamaModel[] | null> {
        const now = Date.now();
        if (
            this.cachedModelList !== null &&
            now - this.cachedModelListTimestamp < OllamaClient.MODEL_LIST_TTL_MS
        ) {
            return this.cachedModelList;
        }
        try {
            const res = await fetch(`${this.config.apiBase}/tags`);
            if (!res.ok) return null;
            const data = await res.json() as { models: OllamaModel[] };
            const models = Array.isArray(data.models) ? data.models : [];
            this.cachedModelList = models;
            this.cachedModelListTimestamp = now;
            return models;
        } catch {
            return null;
        }
    }

    /**
     * Returns the global preferred-model fallback chain from this client's config.
     * Consumed by the router for tier-2 fallback after the task profile's own list.
     */
    getPreferredModels(): string[] {
        return this.config.preferredModels;
    }

    /**
     * Resolve a model name for a given TaskType. Convenience wrapper around the
     * standalone `resolveModelForTask` to keep call sites tidy.
     */
    async resolveModel(taskType: TaskType): Promise<string | null> {
        return resolveModelForTask(this, taskType);
    }

    /**
     * Clear the cached model (useful for testing).
     */
    clearModelCache(): void {
        this.cachedModel = null;
        this.cachedModelList = null;
        this.cachedModelListTimestamp = 0;
    }

    /**
     * Build the Ollama `options` object from ModelParams + legacy fields.
     * Only emits keys when callers (or task profiles) provided an explicit value,
     * so we don't silently override Ollama's per-model defaults.
     */
    private buildOptions(params: ModelParams & { temperature?: number; numPredict?: number }) {
        const out: Record<string, unknown> = {};
        if (params.temperature !== undefined) out.temperature = params.temperature;
        if (params.numPredict !== undefined) out.num_predict = params.numPredict;
        if (params.topP !== undefined) out.top_p = params.topP;
        if (params.repeatPenalty !== undefined) out.repeat_penalty = params.repeatPenalty;
        if (params.numCtx !== undefined) out.num_ctx = params.numCtx;
        return out;
    }

    /**
     * Call the generate endpoint.
     */
    async generate(options: {
        model: string;
        prompt: string;
        format?: ResponseFormat;
        temperature?: number;
        numPredict?: number;
        topP?: number;
        repeatPenalty?: number;
        numCtx?: number;
        keepAlive?: string | number;
    }): Promise<{ ok: true; data: OllamaGenerateResponse } | { ok: false; error: string }> {
        try {
            const ollamaOptions = this.buildOptions({
                temperature: options.temperature ?? 0.7,
                numPredict: options.numPredict ?? 256,
                topP: options.topP,
                repeatPenalty: options.repeatPenalty,
                numCtx: options.numCtx
            });

            const body: Record<string, unknown> = {
                model: options.model,
                prompt: options.prompt,
                format: options.format,
                stream: false,
                options: ollamaOptions
            };
            if (options.keepAlive !== undefined) body.keep_alive = options.keepAlive;

            const res = await this.fetchWithTimeout(`${this.config.apiBase}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                return { ok: false, error: `Ollama generate failed: ${res.statusText}` };
            }

            const data = await res.json() as OllamaGenerateResponse;
            return { ok: true, data };
        } catch (error: any) {
            return { ok: false, error: error.message || String(error) };
        }
    }

    /**
     * Call the chat endpoint.
     */
    async chat(options: {
        model: string;
        messages: { role: string; content: string }[];
        format?: ResponseFormat;
        temperature?: number;
        numPredict?: number;
        topP?: number;
        repeatPenalty?: number;
        numCtx?: number;
        keepAlive?: string | number;
    }): Promise<{ ok: true; data: OllamaChatResponse } | { ok: false; error: string; statusCode?: number }> {
        try {
            const ollamaOptions = this.buildOptions({
                temperature: options.temperature ?? 0.7,
                numPredict: options.numPredict ?? 256,
                topP: options.topP,
                repeatPenalty: options.repeatPenalty,
                numCtx: options.numCtx
            });

            const body: Record<string, unknown> = {
                model: options.model,
                messages: options.messages,
                format: options.format,
                stream: false,
                options: ollamaOptions
            };
            if (options.keepAlive !== undefined) body.keep_alive = options.keepAlive;

            const res = await this.fetchWithTimeout(`${this.config.apiBase}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                return {
                    ok: false,
                    error: `Error ${res.status}: ${res.statusText}\n${errorText}`,
                    statusCode: res.status
                };
            }

            const data = await res.json() as OllamaChatResponse;
            return { ok: true, data };
        } catch (error: any) {
            return { ok: false, error: error.message || String(error) };
        }
    }

    /**
     * Task-aware generate. Resolves the model via the router and merges the
     * task profile's params with the caller's overrides (overrides win).
     *
     * Returns `{ ok: false, error: 'NO_MODEL' }` if no installed model matched.
     */
    async generateForTask(options: {
        taskType: TaskType;
        prompt: string;
        format?: ResponseFormat;
        overrides?: ModelParams;
    }): Promise<
        | { ok: true; data: OllamaGenerateResponse; model: string }
        | { ok: false; error: string; model?: string }
    > {
        const profile = getTaskProfile(options.taskType);
        // Emit the attempt to the central log sink so every task is visible in
        // the in-app Ollama viewer without each call site logging individually.
        const logId = generateId();
        emitOllamaLog({ id: logId, phase: 'start', taskType: options.taskType, prompt: options.prompt });

        const model = await this.resolveModel(options.taskType);
        if (!model) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, error: 'NO_MODEL' });
            return { ok: false, error: 'NO_MODEL' };
        }

        const merged: ModelParams = { ...profile.params, ...(options.overrides ?? {}) };
        const result = await this.generate({
            model,
            prompt: options.prompt,
            format: options.format ?? profile.format,
            temperature: merged.temperature,
            numPredict: merged.numPredict,
            topP: merged.topP,
            repeatPenalty: merged.repeatPenalty,
            numCtx: merged.numCtx,
            keepAlive: merged.keepAlive ?? profile.keepAlive
        });

        if (!result.ok) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model, error: result.error });
            return { ok: false, error: result.error, model };
        }
        // A successful transport call logs the RAW response — even when a caller
        // later fails to parse it (e.g. opening_situation at high temperature),
        // the unparseable output is captured here for diagnosis.
        emitOllamaLog({ id: logId, phase: 'success', taskType: options.taskType, model, response: result.data.response });
        return { ok: true, data: result.data, model };
    }

    /**
     * Task-aware chat. Same semantics as generateForTask but for /chat endpoint.
     */
    async chatForTask(options: {
        taskType: TaskType;
        messages: { role: string; content: string }[];
        format?: ResponseFormat;
        overrides?: ModelParams;
    }): Promise<
        | { ok: true; data: OllamaChatResponse; model: string }
        | { ok: false; error: string; model?: string; statusCode?: number }
    > {
        const profile = getTaskProfile(options.taskType);
        const logId = generateId();
        // Serialize the chat turns as the logged "prompt" so chat tasks show
        // their full input in the viewer like generate tasks do.
        const promptForLog = options.messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');
        emitOllamaLog({ id: logId, phase: 'start', taskType: options.taskType, prompt: promptForLog });

        const model = await this.resolveModel(options.taskType);
        if (!model) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, error: 'NO_MODEL' });
            return { ok: false, error: 'NO_MODEL' };
        }

        const merged: ModelParams = { ...profile.params, ...(options.overrides ?? {}) };
        const result = await this.chat({
            model,
            messages: options.messages,
            format: options.format ?? profile.format,
            temperature: merged.temperature,
            numPredict: merged.numPredict,
            topP: merged.topP,
            repeatPenalty: merged.repeatPenalty,
            numCtx: merged.numCtx,
            keepAlive: merged.keepAlive ?? profile.keepAlive
        });

        if (!result.ok) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model, error: result.error });
            return { ok: false, error: result.error, model, statusCode: result.statusCode };
        }
        emitOllamaLog({ id: logId, phase: 'success', taskType: options.taskType, model, response: result.data.message?.content ?? '' });
        return { ok: true, data: result.data, model };
    }
}

// Singleton instance for backward compatibility
let defaultClient: OllamaClient | null = null;

export function getDefaultClient(): OllamaClient {
    if (!defaultClient) {
        defaultClient = new OllamaClient();
    }
    return defaultClient;
}

export function resetDefaultClient(): void {
    defaultClient = null;
    // Also flush the router cache — its TaskType→model entries reference the
    // previous client's resolved model and shouldn't survive a reset.
    resetRouterCache();
}
