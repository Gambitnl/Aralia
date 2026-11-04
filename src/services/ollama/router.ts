/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/router.ts
 *
 * Resolves each task to the player's selected installed model (or its category
 * default). Changing the selection invalidates an old task-cache entry. Missing
 * choices fail explicitly; this route does not substitute another model.
 *
 * Caches resolutions per TaskType to avoid hammering /tags on every call.
 *
 * Source spec: docs/ai/local-llm-model-routing.md
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 23:08:20
 * Dependents: services/ollama/client.ts, services/ollama/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
    taskType: TaskType,
    options: { signal?: AbortSignal } = {},
): Promise<string | null> {
    const profile = getTaskProfile(taskType);
    const wanted = resolveOllamaModel(profile.category);
    const matchesChoice = (name: string) => name === wanted || name.startsWith(wanted + ':') || name === wanted + ':latest';
    const cached = taskModelCache.get(taskType);
    // A settings change must take effect on the next request, including after a
    // failed conversation. A cached old model is never a fallback for a new choice.
    if (cached && matchesChoice(cached)) return cached;
    taskModelCache.delete(taskType);

    if (options.signal?.aborted) return null;
    const installed = await client.listModels(options);
    if (options.signal?.aborted) return null;
    if (!installed || installed.length === 0) return null;
    const found = installed.find(m => matchesChoice(m.name));
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
