# Gap 3: Area Entry/Exit Triggers

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🟠 HIGH  
**Status:** In Progress (schema + runtime trigger handling landed)  
**Blocks:** create-bonfire, grease, fog-cloud, entangle, and many Level 2+ zone spells

---

## Problem Statement

Persistent area effects (bonfires, clouds, difficult terrain) need to trigger when creatures **enter or exit** the area, not just at turn start/end. The current schema only supports turn-phase triggers, missing the "moves into the area for the first time on a turn" mechanic.

---

## Affected Spells

| Spell | Entry Effect | Turn Effect | Notes |
|-------|--------------|-------------|-------|
| `create-bonfire` | Dex save, 1d8 fire | Same on turn start | First time per turn only |
| `grease` | Dex save or prone | Dex save on turn end | Prone on entry AND end |
| `fog-cloud` | Heavily obscured | — | Immediate on entry |
| `entangle` | Dex save, Restrained | — | On creation + entry |
| `moonbeam` (L2) | Con save, 2d10 radiant | Same on turn start | First entry per turn |

---

## Current State

- `create-bonfire` uses `turn_start` (misses entry damage entirely)
- No `on_enter_area` trigger type
- No `first_per_turn` frequency limiter
- Zone effects can't distinguish "walked in" from "started turn there"

---

## Required Schema Changes

```typescript
// Add to EffectTrigger in spellValidator.ts
type: z.enum([
  "immediate",
  "after_primary",
  "turn_start",
  "turn_end",
  "on_enter_area",        // NEW - creature enters effect zone
  "on_exit_area",         // NEW - creature leaves effect zone
  "on_end_turn_in_area"   // NEW - creature ends turn in zone (distinct from turn_end)
])

// Add frequency limiter
frequency: z.enum([
  "every_time",           // Triggers on each occurrence
  "first_per_turn",       // Once per turn per creature (create-bonfire, moonbeam)
  "once_per_creature"     // One-time per creature ever
]).optional()
```

---

## Implementation Tasks

### Schema Updates
- [x] Add `on_enter_area`, `on_exit_area`, `on_end_turn_in_area` to `EffectTrigger.type`
- [x] Add `frequency` field with enum values
- [ ] Document interaction between `frequency` and trigger types
- [ ] Update workflow and acceptance criteria docs

### Engine Implementation
- [ ] Create `AreaEffectTracker` class
  - [ ] Track all active area effects and their boundaries
  - [ ] Store affected tiles for each zone
  - [ ] Emit entry/exit events when creatures move
- [x] Implement frequency tracking
  - [x] Track "already triggered this turn" per creature per effect
  - [x] Reset flags at turn start
- [x] Hook into movement system
  - [x] Before move: record current position
  - [x] After move: check if entered/exited any zones
  - [x] Trigger appropriate effects
- [x] Handle turn-end-in-area
  - [x] At turn end, check if creature is in any active zones
  - [x] Apply `on_end_turn_in_area` effects

### Spell Migrations
- [x] Update `create-bonfire.json` with `on_enter_area` + `first_per_turn`
- [ ] Update `grease.json` with entry + end-turn triggers
- [ ] Update `fog-cloud.json` with obscurement on entry
- [ ] Update `entangle.json` with entry restraint

### Progress Log
- 2025-12-08: Added schema support for entry/exit/end-turn triggers, wired movement/end-turn handlers, and migrated `create-bonfire` to new triggers. Added trigger handler tests for frequency gating.

---

## Test Cases

1. **Entry trigger:** Creature walks into bonfire → Dex save → 1d8 fire if failed
2. **First per turn:** Creature enters bonfire, exits, re-enters same turn → only 1 save
3. **Turn reset:** Same creature enters bonfire next turn → save again (reset)
4. **Turn start vs entry:** Creature starts turn in bonfire → `turn_start` save; creature walks in → `on_enter_area` save (both can apply)
5. **End turn in area:** Creature moves into grease and ends turn → `on_end_turn_in_area` prone check

---

## Dependencies

- Requires movement hook infrastructure (may share with Gap 2)

---

## Estimated Effort

- Schema: 0.5 sessions
- Engine (AreaEffectTracker): 2 sessions
- Movement hook integration: 1 session
- Migration: 0.5 sessions
- **Total: 4 dev sessions**
