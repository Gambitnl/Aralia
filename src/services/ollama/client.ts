/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/client.ts
 * HTTP client for Ollama API communication.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 28/10/2026, 22:00:50
 * Dependents: components/ui/OllamaModelPicker.tsx, services/CompanionGenerator.ts, services/ollama/banter.ts, services/ollama/conversation.ts, services/ollama/facts.ts, services/ollama/index.ts, services/ollama/reaction.ts, services/ollama/router.ts, services/ollamaTextService.ts, systems/gameEntry/generateOpeningSituation.ts, systems/gameEntry/resolveDeEscalationIntent.ts, systems/intent/resolvePlayerIntent.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { resolveOllamaModel, getOllamaComputeMode } from '../ai/aiProviderSettings';
import { emitOllamaLog } from './ollamaLogSink';
import { generateId } from '../../utils/core/idGenerator';
import { isGroqActive, routeGenerateForTask, routeChatForTask } from '../ai/textProviderRouter';
import { hasGroqApiKey } from '../ai/aiProviderSettings';

/** Result of preparing one selected local model without creating model prose. */
export type ModelPreparationResult =
    | { status: 'ready'; model: string }
    | { status: 'not-required'; provider: 'groq' }
    | { status: 'cancelled'; model?: string }
    | { status: 'error'; error: string; model?: string };

interface SharedModelPreparation {
    key: string;
    controller: AbortController;
    waiters: number;
    settled: boolean;
    promise: Promise<ModelPreparationResult>;
}

const modelPreparations = new Map<string, SharedModelPreparation>();
const MODEL_PREPARATION_TIMEOUT_MS = 300_000;

