# Gap 7: Defensive AC Mechanics

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🟡 MEDIUM  
**Status:** Not Started  
**Blocks:** mage-armor, shield, shield-of-faith, barkskin

---

## Problem Statement

Spells that modify Armor Class lack structured fields for:
- Setting a new base AC calculation
- Adding flat AC bonuses
- Setting AC minimums
- Reaction-triggered AC buffs

All AC mechanics are currently in prose descriptions.

---

## Affected Spells

| Spell | AC Mechanic | Duration | Special |
|-------|-------------|----------|---------|
| `mage-armor` | Set base AC to 13 + Dex | 8 hours | Only if no armor worn |
| `shield` | +5 AC | Until start of next turn | Reaction, also vs magic missile |
| `shield-of-faith` | +2 AC | Concentration, 10 min | — |
| `barkskin` (L2) | AC can't be less than 16 | Concentration, 1 hr | Touch target |
| `haste` (L3) | +2 AC | Concentration, 1 min | Plus other benefits |

---

## Current State

```typescript
// DEFENSIVE effect type exists but lacks AC fields
{
  type: "DEFENSIVE",
  description: "...",  // All AC logic is here
  // No structured AC fields
}
```

- AC calculated elsewhere in combat system
- No hook for spell-based AC modifications
- `shield` reaction timing not modeled

---

## Required Schema Changes

```typescript
// Extend DEFENSIVE effect in spellValidator.ts
defensive: z.object({
  type: z.enum([
    "ac_bonus",           // Add flat bonus to existing AC
    "set_base_ac",        // Replace base AC calculation (mage-armor)
    "ac_minimum",         // AC can't be below X (barkskin)
    "damage_resistance",  // Existing
    "damage_immunity",    // Existing
    "attack_immunity"     // Complete immunity (mirror image, blink)
  ]),
  
  // AC fields
  acBonus: z.number().optional(),           // +2, +5, etc.
  baseACFormula: z.string().optional(),     // "13 + dex_mod"
  acMinimum: z.number().optional(),         // Floor value (16 for barkskin)
  
  // Duration
  duration: DurationSchema,
  
  // Reaction trigger (for shield)
  reactionTrigger: z.object({
    event: z.enum(["when_hit", "when_targeted", "when_damaged"]),
    includesSpells: z.array(z.string()).optional()  // ["magic-missile"]
  }).optional(),
  
  // Restrictions
  restrictions: z.object({
    noArmor: z.boolean().optional(),        // Mage armor restriction
    noShield: z.boolean().optional(),       // Some effects don't stack with shield
    targetSelf: z.boolean().optional()      // Must be cast on self
  }).optional()
}).optional()
```

---

## Implementation Tasks

### Schema Updates
- [ ] Extend `DEFENSIVE` effect with AC-specific fields
- [ ] Add `acBonus`, `baseACFormula`, `acMinimum` fields
- [ ] Add `reactionTrigger` for reaction-based AC spells
- [ ] Add `restrictions` for armor/shield requirements
- [ ] Update workflow and acceptance criteria docs

### Engine Implementation
- [ ] Update AC calculation pipeline
  - [ ] Check for active `set_base_ac` effects (use highest)
  - [ ] Sum all active `ac_bonus` effects
  - [ ] Apply `ac_minimum` as floor
- [ ] Handle reaction AC buffs
  - [ ] When attack hits, check for available reaction AC spells
  - [ ] Prompt player "Cast Shield as reaction?"
  - [ ] Retroactively apply AC bonus and recheck hit
- [ ] Handle restrictions
  - [ ] Validate `noArmor` restriction at cast time
  - [ ] Validate stacking rules (multiple base AC effects)
- [ ] Track buff durations
  - [ ] `shield` ends at start of caster's next turn
  - [ ] Concentration buffs end on concentration break

### Spell Migrations
- [ ] Update `mage-armor.json` with `set_base_ac: "13 + dex_mod"`, `noArmor: true`
- [ ] Update `shield.json` with `acBonus: 5`, reaction trigger
- [ ] Update `shield-of-faith.json` with `acBonus: 2`
- [ ] Template for `barkskin` with `acMinimum: 16`

---

## Test Cases

1. **Base AC override:** Wizard with no armor → cast `mage-armor` → AC becomes 13 + Dex
2. **Armor restriction:** Wizard wearing armor → cast `mage-armor` → spell fails or doesn't apply
3. **AC bonus stacking:** Have `shield-of-faith` (+2) → cast `shield` (+5) → total +7 AC
4. **Reaction timing:** Attack roll 18 hits AC 16 → cast `shield` → new AC 21 → attack misses
5. **AC minimum:** Target has AC 12 → `barkskin` cast → AC becomes 16
6. **AC minimum with bonus:** Target AC 12, `barkskin` active (min 16) → `shield-of-faith` (+2) → AC 18

---

## Edge Cases

- **Multiple base AC sources:** `mage-armor` vs Dragon Sorcerer's Draconic Resilience → use higher
- **Shield duration:** Shield lasts until "start of your next turn" not "1 round"
- **Magic Missile:** Shield specifically blocks all darts, not just AC increase

---

## Dependencies

- AC calculation centralized in one location
- Attack resolution flow (for reaction prompts)

---

## Estimated Effort

- Schema: 0.5 sessions
- Engine (AC calculation update): 1 session
- Reaction UI: 1 session
- Migration: 0.5 sessions
- **Total: 3 dev sessions**
