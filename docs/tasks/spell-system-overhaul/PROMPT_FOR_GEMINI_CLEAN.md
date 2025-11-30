# Prompt for Gemini 3 Pro - Spell Migration Coordination

## Context

**PR #38** (5 Level 1 spells) and **PR #39** (cantrips) have both been **MERGED** ✅

The pattern is now established. Time to scale it!

## Your Mission

Coordinate Jules to complete spell migration one level at a time:

1. 📋 **Complete ALL remaining cantrips (Level 0)** - HIGHEST PRIORITY
2. 📋 **Complete ALL remaining Level 1 spells**
3. 📋 Then move to Level 2, Level 3, etc.
4. 🎯 **One spell level category at a time** - Do NOT mix levels

**Why this order?**
- Cantrips use `"character_level"` scaling, Level 1+ use `"slot_level"` scaling
- Completing one category at a time prevents errors
- Easier to validate one level at a time
- Cantrips are needed from character level 1

## Critical Documents

These documents solve the root cause (TypeScript → Examples):

1. **docs/spells/SPELL_TEMPLATE.json** - Shows ALL possible spell fields
2. **docs/spells/SPELL_JSON_EXAMPLES.md** - 10 complete, validated examples
3. **docs/tasks/spell-system-overhaul/TASK_STRATEGY_UPDATE.md** - Migration strategy
4. **docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md** - Why examples work better than TypeScript

## Your Workflow

### Step 1: Check Progress

```bash
# See which cantrips still need migration
cat docs/spells/STATUS_LEVEL_0.md

# See which Level 1 spells still need migration
cat docs/spells/STATUS_LEVEL_1.md
```

### Step 2: Create Task for Next Batch

Create a GitHub issue with the task. Here's the template (use GitHub Issues web UI or `gh issue create`):

---

## Task Template for Cantrips

**Title**: Migrate [Number] Cantrips to New JSON Format

**Body**:

```markdown
## Required Reading First

1. `docs/spells/SPELL_TEMPLATE.json` - Shows ALL possible fields
2. `docs/spells/SPELL_JSON_EXAMPLES.md` - Focus on Example 1 (Fire Bolt)

## Critical Rules for Cantrips

- `"level": 0`
- Scaling uses `"character_level"`, NOT `"slot_level"`
- ALL effects MUST have `trigger` and `condition` fields
- Effect types are ALL CAPS: `"DAMAGE"`, not `"damage"`

## Spells to Migrate

[List 5-10 cantrip names from STATUS_LEVEL_0.md]

## Workflow

1. Read SPELL_TEMPLATE.json to understand all available fields
2. Read SPELL_JSON_EXAMPLES.md Example 1 (Fire Bolt)
3. For each spell:
   - Identify effect type (DAMAGE, UTILITY, etc.)
   - Copy structure from Fire Bolt or matching example
   - Fill in spell-specific values
   - Verify `trigger` + `condition` on ALL effects
   - Verify scaling type is `"character_level"`
4. Create spell JSON: `public/data/spells/[spell-id].json`
5. Create glossary entry: `public/data/glossary/entries/spells/[spell-id].md`
6. Update `docs/spells/STATUS_LEVEL_0.md` - mark as `[D] Data Only`
7. Run: `npm run validate`
8. Fix any errors
9. Create PR titled: "feat: migrate [number] cantrips"

## Validation Checklist

Before creating PR, verify:
- ✅ All effects have `trigger` field
- ✅ All effects have `condition` field
- ✅ Effect types are ALL CAPS
- ✅ Scaling type is `"character_level"` (NOT `"slot_level"`)
- ✅ `npm run validate` passes

## Example Reference

Fire Bolt (Example 1 in SPELL_JSON_EXAMPLES.md) shows the cantrip pattern:
- Damage cantrip with attack roll
- character_level scaling
- Complete BaseEffect fields

Reply when PR is ready for review.
```

---

## Task Template for Level 1+ Spells

**Title**: Migrate [Number] Level [X] Spells to New JSON Format

**Body**:

```markdown
## Required Reading First

1. `docs/spells/SPELL_TEMPLATE.json` - Shows ALL possible fields
2. `docs/spells/SPELL_JSON_EXAMPLES.md` - Multiple examples for different patterns

## Critical Rules for Level [X] Spells

- `"level": [X]`
- Scaling uses `"slot_level"`, NOT `"character_level"`
- ALL effects MUST have `trigger` and `condition` fields
- Include `"higherLevels"` description if spell can be upcast
- Check if spell is ritual (add `"ritual": true` if so)

## Spells to Migrate

[List 5-10 spell names from STATUS_LEVEL_X.md]

## Common Patterns

Match your spell to these examples:
- **Defensive reaction** → Example 2 (Shield) or Example 3 (Absorb Elements)
- **AoE with save** → Example 4 (Burning Hands)
- **Ritual utility** → Example 5 (Detect Magic)
- **Touch healing** → Example 6 (Cure Wounds)
- **Status condition** → Example 7 (Hold Person)
- **Hybrid targeting** → Example 8 (Ice Knife)
- **Multi-target** → Example 9 (Magic Missile)
- **Summoning** → Example 10 (Find Familiar)

## Workflow

1. Read SPELL_TEMPLATE.json
2. For each spell, find closest example in SPELL_JSON_EXAMPLES.md
3. Copy complete structure from example
4. Fill in spell-specific values
5. Verify `trigger` + `condition` on ALL effects
6. Verify scaling type is `"slot_level"`
7. Check for ritual property
8. Create JSON and glossary entry
9. Update STATUS_LEVEL_[X].md
10. Run: `npm run validate`
11. Create PR

## Validation Checklist

- ✅ All effects have `trigger` and `condition` fields
- ✅ Scaling type is `"slot_level"` (NOT `"character_level"`)
- ✅ Ritual spells have `"ritual": true`
- ✅ `npm run validate` passes

Reply when PR is ready for review.
```

