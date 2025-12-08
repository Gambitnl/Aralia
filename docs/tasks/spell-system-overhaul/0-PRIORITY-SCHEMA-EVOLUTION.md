# Priority: Schema Evolution for Spell System

**Created:** 2025-12-08 12:36 CET  
**Priority:** 🔴 HIGH  
**Source:** Consolidated gaps from Level 1 (Batches 1–7) and Cantrip migrations  
**Blocking:** Full automation of ~40% of Level 1 spells; all smites, marks, wards, and summons

---

## Executive Summary

The spell migration audit revealed **7 critical schema gaps** that prevent machine-readable execution of complex spell mechanics. These gaps affect:
- All Paladin smite spells
- Warlock `hex` and Ranger `hunter's-mark`
- Terrain spells (`create-bonfire`, `grease`, `fog-cloud`)
- Summoning spells (`find-familiar`, `unseen-servant`)
- Defensive buffs (`mage-armor`, `shield`, `shield-of-faith`)

Until addressed, these mechanics remain **prose-only descriptions** that the combat engine cannot automate.

---

## Gap 1: Per-Hit Damage Riders

### Priority: 🔴 CRITICAL

### Problem
Spells that add damage to weapon attacks have no structured representation.

### Affected Spells
| Spell | Rider | Trigger | Duration |
|-------|-------|---------|----------|
| `divine-favor` | +1d4 radiant | Every melee hit | Concentration, 1 min |
| `hex` | +1d6 necrotic | Every hit on marked target | Concentration, 1 hr+ |
| `hunter's-mark` | +1d6 force | Every hit on marked target | Concentration, 1 hr+ |
| `searing-smite` | +1d6 fire + ongoing burn | First melee hit | Concentration, 1 min |
| `thunderous-smite` | +2d6 thunder + push | First melee hit | Concentration, 1 min |
| `wrathful-smite` | +1d6 psychic + frightened | First melee hit | Concentration, 1 min |
| `hail-of-thorns` | +1d10 piercing AoE | First ranged hit | Concentration, 1 min |

### Current State
- `divine-favor` has partial `attackAugments` schema (added in Batch 3)
- All other smites/marks use `description` field only
- No `on_attack_hit` trigger in effect schema

### Required Schema Changes

```typescript
// Add to EffectTrigger
type: z.enum([
  "immediate",
  "after_primary",
  "turn_start",
  "turn_end",
  "on_attack_hit",        // NEW - triggers when caster hits with attack
  "on_target_action"      // NEW - triggers when target acts
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

### Implementation Tasks
- [ ] Add `on_attack_hit` trigger type to `EffectTrigger` in `spellValidator.ts`
- [ ] Add `consumption` field to track single-use vs repeating riders
- [ ] Add `attackFilter` to constrain which attacks qualify
- [ ] Update `SpellCommandFactory` to register attack listeners
- [ ] Create `AttackRiderSystem` in combat engine to apply bonuses
- [ ] Migrate smite spells to use new schema
- [ ] Migrate `hex`, `hunter's-mark`, `divine-favor` to new schema

### Test Cases
1. Cast `divine-favor` → hit with melee → verify +1d4 radiant added
2. Cast `searing-smite` → hit twice → verify only first hit applies bonus
3. Cast `hex` → hit marked target 3x → verify +1d6 on each hit

---

## Gap 2: Reactive / Event-Driven Triggers

### Priority: 🔴 CRITICAL

### Problem
Many spells trigger based on **target behavior** (movement, attacks, spellcasting), not temporal phases.

### Affected Spells
| Spell | Trigger Condition | Current Workaround |
|-------|-------------------|-------------------|
| `booming-blade` | Target willingly moves | `description` text |
| `compelled-duel` | Target attacks someone else | `taunt` schema partial |
| `sanctuary` | Attacker targets warded creature | `description` text |
| `witch-bolt` | Caster uses action to sustain | `description` text |

### Current State
```typescript
// Existing trigger types (insufficient)
trigger.type: "immediate" | "after_primary" | "turn_start" | "turn_end"
```

### Required Schema Changes

