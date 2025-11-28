# Complete Spell Properties Reference

**Source of Truth**: [src/types/spells.ts](../../../src/types/spells.ts)

This is the **complete, accurate** list of all spell properties from the TypeScript type definitions.

---

## Property Status Key

- ✅ **Required** - Must be present in every spell
- 🔵 **Optional** - May be omitted
- ⚠️ **Proposed** - In documentation but NOT yet in TypeScript types (needs implementation)
- 🔴 **Missing (Critical)** - Not in types but needed for integration (will cause issues)

---

## Top-Level Spell Properties

### Identity & Metadata

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `id` | ✅ Required | `string` | Unique identifier (kebab-case, e.g., "fire-bolt") | All systems |
| `name` | ✅ Required | `string` | Display name (e.g., "Fire Bolt") | All UI components |
| `level` | ✅ Required | `number` | Spell level (0-9, where 0 = cantrip) | Character creation, spellbook, combat |
| `school` | ✅ Required | `SpellSchool` | School of magic (see enum below) | Wizard specialization, counterspell |
| `classes` | ✅ Required | `string[]` | Array of class IDs that can learn this spell | Character creation filtering |
| `description` | ✅ Required | `string` | Full text description of spell effects | Tooltips, info modals, fallback parsing |
| `higherLevels` | 🔵 Optional | `string` | Description of upcast behavior | Spellbook display, combat |
| `tags` | 🔵 Optional | `string[]` | Searchable tags (e.g., ["damage", "fire", "aoe"]) | Search/filtering, targeting inference |
| `ritual` | 🔵 Optional | `boolean` | Indicates if the spell can be cast as a ritual. | Casting logic, UI |
| `rarity`| 🔵 Optional | `SpellRarity` | Defines the rarity of a spell, for loot tables or special scrolls. | Loot generation, item value |

**Total Top-Level**: 10 properties (5 required, 5 optional)

---

## CastingTime Properties

**Type**: `CastingTime` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `castingTime.value` | ✅ Required | `number` | Numeric value for casting time | Time system |
| `castingTime.unit` | ✅ Required | `"action" \| "bonus_action" \| "reaction" \| "minute" \| "hour" \| "special"` | Unit of time | Combat action economy, exploration |
| `castingTime.reactionCondition` | 🔵 Optional | `string` | Condition for reaction spells (e.g., "when you are hit") | Combat triggers |
| `castingTime.combatCost` | 🔵 Optional | `"action" \| "bonus_action" \| "reaction"` | Tactical combat cost. | Combat system |
| `castingTime.explorationCost` | 🔵 Optional | `object` | Out-of-combat time cost. | Exploration time system |
| `castingTime.explorationCost.value` | 🔵 Optional | `number` | How long in exploration mode | Exploration system |
| `castingTime.explorationCost.unit` | 🔵 Optional | `"minute" \| "hour"` | Exploration time unit | Exploration system |


**Actual in types**: 5 properties (2 required, 3 optional)

---

## Range Properties

**Type**: `Range` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `range.type` | ✅ Required | `"self" \| "touch" \| "ranged" \| "special"` | Type of range | Combat targeting, spellAbilityFactory |
| `range.distance` | 🔵 Optional | `number` | Distance in feet (required if type = "ranged") | Combat range calculation |

**Total**: 2 properties (1 required, 1 conditional)

---

## Components Properties

**Type**: `Components` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `components.verbal` | ✅ Required | `boolean` | Requires speaking? | Silenced condition checks |
| `components.somatic` | ✅ Required | `boolean` | Requires gestures? | Restrained condition checks |
| `components.material` | ✅ Required | `boolean` | Requires materials? | Component availability |
| `components.materialDescription` | 🔵 Optional | `string` | Description of materials | Spell tooltips |
| `components.materialCost` | 🔵 Optional | `number` | Gold cost of materials | Economy system |
| `components.isConsumed` | 🔵 Optional | `boolean` | Materials consumed when cast? | Inventory management |

**Total**: 6 properties (3 required, 3 optional)

---

## Duration Properties

**Type**: `Duration` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `duration.type` | ✅ Required | `"instantaneous" \| "timed" \| "special" \| "until_dispelled" \| "until_dispelled_or_triggered"` | Duration category | Buff/debuff system |
| `duration.value` | 🔵 Optional | `number` | Numeric duration (required if type = "timed") | Duration tracking |
| `duration.unit` | 🔵 Optional | `"round" \| "minute" \| "hour"` | Time unit (required if type = "timed") | Duration tracking |
| `duration.concentration` | ✅ Required | `boolean` | Requires concentration? | Concentration tracking, breaking concentration |

