# AI Arbitration Service Follow-Through

**Status:** Live follow-through brief  
**Last Reverified:** 2026-03-11

---

## Current Verified Backend Surface

The AI arbitration backend is not missing anymore.

Verified live files:
- [`src/systems/spells/ai/AISpellArbitrator.ts`](../../../src/systems/spells/ai/AISpellArbitrator.ts)
- [`src/systems/spells/ai/MaterialTagService.ts`](../../../src/systems/spells/ai/MaterialTagService.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

Verified current behavior:
- `AISpellArbitrator` already handles `mechanical`, `ai_assisted`, and `ai_dm`
- `useAbilitySystem` already has `onRequestInput` handling for spells that require player input
- AI-tagged spell JSON already exists for:
  - [`prestidigitation.json`](../../../public/data/spells/level-0/prestidigitation.json)
  - [`blindness-deafness.json`](../../../public/data/spells/level-2/blindness-deafness.json)
  - [`suggestion.json`](../../../public/data/spells/level-2/suggestion.json)

---

## What Still Looks Incomplete Or Unverified

### 1. UI proof-of-life

[`src/components/BattleMap/AISpellInputModal.tsx`](../../../src/components/BattleMap/AISpellInputModal.tsx) exists, but this pass did not verify a live wiring site that actually renders it in the spell-casting flow.

### 2. Cache layer

No current [`src/systems/spells/ai/ArbitrationCache.ts`](../../../src/systems/spells/ai/ArbitrationCache.ts) file was found during this pass.

### 3. Example spell quality

AI-tagged spell files exist, but they are not all strong proof-of-life examples yet:
- `suggestion.json` is tagged `ai_dm`, but its `aiContext.prompt` is empty and `playerInputRequired` is currently `false`
- `prestidigitation.json` is also tagged `ai_dm` with an empty prompt and `playerInputRequired: false`
- `blindness-deafness.json` is tagged `ai_assisted` for a player-choice flow and should be treated as a special-case example rather than proof that all context-aware spell prompts are production-ready

### 4. Terrain/material correctness

`MaterialTagService` already uses submap tile information when possible, but it still falls back to biome-level inference when concrete local tile data is unavailable.

---

## Current Follow-Through Priorities

1. Prove or repair the input-modal wiring in the real spell-casting flow.
2. Add or explicitly defer the arbitration cache layer.
3. Clean up the current AI-tagged example spells so they use meaningful prompts and input requirements.
4. Tighten the material fallback path so context-sensitive spells rely less on biome guesses.

Use this file as the current AI-arbitration follow-through brief, not as a claim that the service still needs to be created from zero.
