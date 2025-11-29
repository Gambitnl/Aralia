# Root Cause Analysis: Why PR #38 Failed to Follow Schema

## Executive Summary

PR #38 failed because **Jules was given a reference to a TypeScript file but no working examples of complete JSON structures**. This is a fundamental instruction design problem, not a failure of the AI agent.

## The Core Issue: Missing Concrete Examples

### What Jules Was Told
```
Migrate the following 5 Level 1 Spells to the new JSON format defined in src/types/spells.ts
```

### What Jules Received
- A reference to a TypeScript file with complex interfaces
- Type definitions using advanced TypeScript features (`extends`, discriminated unions)
- No concrete JSON examples showing the complete structure

### What Jules Actually Needed
**Working JSON examples** showing complete effect structures with all required fields, like:

```json
{
  "type": "DEFENSIVE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "defenseType": "resistance",
  "damageType": ["Cold"],
  "duration": { "type": "rounds", "value": 1 }
}
```

## Evidence: The Schema Mismatch Pattern

### PR #38 Effects (What Jules Created)
```json
{
  "type": "DEFENSIVE",
  "defenseType": "resistance",
  "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
  "duration": { "type": "rounds", "value": 1 }
}
```
**Missing**: `trigger` and `condition` (required from BaseEffect)

### The TypeScript Definition (What Jules Was Told to Follow)
```typescript
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: "ac_bonus" | "resistance" | "immunity" | "temporary_hp" | "advantage_on_saves";
  value?: number;
  damageType?: DamageType[];
  savingThrow?: SavingThrowAbility[];
  duration: EffectDuration;
}

export interface BaseEffect {
  trigger: EffectTrigger;      // REQUIRED
  condition: EffectCondition;  // REQUIRED
  scaling?: ScalingFormula;
}
```

### What Happened
Jules saw `DefensiveEffect` and correctly identified the fields:
- ✅ `type: "DEFENSIVE"`
- ✅ `defenseType: "resistance"`
- ✅ `damageType: [...]`
- ✅ `duration: {...}`

But **did not understand** that `extends BaseEffect` means those fields must also be included in the JSON.

## The TypeScript `extends` Problem

### Why AI Agents Miss This

When an AI agent reads:
```typescript
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: string;
  duration: EffectDuration;
}
```

They understand:
- "DefensiveEffect has these fields: type, defenseType, duration"

They often don't understand:
- "DefensiveEffect ALSO includes all fields from BaseEffect"
- "BaseEffect fields are REQUIRED in the JSON"

This is because:
1. **Inheritance is implicit** - The fields aren't visually listed in the DefensiveEffect interface
2. **No runtime enforcement** - TypeScript types don't exist at runtime, so there's no JSON schema to validate against during creation
3. **No examples** - Without seeing a working JSON, the agent has to infer the structure

## Evidence from Existing Spells

### Fire Bolt (Legacy Format - Working)
```json
{
  "effects": [
    {
      "type": "Damage",
      "attack": { "type": "Ranged Spell" },
      "damage": { "dice": "1d10", "type": "Fire" }
    }
  ]
}
```
**Note**: This is the OLD format. No `trigger`, `condition`, or BaseEffect fields because it predates the new schema.

### Mage Armor (Legacy Format - Working)
```json
{
  "effects": [
    {
      "type": "Buff",
      "special": "Base AC becomes 13 + Dex Mod (if unarmored)."
    }
  ]
}
```
**Note**: Also OLD format. Uses `"Buff"` type that doesn't exist in new schema.

### Critical Discovery
**There are NO spells in the new format with properly structured effects in the repository yet.**

This means:
- Jules had no working examples to reference
- Jules couldn't copy-paste a working effect structure
- Jules had to infer the JSON structure from TypeScript alone

## The Three Missing Pieces

### 1. No Working Examples
**Problem**: No spell JSONs exist with complete, valid new-format effects.

**Impact**: Jules couldn't see what a proper `DEFENSIVE` effect looks like with all BaseEffect fields included.

**Solution**: Create reference examples:
```json
// Example: Shield spell (DEFENSIVE effect)
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" },
      "defenseType": "ac_bonus",
      "value": 5,
      "duration": { "type": "rounds", "value": 1 }
    }
  ]
}

// Example: Absorb Elements (DEFENSIVE effect)
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" },
      "defenseType": "resistance",
      "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
      "duration": { "type": "rounds", "value": 1 }
    },
    {
      "type": "DAMAGE",
      "trigger": { "type": "turn_start" },
      "condition": { "type": "hit" },
      "damage": {
        "dice": "1d6",
        "type": "Acid"  // or whatever was absorbed
      }
    }
  ]
}
```

### 2. No Validation Pre-Flight
**Problem**: Jules didn't run validation before creating the PR.

