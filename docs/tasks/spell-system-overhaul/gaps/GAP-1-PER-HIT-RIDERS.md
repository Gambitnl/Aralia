
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

## Current State

- `divine-favor` has partial `attackAugments` schema (added in Batch 3)
- All other smites/marks use `description` field only
- No `on_attack_hit` trigger type in effect schema
- No consumption tracking (first hit vs every hit)

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
- [ ] Add `on_attack_hit` trigger type to `EffectTrigger` in `spellValidator.ts`
- [ ] Add `consumption` field with enum values
- [ ] Add `attackFilter` object for weapon/attack type constraints
- [ ] Update `@WORKFLOW-SPELL-CONVERSION.md` with new fields
- [ ] Update `JULES_ACCEPTANCE_CRITERIA.md` with rider guidance

### Engine Implementation
- [ ] Create `AttackRiderSystem` class in combat engine
- [ ] Register attack listeners when spell is cast
- [ ] Apply bonus damage on qualifying hits
- [ ] Handle consumption (remove rider after first hit for smites)
- [ ] Integrate with `SpellCommandFactory` to set up riders

### Spell Migrations
- [ ] Update `divine-favor.json` to use finalized schema
- [ ] Migrate `hex.json` to new rider schema
- [ ] Migrate `hunter's-mark.json` to new rider schema
- [ ] Migrate `searing-smite.json` to new rider schema
- [ ] Migrate `thunderous-smite.json` to new rider schema
- [ ] Migrate `wrathful-smite.json` to new rider schema
- [ ] Migrate `hail-of-thorns.json` to new rider schema

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

## Estimated Effort

- Schema: 1 session
- Engine: 2 sessions
- Migration: 1 session
- **Total: 4 dev sessions**