```typescript
// Expand EffectTrigger
type: z.enum([
  "immediate",
  "after_primary",
  "turn_start",
  "turn_end",
  "on_target_move",       // NEW - target moves (willingly or forced)
  "on_target_attack",     // NEW - target makes an attack
  "on_target_cast",       // NEW - target casts a spell
  "on_caster_action",     // NEW - caster uses action to sustain
  "on_attack_hit"         // (from Gap 1)
])

// Add movement qualifier
movementType: z.enum([
  "any",
  "willing",              // Excludes forced movement
  "forced"                // Only push/pull/teleport by others
]).optional()

// For sustain mechanics
sustainCost: z.object({
  actionType: z.enum(["action", "bonus_action", "reaction"]),
  optional: z.boolean()   // true = can skip, false = must sustain or lose
}).optional()
```

### Implementation Tasks
- [ ] Add new trigger types to `EffectTrigger` schema
- [ ] Implement `MovementEventEmitter` in combat engine
- [ ] Implement `AttackEventEmitter` in combat engine (shares with Gap 1)
- [ ] Add `sustainCost` field for action-gated effects
- [ ] Update `ConcentrationProvider` to handle sustain actions
- [ ] Migrate `booming-blade`, `sanctuary`, `witch-bolt` to new schema

### Test Cases
1. `booming-blade` → target moves → verify thunder damage triggers
2. `booming-blade` → target pushed → verify NO damage (forced movement)
3. `witch-bolt` → caster uses action → verify 1d12 lightning continues
4. `witch-bolt` → caster attacks instead → verify spell ends

---

## Gap 3: Area Entry/Exit Triggers

### Priority: 🟠 HIGH

### Problem
Persistent area effects (bonfires, clouds, zones) need to trigger when creatures **enter or exit** the area, not just at turn boundaries.

### Affected Spells
| Spell | Entry Trigger | Exit Trigger | Additional |
|-------|---------------|--------------|------------|
| `create-bonfire` | Dex save, 1d8 fire | — | First time per turn |
| `grease` | Dex save or prone | — | Also end-of-turn |
| `fog-cloud` | Obscured (immediate) | Vision restored | — |
| `entangle` | Restrained (immediate) | — | Str check to escape |

### Current State
- `create-bonfire` uses `turn_start` (misses entry damage)
- No `on_enter_area` or `first_per_turn` frequency

### Required Schema Changes

```typescript
// Add to EffectTrigger
type: z.enum([
  // ... existing ...
  "on_enter_area",        // NEW - creature enters effect zone
  "on_exit_area",         // NEW - creature leaves effect zone
  "on_end_turn_in_area"   // NEW - creature ends turn in zone
])

// Add frequency limiter
frequency: z.enum([
  "every_time",           // Triggers on each occurrence
  "first_per_turn",       // Once per turn per creature
  "once_per_creature"     // One-time per creature ever
]).optional()
```

### Implementation Tasks
- [x] Add area trigger types to schema
- [ ] Create `AreaEffectTracker` to monitor zone boundaries
- [x] Implement turn-based frequency tracking per creature
- [x] Hook into movement system to emit entry/exit events
- [ ] Migrate `create-bonfire`, `grease`, terrain spells (create-bonfire updated; others pending)

### Test Cases
1. `create-bonfire` → creature walks through → Dex save + damage
2. `create-bonfire` → creature enters twice same turn → only 1 save
3. `grease` → creature ends turn in area → Dex save or prone

---

## Gap 4: Repeat Saves & Save Modifiers

### Priority: 🟠 HIGH

### Problem
Many concentration spells allow **repeat saves** each turn, sometimes with modifiers based on circumstances.

### Affected Spells
| Spell | Repeat Condition | Modifier |
|-------|------------------|----------|
| `tasha's-hideous-laughter` | End of each turn | Advantage if damaged since last turn |
| `hold-person` (Level 2) | End of each turn | None |
| `ensnaring-strike` | Creature's turn (Str check) | Large+ has advantage |
| `wrathful-smite` | Use action for Wis check | Caster sets DC |

### Current State
- `saveModifiers` partially added for size advantage (Batch 3)
- No `repeatSave` primitive for "save again each turn"
- No `advantageOnDamage` hook

### Required Schema Changes

```typescript
// Add to effects with saves
repeatSave: z.object({
  timing: z.enum(["turn_end", "turn_start", "on_action"]),
  abilityOrCheck: z.enum([...abilities, "strength_check", "wisdom_check"]),
  successEnds: z.boolean()       // true = condition ends on success
}).optional()

saveModifiers: z.object({
  sizeAdvantage: z.array(z.string()).optional(),  // ["Large", "Huge"] = advantage
  advantageOnDamage: z.boolean().optional(),      // Advantage if damaged
  disadvantageIf: z.string().optional()           // Condition for disadvantage
}).optional()
```

