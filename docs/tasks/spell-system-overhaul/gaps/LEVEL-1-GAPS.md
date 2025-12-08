# Level 1 Gaps & Validation Log (Consolidated)

**Consolidated:** 2025-12-06 15:31 UTC  
**Source Files Merged:** `BATCH-1-GAPS.md`, `LEVEL-1-BATCH-2-GAPS.md`

---

## Batch 1 — Cantrips (1I-MIGRATE-CANTRIPS-BATCH-1)

### Batch 1 Migration Gaps Analysis

**Batch**: 1I-MIGRATE-CANTRIPS-BATCH-1  
**Spells**: `acid-splash`, `blade-ward`, `booming-blade`, `chill-touch`, `create-bonfire`  
**Reviewed**: 2025-12-05

### Overview

This document details the schema and system gaps identified during the migration of Cantrips Batch 1. These gaps represent mechanics that cannot be fully expressed within the current `spellValidator.ts` schema and require schema evolution or engine-level support.

### Gap 1: Conditional Movement Trigger (`booming-blade`)

#### Current Implementation
```json
{
  "type": "STATUS_CONDITION",
  "trigger": { "type": "immediate" },
  "condition": { "type": "hit" },
  "statusCondition": {
    "name": "Booming Energy",
    "duration": { "type": "rounds", "value": 1 }
  },
  "description": "If the target willingly moves before the start of your next turn, it immediately takes 1d8 thunder damage..."
}
```

#### The Gap
The spell's secondary damage triggers **"if the target willingly moves"** - a conditional trigger based on the target's own choices. The current schema only supports:
```typescript
trigger.type: "immediate" | "after_primary" | "turn_start" | "turn_end"
```

#### Required Feature
A trigger system that can respond to **target actions**, not just temporal events:
- `on_target_move_willingly`
- `on_target_attack`
- `on_target_cast_spell`

#### Industry Solutions (from research)
Game design systems typically solve this with:
1. **Observer Pattern**: Target actions emit events; effects subscribe to them
2. **Reaction Triggers**: Special trigger type that monitors specific creature actions
3. **State-based Effects**: Flag on creature that checks movement validity

#### Recommended Schema Enhancement
```typescript
const EffectTrigger = z.object({
  type: z.enum([
    "immediate", 
    "after_primary", 
    "turn_start", 
    "turn_end",
    "on_target_action"  // NEW
  ]),
  actionType: z.enum([
    "move_willingly",
    "attack", 
    "cast_spell"
  ]).optional(),  // Required when type = "on_target_action"
});
```

#### Current Workaround
Mechanic documented in `description` field; actual trigger is not machine-readable.

---

### Gap 2: Area Entry Trigger (`create-bonfire`)

#### Current Implementation
```json
{
  "type": "DAMAGE",
  "trigger": { "type": "turn_start" },
  "condition": { "type": "save", "saveType": "Dexterity", "saveEffect": "none" },
  "damage": { "dice": "1d8", "type": "Fire" },
  "description": "A creature must also make the saving throw when it moves into the bonfire's space for the first time on a turn..."
}
```

#### The Gap
The spell damages creatures who:
1. ✅ Start their turn in the area (`turn_start` - supported)
2. ❌ **Move into the area for the first time on a turn** (not supported)

The "first time on a turn" qualifier is also important - it prevents damage stacking from repeated entries.

#### Required Feature
A trigger type for area-based entry:
- `on_enter_area`
- With modifiers like `first_time_per_turn`

#### Industry Solutions (from research)
Many games use:
1. **Zone Controllers**: Areas track entry/exit events
2. **Aura Systems**: Effects tied to spatial boundaries with entry hooks
3. **Movement Event Hooks**: Movement system emits events at each position change

#### Recommended Schema Enhancement
```typescript
const EffectTrigger = z.object({
  type: z.enum([
    "immediate", 
    "after_primary", 
    "turn_start", 
    "turn_end",
    "on_enter_area",   // NEW
    "on_exit_area"     // NEW
  ]),
  frequency: z.enum([
    "every_time",
    "first_per_turn",  // NEW - for "first time on a turn"
    "once"
  ]).optional(),
});
```

#### Current Workaround
Uses `turn_start` trigger which covers "ends turn there" but NOT "enters for first time". The "enters" mechanic is described in text but not programmatically enforced.

---

### Gap 3: Creature Type Conditional Effects (`chill-touch`)

#### Current Implementation
```json
{
  "type": "STATUS_CONDITION",
  "trigger": { "type": "immediate" },
  "condition": { "type": "hit" },
  "statusCondition": {
    "name": "Disadvantage on attacks vs. caster",
    "duration": { "type": "rounds", "value": 1 }
  },
  "description": "If you hit an undead target, it also has disadvantage on attack rolls against you..."
}
```