**Total**: 4 properties (2 required, 2 conditional)

---

## Targeting Properties

**Type**: `SpellTargeting` discriminated union

### Common to All Targeting Types (BaseTargeting)

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.validTargets` | ✅ Required | `TargetFilter[]` | What can be targeted: ["creatures", "objects", "allies", "enemies", "self", "point"] | Combat targeting validation |
| `targeting.lineOfSight` | 🔵 Optional | `boolean` | Requires line of sight? | Combat targeting validation |

### Targeting Type: "single"

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.type` | ✅ Required | `"single"` | Discriminator | Type narrowing |
| `targeting.range` | ✅ Required | `number` | Range in feet | Combat range validation |

**Example**: Chromatic Orb

### Targeting Type: "multi"

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.type` | ✅ Required | `"multi"` | Discriminator | Type narrowing |
| `targeting.range` | ✅ Required | `number` | Range in feet | Combat range validation |
| `targeting.maxTargets` | ✅ Required | `number` | Maximum targets | Combat UI |

**Example**: Magic Missile

### Targeting Type: "area"

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.type` | ✅ Required | `"area"` | Discriminator | Type narrowing |
| `targeting.range` | ✅ Required | `number` | Distance to origin point | Combat range validation |
| `targeting.areaOfEffect` | ✅ Required | `AreaOfEffect` | Shape and size (see AoE section) | Combat visual overlay |

**Example**: Fireball

