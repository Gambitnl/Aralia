/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/config/llmProviderConfig.ts
 *
 * CANONICAL LLM PROVIDER / MODEL CONFIG (single source of truth).
 *
 * WHY THIS EXISTS
 * ---------------
 * The Ollama model choices used to be hardcoded and DIVERGENT across several
 * files (the global fallback chain in `types/ollama.ts`, the per-category lists
 * in `services/ollama/taskProfiles.ts`, a lone `'mistral:instruct'` in
 * `services/CompanionGenerator.ts`, and a separate list in the biome hook).
 * This module gathers every one of those choices in ONE place so a future
 * user-facing setting can override the provider/model from a single seam,
 * instead of hunting down scattered literals.
 *
 * BEHAVIOR-PRESERVING (first slice, 2026-07-09)
 * ---------------------------------------------
 * The DEFAULT values below reproduce EXACTLY what each site selected before
 * centralization — same model ids, same order. Importing these constants in
 * place of the old inline literals is a byte-identical substitution; runtime
 * behavior is unchanged. No task's actual model choice moved. A regression pin
 * (`src/config/__tests__/llmProviderConfig.test.ts`) asserts these values match
 * the pre-centralization literals.
 *
 * NO-FALLBACK DIRECTIVE
 * ---------------------
 * Remy's directive: on the CHOSEN provider, a failure is returned honestly —
 * there is NO silent multi-model swapping. Since 2026-09-13 (agora-d1c7.1) every
 * Ollama task category runs on exactly ONE model: the player's choice from the
 * AI settings (`services/ai/aiProviderSettings.ts` resolveOllamaModel), else the
 * category default in OLLAMA_CATEGORY_DEFAULT_MODEL below. The lists that used
 * to be walked as fallback chains are kept only as the CATALOG the picker offers.
 */

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

/** The LLM providers Aralia can route text generation through today. */
export type LlmProvider = 'ollama' | 'groq';

/**
 * The default provider. Local Ollama, matching the pre-config behavior. The
 * runtime provider choice already lives in `services/ai/aiProviderSettings.ts`
 * (user-selectable, persisted); this constant documents the baseline default in
 * the canonical config so the two agree.
 */
export const DEFAULT_LLM_PROVIDER: LlmProvider = 'ollama';

// ---------------------------------------------------------------------------
// Ollama transport defaults (mirror of DEFAULT_OLLAMA_CONFIG in types/ollama.ts)
// ---------------------------------------------------------------------------

/** Base URL for the Ollama API proxy. */
export const OLLAMA_API_BASE = '/api/ollama';

/** Default per-request timeout in milliseconds. */
export const OLLAMA_TIMEOUT_MS = 90000;

/** Number of retry attempts for failed requests (0 = no client-side retry). */
export const OLLAMA_RETRY_ATTEMPTS = 0;

// ---------------------------------------------------------------------------
// Ollama model selections (per-task and global fallback)
// ---------------------------------------------------------------------------

/**
 * Global preferred-model fallback chain, used by the router when no task
 * profile matches an installed model. Order reflects the router fallback chain:
 * spec-recommended models first, legacy entries after so existing installs keep
 * working. See docs/ai/local-llm-model-routing.md.
 *
 * No longer walked at runtime (agora-d1c7.1): it is the catalog offered by the
 * model picker. The runtime model is resolveOllamaModel(category).
 */
export const OLLAMA_GLOBAL_FALLBACK_MODELS: string[] = [
  'granite4.1:8b-q4_K_M',
  'qwen3:8b-q4_K_M',
  'granite4.1:3b-q6_K',
  'phi4-mini:3.8b-q4_K_M',
  'adi0adi/ollama_stheno-8b_v3.1_q6k',
  'mistral:instruct',
  'leeplenty/ellaria',
  'phi4-mini:3.8b',
  'llama3.1:instruct',
  'llama3:instruct',
  'gemma3:1b',
  'gemma:2b',
  'phi',
];

/**
 * Per-category preferred-model lists. Each Aralia task category walks its list
 * against installed models (then falls back to {@link OLLAMA_GLOBAL_FALLBACK_MODELS}).
 * Keys map to the four categories used by `services/ollama/taskProfiles.ts`.
 *
 * No longer walked at runtime (agora-d1c7.1): the first entry of each list is
 * that category's default (OLLAMA_CATEGORY_DEFAULT_MODEL) and the rest is the
 * catalog the picker offers.
 */
