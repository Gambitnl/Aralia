# NORTH_STAR: Gemini Service

Status: active  
Last updated: 2026-05-31

## Purpose And Scope

Gemini Service is Aralia's AI text runtime for narration, social resolution, encounters, and economy helpers.
This project doc set is the cold-start surface so continuation work can resume without rediscovering the service shape.

In scope:

- `src/services/gemini/*` runtime behavior and reliability controls.
- `src/services/geminiService.ts` as the outward service API used by gameplay.
- handler integrations that write Gemini outputs into game state and debug logs.

Out of scope:

- new AI feature implementation.
- redesign of UI prompt flows.

## Implemented State

- Core path: `src/services/gemini/core.ts`
  - request gate via `isAiEnabled`.
  - 20s timeout around `generateContent`.
  - model fallback chain from `src/config/geminiConfig.ts`.
  - rate-limit detection and global cooldown metadata.
  - JSON/non-JSON return handling with metadata (`promptSent`, `rawResponse`, `rateLimitHit`).
- `src/services/gemini/encounters.ts`
  - oracle/social/custom/character/inspection generation via `generateText`.
  - encounter generation with direct model loop, Google Search grounding, static fallback on failure.
- `src/services/gemini/items.ts`
  - merchant inventory, harvest loot, and guide response.
  - hard-fallback inventory and empty loot outcomes on parse/API failure.
- `src/services/geminiServiceFallback.ts`
  - static encounter fallback when dynamic generation fails.
- `src/services/aiClient.ts`
  - safe Gemini client initialization and disabled state behavior when API key is missing.
- Tests exist for failure and timeout fallbacks in `src/services/__tests__/geminiService.test.ts`.

## Integration Map

- Gameplay call sites: `src/hooks/actions/handleObservation.ts`, `handleOracle.ts`,
  `handleEncounter.ts`, `handleGeminiCustom.ts`, `handleMerchantInteraction.ts`,
  `handleItemInteraction.ts`, `handleMovement.ts`, `handleNpcInteraction.ts`.
- `useGameActions.ts` writes `ADD_GEMINI_LOG_ENTRY` from handler outputs.
- `GeminiLogViewer` and related reducer read `geminiInteractionLog`.
- `SET_RATE_LIMIT_ERROR_FLAG` is dispatched in handlers when `rateLimitHit` propagates from service responses.

## File Map

- `src/config/geminiConfig.ts`: fallback model chain and model constants.
- `src/services/gemini/core.ts`: shared generator, timeout, retry/fallback behavior.
- `src/services/gemini/encounters.ts`: encounter/social/custom/oracle/story prompts.
- `src/services/gemini/items.ts`: shop/harvest/guide prompts and fallback data shaping.
- `src/services/gemini/types.ts`: `StandardizedResult` and metadata contracts.
- `src/services/geminiSchemas.ts`: AI payload schema validation.
- `src/services/geminiService.ts`: public surface and facades.
- `src/services/geminiServiceFallback.ts`: deterministic fallback encounter generator.
- `src/services/aiClient.ts`: shared client + enabled checks.

## Known Gaps And Uncertainties

- Cost and quota policy is still implicit; there is no central token/cost accounting or budget-aware strategy.
- Encounter generation does not use the same fallback delay/backoff flow used by `core.generateText`.
- Adaptive rate-limit timestamp handling is uneven across paths.
- `geminiService.ts` and README comments contain unresolved TODO debt around model selection and facade imports.
- Prompt strategy is function-scattered and not centrally versioned.
- Logging metadata stores full prompt text in some paths before complete redaction hardening.

## Active Task

- Keep this project docs focused on continuity and next checks until the service owner opens a code slice.

## Resume Path

1. Read this file.
2. Read `docs/projects/gemini-service/TRACKER.md`.
3. Read `docs/projects/gemini-service/GAPS.md`.
4. Re-open `src/services/gemini/core.ts` and `src/services/gemini/encounters.ts` for current behavior.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