#### The Gap
The disadvantage effect only applies to **Undead creatures**. The current schema's condition types are:
```typescript
condition.type: "hit" | "save" | "always"
```

There's no way to express "if target creature type = X".

#### Required Feature
A condition system that can check **target properties**:
- `targetType: "Undead"`
- `targetSize: "Large"`
- `targetAlignment: "Evil"`

#### Industry Solutions (from research)
Common approaches:
1. **Target Predicates**: Conditions can include target property checks
2. **Effect Filters**: Effects have a `validTargets` block with property requirements
3. **Conditional Application Blocks**: Nested conditions inside effects

#### Recommended Schema Enhancement
```typescript
const EffectCondition = z.object({
  type: z.enum(["hit", "save", "always"]),
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition"]).optional(),
  targetFilter: z.object({   // NEW
    creatureType: z.array(z.string()).optional(),  // ["Undead", "Construct"]
    size: z.array(z.string()).optional(),          // ["Large", "Huge"]
    alignment: z.array(z.string()).optional(),     // ["Evil"]
  }).optional(),
});
```

#### Current Workaround
Effect always applies on hit; the "Undead only" condition is described in text but not programmatically filtered.

---

### Additional Issue: Duplicate Files (ORPHANED - Safe to Delete)

#### Discovery
During investigation, duplicate JSON files were found for all Batch 1 spells:
- `public/data/spells/acid-splash.json` (root) ← **ORPHANED**
- `public/data/spells/level-0/acid-splash.json` (level-0 dir) ← **USED BY MANIFEST**

#### Manifest Verification
The `spells_manifest.json` correctly points cantrips to the `level-0` subdirectory:
```json
"acid-splash": {
  "path": "/data/spells/level-0/acid-splash.json"  // ✅ Correct
}
```

The root-level files (`public/data/spells/acid-splash.json`, etc.) are **orphaned** and never loaded by the application.

#### Field Differences Between Versions
Both files are in new format but with inconsistencies:
| Field | Root Version | level-0 Version |
|-------|--------------|-----------------|
| `ritual` | Present (`false`) | Missing |
| `combatCost` | Present | Missing |
| `arbitrationType` | Present | Missing |
| `tags` | Missing | Present |
| `validTargets` | `"creatures"` (plural) | `"creature"` (singular) |
| `scaling` | `bonusPerLevel` | `customFormula` |

> [!WARNING]
> The level-0 versions (used by app) are **missing required fields** per acceptance criteria:
> - Missing `ritual: false` (required per line 34)
> - Missing `castingTime.combatCost` (required per line 35)

#### Expected Behavior (per JULES_ACCEPTANCE_CRITERIA.md line 20)
> "**Old JSON Removed**: If migrating a spell from `public/data/spells/{id}.json` to `public/data/spells/level-0/{id}.json`, delete the old file to prevent orphaned duplicates."

#### Action Items
1. **Delete orphaned root files** (safe - not referenced by manifest):
   - `public/data/spells/acid-splash.json`
   - `public/data/spells/blade-ward.json`
   - `public/data/spells/booming-blade.json`
   - `public/data/spells/chill-touch.json`
   - `public/data/spells/create-bonfire.json`
2. **Verify level-0 files have required fields** (or update them):
   - Add missing `ritual: false`
   - Add missing `castingTime.combatCost`

---

### Summary Table

| Gap | Spell | Current Workaround | Priority | Complexity |
|-----|-------|-------------------|----------|------------|
| Conditional Movement Trigger | `booming-blade` | Description text | Medium | High |
| Area Entry Trigger | `create-bonfire` | Uses `turn_start` only | Medium | High |
| Creature Type Conditional | `chill-touch` | Description text | Low | Medium |
| Duplicate Files | All Batch 1 | None | High | Low |

---

### Next Steps

1. [x] ~~Resolve duplicate file issue~~ (COMPLETED 2025-12-05: Orphaned root files deleted, level-0 files updated with missing fields)
2. [x] ~~Update JULES_ACCEPTANCE_CRITERIA.md~~ (COMPLETED 2025-12-05: Added Field Comparison Check step)
3. [x] ~~Implement schema evolution~~ (COMPLETED 2025-12-05: Added new trigger types and targetFilter)
   - Added `on_enter_area`, `on_target_move` to EffectTrigger.type
   - Added `frequency` field: `every_time`, `first_per_turn`, `once`
   - Added `targetFilter.creatureType` to EffectCondition
   - Updated: `spellValidator.ts`, `spells.ts`, `@WORKFLOW-SPELL-CONVERSION.md`, `JULES_ACCEPTANCE_CRITERIA.md`
4. [ ] Update spell JSONs to use new schema features (booming-blade, create-bonfire, chill-touch)
5. [ ] Implement combat engine support for new triggers

---

