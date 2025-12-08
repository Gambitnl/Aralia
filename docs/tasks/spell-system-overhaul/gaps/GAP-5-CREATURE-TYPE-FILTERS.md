# Gap 5: Creature Type Filtering

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🟡 MEDIUM  
**Status:** Not Started  
**Blocks:** chill-touch, protection-from-evil-and-good, divine-smite (extra damage), banishment

---

## Problem Statement

Some spell effects only apply when the target is a specific **creature type** (Undead, Fiend, etc.), **size** (Large+), or **alignment** (Evil). The current condition schema cannot filter by target properties.

---

## Affected Spells

| Spell | Filter | Effect When Matched |
|-------|--------|---------------------|
| `chill-touch` | Undead | Disadvantage on attacks vs caster |
| `protection-from-evil-and-good` | Aberration, Celestial, Elemental, Fey, Fiend, Undead | Attack disadvantage, charm/frighten/possess immunity |
| `divine-smite` (L1 feature) | Fiend, Undead | Extra +1d8 radiant damage |
| `banishment` (L4) | Not native to current plane | Permanent banishment if concentration held |
| `hold-monster` (L5) | Not Undead | Undead are immune |

---

## Current State

```typescript
// Existing condition schema (no target filtering)
condition: {
  type: "hit" | "save" | "always",
  saveType?: SavingThrowAbility,
  saveEffect?: "none" | "half" | "negates_condition"
}
```

- No `targetFilter` field
- Creature type stored on entities but not queryable in effects
- All filter logic in prose descriptions

---

## Required Schema Changes

```typescript
// Add to EffectCondition in spellValidator.ts
targetFilter: z.object({
  creatureTypes: z.array(z.string()).optional(),    // ["Undead", "Fiend"]
  excludeCreatureTypes: z.array(z.string()).optional(), // ["Undead"] for hold-monster
  sizes: z.array(z.string()).optional(),            // ["Large", "Huge", "Gargantuan"]
  alignments: z.array(z.string()).optional(),       // ["Evil"]
  hasCondition: z.array(z.string()).optional(),     // ["Frightened", "Charmed"]
  isNativeToPlane: z.boolean().optional(),          // For banishment
  inverse: z.boolean().optional()                   // true = exclude instead of include
}).optional()
```

---

## Implementation Tasks

### Schema Updates
- [ ] Add `targetFilter` object to `EffectCondition` in `spellValidator.ts`
- [ ] Include `creatureTypes`, `excludeCreatureTypes`, `sizes`, `alignments`
- [ ] Add `hasCondition` for effects that only apply to already-affected targets
- [ ] Add `isNativeToPlane` for plane-based effects (requires plane tracking)
- [ ] Update workflow and acceptance criteria docs

### Engine Implementation
- [ ] Ensure all creature entities have `creatureType` field populated
- [ ] Update effect application logic in `SpellCommandFactory`
  - [ ] Before applying effect, check `targetFilter` against target properties
  - [ ] Skip effect if filter doesn't match
- [ ] Handle `inverse` flag for "everyone except" filters
- [ ] Log when effect is skipped due to filter mismatch

### Data Verification
- [ ] Audit all monster/NPC data for `creatureType` field
- [ ] Add missing creature types to existing entities
- [ ] Consider alignment data for evil-detection spells

### Spell Migrations
- [ ] Update `chill-touch.json` with `targetFilter: { creatureTypes: ["Undead"] }`
- [ ] Update `protection-from-evil-and-good.json` with multi-type filter
- [ ] Prepare templates for `divine-smite`, `banishment`, `hold-monster`

---

## Test Cases

1. **Undead filter:** `chill-touch` hits Zombie → verify disadvantage applied
2. **Non-match:** `chill-touch` hits Human → verify NO disadvantage
3. **Multi-type:** `protection-from-evil-and-good` → Fiend attacks → disadvantage; Humanoid attacks → no disadvantage
4. **Exclude filter:** `hold-monster` cast on Undead → spell fails (immune)
5. **Size filter:** Spell that affects only Large+ → verify Small creature not affected

---

## Dependencies

- Creature data must have `creatureType` field populated
- May need alignment data for certain spells

---

## Estimated Effort

- Schema: 0.5 sessions
- Engine (filter logic): 1 session
- Data audit: 0.5 sessions
- Migration: 0.5 sessions
- **Total: 2.5 dev sessions**
