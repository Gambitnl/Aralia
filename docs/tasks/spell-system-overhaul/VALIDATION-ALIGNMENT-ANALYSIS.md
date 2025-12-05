# Agent Task: Zod Validation vs Jules Acceptance Criteria Alignment

**Created:** 2025-12-05
**Status:** Pending Analysis

---

## Objective

Perform a deep-dive analysis to determine if the Zod validation schema aligns with Jules' acceptance criteria for spell migration.

---

## Key Questions to Answer

1. **What does the Zod validator actually check?**
   - Read [scripts/validate-data.ts](../../../scripts/validate-data.ts)
   - Read [src/systems/spells/validation/spellValidator.ts](../../../src/systems/spells/validation/spellValidator.ts)
   - Document every field, enum, and constraint that is validated

2. **What does Jules' acceptance criteria require?**
   - Read [JULES_ACCEPTANCE_CRITERIA.md](./JULES_ACCEPTANCE_CRITERIA.md)
   - Extract all quality requirements for migrated spells
   - Identify what makes a spell "acceptable" vs "needs revision"

3. **Where are the gaps?**
   - Compare validation requirements vs acceptance criteria
   - Identify what Zod checks that Jules doesn't care about
   - Identify what Jules cares about that Zod doesn't check

4. **What passes validation but fails acceptance?**
   - Are there spells that could be syntactically valid but semantically wrong?
   - Examples: Wrong damage dice, incorrect targeting, missing effects
   - Does validation check mechanical accuracy or just structure?

5. **What fails validation but should pass?**
   - Are there edge cases where Jules' acceptable format doesn't match Zod?
   - Are there optional fields that Zod requires but shouldn't?

---

## Files to Analyze

### Validation System
- [scripts/validate-data.ts](../../../scripts/validate-data.ts) - Main validation runner
- [src/systems/spells/validation/spellValidator.ts](../../../src/systems/spells/validation/spellValidator.ts) - Zod schema
- [src/types/spells.ts](../../../src/types/spells.ts) - TypeScript type definitions

### Acceptance Criteria
- [JULES_ACCEPTANCE_CRITERIA.md](./JULES_ACCEPTANCE_CRITERIA.md) - Quality standards for Jules
- [BATCH-CREATION-GUIDE.md](./BATCH-CREATION-GUIDE.md) - Batch workflow guidance
- [SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md) - Example spell formats

### Sample Data
- [public/data/spells/level-0/](../../../public/data/spells/level-0/) - Migrated cantrips
- [public/data/spells/](../../../public/data/spells/) - Legacy flat-structure spells

---

## Deliverables

Create a report document: `VALIDATION-VS-CRITERIA-REPORT.md`

### Section 1: Zod Validation Coverage
```markdown
## What Zod Validates

### Required Fields
- List all required fields with types

### Optional Fields
- List all optional fields

### Enum Constraints
- List all enum fields with valid values
- Note case-sensitivity rules

### Type Constraints
- Number ranges
- String formats
- Array requirements

### Business Logic Checks
- Does it validate class names against CLASSES_DATA?
- Does it check cross-field dependencies?
```

### Section 2: Jules Acceptance Criteria Coverage
```markdown
## What Jules' Criteria Require

### Mandatory Data
- List all fields Jules needs populated

### Quality Standards
- Damage dice accuracy
- Targeting correctness
- Effect completeness
- Description quality

### Format Requirements
- Specific structures required
- Example patterns expected
```

### Section 3: Gap Analysis
```markdown
## Alignment Matrix

| Requirement | Zod Checks? | Jules Requires? | Gap? |
|-------------|-------------|-----------------|------|
| Field `id` exists | ✅ | ✅ | No |
| Damage dice format | ✅ (string) | ✅ (valid dice) | ⚠️ Partial |
| ... | ... | ... | ... |

## Critical Gaps
1. **Gap:** Zod checks X but Jules doesn't care
2. **Gap:** Jules needs Y but Zod doesn't validate

## Recommendations
- Should Zod be stricter?
- Should Jules' criteria be relaxed?
- Are there validation rules that should be added?
```

### Section 4: Examples
```markdown
## Example: Valid But Wrong

Show an example spell JSON that:
- ✅ Passes Zod validation
- ❌ Fails Jules' acceptance criteria
- Explain why

## Example: Invalid But Acceptable

Show an example spell JSON that:
- ❌ Fails Zod validation
- ✅ Would meet Jules' quality bar
- Explain why (if such cases exist)
```

---

## Success Criteria

This analysis is complete when:
1. ✅ All Zod validation rules are documented
2. ✅ All Jules acceptance criteria are documented
3. ✅ A clear gap analysis identifies misalignments
4. ✅ Concrete examples demonstrate the gaps
5. ✅ Recommendations are provided for alignment

---

## Agent Instructions

**Approach:**
1. Read validation code thoroughly - don't just skim
2. Read Jules criteria thoroughly - extract implicit requirements
3. Create detailed comparison tables
4. Find real examples from the codebase to illustrate gaps
5. Be specific - vague analysis is not helpful

**Output:**
- Create `VALIDATION-VS-CRITERIA-REPORT.md` in this directory
- Use markdown tables, code examples, and clear sections
- Highlight critical gaps vs minor misalignments
- Provide actionable recommendations

**Tone:**
- Technical and precise
- Show your work with code references
- Use line numbers when citing code
- Don't speculate - verify everything

---

**Next Steps After Analysis:**
- Human review of report
- Decide if validation should be enhanced
- Decide if Jules' criteria should be adjusted
- Update documentation accordingly