### Targeting Type: "self"

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.type` | ✅ Required | `"self"` | Discriminator | Type narrowing |

**Example**: Shield

### Targeting Type: "hybrid"

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `targeting.type` | ✅ Required | `"hybrid"` | Discriminator | Type narrowing |
| `targeting.primary` | ✅ Required | `SingleTargeting` | Initial target | Combat execution |
| `targeting.secondary` | ✅ Required | `AreaTargeting` | Secondary area effect | Combat execution |

**Example**: Ice Knife (hits one target, then explodes)

---

## AreaOfEffect Properties

**Type**: `AreaOfEffect` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `areaOfEffect.shape` | ✅ Required | `"Cone" \| "Cube" \| "Cylinder" \| "Line" \| "Sphere"` | AoE shape | Combat visual overlay, spellAbilityFactory |
| `areaOfEffect.size` | ✅ Required | `number` | Size in feet (radius for Sphere, length for Line, etc.) | Combat visual overlay |

**Total**: 2 properties (both required)

**Note**: This appears both as:
- `targeting.areaOfEffect` (for area-targeted spells)
- `effects[].areaOfEffect` (for effects that have AoE - see below)

---

## Effects Array

**Type**: `SpellEffect[]` - array of discriminated union

### Common to All Effects (BaseEffect)

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `effects[].trigger` | ✅ Required | `EffectTrigger` | When effect applies (see below) | Combat sequencing |
| `effects[].condition` | ✅ Required | `EffectCondition` | Condition for effect (see below) | Saving throw logic |
| `effects[].scaling` | 🔵 Optional | `ScalingFormula` | How effect scales with level (see below) | Upcasting |

### EffectTrigger Properties

| Property | Status | Type | Description |
|----------|--------|------|-------------|
| `effects[].trigger.type` | ✅ Required | `"immediate" \| "after_primary" \| "turn_start" \| "turn_end"` | When effect triggers |

### EffectCondition Properties

| Property | Status | Type | Description |
|----------|--------|------|-------------|
| `effects[].condition.type` | ✅ Required | `"hit" \| "save" \| "always"` | Condition type |
| `effects[].condition.saveType` | 🔵 Optional | `SavingThrowAbility` | Which save (if type = "save") |
| `effects[].condition.saveEffect` | 🔵 Optional | `"none" \| "half" \| "negates_condition"` | What happens on successful save |

---

## Effect Type: DAMAGE

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `effects[].type` | ✅ Required | `"DAMAGE"` | Discriminator | Type narrowing |
| `effects[].damage` | ✅ Required | `DamageData` | Damage details | Combat damage calculation |
| `effects[].damage.dice` | ✅ Required | `string` | Damage dice (e.g., "8d6") | Combat damage calculation |
| `effects[].damage.type` | ✅ Required | `DamageType` | Damage type (see enum) | Resistance/immunity checks |

**Total**: 4 properties (all required)

---

## Effect Type: HEALING

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `effects[].type` | ✅ Required | `"HEALING"` | Discriminator | Type narrowing |
| `effects[].healing` | ✅ Required | `HealingData` | Healing details | Combat healing calculation |
| `effects[].healing.dice` | ✅ Required | `string` | Healing dice (e.g., "2d8+5") | Combat healing calculation |
| `effects[].healing.isTemporaryHp` | 🔵 Optional | `boolean` | Grants temporary HP instead? | HP system |

**Total**: 4 properties (3 required, 1 optional)

---

## Effect Type: STATUS_CONDITION

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `effects[].type` | ✅ Required | `"STATUS_CONDITION"` | Discriminator | Type narrowing |
| `effects[].statusCondition` | ✅ Required | `StatusCondition` | Condition details | Status effect system |
| `effects[].statusCondition.name` | ✅ Required | `ConditionName` | Which condition (see enum) | Status effect system |
| `effects[].statusCondition.duration` | ✅ Required | `EffectDuration` | How long it lasts | Status effect tracking |
| `effects[].statusCondition.duration.type` | ✅ Required | `"rounds" \| "minutes" \| "special"` | Duration type | Duration tracking |
| `effects[].statusCondition.duration.value` | 🔵 Optional | `number` | Numeric duration (if type != "special") | Duration tracking |

**Total**: 6 properties (5 required, 1 conditional)

---

## Effect Types: MOVEMENT, SUMMONING, TERRAIN, UTILITY, DEFENSIVE

**Status**: Implemented - These types are now defined in `spells.ts`

| Property | Status | Type | Description | Implementation Status |
|----------|--------|------|-------------|----------------------|
| `effects[].type` | ✅ Required | `"MOVEMENT"` | Movement effects | Implemented |
| `effects[].type` | ✅ Required | `"SUMMONING"` | Summoning effects | Implemented |
| `effects[].type` | ✅ Required | `"TERRAIN"` | Terrain effects | Implemented |
| `effects[].type` | ✅ Required | `"UTILITY"` | Utility effects | Implemented |
| `effects[].type` | ✅ Required | `"DEFENSIVE"` | Defensive effects | Implemented |

---

## ScalingFormula Properties

**Type**: `ScalingFormula` interface

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `scaling.type` | ✅ Required | `"slot_level" \| "character_level" \| "custom"` | How spell scales | Upcasting logic |
| `scaling.bonusPerLevel` | 🔵 Optional | `string` | Bonus per level (e.g., "+1d6", "+1 target") | Upcasting calculation |
| `scaling.customFormula` | 🔵 Optional | `string` | Custom formula (e.g., "floor(character_level / 2)") | Custom scaling logic |

**Total**: 3 properties (1 required, 2 optional)

---

## AI Arbitration Properties

**Type**: `ArbitrationType` enum

| Property | Status | Type | Description | Used By |
|----------|--------|------|-------------|---------|
| `arbitrationType` | 🔵 Optional | `"mechanical" \| "ai_assisted" \| "ai_dm"` | How spell resolves ambiguous effects | AI arbitration system |

**Total**: 1 property (optional)

**Note**: The `AIContext` type exists but is **not directly on Spell** - it's for future use.

---

## Enums & Type Unions

### SpellSchool
```typescript
"Abjuration" | "Conjuration" | "Divination" | "Enchantment"
| "Evocation" | "Illusion" | "Necromancy" | "Transmutation"
```
**Total**: 8 schools

### DamageType
```typescript
"Acid" | "Bludgeoning" | "Cold" | "Fire" | "Force"
| "Lightning" | "Necrotic" | "Piercing" | "Poison"
| "Psychic" | "Radiant" | "Slashing" | "Thunder"
```
**Total**: 13 damage types

### ConditionName
```typescript
"Blinded" | "Charmed" | "Deafened" | "Exhaustion" | "Frightened"
| "Grappled" | "Incapacitated" | "Invisible" | "Paralyzed"
| "Petrified" | "Poisoned" | "Prone" | "Restrained"
| "Stunned" | "Unconscious"
```
**Total**: 15 conditions (includes "Exhaustion")

### SavingThrowAbility
```typescript
"Strength" | "Dexterity" | "Constitution"
| "Intelligence" | "Wisdom" | "Charisma"
```
**Total**: 6 ability scores

### TargetFilter
```typescript
"creatures" | "objects" | "allies" | "enemies" | "self" | "point"
```
**Total**: 6 target filters

---

## Properties NOT in Types (But Used by Components)

These properties appear in the codebase but are **NOT in `src/types/spells.ts`**:

### From LegacySpell (Backward Compatibility)

| Property | Status | Where Used | Description |
|----------|--------|------------|-------------|
| `spell.areaOfEffect` | 🔴 **Missing** | spellAbilityFactory.ts:71 | Top-level AoE (legacy format) |
| `spell.effects[].areaOfEffect` | 🔴 **Missing** | spellAbilityFactory.ts:54 | Effect-level AoE (legacy format) |

**Note**: `areaOfEffect` exists on `LegacySpell` and as `targeting.areaOfEffect` on `AreaTargeting`, but **NOT as a top-level Spell property**.

### Inferred by spellAbilityFactory

The combat system infers these from other properties:

| Property | How It's Inferred | Source |
|----------|------------------|--------|
| Targeting type | From description text or tags | spellAbilityFactory.ts:18 |
| AoE shape/size | From description text parsing | spellAbilityFactory.ts:48 |
| Damage average | Calculated from dice string | spellAbilityFactory.ts:100 |

---

## Critical Gaps & Issues

### 🔴 Critical Issues (Will Break Integration)

1. **Legacy `areaOfEffect` Property**
   - **Status**: Used by spellAbilityFactory.ts but NOT in new Spell interface
   - **Impact**: AoE spells must use `targeting.areaOfEffect` OR `effects[].areaOfEffect`
   - **Workaround**: spellAbilityFactory checks both locations
   - **Fix Required**: Clarify which is canonical

### ⚠️ Important Missing Properties

2. **No `rarity` Property**
   - **Status**: Not in Spell interface
   - **Impact**: Can't determine spell scroll rarity/value
   - **Workaround**: Calculate from spell level
   - **Recommended**: Add `rarity?: string` for exotic spells

---

## Property Count Summary

| Category | Required | Optional | Proposed | Stubbed | Total |
|----------|----------|----------|----------|---------|-------|
| **Top-Level** | 5 | 5 | 0 | 0 | 10 |
| **CastingTime** | 2 | 5 | 0 | 0 | 7 |
| **Range** | 1 | 1 | 0 | 0 | 2 |
| **Components** | 3 | 3 | 0 | 0 | 6 |
| **Duration** | 2 | 2 | 0 | 0 | 4 |
| **Targeting (varies)** | 2-5 | 0-2 | 0 | 0 | 2-7 |
| **AreaOfEffect** | 2 | 0 | 0 | 0 | 2 |
| **Effect Base** | 2 | 1 | 0 | 0 | 3 |
| **DAMAGE Effect** | 4 | 0 | 0 | 0 | 4 |
| **HEALING Effect** | 3 | 1 | 0 | 0 | 4 |
| **STATUS_CONDITION** | 5 | 1 | 0 | 0 | 6 |
| **Other Effects** | 1 | 0 | 0 | 0 | 1 |
| **ScalingFormula** | 1 | 2 | 0 | 0 | 3 |
| **AI Arbitration** | 0 | 1 | 0 | 0 | 1 |

**Total Unique Properties**: ~70-80 (depending on targeting type and effect types)

---

## Recommendations

### Immediate Actions Required

1. **Clarify AoE Property Location**
   - Document: Use `targeting.areaOfEffect` for area spells
   - Document: Use `effects[].areaOfEffect` for secondary AoE effects (Ice Knife)
   - Update spellAbilityFactory to prefer targeting.areaOfEffect

2. **Add Missing Properties**
   - `rarity?: string` - For spell scrolls (optional, defaults to spell level)

### Documentation Updates

3. **Update Integration Checklist**
   - Document AoE property location ambiguity

4. **Create JSON Schema**
   - Generate from TypeScript types
   - Add to validation pipeline
   - Enable VSCode autocomplete

---

**Last Updated**: Current session
**Source**: [src/types/spells.ts](../../../src/types/spells.ts) (actual implementation)