function waitForSignal<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return work;
    if (signal.aborted) return Promise.reject(new DOMException('Request cancelled.', 'AbortError'));
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Request cancelled.', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        work.then(
            value => { signal.removeEventListener('abort', onAbort); resolve(value); },
            error => { signal.removeEventListener('abort', onAbort); reject(error); },
        );
    });
}

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
        // An optional greeting can stop being relevant before the provider's
        // timeout. Cancel its network work as well as ignoring its late words.
        const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal
            });
            clearTimeout(id);
            return response;
        } catch (error: any) {
            clearTimeout(id);
            const elapsed = Date.now() - startTime;
            if (error.name === 'AbortError') {
                if (options.signal?.aborted) throw new Error('Request cancelled.');
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
        // When Groq is the active text provider, "available" means a key is
        // present (per spec: no /tags probe, no silent fallback). The first real
        // call surfaces bad-key/rate-limit failures honestly.
        if (isGroqActive()) {
            return hasGroqApiKey();
        }
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
        // agora-d1c7.1: the generic model is the 'utility' category's ONE model
        // (player choice or default). No preference walk, no first-installed
        // last resort: a missing model is reported and null is returned.
        if (this.cachedModel) return this.cachedModel;
        const wanted = resolveOllamaModel('utility');
        const installed = await this.listModels();
        if (!installed) return null;
        const found = installed.find(m => m.name === wanted || m.name.startsWith(wanted + ':') || m.name === wanted + ':latest');
        if (!found) {
            console.error(`Ollama model "${wanted}" (utility) is not installed. Pick an installed model in AI settings or run: ollama pull ${wanted}`);
            return null;
        }
        this.cachedModel = found.name;
        return found.name;
    }

    async listModels(options: { signal?: AbortSignal } = {}): Promise<OllamaModel[] | null> {
        const signal = options.signal;
        if (signal?.aborted) return null;
        const now = Date.now();
        if (
            this.cachedModelList !== null &&
            now - this.cachedModelListTimestamp < OllamaClient.MODEL_LIST_TTL_MS
        ) {
            return this.cachedModelList;
        }
        try {
            const res = await fetch(`${this.config.apiBase}/tags`, signal ? { signal } : undefined);
            if (!res.ok) return null;
            const data = await waitForSignal(res.json() as Promise<{ models: OllamaModel[] }>, signal);
            if (signal?.aborted) return null;
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
    async resolveModel(taskType: TaskType, options: { signal?: AbortSignal } = {}): Promise<string | null> {
        return resolveModelForTask(this, taskType, options);
    }

    /**
     * Load the selected local model only when a player starts a typed dialogue
     * turn. The empty prompt returns no NPC words; the task's context and compute
     * choices are preserved, and concurrent matching requests share one load.
     */
    async prepareForTask(
        taskType: TaskType,
        options: { signal?: AbortSignal } = {},
    ): Promise<ModelPreparationResult> {
        if (isGroqActive()) return { status: 'not-required', provider: 'groq' };
        if (options.signal?.aborted) return { status: 'cancelled' };

        const stageController = new AbortController();
        let timedOut = false;
        const abortFromCaller = () => stageController.abort();
        options.signal?.addEventListener('abort', abortFromCaller, { once: true });
        const timeoutId = setTimeout(() => {
            timedOut = true;
            stageController.abort();
        }, MODEL_PREPARATION_TIMEOUT_MS);
        try {
            return await waitForSignal(this.prepareForTaskWithin(taskType, stageController.signal), stageController.signal);
        } catch (error) {
            if (timedOut) {
                const message = `Ollama model preparation timed out after ${MODEL_PREPARATION_TIMEOUT_MS}ms.`;
                this.logPreparationFailure(taskType, message);
                return { status: 'error', error: message };
            }
            if (options.signal?.aborted || stageController.signal.aborted) return { status: 'cancelled' };
            const message = error instanceof Error ? error.message : String(error);
            this.logPreparationFailure(taskType, message);
            return { status: 'error', error: message };
        } finally {
            clearTimeout(timeoutId);
            options.signal?.removeEventListener('abort', abortFromCaller);
        }
    }

    private async prepareForTaskWithin(taskType: TaskType, signal: AbortSignal): Promise<ModelPreparationResult> {

        const profile = getTaskProfile(taskType);
        let model: string | null;
        try {
            model = await waitForSignal(this.resolveModel(taskType, { signal }), signal);
        } catch (error) {
            if (signal.aborted) return { status: 'cancelled' };
            const message = error instanceof Error ? error.message : String(error);
            this.logPreparationFailure(taskType, message);
            return { status: 'error', error: message };
        }
        if (signal.aborted) return { status: 'cancelled', model: model ?? undefined };
        if (!model) {
            this.logPreparationFailure(taskType, 'NO_MODEL');
            return { status: 'error', error: 'NO_MODEL' };
        }

        const computeMode = getOllamaComputeMode(profile.category);
        const numGpu = computeMode === 'cpu' ? 0 : undefined;
        const numCtx = profile.params.numCtx;
        const key = JSON.stringify(['ollama', this.config.apiBase, model, numCtx, computeMode]);
        let shared = modelPreparations.get(key);

        // A canceled transport is allowed to settle before a deliberate retry
        // starts another load for the same model.
        if (shared?.controller.signal.aborted && !shared.settled) {
            try {
                await waitForSignal(shared.promise, signal);
            } catch {
                return { status: 'cancelled', model };
            }
            if (signal.aborted) return { status: 'cancelled', model };
            shared = modelPreparations.get(key);
        }

        if (!shared) {
            const entry: SharedModelPreparation = {
                key,
                controller: new AbortController(),
                waiters: 0,
                settled: false,
                promise: Promise.resolve({ status: 'cancelled', model }),
            };
            modelPreparations.set(key, entry);
            entry.promise = this.loadModelForTask(taskType, model, numCtx, numGpu, entry.controller)
                .finally(() => {
                    entry.settled = true;
                    if (modelPreparations.get(key) === entry) modelPreparations.delete(key);
                });
            shared = entry;
        }

        return this.waitForSharedPreparation(shared, model, signal);
    }

    private async loadModelForTask(
        taskType: TaskType,
        model: string,
        numCtx: number | undefined,
        numGpu: number | undefined,
        controller: AbortController,
    ): Promise<ModelPreparationResult> {
        const logId = generateId();
        emitOllamaLog({ id: logId, phase: 'start', taskType, model, prompt: '' });
        const signal = controller.signal;
        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            // Keep the startup bound through response-body parsing as well as fetch headers.
            controller.abort();
        }, MODEL_PREPARATION_TIMEOUT_MS);
        try {
            const requestOptions = this.buildOptions({ numCtx, numGpu });
            const response = await this.fetchWithTimeout(`${this.config.apiBase}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Ollama loads the model for an empty prompt without creating a reply.
                // keep_alive stays omitted so the service keeps its default policy.
                body: JSON.stringify({ model, prompt: '', stream: false, options: requestOptions }),
                signal,
            }, MODEL_PREPARATION_TIMEOUT_MS);

            if (!response.ok) throw new Error(`Ollama model preparation failed: ${response.statusText}`);
            const data = await waitForSignal(response.json() as Promise<{ done?: boolean }>, signal);
            if (data.done !== true) throw new Error('Ollama model preparation did not complete.');

            emitOllamaLog({ id: logId, phase: 'success', taskType, model, response: '' });
            return { status: 'ready', model };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            emitOllamaLog({ id: logId, phase: 'error', taskType, model, error: message });
            return timedOut
                ? { status: 'error', error: `Ollama model preparation timed out after ${MODEL_PREPARATION_TIMEOUT_MS}ms.`, model }
                : signal.aborted
                ? { status: 'cancelled', model }
                : { status: 'error', error: message, model };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private logPreparationFailure(taskType: TaskType, message: string): void {
        const id = generateId();
        emitOllamaLog({ id, phase: 'start', taskType, prompt: '' });
        emitOllamaLog({ id, phase: 'error', taskType, error: message });
    }

    private waitForSharedPreparation(
        shared: SharedModelPreparation,
        model: string,
        signal?: AbortSignal,
    ): Promise<ModelPreparationResult> {
        if (signal?.aborted) {
            if (shared.waiters === 0 && !shared.settled) {
                shared.controller.abort();
            }
            return Promise.resolve({ status: 'cancelled', model });
        }

        shared.waiters += 1;
        return new Promise(resolve => {
            let finished = false;
            const release = () => {
                shared.waiters = Math.max(0, shared.waiters - 1);
                if (shared.waiters === 0 && !shared.settled) {
                    // Cancel the expensive load only after its last caller leaves.
                    // Keep its entry until the transport settles so an immediate
                    // retry cannot overlap a still-unwinding model load.
                    shared.controller.abort();
                }
            };
            const onAbort = () => {
                if (finished) return;
                finished = true;
                release();
                resolve({ status: 'cancelled', model });
            };
            if (signal) signal.addEventListener('abort', onAbort, { once: true });
            shared.promise.then(result => {
                if (finished) return;
                finished = true;
                signal?.removeEventListener('abort', onAbort);
                release();
                resolve(result);
            });
        });
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
        if (params.numGpu !== undefined) out.num_gpu = params.numGpu;
        return out;
    }

    /**
     * Call the generate endpoint.
     */
    async generate(options: {
        signal?: AbortSignal;
        model: string;
        prompt: string;
        format?: ResponseFormat;
        temperature?: number;
        numPredict?: number;
        topP?: number;
        repeatPenalty?: number;
        numCtx?: number;
        numGpu?: number;
        keepAlive?: string | number;
    }): Promise<{ ok: true; data: OllamaGenerateResponse } | { ok: false; error: string }> {
        try {
            const ollamaOptions = this.buildOptions({
                temperature: options.temperature ?? 0.7,
                numPredict: options.numPredict ?? 256,
                topP: options.topP,
                repeatPenalty: options.repeatPenalty,
                numCtx: options.numCtx,
                numGpu: options.numGpu
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
                body: JSON.stringify(body),
                signal: options.signal
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
        numGpu?: number;
        keepAlive?: string | number;
    }): Promise<{ ok: true; data: OllamaChatResponse } | { ok: false; error: string; statusCode?: number }> {
        try {
            const ollamaOptions = this.buildOptions({
                temperature: options.temperature ?? 0.7,
                numPredict: options.numPredict ?? 256,
                topP: options.topP,
                repeatPenalty: options.repeatPenalty,
                numCtx: options.numCtx,
                numGpu: options.numGpu
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
        signal?: AbortSignal;
        taskType: TaskType;
        prompt: string;
        format?: ResponseFormat;
        overrides?: ModelParams;
    }): Promise<
        | { ok: true; data: OllamaGenerateResponse; model: string }
        | { ok: false; error: string; model?: string }
    > {
        // Provider router: when the player has switched text generation to Groq,
        // delegate to the Groq provider. It returns this exact shape and logs
        // through the same central sink, so callers and the log viewer are
        // unchanged. No-fallback: a Groq failure is returned honestly.
        if (isGroqActive()) {
            return routeGenerateForTask(options);
        }
        const profile = getTaskProfile(options.taskType);
        // Emit the attempt to the central log sink so every task is visible in
        // the in-app Ollama viewer without each call site logging individually.
        const logId = generateId();
        emitOllamaLog({ id: logId, phase: 'start', taskType: options.taskType, prompt: options.prompt });

        let model: string | null;
        try {
            model = await this.resolveModel(options.taskType);
        } catch (error) {
            // A configured model that is not installed throws during discovery.
            // Report that failure through the same log/result path as transport
            // errors, without silently choosing another model or leaving the
            // player's request looking permanently pending.
            const message = error instanceof Error ? error.message : String(error);
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, error: message });
            return { ok: false, error: message };
        }
        if (options.signal?.aborted) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, error: 'Request cancelled.' });
            return { ok: false, error: 'Request cancelled.' };
        }
        if (!model) {
            emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, error: 'NO_MODEL' });
            return { ok: false, error: 'NO_MODEL' };
        }

        const merged: ModelParams = { ...profile.params, ...(options.overrides ?? {}) };
        const result = await this.generate({
            signal: options.signal,
            model,
            prompt: options.prompt,
            format: options.format ?? profile.format,
            temperature: merged.temperature,
            numPredict: merged.numPredict,
            topP: merged.topP,
            repeatPenalty: merged.repeatPenalty,
            numCtx: merged.numCtx,
            // Respect the player's explicit local processing choice per request.
            // Automatic adds no device override; cloud routing returned above.
            numGpu: getOllamaComputeMode(profile.category) === 'cpu' ? 0 : merged.numGpu,
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
        // Provider router: delegate to Groq when selected (see generateForTask).
        if (isGroqActive()) {
            return routeChatForTask(options);
        }
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
            // Respect the player's explicit local processing choice per request.
            // Automatic adds no device override; cloud routing returned above.
            numGpu: getOllamaComputeMode(profile.category) === 'cpu' ? 0 : merged.numGpu,
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
