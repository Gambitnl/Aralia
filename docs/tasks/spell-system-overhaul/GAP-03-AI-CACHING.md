# Gap: Missing AI Caching Layer

**Priority:** Medium (Optimization)
**Status:** Open
**Detected:** Dec 2025 (Agent Epsilon Review)

## Findings
The original plan for Agent Epsilon (`docs/tasks/spell-system-overhaul/AGENT-EPSILON-AI.md`) explicitly called for an `ArbitrationCache` class.
- **Current State:** `src/systems/spells/ai/AISpellArbitrator.ts` makes a fresh API call to Google Gemini *every time* `arbitrate()` is called.
- **Code Audit:** No `ArbitrationCache` class exists in the codebase.

## The Problem
AI calls are:
1. **Slow:** 1-3 seconds latency disrupts combat flow.
2. **Expensive:** Repeated calls cost tokens/money.
3. **Redundant:** Casting "Meld into Stone" on the *exact same tile* 5 seconds later should not require a new AI judgment—the stone didn't move.

## Proposed Solution
Implement an in-memory LRU (Least Recently Used) cache for arbitration results.

### 1. `ArbitrationCache.ts`
- **Key:** Hash of `(spellId + casterPosition + targetIds + playerInput)`.
- **Value:** `ArbitrationResult`.
- **TTL:** 5 minutes (or cleared on Scene Change).

### 2. Integration
- Modify `AISpellArbitrator.ts`:
    1. Before calling `geminiService`, check `ArbitrationCache.get(key)`.
    2. If hit, return cached result immediately.
    3. If miss, call AI, then `ArbitrationCache.set(key, result)`.

## Impact
- **Performance:** Instant response for repeated validation checks.
- **Cost:** Significantly reduced API usage for spam-casting.
