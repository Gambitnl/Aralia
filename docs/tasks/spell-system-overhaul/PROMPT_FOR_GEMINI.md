# Prompt for Gemini 3 Pro - Spell Migration Coordination

## Context

Jules has been tasked with migrating D&D 5e spells to a new JSON format. Two PRs have been created (PR #38 and PR #39) but both have critical structural issues. The root cause has been identified: Jules was given TypeScript type definitions but no concrete JSON examples, and doesn't understand that TypeScript `extends` keyword means those fields must be included in the JSON.

## Your Mission

Coordinate Jules to:
1. Fix the existing broken PRs (#38 and #39)
2. Establish a working pattern using validated examples
3. Continue spell migration with correct structure

## Critical Documents Created

Three new documents have been created to solve this problem:

1. **docs/spells/SPELL_JSON_EXAMPLES.md** - 10 complete, validated spell JSON examples
2. **docs/tasks/spell-system-overhaul/JULES_TASK_PROMPTS.md** - Ready-to-use task templates
3. **docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md** - Analysis of what went wrong

## Immediate Actions Required

### Phase 1: Fix PR #38 (Priority: CRITICAL)

**Task for Jules**:

```
URGENT FIX REQUIRED: PR #38 - Add Missing BaseEffect Fields

PR #38 has 5 Level 1 spells with invalid effect structures. All effects are missing required "trigger" and "condition" fields.

STEP 1: Read the Complete Example
Open and read: docs/spells/SPELL_JSON_EXAMPLES.md
Focus on Example 3 (Absorb Elements) - this is one of the spells you need to fix.

STEP 2: Understand the Problem
Every effect in PR #38 is missing these REQUIRED fields:
{
  "trigger": { "type": "..." },
  "condition": { "type": "..." }
}

STEP 3: Fix Each Spell
You need to fix these 5 files in public/data/spells/:
1. absorb-elements.json
2. alarm.json
3. animal-friendship.json
4. armor-of-agathys.json
5. arms-of-hadar.json

STEP 4: Example Fix for Absorb Elements

CURRENT (BROKEN):
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "defenseType": "resistance",
      "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
      "duration": { "type": "rounds", "value": 1 }
    }
  ]
}

REQUIRED (CORRECT):
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "defenseType": "resistance",
      "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
      "duration": {
        "type": "rounds",
        "value": 1
      }
    },
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "turn_start"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d6",
        "type": "Acid"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ]
}

CRITICAL NOTE: Absorb Elements has TWO effects:
1. Immediate resistance to damage (DEFENSIVE)
2. Bonus damage on next melee hit (DAMAGE)

STEP 5: Pattern Reference

For DEFENSIVE effects (no attack/save needed):
{
  "type": "DEFENSIVE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  // ... rest of defensive fields
}

For DAMAGE effects requiring attack roll:
{
  "type": "DAMAGE",
  "trigger": { "type": "immediate" },
  "condition": { "type": "hit" },
  // ... rest of damage fields
}

For DAMAGE effects requiring saving throw:
{
  "type": "DAMAGE",
  "trigger": { "type": "immediate" },
  "condition": {
    "type": "save",
    "saveType": "Dexterity",
    "saveEffect": "half"
  },
  // ... rest of damage fields
}

For STATUS_CONDITION effects:
{
  "type": "STATUS_CONDITION",
  "trigger": { "type": "immediate" },
  "condition": {
    "type": "save",
    "saveType": "Wisdom",
    "saveEffect": "negates_condition"
  },
  // ... rest of status fields
}

For UTILITY effects:
{
  "type": "UTILITY",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  // ... rest of utility fields
}

STEP 6: Fix Each Spell Using Examples

For each of the 5 spells:
1. Read the spell description to understand what it does
2. Find the matching example in docs/spells/SPELL_JSON_EXAMPLES.md
3. Copy the complete effect structure from the example
4. Fill in your spell's specific values
5. Make sure EVERY effect has "trigger" and "condition" fields

STEP 7: Validation
After fixing all 5 spells, run:
npm run validate

Fix any errors that appear.

STEP 8: Commit
Commit the fixes to PR #38 with message:
"fix: add missing BaseEffect fields (trigger, condition) to all effects"

DO NOT create a new PR. Fix the existing PR #38.

REFERENCE:
- Complete examples: docs/spells/SPELL_JSON_EXAMPLES.md (READ THIS!)
- Why this happened: docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md
```

### Phase 2: Fix PR #39 (Priority: HIGH)

**Task for Jules**:

```
FIX REQUIRED: PR #39 - Add Missing BaseEffect Fields

PR #39 has cantrips with the same structural issue as PR #38.

STEP 1: Read the Cantrip Example
Open: docs/spells/SPELL_JSON_EXAMPLES.md
Read Example 1 (Fire Bolt) completely.

STEP 2: Identify Which Cantrips Need Fixing
Check all cantrip JSONs in PR #39. Each effect must have:
- "trigger" field
- "condition" field

STEP 3: Apply the Fire Bolt Pattern
All cantrips should follow this pattern:

{
  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d10",
        "type": "Fire"
      },
      "scaling": {
        "type": "character_level",
        "bonusPerLevel": "+1d10"
      }
    }
  ]
}

CRITICAL: Cantrips use "character_level" for scaling, NOT "slot_level"

STEP 4: Fix and Validate
1. Add missing fields to all cantrip effects
2. Run: npm run validate
3. Fix any errors
4. Commit to PR #39: "fix: add missing BaseEffect fields to cantrip effects"

REFERENCE:
- Cantrip example: docs/spells/SPELL_JSON_EXAMPLES.md Example 1
```

### Phase 3: Future Spell Migration (Priority: MEDIUM)

**Guidelines for Jules**:

```
GUIDELINES: Future Spell Migration Tasks

Going forward, ALL spell migration tasks must follow this workflow:

BEFORE YOU START:
1. Read docs/spells/SPELL_JSON_EXAMPLES.md completely
2. Identify which example(s) match your spell type
3. Copy the example structure exactly

FOR EACH SPELL:
1. Read the D&D 5e spell description
2. Determine effect type(s):
   - Deals damage → DAMAGE
   - Heals HP → HEALING
   - Grants AC/resistance/temp HP → DEFENSIVE
   - Applies condition (Charmed, Paralyzed, etc.) → STATUS_CONDITION
   - Changes movement → MOVEMENT
   - Summons creatures → SUMMONING
   - Creates terrain → TERRAIN
   - Other (light, detection, etc.) → UTILITY

3. Find matching example in SPELL_JSON_EXAMPLES.md
4. Copy the complete structure including ALL fields
5. Fill in spell-specific values
6. Verify EVERY effect has:
   - "trigger": { "type": "..." }
   - "condition": { "type": "..." }
   - Effect-specific fields (damage, healing, etc.)

VALIDATION CHECKLIST:
Before creating ANY PR, verify:
✅ All effects have "trigger" field
✅ All effects have "condition" field
✅ Effect types are all caps: "DAMAGE", not "damage"
✅ Damage types are capitalized: "Fire", not "fire"
✅ Conditions are capitalized: "Paralyzed", not "paralyzed"
✅ Schools are capitalized: "Evocation", not "evocation"
✅ Units are lowercase: "action", not "Action"
✅ Ritual spells have "ritual": true
✅ Touch spells have both range.type: "touch" AND targeting.range: 5
✅ Validation passes: npm run validate

NEVER:
❌ Skip the BaseEffect fields (trigger, condition)
❌ Use old format types ("Buff", "Debuff")
❌ Guess at structure from TypeScript files
❌ Create PR without running validation
❌ Mix old and new format

ALWAYS:
✅ Start from concrete examples in SPELL_JSON_EXAMPLES.md
✅ Copy complete structure, don't cherry-pick fields
✅ Run npm run validate before creating PR
✅ Check that every effect has trigger + condition

REFERENCE:
- Examples: docs/spells/SPELL_JSON_EXAMPLES.md
- Task templates: docs/tasks/spell-system-overhaul/JULES_TASK_PROMPTS.md
```

## Your Coordination Strategy

**IMPORTANT: You will coordinate Jules through GitHub PR comments, NOT direct messages.**

Jules monitors PR comments and will take action based on your feedback. Use the GitHub CLI (`gh`) tool to post comments.

### Step 1: Post Root Cause Analysis to PR #38

Use GitHub CLI to comment on PR #38:

```bash
gh pr comment 38 --body "## Root Cause Identified

PR #38 has structural issues with the spell effect definitions. All effects are missing required \`trigger\` and \`condition\` fields from BaseEffect.

**Full Analysis**: See \`docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md\`

**What went wrong**: You were given TypeScript type definitions to follow, but TypeScript's \`extends\` keyword means those parent fields must be included in the JSON. All effects must extend BaseEffect, which requires:
- \`trigger\`
- \`condition\`

**Solution**: I've created complete JSON examples showing the correct structure.

**Next Steps**: See my next comment for detailed fix instructions."
```

### Step 2: Post Fix Instructions to PR #38

Comment with the complete fix task:

```bash
gh pr comment 38 --body "## Fix Instructions for PR #38

**REQUIRED READING FIRST**: \`docs/spells/SPELL_JSON_EXAMPLES.md\`

This document contains 10 complete, validated spell examples. Example 3 (Absorb Elements) is one of the spells in this PR.

### Critical Issue

Every effect in this PR is missing these REQUIRED fields:
\`\`\`json
{
  \"trigger\": { \"type\": \"...\" },
  \"condition\": { \"type\": \"...\" }
}
\`\`\`

### Example Fix: Absorb Elements

**CURRENT (BROKEN)**:
\`\`\`json
{
  \"effects\": [
    {
      \"type\": \"DEFENSIVE\",
      \"defenseType\": \"resistance\",
      \"damageType\": [\"Acid\", \"Cold\", \"Fire\", \"Lightning\", \"Thunder\"],
      \"duration\": { \"type\": \"rounds\", \"value\": 1 }
    }
  ]
}
\`\`\`

**REQUIRED (CORRECT)**:
\`\`\`json
{
  \"effects\": [
    {
      \"type\": \"DEFENSIVE\",
      \"trigger\": { \"type\": \"immediate\" },
      \"condition\": { \"type\": \"always\" },
      \"defenseType\": \"resistance\",
      \"damageType\": [\"Acid\", \"Cold\", \"Fire\", \"Lightning\", \"Thunder\"],
      \"duration\": { \"type\": \"rounds\", \"value\": 1 }
    },
    {
      \"type\": \"DAMAGE\",
      \"trigger\": { \"type\": \"turn_start\" },
      \"condition\": { \"type\": \"hit\" },
      \"damage\": { \"dice\": \"1d6\", \"type\": \"Acid\" },
      \"scaling\": { \"type\": \"slot_level\", \"bonusPerLevel\": \"+1d6\" }
    }
  ]
}
\`\`\`

**NOTE**: Absorb Elements has TWO effects (resistance + bonus damage).

**CRITICAL**: The second effect MUST be type \`DAMAGE\`, NOT \`UTILITY\`. The spell deals actual damage (1d6 scaling with spell slot), which requires the DAMAGE effect type with proper dice and type fields.

### Files to Fix

1. \`public/data/spells/absorb-elements.json\` - ⚠️ Currently uses UTILITY for damage (must be DAMAGE)
2. \`public/data/spells/alarm.json\`
3. \`public/data/spells/animal-friendship.json\`
4. \`public/data/spells/armor-of-agathys.json\`
5. \`public/data/spells/arms-of-hadar.json\`

### Workflow

1. Read \`docs/spells/SPELL_JSON_EXAMPLES.md\` completely
2. For each spell, find the matching example
3. Add \`trigger\` and \`condition\` to every effect
4. Verify complete structure matches examples
5. Run: \`npm run validate\`
6. Commit fixes to this PR

### Common Patterns

**DEFENSIVE (no attack/save)**:
\`\`\`json
{
  \"type\": \"DEFENSIVE\",
  \"trigger\": { \"type\": \"immediate\" },
  \"condition\": { \"type\": \"always\" },
  // ... rest of fields
}
\`\`\`

**DAMAGE (attack roll)**:
\`\`\`json
{
  \"type\": \"DAMAGE\",
  \"trigger\": { \"type\": \"immediate\" },
  \"condition\": { \"type\": \"hit\" },
  // ... rest of fields
}
\`\`\`

**DAMAGE (saving throw)**:
\`\`\`json
{
  \"type\": \"DAMAGE\",
  \"trigger\": { \"type\": \"immediate\" },
  \"condition\": {
    \"type\": \"save\",
    \"saveType\": \"Dexterity\",
    \"saveEffect\": \"half\"
  },
  // ... rest of fields
}
\`\`\`

Reply to this comment when fixes are committed."
```

### Step 3: Monitor PR #38 for Jules's Response

Watch for Jules to:
1. Reply to your comment acknowledging the task
2. Push commits fixing the spell JSONs
3. Report validation results

### Step 4: Review and Validate

Once Jules pushes fixes, review the changes:

```bash
# Check the diff
gh pr diff 38

# Post validation comment
gh pr comment 38 --body "Reviewing your fixes now..."
```

If fixes look good:
```bash
gh pr comment 38 --body "✅ Fixes look good! All effects now have trigger and condition fields. Great work following the examples.

Please confirm that \`npm run validate\` passes with no errors."
```

If issues remain:
```bash
gh pr comment 38 --body "⚠️ Issues found:

1. [Specific file]: [Specific issue]
2. [Specific file]: [Specific issue]

Please review \`docs/spells/SPELL_JSON_EXAMPLES.md\` Example [X] and ensure the structure matches exactly."
```

### Step 5: Move to PR #39

Once PR #38 is fixed and validated, post to PR #39:

```bash
gh pr comment 39 --body "## Fix Required: PR #39

This PR has the same structural issue as PR #38 (now fixed).

**Issue**: Cantrip effects are missing \`trigger\` and \`condition\` fields.

**Reference**: \`docs/spells/SPELL_JSON_EXAMPLES.md\` Example 1 (Fire Bolt)

**Cantrip Pattern**:
\`\`\`json
{
  \"effects\": [
    {
      \"type\": \"DAMAGE\",
      \"trigger\": { \"type\": \"immediate\" },
      \"condition\": { \"type\": \"hit\" },
      \"damage\": { \"dice\": \"1d10\", \"type\": \"Fire\" },
      \"scaling\": {
        \"type\": \"character_level\",
        \"bonusPerLevel\": \"+1d10\"
      }
    }
  ]
}
\`\`\`

**CRITICAL**: Cantrips use \`\"character_level\"\` for scaling, NOT \`\"slot_level\"\`.

### Workflow
1. Read Example 1 in \`docs/spells/SPELL_JSON_EXAMPLES.md\`
2. Add \`trigger\` and \`condition\` to all cantrip effects
3. Verify scaling type is \`\"character_level\"\`
4. Run: \`npm run validate\`
5. Commit fixes

Reply when ready for review."
```

### Step 6: Establish Pattern for Future

After both PRs are fixed, create a summary comment on PR #38:

```bash
gh pr comment 38 --body "## ✅ Pattern Established

Great work fixing this PR! Here's what we learned:

**Root Cause**: TypeScript references don't work as well as concrete JSON examples.

**Solution**: Always use \`docs/spells/SPELL_JSON_EXAMPLES.md\` as your source of truth.

**Going Forward**:
- ALL spell migration tasks should start by reading the examples document
- Match your spell to the closest example
- Copy the complete structure (don't cherry-pick fields)
- Run validation before creating PR

**Key Rule**: Every effect MUST have:
- \`trigger\`: { \"type\": \"...\" }
- \`condition\`: { \"type\": \"...\" }
- Plus effect-specific fields

This PR is now a working example for future reference. 🎉"
```

## Communication Template for Jules

Use this structure when tasking Jules:

```
TASK: [Specific task name]

REQUIRED READING FIRST:
- docs/spells/SPELL_JSON_EXAMPLES.md (Example [X])

CRITICAL RULE:
Every effect MUST include:
{
  "trigger": { "type": "..." },
  "condition": { "type": "..." }
}

COMPLETE EXAMPLE:
[Paste relevant example from SPELL_JSON_EXAMPLES.md]

WORKFLOW:
1. Read example
2. Copy structure
3. Fill in values
4. Verify trigger + condition on ALL effects
5. Run: npm run validate
6. Commit only if validation passes

REFERENCE:
- docs/spells/SPELL_JSON_EXAMPLES.md
- [Any other specific references]
```

## Success Criteria

You'll know this is working when:

1. **PR #38 and #39 are fixed** with all effects containing trigger + condition fields
2. **Validation passes**: `npm run validate` shows no errors
3. **Pattern is established**: Jules starts each new task by referencing SPELL_JSON_EXAMPLES.md
4. **Future PRs are correct**: New spell migrations have complete effect structures on first attempt

## Red Flags to Watch For

If Jules:
- ❌ Creates effects without trigger/condition → Stop immediately, point to examples
- ❌ Uses old format types ("Buff", "Damage") → Refer to SPELL_JSON_EXAMPLES.md for correct types
- ❌ Creates PR without validation → Require validation before PR creation
- ❌ References TypeScript files instead of examples → Redirect to SPELL_JSON_EXAMPLES.md

## Key Insight

The root cause was simple: **We gave Jules a reference to TypeScript interfaces when we should have given concrete JSON examples.**

The fix is equally simple: **Show, don't tell. Use SPELL_JSON_EXAMPLES.md as source of truth.**

AI agents excel at pattern matching. TypeScript `extends` keyword is not a pattern they can easily match to JSON structure. But complete JSON examples? Perfect pattern matching material.

## Your Action Items

### Before Starting

1. ✅ Read this prompt completely
2. ✅ Familiarize yourself with `docs/spells/SPELL_JSON_EXAMPLES.md`
3. ✅ Check current state of PR #38 and PR #39:
   ```bash
   gh pr view 38
   gh pr view 39
   gh pr diff 38
   gh pr diff 39
   ```

**NOTE**: You may see that `absorb-elements.json` in PR #38 already has `trigger` and `condition` fields added. This is good progress! However:
- Check if it uses UTILITY effect for the damage (WRONG) or DAMAGE effect (CORRECT)
- The damage effect should be type DAMAGE with `trigger.type: "turn_start"`, not UTILITY
- Verify all other spells in PR #38 also have the required fields
- Continue with your feedback based on what still needs fixing

### Phase 1: Fix PR #38

4. ✅ Post root cause comment to PR #38 (see Step 1 above)
5. ✅ Post fix instructions to PR #38 (see Step 2 above)
6. ✅ Monitor for Jules's response and commits
7. ✅ Review changes when Jules pushes:
   ```bash
   gh pr diff 38
   ```
8. ✅ Post validation feedback (either approval or issues found)
9. ✅ Verify `npm run validate` passes

### Phase 2: Fix PR #39

10. ✅ Once PR #38 is fixed, post fix instructions to PR #39 (see Step 5 above)
11. ✅ Monitor for Jules's response and commits
12. ✅ Review and validate PR #39 changes
13. ✅ Post approval or feedback

### Phase 3: Establish Pattern

14. ✅ Post summary comment to PR #38 establishing pattern (see Step 6 above)
15. ✅ Update your coordination protocol to:
    - Always communicate via PR comments
    - Always reference SPELL_JSON_EXAMPLES.md first
    - Require validation before PR approval

### Ongoing Monitoring

16. ✅ Watch for Jules to create new spell migration PRs
17. ✅ Check that new PRs follow the established pattern
18. ✅ If pattern is broken, immediately comment with reference to examples
19. ✅ Maintain quality gate: No PR approval without validation passing

## Questions?

If Jules asks questions, redirect to:
- Structure questions → docs/spells/SPELL_JSON_EXAMPLES.md
- "What went wrong?" → docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md
- Future task format → docs/tasks/spell-system-overhaul/JULES_TASK_PROMPTS.md

The examples document is comprehensive. Jules should find answers there first.

---

**Your role**: Coordinator and quality gate. Make sure Jules reads the examples before starting any work, and doesn't create PRs without passing validation.

**Jules's role**: Execute spell migrations by pattern-matching to examples, not by interpreting TypeScript.

**Success metric**: Clean PRs with valid JSON that passes `npm run validate` on first attempt.

Good luck, Gemini 3 Pro. You've got this! 🚀