## Batch 2 — Level 1 Spells 11-20

**Timestamp:** 2025-12-06 15:31 UTC  
**Spells:** command, compelled-duel, comprehend-languages, create-or-destroy-water, cure-wounds, detect-evil-and-good, detect-magic, detect-poison-and-disease, disguise-self, dissonant-whispers

### Commands Run
- `npm run lint` — Failed (script missing in package.json)
- `npm test` — Passed (CommandExecutor test logs expected failure message)
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 376 spells)
- `npm run validate` — Passed (All spell data validated)

### Blockers
- No blockers for this batch; lint script missing upstream and noted above.
- None new; lint script still absent upstream.

### System Gaps & Follow-up
- [x] **Command**: Added `controlOptions` schema and populated per-option behaviors (Approach/Drop/Flee/Grovel/Halt) in `command.json`; engine now logs control options for enforcement, but UI/AI still must choose which option to execute.
- [x] **Compelled Duel**: Added `taunt` schema (disadvantage vs. others, 30 ft leash, break conditions) and populated in `compelled-duel.json`; engine now tags targets with a taunt status and logs leash data (full disadvantage/leash enforcement still to be wired where targeting/attack rolls are resolved).
- [x] **Dissonant Whispers**: Added `forcedMovement` schema (`usesReaction`, direction away, maxDistance target speed) and updated movement effect in `dissonant-whispers.json`; engine now forces positional movement away from caster using the target's speed, though pathfinding/safest-route handling remains a future enhancement.

---

## Batch 3 — Level 1 Spells 21-30

**Timestamp:** 2025-12-06 20:53 UTC  
**Spells:** divine-favor, divine-smite, ensnaring-strike, entangle, expeditious-retreat, faerie-fire, false-life, feather-fall, find-familiar, fog-cloud

### Commands Run
- `npm run lint` — Failed (script missing in package.json)
- `npm test` — Failed: vitest cannot resolve import alias `@/types/spells` in `DamageCommand.ts` (breaks Concentration.test.ts and SpellCommandFactory.test.ts); existing issue
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 376 spells)
- `npm run validate` — Passed (All spell data validated)
- `npm test` — Passed after pointing `@` to `src` in tsconfig/vite/vitest and awaiting async factory tests (CommandExecutor failure log expected)
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 376 spells)
- `npm run validate` — Passed (All spell data validated)

### Blockers
- No new blockers; noted test alias resolution issue above.
- Alias resolution fixed (`@` now targets `src`); lint script still missing upstream.

### System Gaps & Follow-up
- [x] **Divine Favor**: Fixed by adding `on_attack_hit` trigger and structured `attackAugments` (schema/validator) and updating `divine-favor.json` to add the 1d4 radiant rider; engine still needs to apply on-hit augment.
- [x] **Ensnaring Strike**: Fixed by adding `saveModifiers` (Large+ advantage), `requiresStatus` gating for start-of-turn damage, and `escapeCheck` on Restrained in data/schema; engine still needs to honor `requiresStatus` automatically.
- [x] **Entangle**: Fixed by adding planar `Square` AoE + `height`, updating spell to square, and adding `escapeCheck` on Restrained; AoECalculator now handles `Square`.
- [x] **Expeditious Retreat**: Fixed by adding structured `grantedActions` and encoding per-turn bonus-action Dash in the spell; engine still needs to surface granted actions.
- [x] **Find Familiar**: Fixed by adding `familiarContract` schema and populating contract details (forms, telepathy 100 ft, bonus-action senses, pocket-dimension dismissal, touch delivery via familiar reaction) in `find-familiar.json`.
- [x] **Fog Cloud**: Fixed by adding `dispersedByStrongWind` to terrain schema and marking `fog-cloud.json`; environment/wind hook still needed to consume the flag.

---

## Batch 4 — Level 1 Spells 31-40

**Timestamp:** 2025-12-08 10:56 UTC  
**Spells:** goodberry, grease, guiding-bolt, hail-of-thorns, healing-word, hellish-rebuke, heroism, hex, hunters-mark, ice-knife

### Commands Run
- `npm run lint` — Completed with warnings (numerous existing eslint warnings)
- `npm test` — Passed (Vitest suite)
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 376 spells)
- `npm run validate` — Passed (All spell data validated)

### Blockers
- None new; lint warnings remain.

### System Gaps & Follow-up
- [ ] **Grease**: Enter/end-of-turn prone checks and repeated saves not modeled as repeatable triggers; prone only captured on creation.
- [ ] **Heroism**: Per-turn temp HP equal to casting mod and Frightened immunity stay in description; schema lacks recurring temp HP/condition immunity primitives.
- [ ] **Hex**: Per-hit +1d6 necrotic and chosen-ability check Disadvantage captured in prose; schema lacks per-hit rider and ability-check penalty fields; duration scaling in text only.
- [ ] **Hunter's Mark**: Per-hit +1d6 force, tracking advantage, mark transfer on 0 HP stored in description; no structured mark/transfer or per-hit rider support.
- [ ] **Hail of Thorns**: Trigger is “after ranged weapon hit”; schema only approximated with immediate trigger.

