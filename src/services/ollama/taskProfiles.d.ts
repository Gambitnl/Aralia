/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/taskProfiles.ts
 *
 * Central registry of task → model routing profiles.
 *
 * Each Aralia task that touches the local LLM declares a TaskType. The router
 * uses this registry to pick a model from the task's preferred list against the
 * installed Ollama models, and to apply the right sampling parameters.
 *
 * Source spec: docs/ai/local-llm-model-routing.md
 */
import type { TaskProfile, TaskType } from '../../types/ollama';
export declare const DEFAULT_TASK_PROFILES: Record<TaskType, TaskProfile>;
/**
 * Look up a task profile by type. Falls back to a generic dialogue profile if the
 * caller passes an unknown task type at runtime (shouldn't happen with TS, but
 * protects JS callers).
 */
export declare function getTaskProfile(taskType: TaskType): TaskProfile;
