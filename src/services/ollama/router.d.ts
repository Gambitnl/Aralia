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
import type { TaskType } from '../../types/ollama';
import type { OllamaClient } from './client';
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
export declare function resolveModelForTask(client: OllamaClient, taskType: TaskType): Promise<string | null>;
/**
 * Clear cached resolutions. Useful in tests and after pulling new models.
 */
export declare function resetRouterCache(): void;