---

### Step 3: Monitor and Review PRs

When Jules creates a PR, use `gh` CLI to review:

```bash
# View the PR
gh pr view [PR_NUMBER]

# Check the diff
gh pr diff [PR_NUMBER]

# Post review comment
gh pr comment [PR_NUMBER] --body "Reviewing your migration..."
```

### Step 4: Provide Feedback

**If everything looks good:**

```bash
gh pr comment [PR_NUMBER] --body "✅ Great work! All spells have:
- trigger and condition fields ✅
- Correct scaling type ✅
- Proper effect types ✅

Please confirm npm run validate passes, then I'll approve."
```

**If issues found:**

```bash
gh pr comment [PR_NUMBER] --body "⚠️ Issues found:

1. [spell-name].json: Using slot_level scaling - should be character_level for cantrips
2. [spell-name].json: Missing trigger field on DAMAGE effect
3. [spell-name].json: Effect type 'damage' should be 'DAMAGE' (all caps)

Please review the examples and fix these issues."
```

### Step 5: Repeat Until Level Complete

Continue creating batches of 5-10 spells until the STATUS file shows 100% for that level.

### Step 6: Move to Next Level

Only move to the next spell level when the current level is 100% complete.

## Quality Gates

**Before approving ANY PR:**
1. ✅ All effects have `trigger` and `condition` fields
2. ✅ Correct scaling type (character_level for cantrips, slot_level for others)
3. ✅ Effect types are ALL CAPS
4. ✅ `npm run validate` passes
5. ✅ STATUS file updated

**Before moving to next spell level:**
1. ✅ Current level is 100% complete
2. ✅ All PRs for that level are merged
3. ✅ Pattern is working consistently

## Red Flags to Watch For

If Jules:
- ❌ Uses `slot_level` for cantrips → Reject, point to Fire Bolt example
- ❌ Uses `character_level` for leveled spells → Reject, point to correct example
- ❌ Skips `trigger`/`condition` → Reject, point to SPELL_TEMPLATE.json
- ❌ Creates PR without validation → Require validation first
- ❌ Mixes spell levels in one PR → Reject, require separation by level

## Key Patterns to Reinforce

### Cantrip Pattern (from PR #39)
```json
{
  "level": 0,
  "effects": [{
    "type": "DAMAGE",
    "trigger": { "type": "immediate" },
    "condition": { "type": "hit" },
    "damage": { "dice": "1d10", "type": "Fire" },
    "scaling": {
      "type": "character_level",
      "bonusPerLevel": "+1d10"
    }
  }]
}
```

### Level 1+ Pattern (from PR #38)
```json
{
  "level": 1,
  "effects": [{
    "type": "DEFENSIVE",
    "trigger": { "type": "immediate" },
    "condition": { "type": "always" },
    "defenseType": "resistance",
    "damageType": ["Fire"],
    "duration": { "type": "rounds", "value": 1 },
    "scaling": {
      "type": "slot_level",
      "bonusPerLevel": "+1 target"
    }
  }]
}
```

## Success Metrics

You'll know this is working when:
- ✅ Each PR passes validation on first attempt
- ✅ Jules consistently references SPELL_TEMPLATE.json and SPELL_JSON_EXAMPLES.md
- ✅ All effects have trigger + condition fields
- ✅ Correct scaling type for each spell level
- ✅ One spell level completes before moving to next

## The Established Pattern

From PR #38 and #39, we learned:

**What Works:**
- ✅ Template shows all possible fields
- ✅ Examples show how to use them
- ✅ Validation ensures correctness
- ✅ One level at a time prevents errors

**What Doesn't Work:**
- ❌ TypeScript references (inheritance confusion)
- ❌ Mixing spell levels (scaling confusion)
- ❌ No validation (errors slip through)

## Your Action Items

1. ✅ Read this prompt
2. ✅ Check STATUS_LEVEL_0.md for remaining cantrips
3. ✅ Create GitHub issue with cantrip task (5-10 spells)
4. ✅ Monitor Jules's PR
5. ✅ Review and provide feedback
6. ✅ Approve when validated
7. ✅ Repeat until all cantrips complete
8. ✅ Move to Level 1 (same process)
9. ✅ Continue through all spell levels

## Summary

**Pattern**: Template (what's possible) + Examples (how to use) + Validation (did it work) = Success

**Strategy**: One spell level at a time, 5-10 spells per batch

**Quality Gate**: No approval without trigger/condition fields and validation passing

The system is working - just maintain the pattern and scale it! 🚀