**Impact**: Invalid JSONs were committed without catching the errors.

**Solution**: Add validation step to task workflow:
```
1. Create spell JSONs
2. Run validation: npm run validate
3. Fix any errors
4. Commit and create PR
```

### 3. Instructions Assume TypeScript Expertise
**Problem**: Task instructions said "follow src/types/spells.ts" but didn't explain TypeScript-specific concepts.

**Impact**: Jules couldn't understand that `extends` means field inheritance.

**Solution**: Either:
- Provide complete JSON examples (preferred)
- Or explicitly explain: "Note: All effect types extend BaseEffect, which means every effect MUST include trigger, condition, and optionally scaling fields"

## Comparison: What Works vs What Doesn't

### ❌ What Doesn't Work
```
Task: Migrate spells to the format defined in src/types/spells.ts
```
**Why**: AI must infer JSON structure from TypeScript with complex inheritance.

### ✅ What Works
```
Task: Migrate spells using these example JSONs as templates:

Example 1: Simple DAMAGE effect (Fire Bolt)
{
  "effects": [
    {
      "type": "DAMAGE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "hit" },
      "damage": { "dice": "1d10", "type": "Fire" }
    }
  ]
}

Example 2: DEFENSIVE effect (Shield)
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" },
      "defenseType": "ac_bonus",
      "value": 5,
      "duration": { "type": "rounds", "value": 1 }
    }
  ]
}

Example 3: Multi-effect spell (Absorb Elements)
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" },
      "defenseType": "resistance",
      "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
      "duration": { "type": "rounds", "value": 1 }
    },
    {
      "type": "DAMAGE",
      "trigger": { "type": "turn_start" },
      "condition": { "type": "hit" },
      "damage": { "dice": "1d6", "type": "Acid" }
    }
  ]
}

Follow the structure of these examples exactly.
```
**Why**: AI can pattern-match and fill in values without needing to understand TypeScript inheritance.

## The Systemic Problem

### Current State
1. **Type definitions exist** (src/types/spells.ts) ✅
2. **Zod validators exist** (spellValidator.ts) ✅
3. **Documentation exists** (SPELL_PROPERTIES_REFERENCE.md) ✅
4. **Working JSON examples exist** ❌ **MISSING**
5. **Validation workflow exists** ❌ **MISSING**

### The Gap
We have excellent architecture and documentation for **humans and TypeScript developers**, but we're missing the **concrete examples and validation workflow** needed for **AI agents to execute tasks successfully**.

## Root Cause Statement

**PR #38 failed because the task instructions relied on TypeScript type definitions as the source of truth, but did not provide concrete JSON examples showing complete effect structures with all inherited fields from BaseEffect.**

This is not a failure of the AI agent. This is a **task instruction design failure**.

## The Fix: Three-Part Solution

### Part 1: Create Reference Examples Document
Create `docs/spells/SPELL_JSON_EXAMPLES.md` with complete, working examples of every effect type with all required BaseEffect fields.

### Part 2: Update Task Template
When tasking agents with spell migration, include:
```
Reference these complete examples: docs/spells/SPELL_JSON_EXAMPLES.md

IMPORTANT: Every effect MUST include these BaseEffect fields:
- trigger: { type: "immediate" | "after_primary" | "turn_start" | "turn_end" }
- condition: { type: "hit" | "save" | "always", saveType?: "...", saveEffect?: "..." }
- scaling: { ... } (optional)

Then add the effect-specific fields (damage, defenseType, etc.)
```

### Part 3: Add Validation to Workflow
Update agent workflow to include:
```
1. Create spell JSONs
2. Run: npm run validate
3. Fix any validation errors shown
4. Only create PR when validation passes
```

## Secondary Issues in PR #38

While the missing BaseEffect fields are the primary issue, there are also:

1. **UTILITY Effect Overuse**
   - Using `UTILITY` type with text descriptions instead of proper effect types
   - Example: Armor of Agathys should use `DEFENSIVE` + `DAMAGE` effects, not UTILITY

2. **Schema Validation Not Run**
   - Zod validator would have caught the missing fields
   - No evidence that validation was attempted before PR creation

3. **Legacy Format Contamination**
   - Some effects look like old format (e.g., using "Buff" type)
   - Suggests mixing old and new patterns

## Conclusion

The root cause is clear: **Task instructions must include complete, working JSON examples, not just TypeScript type references.**

AI agents excel at pattern matching and following examples. They struggle with inferring JSON structures from TypeScript interfaces with inheritance.

The fix is simple: Create a comprehensive examples document and update the task template to reference it.

---

**Recommendation**: Before migrating any more spells, create `SPELL_JSON_EXAMPLES.md` with at least 10 complete, validated spell examples covering all effect types.