### Implementation Tasks
- [ ] Add `repeatSave` schema to status condition effects
- [ ] Extend `saveModifiers` with damage-based advantage
- [ ] Implement turn-end save prompts in combat loop
- [ ] Track "damaged this turn" flag on creatures
- [ ] Migrate `tasha's-hideous-laughter`, smites, hold spells

### Test Cases
1. `tasha's` → target fails → end of turn → repeat Wis save → passes → effect ends
2. `tasha's` → target damaged → repeat save → verify advantage granted
3. `ensnaring-strike` → Large creature → Str check → verify advantage

---

## Gap 5: Creature Type Filtering

### Priority: 🟡 MEDIUM

### Problem
Some effects only apply to creatures of specific types, sizes, or alignments.

### Affected Spells
| Spell | Filter | Effect |
|-------|--------|--------|
| `chill-touch` | Undead | Disadvantage on attacks vs caster |
| `protection-from-evil-and-good` | Aberration, Celestial, Elemental, Fey, Fiend, Undead | Attack disadvantage, immunity to charm/frighten/possess |
| `divine-smite` (Level 2) | Fiend, Undead | Extra +1d8 radiant |

### Current State
- No `targetFilter` in condition schema
- Creature type stored as string on entities but not queryable in effects

### Required Schema Changes

```typescript
// Add to EffectCondition
targetFilter: z.object({
  creatureTypes: z.array(z.string()).optional(),    // ["Undead", "Fiend"]
  sizes: z.array(z.string()).optional(),            // ["Large", "Huge", "Gargantuan"]
  alignments: z.array(z.string()).optional(),       // ["Evil"]
  hasCondition: z.array(z.string()).optional(),     // ["Frightened"]
  inverse: z.boolean().optional()                   // true = exclude instead of include
}).optional()
```

### Implementation Tasks
- [ ] Add `targetFilter` to `EffectCondition` schema
- [ ] Ensure all entities have `creatureType` field populated
- [ ] Update effect application logic to check filter before applying
- [ ] Migrate `chill-touch`, `protection-from-evil-and-good`

### Test Cases
1. `chill-touch` → hit Undead → verify disadvantage applied
2. `chill-touch` → hit Humanoid → verify NO disadvantage

---

## Gap 6: Summoning & Minion System

### Priority: 🟢 FUTURE (Complex)

### Problem
Spells that create entities need a structured contract for stats, commands, and persistence.

### Affected Spells
| Spell | Entity | Special Features |
|-------|--------|------------------|
| `find-familiar` | Familiar | Form options, telepathy, touch delivery, pocket dimension |
| `unseen-servant` | Servant | HP 1, AC 10, Str 2, 30 lb. carry, 15 ft. speed, command each turn |
| `tenser's-floating-disk` | Disk | Follows 20 ft. behind, 500 lb., hovers 3 ft., doesn't ascend |

### Current State
- All mechanics in `description` field
- No structured summon stat block
- No command economy system

### Required Schema Changes

```typescript
// New top-level effect type
{
  type: "SUMMONING",
  summon: {
    entityType: z.enum(["familiar", "servant", "construct", "vehicle"]),
    duration: DurationSchema,
    statBlock: {
      hp: z.number().optional(),
      ac: z.number().optional(),
      speed: z.number().optional(),
      abilities: z.record(z.number()).optional(),  // { "str": 2, "dex": 10 }
      capacity: z.number().optional()              // Carry weight
    }.optional(),
    formOptions: z.array(z.string()).optional(),   // ["Bat", "Cat", "Hawk"]
    telepathyRange: z.number().optional(),
    commandCost: z.enum(["action", "bonus_action", "free"]).optional(),
    specialActions: z.array(z.string()).optional() // ["Touch Spell Delivery"]
  }
}
```

### Implementation Tasks
- [ ] Design full `SummonSchema` with stat blocks
- [ ] Create `SummonedEntityManager` for tracking summoned creatures
- [ ] Implement command economy (bonus action per turn for orders)
- [ ] Handle familiar special actions (touch delivery, senses)
- [ ] Create UI for summoned creature management
- [ ] Migrate `find-familiar`, `unseen-servant`, `tenser's-floating-disk`

### Complexity Note
This is a **major system addition** requiring entity management, AI behaviors, and UI work. Recommend deferring until core combat gaps (1–4) are resolved.

---

## Gap 7: Defensive AC Mechanics

