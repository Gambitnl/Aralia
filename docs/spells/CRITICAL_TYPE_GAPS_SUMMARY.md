# Critical Type Definition Gaps - Summary

**Status**: 🔴 **BLOCKING** - Prevents spell migration
**Created**: Current session
**Review**: Gemini 3 Pro architecture analysis
**Action Required**: Complete [TASK-01.5-TYPE-PATCHES.md](../tasks/spell-system-overhaul/TASK-01.5-TYPE-PATCHES.md)

---

## Executive Summary

Gemini 3 Pro's architecture review identified **4 critical gaps** in `src/types/spells.ts` that will cause data loss and architectural degradation if not fixed before mass spell migration begins.

**Impact**: ~85+ spells cannot be properly defined, forcing reliance on brittle text parsing instead of structured data.

**Time to Fix**: 2-3 hours

**Consequence if Ignored**: The spell system overhaul fails to achieve its goal of replacing text parsing with structured data.

---

## The 4 Critical Gaps

### 1. Missing `ritual` Property 🔴

**Affected Spells**: ~30 ritual spells (Detect Magic, Alarm, Identify, etc.)

**Current Behavior**:
```json
{
  "id": "detect-magic",
  "description": "... This spell can be cast as a ritual."
}
```

**Problem**:
- Ritual status only in description text
- Must parse description to detect ritual spells
- Ritual Casting feature has no data to filter on
- **Data loss**: Migration strips ritual metadata

**Fix Required**: Add `ritual?: boolean` to Spell interface

---

### 2. Missing `rarity` Property ⚠️

**Affected Systems**: Spell scroll economy, crafting

**Current Behavior**:
- No way to distinguish exotic spell scrolls
- Must hardcode scroll value = spell level × 50gp

**Problem**:
- Cannot represent rare/legendary homebrew spell scrolls
- Economy system less flexible

**Fix Required**: Add `rarity?: SpellRarity` to Spell interface

---

### 3. Stubbed Effect Types Have Zero Properties 🔴

**Affected Spells**: ~55+ spells

**Effect Types with NO Properties**:
- MOVEMENT (Longstrider, Misty Step, etc.)
- DEFENSIVE (Mage Armor, Shield of Faith, etc.)
- SUMMONING (Unseen Servant, Find Familiar, etc.)
- TERRAIN (Entangle, Grease, etc.)
- UTILITY (Light, Dancing Lights, etc.)

**Current Definition**:
```typescript
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  // NO PROPERTIES - completely empty stub
}
```

**Problem**:
- **Cannot define what the effect does**
- Longstrider (+10ft speed) has nowhere to store "+10ft"
- Mage Armor (AC = 13 + Dex) has nowhere to store AC formula
- **Defeats the entire purpose of structured spell data**
- Forces fallback to description text parsing

**Example Spell That Cannot Be Defined**:
```json
{
  "id": "longstrider",
  "effects": [
    {
      "type": "MOVEMENT",
      // HOW DO WE SAY "+10 feet to walking speed"?
      // There are no properties to store this!
    }
  ]
}
```

**Fix Required**: Define minimum properties for each stubbed effect type

---

### 4. Missing `combatCost` / `explorationCost` ⚠️

**Current Behavior**:
```typescript
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "minute" | "hour";
  // No combatCost or explorationCost
}
```

**Problem**:
- Documented in AGENT-ALPHA-TYPES.md but **not implemented**
- Combat engine parses unit string: `unit.includes('bonus')` (brittle)
- Cannot represent ritual spells (1 action OR 11 minutes)
- No structured way to handle hybrid time system

**Affected Spells**: All ritual spells, any spell castable in/out of combat

**Fix Required**: Implement combatCost/explorationCost as documented

---

## Impact Analysis

### Spells That Cannot Be Properly Defined

| Effect Type | Example Spells | Count | Impact |
|-------------|----------------|-------|--------|
| MOVEMENT | Longstrider, Misty Step, Jump, Expeditious Retreat | ~15 | Cannot store speed changes |
| DEFENSIVE | Mage Armor, Shield, Barkskin, Protection from Evil | ~20 | Cannot store AC bonuses/formulas |
| SUMMONING | Unseen Servant, Find Familiar, Conjure Animals | ~10 | Cannot specify what's summoned |
| TERRAIN | Entangle, Grease, Spike Growth, Wall of Stone | ~15 | Cannot define terrain effects |
| UTILITY | Light, Dancing Lights, Message, Prestidigitation | ~25 | Forced to use description parsing |

