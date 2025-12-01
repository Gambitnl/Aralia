# Updated Spell Migration Strategy

## Key Changes Based on User Feedback

### 1. Complete Spell Template Created

**Location**: `docs/spells/SPELL_TEMPLATE.json`

This template shows:
- ALL possible fields a spell can have
- Comments explaining when each field is required
- Examples of every effect type with complete structure
- All targeting type options
- Complete BaseEffect structure for every effect

**Purpose**: This is the comprehensive reference that covers every base. Use this alongside the concrete examples in SPELL_JSON_EXAMPLES.md.

### 2. Migration Order: Complete One Level at a Time

**NEW STRATEGY**: Focus on completing ALL cantrips before moving to Level 1 spells.

**Rationale**:
- Cantrips are available to level 1 characters from the start
- Completing one spell level category at a time maintains focus
- Reduces context switching between cantrip rules (character_level scaling) and spell rules (slot_level scaling)
- Easier to validate and QA one category at a time

**Updated Priority Order**:
1. ✅ **Complete ALL Cantrips first** (Level 0)
2. Then **Complete ALL Level 1 spells**
3. Then Level 2, Level 3, etc.

## Current PR Status (as of latest update)

### PR #38 - Level 1 Spells
**Status**: ✅ Ready to merge (per user)
- Contains 5 Level 1 spells
- Fixes have been applied

### PR #39 - Cantrips
**Status**: 🔄 Getting followup tasks (per user)
- Contains cantrips
- Currently being worked on

## Revised Coordination Strategy for Gemini

### Phase 1: Complete Cantrips (PR #39 + Additional PRs)

**Step 1**: Ensure PR #39 is completed correctly
- All cantrip effects have `trigger` and `condition` fields
- All cantrips use `"character_level"` for scaling (NOT `"slot_level"`)
- Validation passes

**Step 2**: Check STATUS_LEVEL_0.md
- How many total cantrips need migration?
- How many are already done?
- Prioritize remaining cantrips

**Step 3**: Task Jules with additional cantrip batches
- Use batch size of 5-10 cantrips per PR
- All must reference SPELL_TEMPLATE.json + SPELL_JSON_EXAMPLES.md
- All must validate before PR creation

**Step 4**: Only move to Level 1 after ALL cantrips are complete

### Phase 2: Complete Level 1 Spells

**Step 1**: Since PR #38 is ready to merge, merge it

**Step 2**: Check STATUS_LEVEL_1.md
- How many total Level 1 spells need migration?
- How many are already done (including PR #38)?
- Prioritize remaining spells

**Step 3**: Task Jules with Level 1 batches
- Batch size of 5-10 spells per PR
- All must reference SPELL_TEMPLATE.json + SPELL_JSON_EXAMPLES.md
- All must use `"slot_level"` for scaling (NOT `"character_level"`)
- All must validate before PR creation

**Step 4**: Only move to Level 2 after ALL Level 1 spells are complete

## Updated Task Template for Future Batches

```markdown
TASK: Migrate [Number] Cantrips to New JSON Format

**REQUIRED READING**:
1. `docs/spells/SPELL_TEMPLATE.json` - Complete template showing ALL possible fields
2. `docs/spells/SPELL_JSON_EXAMPLES.md` - 10 complete, validated examples
3. Focus on Example 1 (Fire Bolt) for cantrip pattern

**CRITICAL RULES FOR CANTRIPS**:
1. `"level": 0`
2. Scaling uses `"character_level"`, NOT `"slot_level"`
3. ALL effects MUST have `trigger` and `condition` fields

**Spells to Migrate**:
[List of spell names]

**Workflow**:
1. Read SPELL_TEMPLATE.json to understand all possible fields
2. Read SPELL_JSON_EXAMPLES.md Example 1 (Fire Bolt)
3. For each spell:
   - Identify effect type (DAMAGE, UTILITY, etc.)
   - Copy structure from matching example
   - Fill in spell-specific values
   - Verify trigger + condition on ALL effects
   - Verify scaling type is "character_level"
4. Create glossary entries
5. Update docs/spells/STATUS_LEVEL_0.md
6. Run: `npm run validate`
7. Fix any errors
8. Create PR

**Template Reference**: `docs/spells/SPELL_TEMPLATE.json`
**Examples Reference**: `docs/spells/SPELL_JSON_EXAMPLES.md`
```

## Updated Task Template for Level 1+ Spells

```markdown
TASK: Migrate [Number] Level [X] Spells to New JSON Format

**REQUIRED READING**:
1. `docs/spells/SPELL_TEMPLATE.json` - Complete template showing ALL possible fields
2. `docs/spells/SPELL_JSON_EXAMPLES.md` - 10 complete, validated examples

**CRITICAL RULES FOR LEVELED SPELLS**:
1. `"level": [1-9]`
2. Scaling uses `"slot_level"`, NOT `"character_level"`
3. ALL effects MUST have `trigger` and `condition` fields
4. Include `"higherLevels"` description if spell can be upcast
5. Check if spell is ritual (add `"ritual": true` if so)
6. Check for material component costs (add `"materialCost"` if GP cost exists)

**Spells to Migrate**:
[List of spell names]

**Workflow**:
1. Read SPELL_TEMPLATE.json to understand all possible fields
2. Read SPELL_JSON_EXAMPLES.md to find matching patterns
3. For each spell:
   - Identify effect type(s)
   - Find closest example in SPELL_JSON_EXAMPLES.md
   - Copy complete structure (don't cherry-pick fields)
   - Fill in spell-specific values
   - Verify trigger + condition on ALL effects
   - Verify scaling type is "slot_level"
   - Check for ritual property
   - Check for material costs
4. Create glossary entries
5. Update docs/spells/STATUS_LEVEL_[X].md
6. Run: `npm run validate`
7. Fix any errors
8. Create PR

**Template Reference**: `docs/spells/SPELL_TEMPLATE.json`
**Examples Reference**: `docs/spells/SPELL_JSON_EXAMPLES.md`
```

## Benefits of This Approach

### 1. Comprehensive Template
- Jules can see ALL possible fields in one place
- No ambiguity about what's available
- Comments explain when fields are required vs optional

### 2. Category Focus
- Cantrips have different scaling rules than leveled spells
- Completing one category at a time reduces errors
- Easier to spot pattern violations within a category

### 3. Incremental Progress
- Small batches (5-10 spells) are manageable
- Each batch validates before moving to next
- Clear progress tracking per spell level

### 4. Quality Gates
- Template + Examples = Clear expectations
- Validation required before PR
- Category completion before moving to next level

## Next Steps for Gemini

1. ✅ Verify PR #39 (cantrips) is complete and correct
2. ✅ Update Jules's tasks to reference SPELL_TEMPLATE.json + SPELL_JSON_EXAMPLES.md
3. ✅ Focus on completing ALL remaining cantrips
4. ✅ Track progress in STATUS_LEVEL_0.md
5. ✅ Only move to Level 1 spells after cantrips are 100% complete
6. ✅ Establish pattern: Template + Examples + Validation = Success

## Summary

**Old Approach**: Mixed cantrips and Level 1 spells, TypeScript references only
**New Approach**: Complete all cantrips first, use Template + Examples, validate each batch

**Key Resources for Jules**:
- `docs/spells/SPELL_TEMPLATE.json` - Comprehensive field reference
- `docs/spells/SPELL_JSON_EXAMPLES.md` - 10 working examples
- STATUS files for tracking progress by level

**Success Metric**: All cantrips migrated and validated before any Level 1 work continues.