### Priority: 🟡 MEDIUM

### Problem
Spells that modify AC lack structured fields for base AC setting or AC bonuses.

### Affected Spells
| Spell | AC Mechanic | Duration |
|-------|-------------|----------|
| `mage-armor` | Set base AC to 13 + Dex | 8 hours |
| `shield` | +5 AC | Until start of next turn |
| `shield-of-faith` | +2 AC | Concentration, 10 min |
| `barkskin` (Level 2) | AC can't be less than 16 | Concentration, 1 hr |

### Current State
- All in `DEFENSIVE` effect type with `description` text
- No `acBonus` or `setBaseAC` fields
- `shield` reaction timing not modeled

### Required Schema Changes

```typescript
// Add to DEFENSIVE effect
defensive: z.object({
  type: z.enum([
    "ac_bonus",           // Add flat bonus
    "set_base_ac",        // Replace base AC calculation
    "ac_minimum",         // AC can't be below X
    "damage_resistance",  // Existing
    "damage_immunity"     // Existing
  ]),
  value: z.number().optional(),           // Bonus amount or base value
  formula: z.string().optional(),         // "13 + dex_mod"
  duration: DurationSchema,
  reactionTrigger: z.string().optional()  // "when hit by attack" for Shield
}).optional()
```

### Implementation Tasks
- [ ] Add AC fields to `DEFENSIVE` effect schema
- [ ] Update AC calculation in combat to check active defensive effects
- [ ] Handle reaction-based AC buffs (Shield)
- [ ] Migrate `mage-armor`, `shield`, `shield-of-faith`

### Test Cases
1. `mage-armor` → verify AC becomes 13 + Dex (ignores armor)
2. `shield` → get hit → cast as reaction → verify +5 AC retroactively
3. Both active → verify `shield` bonus stacks on `mage-armor` base

---

## Implementation Roadmap

### Phase 1: Attack & Event Triggers (Gaps 1 + 2)
**ETA:** 3–5 dev sessions  
**Unblocks:** All smites, marks, `booming-blade`, `sanctuary`, `witch-bolt`

1. Extend `EffectTrigger` with `on_attack_hit`, `on_target_move`, `consumption`
2. Create event emitter infrastructure in combat engine
3. Implement `AttackRiderSystem`
4. Migrate 10+ spells

### Phase 2: Area & Save Mechanics (Gaps 3 + 4)
**ETA:** 2–3 dev sessions  
**Unblocks:** Zone spells, laughter/hold effects

1. Add area entry triggers and frequency tracking
2. Add `repeatSave` and `saveModifiers` extensions
3. Hook into movement and turn systems
4. Migrate zone spells and save-repeat spells

### Phase 3: Filters & Defenses (Gaps 5 + 7)
**ETA:** 1–2 dev sessions  
**Unblocks:** Type-conditional effects, AC spells

1. Add `targetFilter` to condition schema
2. Add AC fields to defensive schema
3. Update AC calculation pipeline
4. Migrate remaining spells

### Phase 4: Summoning System (Gap 6)
**ETA:** 5+ dev sessions (major feature)  
**Unblocks:** Familiar, servant, disk, higher-level summons

1. Design full summon contract schema
2. Build summoned entity manager
3. Implement command economy and AI
4. Create summoned creature UI

---

## Appendix: Full Spell Impact List

### Spells Blocked by Gap 1 (Per-Hit Riders)
- `divine-favor`, `hex`, `hunter's-mark`
- `searing-smite`, `thunderous-smite`, `wrathful-smite`
- `hail-of-thorns`

### Spells Blocked by Gap 2 (Reactive Triggers)
- `booming-blade`, `compelled-duel`, `sanctuary`, `witch-bolt`

### Spells Blocked by Gap 3 (Area Entry)
- `create-bonfire`, `grease`, `fog-cloud`, `entangle`

### Spells Blocked by Gap 4 (Repeat Saves)
- `tasha's-hideous-laughter`, `ensnaring-strike`, `wrathful-smite`
- (Many Level 2+ spells: `hold-person`, `crown-of-madness`, etc.)

### Spells Blocked by Gap 5 (Creature Filter)
- `chill-touch`, `protection-from-evil-and-good`

### Spells Blocked by Gap 6 (Summoning)
- `find-familiar`, `unseen-servant`, `tenser's-floating-disk`

### Spells Blocked by Gap 7 (AC Mechanics)
- `mage-armor`, `shield`, `shield-of-faith`
