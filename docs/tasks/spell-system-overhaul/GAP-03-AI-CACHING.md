# Gap: Missing AI Caching Layer

**Priority:** Medium  
**Status:** Still open  
**Last Reverified:** 2026-03-11

## Verified Current State

The live arbitrator exists:
- [`src/systems/spells/ai/AISpellArbitrator.ts`](../../../src/systems/spells/ai/AISpellArbitrator.ts)

What was not found during this pass:
- [`src/systems/spells/ai/ArbitrationCache.ts`](../../../src/systems/spells/ai/ArbitrationCache.ts)

This pass also did not find a verified cache layer in the current AI arbitration flow.

## Why The Gap Is Still Real

Without caching:
- repeated validation/adjudication can keep paying the same latency and API-cost penalty
- repeated context checks can stay noisier than they need to be

## Current Follow-Through

1. Decide whether the cache should be in-memory only or tied to scene/combat resets.
2. Add a narrow cache keyed by spell/context/input shape if this path becomes performance-sensitive in live use.
3. Keep this as a real optimization gap, not as a claim that the whole AI service is still missing.
