/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/__tests__/generateOpeningSituation.test.ts
 *
 * Generator unit tests. Ollama is STUBBED — we cannot golden a live model, so we
 * inject a fake client and a deterministic id factory. These prove:
 *  - the prompt is grounded in THIS character (race/class/background/name) + place
 *  - a good model response maps to a valid OpeningSituation
 *  - model-unavailable THROWS (no fallback)
 *  - unparseable output THROWS (no fallback)
 */
export {};
