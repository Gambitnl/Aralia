/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/config/__tests__/llmProviderConfig.test.ts
 *
 * REGRESSION PIN for the LLM provider-config first slice (2026-07-09).
 *
 * This slice centralized previously-hardcoded, divergent Ollama model choices
 * into src/config/llmProviderConfig.ts WITHOUT changing runtime behavior. These
 * tests pin the canonical defaults to the EXACT literals that lived at each site
 * before centralization, and assert the re-pointed sites now resolve to those
 * same values. If any of these change, a model selection has silently moved —
 * which this slice explicitly forbids.
 */

import { describe, it, expect } from 'vitest';
import {
  OLLAMA_API_BASE,
  OLLAMA_TIMEOUT_MS,
  OLLAMA_RETRY_ATTEMPTS,
  OLLAMA_GLOBAL_FALLBACK_MODELS,
  OLLAMA_TASK_MODELS,
  COMPANION_GENERATION_MODEL,
  BIOME_GENERATION_MODELS,
  DEFAULT_LLM_PROVIDER,
} from '../llmProviderConfig';
import { DEFAULT_OLLAMA_CONFIG } from '../../types/ollama';
import { DEFAULT_TASK_PROFILES } from '../../services/ollama/taskProfiles';

// ---------------------------------------------------------------------------
// Pre-centralization literals (the ground truth this slice must reproduce).
// Copied verbatim from the sites listed in each comment. DO NOT edit to match
// code — the whole point is that they are frozen snapshots of old behavior.
// ---------------------------------------------------------------------------

/** Was: types/ollama.ts DEFAULT_OLLAMA_CONFIG.preferredModels */
const PRE_GLOBAL_FALLBACK = [
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

/** Was: services/ollama/taskProfiles.ts DIALOGUE_MODELS */
const PRE_DIALOGUE = [
  'adi0adi/ollama_stheno-8b_v3.1_q6k',
  'leeplenty/ellaria',
  'qwen3:8b-q4_K_M',
  'mistral:instruct',
  'llama3.1:instruct',
];

/** Was: services/ollama/taskProfiles.ts JUDGMENT_MODELS */
const PRE_JUDGMENT = [
  'granite4.1:8b-q4_K_M',
  'qwen3:8b-q4_K_M',
  'llama3.1:instruct',
  'mistral:instruct',
];

/** Was: services/ollama/taskProfiles.ts UTILITY_MODELS */
const PRE_UTILITY = [
  'granite4.1:3b-q6_K',
  'phi4-mini:3.8b-q4_K_M',
  'phi4-mini:3.8b',
  'gemma3:1b',
  'gemma:2b',
];

/** Was: services/ollama/taskProfiles.ts PROSE_MODELS */
const PRE_PROSE = [
  'qwen3.5:9b-q4_K_M',
  'qwen3:8b-q4_K_M',
  'gemma4:12b',
  'adi0adi/ollama_stheno-8b_v3.1_q6k',
  'granite4.1:8b-q4_K_M',
  'llama3.1:instruct',
];

/** Was: services/CompanionGenerator.ts `const model = 'mistral:instruct'` */
const PRE_COMPANION_MODEL = 'mistral:instruct';

/** Was: hooks/useBiomeGenerator.ts `const models = [...]` */
const PRE_BIOME_MODELS = ['mistral:instruct', 'phi4-mini:3.8b', 'gemma3:1b'];

describe('llmProviderConfig — canonical defaults (regression pin)', () => {
  it('default provider is ollama (pre-config baseline)', () => {
    expect(DEFAULT_LLM_PROVIDER).toBe('ollama');
  });

  it('Ollama transport defaults match pre-config literals', () => {
    expect(OLLAMA_API_BASE).toBe('/api/ollama');
    expect(OLLAMA_TIMEOUT_MS).toBe(90000);
    expect(OLLAMA_RETRY_ATTEMPTS).toBe(0);
  });

  it('global fallback chain matches the pre-config literal exactly (order + values)', () => {
    expect(OLLAMA_GLOBAL_FALLBACK_MODELS).toEqual(PRE_GLOBAL_FALLBACK);
  });

  it('per-task model lists match the pre-config taskProfiles literals exactly', () => {
    expect(OLLAMA_TASK_MODELS.dialogue).toEqual(PRE_DIALOGUE);
    expect(OLLAMA_TASK_MODELS.judgment).toEqual(PRE_JUDGMENT);
    expect(OLLAMA_TASK_MODELS.utility).toEqual(PRE_UTILITY);
    expect(OLLAMA_TASK_MODELS.prose).toEqual(PRE_PROSE);
  });

  it('companion generation model matches the pre-config literal', () => {
    expect(COMPANION_GENERATION_MODEL).toBe(PRE_COMPANION_MODEL);
  });

  it('biome generation model list matches the pre-config literal exactly', () => {
    expect(BIOME_GENERATION_MODELS).toEqual(PRE_BIOME_MODELS);
  });
});

describe('llmProviderConfig — re-pointed sites resolve to canonical values (behavior preserved)', () => {
  it('DEFAULT_OLLAMA_CONFIG now sources its transport + fallback chain from the config', () => {
    expect(DEFAULT_OLLAMA_CONFIG.apiBase).toBe(OLLAMA_API_BASE);
    expect(DEFAULT_OLLAMA_CONFIG.timeoutMs).toBe(OLLAMA_TIMEOUT_MS);
    expect(DEFAULT_OLLAMA_CONFIG.retryAttempts).toBe(OLLAMA_RETRY_ATTEMPTS);
    // Value equality against the frozen pre-config literal proves behavior parity.
    expect(DEFAULT_OLLAMA_CONFIG.preferredModels).toEqual(PRE_GLOBAL_FALLBACK);
  });

  it('task profiles resolve to the canonical per-category lists (spot-check per category)', () => {
    // Dialogue category
    expect(DEFAULT_TASK_PROFILES.companion_banter.preferredModels).toEqual(PRE_DIALOGUE);
    expect(DEFAULT_TASK_PROFILES.npc_dialogue.preferredModels).toEqual(PRE_DIALOGUE);
    // Judgment category
    expect(DEFAULT_TASK_PROFILES.oracle_response.preferredModels).toEqual(PRE_JUDGMENT);
    // Utility category
    expect(DEFAULT_TASK_PROFILES.name_generation.preferredModels).toEqual(PRE_UTILITY);
    // Prose category
    expect(DEFAULT_TASK_PROFILES.location_description.preferredModels).toEqual(PRE_PROSE);
  });
});
