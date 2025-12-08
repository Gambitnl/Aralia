# Gap 1: Per-Hit Damage Riders

**Created:** 2025-12-08 12:59 CET  
**Status:** Complete
**Owner:** Gemini/Jules
**Priority:** High
**Blocks:** All smites, hex, hunter's-mark, divine-favor

---

## Problem Statement

Spells that add bonus damage to weapon attacks have no structured representation. The combat engine cannot automatically apply "on your next hit" or "on every hit" damage bonuses.

---

## Affected Spells

| Spell | Rider | Trigger | Duration |
|-------|-------|---------|----------|
| `divine-favor` | +1d4 radiant | Every melee hit | Concentration, 1 min |
| `hex` | +1d6 necrotic | Every hit on marked target | Concentration, 1 hr+ |
| `hunter's-mark` | +1d6 force | Every hit on marked target | Concentration, 1 hr+ |
| `searing-smite` | +1d6 fire + ongoing burn | First melee hit | Concentration, 1 min |
| `thunderous-smite` | +2d6 thunder + push | First melee hit | Concentration, 1 min |
| `wrathful-smite` | +1d6 psychic + frightened | First melee hit | Concentration, 1 min |
| `hail-of-thorns` | +1d10 piercing AoE | First ranged hit | Concentration, 1 min |

---

## Required Schema Changes

```typescript
// Add to EffectTrigger in spellValidator.ts
type: z.enum([
  "immediate",
  "after_primary",
  "turn_start",
  "turn_end",
  "on_attack_hit",        // NEW - triggers when caster hits with attack
])

// Add consumption tracking
consumption: z.enum([
  "unlimited",            // Every qualifying hit (divine-favor, hex)
  "first_hit",            // Consumes on first hit (smites)
  "per_turn"              // Once per turn maximum
]).optional()

// Add attack filter
attackFilter: z.object({
  weaponType: z.enum(["melee", "ranged", "any"]).optional(),
  attackType: z.enum(["weapon", "spell", "any"]).optional()
}).optional()
```

---

## Implementation Tasks

### Schema Updates
- [x] Add `on_attack_hit` trigger type to `EffectTrigger` in `spellValidator.ts`
- [x] Add `consumption` field with enum values
- [x] Add `attackFilter` object for weapon/attack type constraints
- [x] Update `@WORKFLOW-SPELL-CONVERSION.md` with new fields
- [x] Update `JULES_ACCEPTANCE_CRITERIA.md` with rider guidance

### Engine Implementation
- [x] Create `AttackRiderSystem` class in combat engine (`src/systems/combat/AttackRiderSystem.ts`)
- [x] Create `RegisterRiderCommand` (`src/commands/effects/RegisterRiderCommand.ts`)
- [x] Integrate with `SpellCommandFactory` to generate rider commands
- [x] Integrate with `useAbilitySystem` to apply riders on attack hits
- [x] Integrate rider cleanup in `ConcentrationCommands.ts`
- [x] Handle consumption (remove rider after first hit for smites)

### Spell Migrations
- [x] Update `divine-favor.json` to use finalized schema
- [x] Migrate `hex.json` to new rider schema
- [x] Migrate `hunter's-mark.json` to new rider schema
- [x] Migrate `searing-smite.json` to new rider schema
- [x] Migrate `thunderous-smite.json` to new rider schema
- [x] Migrate `wrathful-smite.json` to new rider schema
- [x] Migrate `hail-of-thorns.json` to new rider schema

---

## Test Cases

1. **Every-hit rider:** Cast `divine-favor` → hit with melee 3x → verify +1d4 radiant on each hit
2. **First-hit consumption:** Cast `searing-smite` → hit twice → verify only first hit applies bonus
3. **Mark targeting:** Cast `hex` → hit marked target 3x → verify +1d6 on each; hit different target → no bonus
4. **Weapon filter:** Smite riders only apply to melee → verify ranged attack doesn't trigger
5. **Concentration end:** Break concentration on `hex` → next hit should NOT add bonus

---

## Dependencies

- None (foundational gap)

---

## Completed: 2025-12-08

- Schema: ✅
- Engine: ✅
- Migration: ✅
