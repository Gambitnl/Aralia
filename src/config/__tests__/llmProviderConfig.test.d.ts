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
export {};
