# Gap 2: Reactive / Event-Driven Triggers

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🔴 CRITICAL  
**Status:** ✅ COMPLETED  
**Blocks:** booming-blade, compelled-duel, sanctuary, witch-bolt

---

## Problem Statement

Many spells trigger based on **target behavior** (movement, attacks, spellcasting), not just temporal phases (turn start/end). The current trigger system is purely turn-phase-driven and cannot react to creature actions.

---

## Affected Spells

| Spell | Trigger Condition | Effect |
|-------|-------------------|--------|
| `booming-blade` | Target willingly moves | 1d8+ thunder damage |
| `compelled-duel` | Target attacks someone else | Wisdom save or lose attack |
| `sanctuary` | Attacker targets warded creature | Wisdom save or must retarget |
| `witch-bolt` | Caster uses action to sustain | 1d12 lightning (no attack roll) |

---

## Current State

```typescript
// Existing trigger types (insufficient)
trigger.type: "immediate" | "after_primary" | "turn_start" | "turn_end"
```

- No way to trigger on target movement
- No way to trigger on target attacks
- No way to gate effects on caster's sustained action
- `booming-blade` secondary damage is purely descriptive

---

## Required Schema Changes

```typescript
// Expand EffectTrigger in spellValidator.ts
type: z.enum([
  "immediate",
  "after_primary",
  "turn_start",
  "turn_end",
  "on_target_move",       // NEW - target moves (willingly or forced)
  "on_target_attack",     // NEW - target makes an attack
  "on_target_cast",       // NEW - target casts a spell
  "on_caster_action"      // NEW - caster uses action to sustain
])

// Add movement qualifier
movementType: z.enum([
  "any",
  "willing",              // Excludes forced movement (booming-blade)
  "forced"                // Only push/pull/teleport by others
]).optional()

// For sustain mechanics
sustainCost: z.object({
  actionType: z.enum(["action", "bonus_action", "reaction"]),
  optional: z.boolean()   // true = can skip, false = must sustain or lose
}).optional()
```

---

## Implementation Tasks

### Schema Updates
- [x] Add `on_target_move`, `on_target_attack`, `on_target_cast`, `on_caster_action` to `EffectTrigger.type`
- [x] Add `movementType` field for willing vs forced distinction
- [x] Add `sustainCost` object for action-gated effects
- [x] Update workflow and acceptance criteria docs

### Engine Implementation
- [x] Create `MovementEventEmitter` in combat engine
  - [x] Emit event when creature moves
  - [x] Track willing vs forced movement
  - [x] Allow effects to subscribe
- [x] Create `AttackEventEmitter` in combat engine
  - [x] Emit event when creature attacks (before resolution)
  - [x] Allow pre-attack hooks (sanctuary save)
- [x] Implement sustain action handling
  - [x] Track which spells require sustained actions
  - [x] Prompt caster for sustain on their turn
  - [x] End effect if not sustained
- [x] Update `SpellCommandFactory` to register reactive listeners

### Spell Migrations
- [x] Migrate `booming-blade.json` with `on_target_move` + `movementType: willing`
- [x] Migrate `compelled-duel.json` with `on_target_attack`
- [x] Migrate `sanctuary.json` with target attack reaction
- [x] Migrate `witch-bolt.json` with `on_caster_action` sustain

---

## Test Cases

1. **Willing movement:** `booming-blade` → target walks away → verify thunder damage triggers
2. **Forced movement:** `booming-blade` → target is pushed → verify NO damage (forced ≠ willing)
3. **Sustain success:** `witch-bolt` → caster uses action → verify 1d12 lightning continues
4. **Sustain failure:** `witch-bolt` → caster attacks instead → verify spell ends
5. **Sanctuary redirect:** Enemy attacks warded ally → Wis save → failure → must choose new target or lose action

---

## Dependencies

- Shares `AttackEventEmitter` with Gap 1 (Per-Hit Riders)

---

## Estimated Effort

- Schema: 1 session
- Engine (event emitters): 2–3 sessions
- Migration: 1 session
- **Total: 4–5 dev sessions**
