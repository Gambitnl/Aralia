# Gap 4: Repeat Saves & Save Modifiers

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🟠 HIGH  
**Status:** Not Started  
**Blocks:** tasha's-hideous-laughter, ensnaring-strike, hold-person, crown-of-madness, many concentration spells

---

## Problem Statement

Many concentration spells allow targets to **repeat saving throws** each turn to escape, sometimes with modifiers (advantage when damaged, disadvantage in certain conditions). The current schema treats saves as one-shot events with no repeat mechanism.

---

## Affected Spells

| Spell | Repeat Timing | Modifier | Success Effect |
|-------|---------------|----------|----------------|
| `tasha's-hideous-laughter` | End of each turn | Advantage if damaged since last turn | End incapacitated |
| `hold-person` (L2) | End of each turn | None | End paralyzed |
| `ensnaring-strike` | Target's turn (Str check) | Large+ has advantage | End restrained |
| `wrathful-smite` | Use action for Wis check | None (costs action) | End frightened |
| `crown-of-madness` (L2) | End of each turn | None | End charmed |
| `dominate-person` (L5) | When takes damage | — | Repeat with advantage |

---

## Current State

- `saveModifiers` partially exists for size-based advantage (added in Batch 3)
- No `repeatSave` field for "save again each turn"
- No `advantageOnDamage` hook
- Repeat saves described in prose only

---

## Required Schema Changes

```typescript
// Add to STATUS_CONDITION effects in spellValidator.ts
repeatSave: z.object({
  timing: z.enum([
    "turn_end",           // End of target's turn (most common)
    "turn_start",         // Start of target's turn
    "on_damage",          // When target takes damage
    "on_action"           // Target must use action to attempt (wrathful smite)
  ]),
  saveType: z.enum([
    "Strength", "Dexterity", "Constitution",
    "Intelligence", "Wisdom", "Charisma",
    "strength_check",     // Ability check, not save (ensnaring strike)
    "wisdom_check"
  ]),
  successEnds: z.boolean(),   // true = condition ends on success
  useOriginalDC: z.boolean()  // true = use caster's spell DC (default)
}).optional()

// Extend saveModifiers
saveModifiers: z.object({
  sizeAdvantage: z.array(z.string()).optional(),    // ["Large", "Huge"] = advantage
  sizeDisadvantage: z.array(z.string()).optional(), // ["Small", "Tiny"] = disadvantage
  advantageOnDamage: z.boolean().optional(),        // Advantage if damaged this turn
  disadvantageIf: z.string().optional()             // Freeform condition for disadvantage
}).optional()
```

---

## Implementation Tasks

### Schema Updates
- [ ] Add `repeatSave` object to STATUS_CONDITION effect schema
- [ ] Extend `saveModifiers` with `advantageOnDamage`, `sizeDisadvantage`
- [ ] Handle `on_action` timing (costs action to attempt escape)
- [ ] Update workflow and acceptance criteria docs

### Engine Implementation
- [ ] Implement repeat save prompts
  - [ ] At appropriate timing (turn_end, turn_start, on_damage)
  - [ ] Check for applicable modifiers
  - [ ] Remove condition on success if `successEnds: true`
- [ ] Track "damaged this turn" flag
  - [ ] Set flag when creature takes damage
  - [ ] Clear flag at turn start
  - [ ] Check flag for `advantageOnDamage` modifier
- [ ] Handle `on_action` saves
  - [ ] Add "Attempt Escape" action to creature's available actions
  - [ ] Consume action on attempt
  - [ ] Roll ability check/save and resolve

### Spell Migrations
- [ ] Update `tasha's-hideous-laughter.json` with repeat save + advantage on damage
- [ ] Update `ensnaring-strike.json` with Str check + size advantage
- [ ] Update `wrathful-smite.json` with on_action Wis check
- [ ] Prepare templates for Level 2+ spells (hold-person, crown-of-madness)

---

## Test Cases

1. **Basic repeat save:** Target fails `tasha's` → end of their turn → Wis save → pass → laughter ends
2. **Advantage on damage:** Target fails `tasha's` → takes damage → end of turn → verify advantage on repeat save
3. **Size advantage:** Large creature restrained by `ensnaring-strike` → Str check → verify advantage
4. **Action cost:** Frightened by `wrathful-smite` → target uses action → Wis check → verify action consumed
5. **Damage reroll:** Target under `dominate-person` → takes damage → immediate save with advantage

---

## Dependencies

- Damage tracking system (for `advantageOnDamage`)
- Action economy system (for `on_action` timing)

---

## Estimated Effort

- Schema: 1 session
- Engine (repeat save system): 2 sessions
- Damage tracking: 0.5 sessions
- Migration: 0.5 sessions
- **Total: 4 dev sessions**
