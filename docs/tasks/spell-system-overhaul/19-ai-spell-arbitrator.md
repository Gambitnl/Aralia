# Task 19: AI Spell Arbitrator Service

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/systems/spells/ai/AISpellArbitrator.ts`](../../../src/systems/spells/ai/AISpellArbitrator.ts)

---

## Why This File Still Exists

This task spec is preserved because the AI arbitration layer it described now exists in the repo and still explains the intended role of AI-assisted and AI-DM spell handling.

It is no longer a clean "build this from scratch" brief. It now serves as:
- a preserved record of the original AI-arbitration intent
- a pointer to the live implementation
- a note about where the live repo differs from the earlier proposed architecture

---

## Verified Current State

The core arbitrator service now exists:

- [`src/systems/spells/ai/AISpellArbitrator.ts`](../../../src/systems/spells/ai/AISpellArbitrator.ts)
- [`src/systems/spells/ai/MaterialTagService.ts`](../../../src/systems/spells/ai/MaterialTagService.ts)

The current arbitrator already supports:
- `mechanical`, `ai_assisted`, and `ai_dm` routing
- player-input gating for AI-DM spells
- Gemini-backed AI calls
- context building with nearby-creature and nearby-terrain descriptions

The current spell data also already contains AI-tagged examples:
- [`public/data/spells/level-0/prestidigitation.json`](../../../public/data/spells/level-0/prestidigitation.json)
- [`public/data/spells/level-2/blindness-deafness.json`](../../../public/data/spells/level-2/blindness-deafness.json)
- [`public/data/spells/level-2/suggestion.json`](../../../public/data/spells/level-2/suggestion.json)

---

## Important Divergences From The Original Task Brief

### Architecture path changed

The older version of this file pointed at a broken research path:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

### The service landed in a different location

The old brief assumed a new `src/services/ai/` tree with provider abstractions for Claude/OpenAI/local models.

What is true now:
- the live arbitrator sits under [`src/systems/spells/ai`](../../../src/systems/spells/ai)
- the live implementation is currently wired to the Gemini service, not a generic provider matrix
- no `ArbitrationCache.ts` was re-verified in the current repo

---

## What To Treat As Current Authority

For current AI arbitration behavior, use:
- [`src/systems/spells/ai/AISpellArbitrator.ts`](../../../src/systems/spells/ai/AISpellArbitrator.ts)
- [`src/systems/spells/ai/MaterialTagService.ts`](../../../src/systems/spells/ai/MaterialTagService.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

This file should be read as preserved task context, not as a fresher source of truth than those code paths.

---

## What Still Needs Follow-Through

- input UI wiring still needs proof-of-life at the app flow level
- caching is still missing
- some example AI-tagged spells still have weak or placeholder prompt configuration
- terrain/material context still falls back to heuristic inference when concrete tile data is unavailable

Use this file as preserved implementation context plus a pointer to the live AI arbitration layer.
