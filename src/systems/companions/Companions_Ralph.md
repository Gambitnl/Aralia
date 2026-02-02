# Companions Component Documentation (Ralph)

## Overview
This folder contains the logic for the Companion System, including dynamic banter selection, reaction evaluation to player choices, and long-term relationship progression.

## Files
- **BanterManager.ts**: Handles the selection of ambient dialogue (banter). It filters potential lines based on context (location, present characters) and prerequisites (relationship levels, cooldowns). It is a selector only; it does not manage the UI state of displaying the banter.
- **CompanionReactionSystem.ts**: The engine that decides how a companion feels about a player's choice. It matches "tags" from a decision (e.g., "cruel", "chaotic") against a companion's personality rules to calculate approval changes.
- **RelationshipManager.ts**: The state manager for long-term progression. It handles arithmetic for approval points (-500 to +500), maps points to named levels (e.g., "Friend", "Rival"), and manages the unlocking of progression rewards (quests, abilities).

## Issues & Opportunities

### 1. RelationshipManager.ts - Romance State Logic Trap
**Status:** Validated - High Priority

**Issue:** Once a character enters the 'romance' state, the `if (newLevel !== 'romance')` guard (line 64) prevents *any* automatic level changes via approval shifts. A companion at romance (500 approval) whose approval drops to -500 will remain flagged as 'romance' while actively despising the player.

**Root Cause:** The romance level bypasses threshold-based recalculation entirely. No breakup/downgrade mechanic exists in the codebase.

**Proposed Solutions:**
- **Option A (Automatic):** Allow romance to downgrade when approval drops below the 'devoted' threshold (< 400)
- **Option B (Event-Driven):** Require explicit breakup events; only auto-downgrade on extreme drops (e.g., below 0)
- **Option C (Hysteresis Hybrid):** Maintain lock-in but add a "betrayal" threshold (e.g., approval < -200 triggers forced exit from romance)

**Implementation Notes:**
- Add `breakup` type to `RelationshipEvent` for history tracking
- Update `processApprovalEvent` to handle romance exit conditions
- Consider adding `triggerBreakup()` method for story-driven breakups

---

### 2. RelationshipManager.ts - crypto.randomUUID() Usage
**Status:** Validated - Medium Priority

**Issue:** Direct calls to `crypto.randomUUID()` (lines 118, 129, 139) assume modern browser/Node environments. May fail in older runtimes or specific embedding contexts.

**Existing Solution:** `src/utils/core/idGenerator.ts` already provides `generateId()` with proper fallback:
```typescript
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
  return crypto.randomUUID();
}
return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
```

**Fix:** Replace all `crypto.randomUUID()` calls with `generateId()` from the utility module.

---

### 3. CompanionReactionSystem.ts - Unused Relationship Checks
**Status:** Validated - High Priority

**Issue:** The `evaluateReaction` method declares `_relationship` (line 42) but never uses it. The `CompanionReactionRule.requirements` fields (`minRelationship`, `maxRelationship`) exist in types but are not enforced in logic.

**Impact:** The intended feature "reactions change based on current relationship" (e.g., friends forgive slights strangers wouldn't) is completely unimplemented.

**Fix Implementation:**
```typescript
// In rule evaluation loop (lines 36-57):
if (rule.requirements) {
  const relationship = companion.relationships['player'];
  if (rule.requirements.minRelationship) {
    const minWeight = levelWeight[rule.requirements.minRelationship];
    const currentWeight = levelWeight[relationship.level];
    if (currentWeight < minWeight) continue; // Skip rule
  }
  if (rule.requirements.maxRelationship) {
    const maxWeight = levelWeight[rule.requirements.maxRelationship];
    const currentWeight = levelWeight[relationship.level];
    if (currentWeight > maxWeight) continue; // Skip rule
  }
}
```

**Level Weight Mapping** (same as RelationshipManager.ts):
```
hated: -5, enemy: -4, rival: -3, distrusted: -2, wary: -1,
stranger: 0, acquaintance: 1, friend: 2, close: 3, devoted: 4, romance: 5
```

---

## Recommended Action Order

1. **Issue 2 (crypto)** - 5-minute fix using existing utility
2. **Issue 3 (relationship checks)** - Unlocks companion depth, straightforward implementation
3. **Issue 1 (romance trap)** - Requires design decision on breakup mechanics
