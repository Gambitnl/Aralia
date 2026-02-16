# Spell Implementation Checklist

**For New Contributors**  
**Last Updated:** 2025-12-13  
**Purpose:** Step-by-step guide for implementing new spells in the V2 system

## Overview

This checklist helps new contributors implement spells correctly in the Aralia RPG spell system. Follow these steps in order to ensure quality and consistency.

## Pre-Implementation Preparation

### 1. Research Phase
- [ ] **Identify the spell** you want to implement
- [ ] **Check existing status** in `docs/spells/STATUS_LEVEL_{N}.md`
- [ ] **Verify it's not already in progress** by checking recent PRs/issues
- [ ] **Review spell mechanics** in official D&D 5e sources
- [ ] **Find reference implementation** by examining similar existing spells

### 2. Environment Setup
- [ ] **Fork and clone** the repository
- [ ] **Install dependencies:** `npm install`
- [ ] **Verify development environment:** `npm run dev`
- [ ] **Run initial validation:** `npm run validate`

## Implementation Steps

### Phase 1: Data Creation

#### 1.1 File Setup
- [ ] **Create directory** if it doesn't exist: `public/data/spells/level-{N}/`
- [ ] **Name file correctly:** `spell-name.json` (kebab-case)
- [ ] **Copy template** from similar spell or use example from `docs/spells/SPELL_JSON_EXAMPLES.md`

#### 1.2 Basic Metadata
- [ ] **Set `id`:** kebab-case matching filename
- [ ] **Set `name`:** Proper title case
- [ ] **Set `level`:** 0-9 (0 for cantrips)
- [ ] **Set `school`:** From approved spell schools list
- [ ] **Set `ritual`:** boolean value
- [ ] **Write `description`:** Accurate flavor text
- [ ] **Add `higherLevels`:** If applicable, otherwise `null`

#### 1.3 Mechanical Properties
- [ ] **Define `castingTime`:** Value, unit, and combatCost
- [ ] **Define `range`:** Type and distance
- [ ] **Define `components`:** Verbal, somatic, material flags
- [ ] **Define `duration`:** Type, concentration flag, value if needed
- [ ] **Define `targeting`:** Type, range, validTargets array

#### 1.4 Class Access
- [ ] **Populate `classes` array** using official subclass list
- [ ] **Normalize class names** to uppercase
- [ ] **Include valid subclasses** only
- [ ] **Verify against source material**

#### 1.5 Effects Definition
- [ ] **Create `effects` array** with at least one effect
- [ ] **Add `trigger` object** to each effect
- [ ] **Add `condition` object** to each effect
- [ ] **Define primary effect type** (DAMAGE, HEALING, etc.)
- [ ] **Include scaling information** if applicable
- [ ] **Add `engineHook` section** with implementation status

### Phase 2: Validation

#### 2.1 Automated Validation
- [ ] **Run spell validation:** `npm run validate:spells`
- [ ] **Fix any schema errors** reported
- [ ] **Run TypeScript check:** `npm run typecheck`
- [ ] **Verify no compilation errors**
- [ ] **Run full build:** `npm run build`
- [ ] **Confirm successful build**

#### 2.2 Manual Validation
- [ ] **Check JSON formatting** (proper indentation, no trailing commas)
- [ ] **Verify all required fields** are present
- [ ] **Confirm enum values** match approved lists
- [ ] **Test filename matches** `id` field exactly
- [ ] **Validate class normalization** against official list

### Phase 3: Integration Testing

#### 3.1 Character Creation Test
- [ ] **Start development server:** `npm run dev`
- [ ] **Create test character** of appropriate class
- [ ] **Navigate to spell selection** step
- [ ] **Verify spell appears** in available options
- [ ] **Select the spell** and complete character creation
- [ ] **Confirm spell is in** character's spellbook

#### 3.2 Spellbook Test
- [ ] **Open character sheet**
- [ ] **Access spellbook overlay**
- [ ] **Verify spell displays** with correct information
- [ ] **Check spell details** (range, components, duration)
- [ ] **Test prepared/unprepared** functionality if applicable

#### 3.3 Combat Test
- [ ] **Enter combat scenario**
- [ ] **Access spell abilities**
- [ ] **Verify spell appears** as usable ability
- [ ] **Test targeting system** works correctly
- [ ] **Cast spell** and verify effects apply
- [ ] **Check spell slot** consumption (if applicable)
- [ ] **Verify combat log** shows correct messages