export const OLLAMA_TASK_MODELS: {
  dialogue: string[];
  judgment: string[];
  utility: string[];
  prose: string[];
} = {
  /** Voices: companion banter, NPC dialogue, gossip, emotional reactions. */
  dialogue: [
    'adi0adi/ollama_stheno-8b_v3.1_q6k',
    'leeplenty/ellaria',
    'qwen3:8b-q4_K_M',
    'mistral:instruct',
    'llama3.1:instruct',
  ],
  /** Judgment: oracle, social outcomes, guidance, structured analysis. */
  judgment: [
    'granite4.1:8b-q4_K_M',
    'qwen3:8b-q4_K_M',
    'llama3.1:instruct',
    'mistral:instruct',
  ],
  /** Utility: names, tile flavour, summaries, loot dressing, fact extraction. */
  utility: [
    'granite4.1:3b-q6_K',
    'phi4-mini:3.8b-q4_K_M',
    'phi4-mini:3.8b',
    'gemma3:1b',
    'gemma:2b',
  ],
  /** Atmosphere: location and encounter descriptions — prose with consistency. */
  prose: [
    'qwen3.5:9b-q4_K_M',
    'qwen3:8b-q4_K_M',
    'gemma4:12b',
    'adi0adi/ollama_stheno-8b_v3.1_q6k',
    'granite4.1:8b-q4_K_M',
    'llama3.1:instruct',
  ],
};

/**
 * Model used specifically for companion character generation. mistral:instruct
 * is chosen for its reliable structured-JSON output. Single model, no fallback
 * (matches the pre-config `services/CompanionGenerator.ts` literal).
 *
 * Default for the 'companion' category (agora-d1c7.1); the player may pick another.
 */
export const COMPANION_GENERATION_MODEL = 'mistral:instruct';

/**
 * Model list tried in order by the biome-DNA generator hook
 * (`hooks/useBiomeGenerator.ts`). Centralized verbatim to preserve today's
 * behavior; the hook still walks this list itself.
 *
 * No longer walked (agora-d1c7.1): the first entry is the 'biome' category
 * default; the hook runs exactly one model, the player's choice or that default.
 */
export const BIOME_GENERATION_MODELS: string[] = [
  'mistral:instruct',
  'phi4-mini:3.8b',
  'gemma3:1b',
];

// ---------------------------------------------------------------------------
// One model per category (agora-d1c7.1)
// ---------------------------------------------------------------------------

/** The task categories a player can pin an Ollama model to. */
export type OllamaModelCategory = 'dialogue' | 'judgment' | 'utility' | 'prose' | 'companion' | 'biome';
export const OLLAMA_MODEL_CATEGORIES: readonly OllamaModelCategory[] = ['dialogue', 'judgment', 'utility', 'prose', 'companion', 'biome'];

export const OLLAMA_MODEL_CATEGORY_LABEL: Record<OllamaModelCategory, string> = {
  dialogue: 'Dialogue (NPC and companion voices)',
  judgment: 'Judgment (rules and checks)',
  utility: 'Utility (short structured answers)',
  prose: 'Prose (scenes and descriptions)',
  companion: 'Companion generation',
  biome: 'Biome generation',
};

/** The one model each category runs on when the player has not chosen one. */
export const OLLAMA_CATEGORY_DEFAULT_MODEL: Record<OllamaModelCategory, string> = {
  dialogue: OLLAMA_TASK_MODELS.dialogue[0],
  judgment: OLLAMA_TASK_MODELS.judgment[0],
  utility: OLLAMA_TASK_MODELS.utility[0],
  prose: OLLAMA_TASK_MODELS.prose[0],
  companion: COMPANION_GENERATION_MODEL,
  biome: BIOME_GENERATION_MODELS[0],
};

/** Every model name the catalog knows, for the picker (installed models are added at runtime). */
export const OLLAMA_MODEL_CATALOG: readonly string[] = Array.from(new Set([
  ...OLLAMA_GLOBAL_FALLBACK_MODELS,
  ...OLLAMA_TASK_MODELS.dialogue,
  ...OLLAMA_TASK_MODELS.judgment,
  ...OLLAMA_TASK_MODELS.utility,
  ...OLLAMA_TASK_MODELS.prose,
  COMPANION_GENERATION_MODEL,
  ...BIOME_GENERATION_MODELS,
]));