---

## Batch 5 — Level 1 Spells 41-50

**Timestamp:** 2025-12-08 10:47 UTC  
**Spells:** identify, illusory-script, inflict-wounds, jump, longstrider, mage-armor, magic-missile, protection-from-evil-and-good, purify-food-and-drink, ray-of-sickness

### Commands Run
- `npm run lint` — Completed with warnings (existing eslint noise across codebase)
- `npm test` — Passed (CommandExecutor test logs expected failure line)
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 376 spells)
- `npm run validate` — Passed after adjusting schema fields (all spell data validated)

### Blockers
- None new; lint warnings persist from existing code.

### System Gaps & Follow-up
- [ ] **Mage Armor**: Base AC setting is stored in description via utility; schema lacks a structured “set base AC” defensive field.
- [ ] **Protection from Evil and Good**: Disadvantage vs specific creature types and immunity to charm/frighten/possession are stored in description; no structured creature-type ward/attack-disadvantage fields.
- [ ] **Grease-style repeating saves** remain unmodeled (enter/end-of-turn) but similar pattern applies if a general solution is added later.

---

## Batch 6 — Level 1 Spells 51-60

**Timestamp:** 2025-12-08 11:00 UTC  
**Spells:** sanctuary, searing-smite, shield, shield-of-faith, silent-image, sleep, speak-with-animals, tashas-hideous-laughter, tensers-floating-disk, thunderous-smite

### Commands Run
- `npm run lint` — Completed with existing warnings across codebase (no new errors).
- `npm test` — Passed (CommandExecutor test logs expected “Boom” failure message).
- `npx tsx scripts/regenerate-manifest.ts` — Passed (Generated manifest with 377 spells).
- `npm run validate` — Failed initially (utilityType enums on new spells); reran after updating utilityType values to accepted enum — Passed.

### Blockers
- No blockers; all validation commands completed after minor schema enum fix.

### System Gaps & Follow-up
- [ ] **Sanctuary**: Attacker reroute/Wisdom save captured in prose; schema lacks an explicit “attacker must retarget or lose attack” hook.
- [ ] **Smite Riders (Searing/Thunderous Smite)**: “Next melee hit before spell ends” trigger and per-hit rider damage are not explicitly modeled; schema lacks on-attack-hit gating and single-use triggers.
- [ ] **AC Buffs (Shield, Shield of Faith)**: +5 AC until start of next turn and +2 AC while concentrating stored in description via utility; schema lacks structured AC bonus/base AC fields.
- [ ] **Silent Image**: Investigation-on-action and physical interaction reveal mechanics are in prose; no structured interaction/contested-check fields.
- [ ] **Sleep**: HP-pool targeting logic (5d8 + scaling, ascending HP order, sleep until damage/shaken) not represented structurally.
- [ ] **Tasha's Hideous Laughter**: Repeat saves each turn and advantage on saves when damage triggers are in prose; schema lacks repeat-save/advantage-on-trigger hooks.
- [ ] **Tenser's Floating Disk**: Follow/offset rules, 500 lb. capacity, and terrain/height constraints are described in text; schema lacks structured summon/vehicle payload and follow-distance fields.

---

## Batch 7 — Level 1 Spells 61-64

**Timestamp:** 2025-12-08 11:28 UTC  
**Spells:** thunderwave, unseen-servant, witch-bolt, wrathful-smite

### Commands Run
- `npm run lint` — Completed with existing eslint warnings (no new errors).
- `npm test` — Passed (CommandExecutor test logs expected “Boom” failure message).
- `npx tsx scripts/regenerate-manifest.ts` — Passed (377 spells).
- `npm run validate` — Passed (all spell data validated).

### Blockers
- None; validations completed despite pre-existing lint warnings elsewhere in the codebase.

### System Gaps & Follow-up
- [ ] **Thunderwave**: Push-on-failed-save and unsecured-object push captured in description; no structured forced-movement flag tied to save outcome; audible radius unmodeled.
- [ ] **Unseen Servant**: Servant stats/action economy encoded in prose; schema lacks a summon stat block (HP/AC/Str), carry capacity, and command-per-turn economy fields.
- [ ] **Witch Bolt**: Sustained action-based damage each turn and break conditions (out of range/total cover/other actions) live in description; no structured “sustain action” trigger or beam persistence.
- [ ] **Wrathful Smite**: “Next melee hit” gating and per-hit rider not structured; frightened condition repeat check (Wis check with action) in prose; no explicit on-hit rider schema.
