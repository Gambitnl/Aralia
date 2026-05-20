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
 * Resolve a TaskType to an installed model name.
 *
 * Order:
 *   1. Profile's `preferredModels` (task-specific)
 *   2. Client's global `preferredModels` (config-wide fallback)
 *   3. First installed model (last-resort)
 *
 * Returns `null` if the Ollama server is unreachable or has no models.
 */
export async function resolveModelForTask(
    client: OllamaClient,
    taskType: TaskType
): Promise<string | null> {
    const cached = taskModelCache.get(taskType);
    if (cached) return cached;

    const installed = await client.listModels();
    if (!installed || installed.length === 0) return null;

    const profile = getTaskProfile(taskType);
    const globalFallback = client.getPreferredModels();

    const resolved =
        pickFirstAvailable(profile.preferredModels, installed) ??
        pickFirstAvailable(globalFallback, installed) ??
        installed[0]?.name ??
        null;

    if (resolved) taskModelCache.set(taskType, resolved);
    return resolved;
}

/**
 * Clear cached resolutions. Useful in tests and after pulling new models.
 */
export function resetRouterCache(): void {
    taskModelCache.clear();
}
