/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/router.ts
 *
 * Resolves a TaskType to an installed Ollama model, applying the task profile's
 * preferred-model list first, then falling back to the global
 * OllamaConfig.preferredModels chain, then to any installed model.
 *
 * Caches resolutions per TaskType to avoid hammering /tags on every call.
 *
 * Source spec: docs/ai/local-llm-model-routing.md
 */

import type { OllamaModel, TaskType } from '../../types/ollama';
import type { OllamaClient } from './client';
import { getTaskProfile } from './taskProfiles';
import { resolveOllamaModel } from '../ai/aiProviderSettings';

// Cache: TaskType → resolved model name. Cleared via resetRouterCache().
const taskModelCache = new Map<TaskType, string>();

/**
 * Returns the first model from `candidates` whose name appears in `installed`.
 * Match is permissive: `installed` model name must `.includes()` the candidate
 * (so a candidate of `granite4.1:8b-q4_K_M` matches an installed
 * `granite4.1:8b-q4_K_M` exactly, but also matches loose tag suffixes if any).
 */
function pickFirstAvailable(candidates: string[], installed: OllamaModel[]): string | null {
    for (const candidate of candidates) {
        const found = installed.find(m => m.name.includes(candidate));
        if (found) return found.name;
    }
    return null;
}

/**
 * Resolve a TaskType to the ONE model its category runs on (agora-d1c7.1).
 *
 * The player's choice for the category (AI settings), else the category
 * default. There is no walk over a preference list and no "first installed"
 * last resort: if the resolved model is not installed the call throws
 * OllamaModelNotInstalledError naming the model, so the failure is visible
 * instead of silently answered by a different model.
 *
 * Returns `null` only when the Ollama server is unreachable or lists no models.
 */
export class OllamaModelNotInstalledError extends Error {
    constructor(public readonly model: string, public readonly category: string, public readonly taskType: TaskType) {
        super(`Ollama model "${model}" (chosen for ${category}, task ${taskType}) is not installed. ` +
            `Pick an installed model in AI settings or run: ollama pull ${model}`);
        this.name = 'OllamaModelNotInstalledError';
    }
}

export async function resolveModelForTask(
    client: OllamaClient,
    taskType: TaskType
): Promise<string | null> {
    const cached = taskModelCache.get(taskType);
    if (cached) return cached;

    const installed = await client.listModels();
    if (!installed || installed.length === 0) return null;

    const profile = getTaskProfile(taskType);
    const wanted = resolveOllamaModel(profile.category);
    const found = installed.find(m => m.name === wanted || m.name.startsWith(wanted + ':') || m.name === wanted + ':latest');
    if (!found) throw new OllamaModelNotInstalledError(wanted, profile.category, taskType);

    taskModelCache.set(taskType, found.name);
    return found.name;
}

/**
 * Clear cached resolutions. Useful in tests and after pulling new models.
 */
export function resetRouterCache(): void {
    taskModelCache.clear();
}