**Total**: ~85 spells forced to rely on text parsing

---

## Data Loss Examples

### Example 1: Detect Magic (Ritual)

**Before Fix**:
```json
{
  "id": "detect-magic",
  "description": "For 10 minutes, you sense magic... This spell can be cast as a ritual.",
  "castingTime": {
    "value": 1,
    "unit": "action"
  }
}
```

**Issues**:
- ❌ No `ritual: true` field
- ❌ Cannot represent 11-minute ritual casting
- ❌ Ritual Casting feature must parse description

**After Fix**:
```json
{
  "id": "detect-magic",
  "ritual": true,
  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": { "type": "action" },
    "explorationCost": { "type": "minutes", "duration": 11 }
  }
}
```

**Benefits**:
- ✅ Machine-readable ritual status
- ✅ Both casting times defined
- ✅ No description parsing needed

---

### Example 2: Longstrider (Movement)

**Before Fix**:
```json
{
  "id": "longstrider",
  "effects": [
    {
      "type": "MOVEMENT",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
      // NO WAY TO STORE "+10 feet speed"
    }
  ],
  "description": "You touch a creature. The target's speed increases by 10 feet until the spell ends."
}
```

**Issues**:
- ❌ Movement effect is an empty stub
- ❌ Must parse description for "+10 feet"
- ❌ Combat engine cannot execute effect mechanically

**After Fix**:
```json
{
  "id": "longstriper",
  "effects": [
    {
      "type": "MOVEMENT",
      "movement": {
        "movementType": "speed",
        "distance": 10,
        "speedType": "walking"
      },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

**Benefits**:
- ✅ Movement effect fully defined
- ✅ Combat engine can apply +10ft mechanically
- ✅ No description parsing needed

---

## Why This Blocks Migration

### The Migration Trap

1. **Start migrating 500+ spells without these properties**
2. **Realize we need ritual field after migrating 200 spells**
3. **Must retrofit 200 spells (painful)**
4. **Or**: Accept data loss and continue with broken architecture

### One-Way Door

Once spells are migrated without proper structure:
- Retrofitting is expensive (re-read SRD for every spell)
- Brittle text parsing becomes permanent
- Defeats the purpose of the overhaul

### Low Cost vs High Value

**Cost**: 2-3 hours to fix now
**Benefit**: Prevents weeks of technical debt
**Risk if delayed**: Architectural failure

---

## Recommended Action

### Immediate Next Steps

1. **Pause all spell data migration**
2. **Assign Task 01.5 to a developer**
3. **Complete type patches (2-3 hours)**
4. **Verify with test spells**
5. **Resume migration with complete schema**

### What Gets Fixed

- ✅ Add `ritual?: boolean` to Spell
- ✅ Add `rarity?: SpellRarity` to Spell
- ✅ Implement combatCost/explorationCost on CastingTime
- ✅ Define properties for MovementEffect, DefensiveEffect, SummoningEffect, TerrainEffect, UtilityEffect
- ✅ Update Zod validator
- ✅ Update JSON Schema
- ✅ Update spell wizard
- ✅ Update documentation

### Timeline

| Task | Time |
|------|------|
| TypeScript updates | 30 min |
| Zod validator | 30 min |
| JSON Schema | 20 min |
| Documentation | 30 min |
| Spell wizard | 45 min |
| Testing | 30 min |
| **Total** | **2h 45min** |

---

## Related Documents

- **Full Task Specification**: [TASK-01.5-TYPE-PATCHES.md](../tasks/spell-system-overhaul/TASK-01.5-TYPE-PATCHES.md)
- **Property Reference**: [SPELL_PROPERTIES_REFERENCE.md](./SPELL_PROPERTIES_REFERENCE.md)
- **Integration Checklist**: [SPELL_INTEGRATION_CHECKLIST.md](./SPELL_INTEGRATION_CHECKLIST.md)
- **Coordination Doc**: [00-AGENT-COORDINATION.md](../tasks/spell-system-overhaul/00-AGENT-COORDINATION.md)

---

**Review Completed By**: Gemini 3 Pro
**Documented By**: Claude (Sonnet 4.5)
**Priority**: 🔴 Blocking
**Status**: Ready for implementation