#### 3.4 Edge Case Testing
- [ ] **Test with different character levels**
- [ ] **Test higher-level casting** if applicable
- [ ] **Test concentration** mechanics if applicable
- [ ] **Test saving throws** if required
- [ ] **Test range limitations**
- [ ] **Test with different targets** (ally, enemy, self)

### Phase 4: Documentation

#### 4.1 Status Tracking
- [ ] **Update appropriate** `STATUS_LEVEL_{N}.md` file
- [ ] **Change status** from Bronze/Silver to Gold
- [ ] **Add implementation notes** if needed
- [ ] **Update completion date**

#### 4.2 Integration Checklist
- [ ] **Update** `SPELL_INTEGRATION_CHECKLIST.md`
- [ ] **Mark completed sections**
- [ ] **Note any remaining gaps**

#### 4.3 Pull Request Preparation
- [ ] **Write clear PR title:** "feat(spells): Add [Spell Name]"
- [ ] **Include validation results** in PR description
- [ ] **List tested scenarios**
- [ ] **Mention any known limitations**
- [ ] **Reference related issues** if applicable

## Quality Assurance Checklist

### Code Quality
- [ ] **No validation errors** from Zod schema
- [ ] **No TypeScript compilation errors**
- [ ] **Consistent field ordering** with other spells
- [ ] **Proper enum casing** (lowercase units, Title Case schools)
- [ ] **Clear, descriptive field names**

### Data Accuracy
- [ ] **Mechanics match** official source material
- [ ] **Class access is correct** and normalized
- [ ] **Level scaling is accurate** if applicable
- [ ] **Descriptions are faithful** to source
- [ ] **Components are properly** specified

### Integration Quality
- [ ] **Works in character creation**
- [ ] **Appears in spellbook correctly**
- [ ] **Functions in combat as expected**
- [ ] **Handles edge cases gracefully**
- [ ] **Provides proper user feedback**

## Common Pitfalls to Avoid

### Data Structure Issues
- ❌ **Missing required fields** - Always check the complete schema
- ❌ **Incorrect enum values** - Use exact values from reference lists
- ❌ **Wrong file location** - Ensure correct level directory
- ❌ **Filename mismatch** - ID must exactly match filename

### Implementation Issues
- ❌ **Incomplete effects** - Every spell needs at least one effect
- ❌ **Missing trigger/condition** - Required for all effects
- ❌ **Invalid class names** - Only use approved base classes/subclasses
- ❌ **Poor scaling definition** - Level scaling should be explicit

### Testing Issues
- ❌ **Skipping integration tests** - Always test in actual gameplay
- ❌ **Only testing happy path** - Include edge cases and error conditions
- ❌ **Ignoring validation errors** - Fix all reported issues
- ❌ **Not testing multiple classes** - Verify class access works correctly

## Resources and Help

### Primary Documentation
- **Main Guide:** `docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md`
- **Data Creation:** `docs/guides/SPELL_DATA_CREATION_GUIDE.md`
- **Examples:** `docs/spells/SPELL_JSON_EXAMPLES.md`
- **Architecture:** `docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`

### Validation Tools
- **Schema Validator:** `src/systems/spells/validation/spellValidator.ts`
- **JSON Schema:** `src/systems/spells/schema/spell.schema.json`
- **Validation Command:** `npm run validate:spells`

### Status Tracking
- **Overall Progress:** `docs/SPELL_INTEGRATION_STATUS.md`
- **Per-Level Status:** `docs/spells/STATUS_LEVEL_{N}.md`
- **Integration Details:** `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

### Community Support
- **Check existing issues** for similar problems
- **Review recent PRs** for implementation patterns
- **Ask in discussions** if you're stuck
- **Pair with experienced** contributor if available

## Completion Criteria

A spell implementation is complete when:

### ✅ Technical Requirements
- [ ] Passes all validation checks
- [ ] Compiles without errors
- [ ] Builds successfully
- [ ] All required fields present
- [ ] Proper effect structure
- [ ] Correct class normalization

### ✅ Functional Requirements
- [ ] Appears in character creation
- [ ] Shows correctly in spellbook
- [ ] Works in combat scenarios
- [ ] Handles edge cases appropriately
- [ ] Provides user feedback

### ✅ Documentation Requirements
- [ ] Status files updated
- [ ] Integration checklist marked complete
- [ ] PR ready with proper description
- [ ] Clear implementation notes

## Next Steps After Completion

1. **Submit Pull Request** with complete implementation
2. **Request review** from maintainers
3. **Address feedback** promptly
4. **Merge when approved**
5. **Celebrate your contribution!**

---

**Remember:** Quality over speed. Take time to understand the system and implement correctly. The spell system is critical to gameplay, so thorough implementation and testing are essential.