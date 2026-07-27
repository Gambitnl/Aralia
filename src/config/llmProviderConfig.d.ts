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
 * there is NO silent multi-model swapping. This module does NOT introduce any
 * new fallback behavior. Where a divergent fallback CHAIN already existed in the
 * code (the global preferred-models list, the per-task preference lists walked
 * against installed models, and the biome hook's model loop), this module simply
 * CENTRALIZES the existing list rather than expanding it. Those lists are marked
 * with `TODO(llm-provider-config)` to flag them as the seam a future
 * user-selectable, single-model choice will replace — see each marker below.
 */
/** The LLM providers Aralia can route text generation through today. */
export type LlmProvider = 'ollama' | 'groq';
/**
 * The default provider. Local Ollama, matching the pre-config behavior. The
 * runtime provider choice already lives in `services/ai/aiProviderSettings.ts`
 * (user-selectable, persisted); this constant documents the baseline default in
 * the canonical config so the two agree.
 */
export declare const DEFAULT_LLM_PROVIDER: LlmProvider;
/** Base URL for the Ollama API proxy. */
export declare const OLLAMA_API_BASE = "/api/ollama";
/** Default per-request timeout in milliseconds. */
export declare const OLLAMA_TIMEOUT_MS = 90000;
/** Number of retry attempts for failed requests (0 = no client-side retry). */
export declare const OLLAMA_RETRY_ATTEMPTS = 0;
/**
 * Global preferred-model fallback chain, used by the router when no task
 * profile matches an installed model. Order reflects the router fallback chain:
 * spec-recommended models first, legacy entries after so existing installs keep
 * working. See docs/ai/local-llm-model-routing.md.
 *
 * TODO(llm-provider-config): user-selectable; no-fallback per directive. This
 * chain is preserved as-is for behavior parity; a future user setting will pick
 * one model and this list becomes an availability-ordered default only.
 */
export declare const OLLAMA_GLOBAL_FALLBACK_MODELS: string[];
/**
 * Per-category preferred-model lists. Each Aralia task category walks its list
 * against installed models (then falls back to {@link OLLAMA_GLOBAL_FALLBACK_MODELS}).
 * Keys map to the four categories used by `services/ollama/taskProfiles.ts`.
 *
 * TODO(llm-provider-config): user-selectable; no-fallback per directive. Lists
 * are centralized verbatim; a future user setting will let a chosen model
 * override the category default without expanding fallback behavior.
 */
export declare const OLLAMA_TASK_MODELS: {
    dialogue: string[];
    judgment: string[];
    utility: string[];
    prose: string[];
};
/**
 * Model used specifically for companion character generation. mistral:instruct
 * is chosen for its reliable structured-JSON output. Single model, no fallback
 * (matches the pre-config `services/CompanionGenerator.ts` literal).
 *
 * TODO(llm-provider-config): user-selectable; no-fallback per directive.
 */
export declare const COMPANION_GENERATION_MODEL = "mistral:instruct";
/**
 * Model list tried in order by the biome-DNA generator hook
 * (`hooks/useBiomeGenerator.ts`). Centralized verbatim to preserve today's
 * behavior; the hook still walks this list itself.
 *
 * TODO(llm-provider-config): user-selectable; no-fallback per directive. This
 * is an EXISTING fallback loop preserved for parity — this slice does NOT change
 * or remove it; a future slice replaces the loop with the user's chosen model.
 */
export declare const BIOME_GENERATION_MODELS: string[];
