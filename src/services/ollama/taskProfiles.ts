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
import { OLLAMA_TASK_MODELS } from '../../config/llmProviderConfig';

// ---------------------------------------------------------------------------
// Model preference lists (per category)
// ---------------------------------------------------------------------------
// Sourced from the canonical LLM provider config so every task's model choice
// lives in ONE place. Values are unchanged — see src/config/llmProviderConfig.ts.

/** Voices: companion banter, NPC dialogue, gossip, emotional reactions. */
const DIALOGUE_MODELS = OLLAMA_TASK_MODELS.dialogue;

/** Judgment: oracle, social outcomes, guidance, structured analysis. */
const JUDGMENT_MODELS = OLLAMA_TASK_MODELS.judgment;

/** Utility: names, tile flavour, summaries, loot dressing, fact extraction. */
const UTILITY_MODELS = OLLAMA_TASK_MODELS.utility;

/** Atmosphere: location and encounter descriptions — prose with consistency. */
const PROSE_MODELS = OLLAMA_TASK_MODELS.prose;

// ---------------------------------------------------------------------------
// Parameter presets (per spec)
// ---------------------------------------------------------------------------

const DIALOGUE_PARAMS = {
    temperature: 0.8,
    topP: 0.9,
    repeatPenalty: 1.08,
    numCtx: 4096,
    numPredict: 80
};

const PROSE_PARAMS = {
    temperature: 0.75,
    topP: 0.9,
    repeatPenalty: 1.08,
    numCtx: 4096,
    numPredict: 180
};

const STRUCTURED_PARAMS = {
    temperature: 0.2,
    topP: 0.8,
    repeatPenalty: 1.05,
    numCtx: 4096,
    numPredict: 160
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const DEFAULT_TASK_PROFILES: Record<TaskType, TaskProfile> = {
    // Dialogue / prose ------------------------------------------------------
    companion_banter: {
        taskType: 'companion_banter',
        preferredModels: DIALOGUE_MODELS,
        params: DIALOGUE_PARAMS,
        format: 'json'
    },
    companion_banter_escalation: {
        taskType: 'companion_banter_escalation',
        preferredModels: DIALOGUE_MODELS,
        params: { ...DIALOGUE_PARAMS, temperature: 0.85 },
        format: 'json'
    },
    conversation_continuation: {
        taskType: 'conversation_continuation',
        preferredModels: DIALOGUE_MODELS,
        params: DIALOGUE_PARAMS,
        format: 'json'
    },
    npc_dialogue: {
        taskType: 'npc_dialogue',
        preferredModels: DIALOGUE_MODELS,
        params: { ...DIALOGUE_PARAMS, temperature: 0.9, numPredict: 100 }
    },
    gossip: {
        taskType: 'gossip',
        preferredModels: DIALOGUE_MODELS,
        params: { ...DIALOGUE_PARAMS, temperature: 0.9, numPredict: 120 }
    },
    emotional_reaction: {
        taskType: 'emotional_reaction',
        preferredModels: DIALOGUE_MODELS,
        params: { ...DIALOGUE_PARAMS, temperature: 0.7, numPredict: 150 },
        format: 'json'
    },
    location_description: {
        taskType: 'location_description',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, temperature: 0.8, numPredict: 150 }
    },
    wilderness_description: {
        taskType: 'wilderness_description',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, temperature: 0.8, numPredict: 150 }
    },
    encounter_description: {
        taskType: 'encounter_description',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, numPredict: 200 }
    },
    action_outcome: {
        taskType: 'action_outcome',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, temperature: 0.8, numPredict: 120 }
    },
    dynamic_event: {
        taskType: 'dynamic_event',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, temperature: 0.8, numPredict: 100 }
    },
    // Opening situation: the fresh, non-deterministic predicament the player is
    // dropped into on a new game. Prose models, higher temperature for genuine
    // per-run variety, json format, extra headroom for the structured scene.
    opening_situation: {
        taskType: 'opening_situation',
        preferredModels: PROSE_MODELS,
        params: { ...PROSE_PARAMS, temperature: 0.95, topP: 0.95, numPredict: 420 },
        format: 'json'
    },

    // Structured / judgment ------------------------------------------------
    oracle_response: {
        taskType: 'oracle_response',
        preferredModels: JUDGMENT_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.5, numPredict: 120 }
    },
    social_check_outcome: {
        taskType: 'social_check_outcome',
        preferredModels: JUDGMENT_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.5, numPredict: 150 }
    },
    situation_analysis: {
        taskType: 'situation_analysis',
        preferredModels: JUDGMENT_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.4, numPredict: 120 }
    },
    custom_action_suggestions: {
        taskType: 'custom_action_suggestions',
        preferredModels: JUDGMENT_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.6, numPredict: 200 }
    },
    guide_response: {
        taskType: 'guide_response',
        preferredModels: JUDGMENT_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.5, numPredict: 180 }
    },

    // Utility / chores -----------------------------------------------------
    conversation_summary: {
        taskType: 'conversation_summary',
        preferredModels: UTILITY_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.3, numPredict: 256 },
        format: 'json'
    },
    fact_extraction: {
        taskType: 'fact_extraction',
        preferredModels: UTILITY_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.3, numPredict: 512 },
        format: 'json'
    },
    name_generation: {
        taskType: 'name_generation',
        preferredModels: UTILITY_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.7, numPredict: 50 }
    },
    tile_inspection: {
        taskType: 'tile_inspection',
        preferredModels: UTILITY_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.8, numPredict: 150 }
    },
    harvest_loot: {
        taskType: 'harvest_loot',
        preferredModels: UTILITY_MODELS,
        params: { ...STRUCTURED_PARAMS, temperature: 0.6, numPredict: 200 },
        format: 'json'
    }
};

/**
 * Look up a task profile by type. Falls back to a generic dialogue profile if the
 * caller passes an unknown task type at runtime (shouldn't happen with TS, but
 * protects JS callers).
 */
export function getTaskProfile(taskType: TaskType): TaskProfile {
    return DEFAULT_TASK_PROFILES[taskType] ?? DEFAULT_TASK_PROFILES.npc_dialogue;
}
