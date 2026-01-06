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
    OllamaResult
} from '../../types/ollama';
import { DEFAULT_OLLAMA_CONFIG } from '../../types/ollama';

/**
 * Low-level HTTP client for Ollama API.
 */
export class OllamaClient {
    private cachedModel: string | null = null;
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
     * Checks if the Ollama service is reachable.
     */
    async isAvailable(): Promise<boolean> {
        try {
            if (typeof window === 'undefined') return false;
            const res = await fetch(`${this.config.apiBase}/tags`);
            return res.ok;
        } catch {
            return false;
        }
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
     * Clear the cached model (useful for testing).
     */
    clearModelCache(): void {
        this.cachedModel = null;
    }

    /**
     * Call the generate endpoint.
     */
    async generate(options: {
        model: string;
        prompt: string;
        format?: 'json';
        temperature?: number;
        numPredict?: number;
    }): Promise<{ ok: true; data: OllamaGenerateResponse } | { ok: false; error: string }> {
        try {
            const res = await this.fetchWithTimeout(`${this.config.apiBase}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model,
                    prompt: options.prompt,
                    format: options.format,
                    stream: false,
                    options: {
                        temperature: options.temperature ?? 0.7,
                        num_predict: options.numPredict ?? 256
                    }
                })
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
        format?: 'json';
        temperature?: number;
        numPredict?: number;
    }): Promise<{ ok: true; data: OllamaChatResponse } | { ok: false; error: string; statusCode?: number }> {
        try {
            const res = await this.fetchWithTimeout(`${this.config.apiBase}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model,
                    messages: options.messages,
                    format: options.format,
                    stream: false,
                    options: {
                        temperature: options.temperature ?? 0.7,
                        num_predict: options.numPredict ?? 256
                    }
                })
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
}
