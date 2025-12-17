# Spell Migration System - Final Summary

## Status: Pattern Established ✅

**PR #38** (5 Level 1 spells) - **MERGED** ✅
**PR #39** (Cantrips) - **MERGED** ✅

The working pattern is now established. Time to scale it! Follow-up: Absorb Elements and Armor of Agathys still need their stored/retaliation damage expressed as `DAMAGE` effects with correct triggers and slot-level scaling.

## What You Have Now

### 1. Complete Spell Template
**File**: [archive/SPELL_TEMPLATE.json](archive/SPELL_TEMPLATE.json) *(archived - use SPELL_JSON_EXAMPLES.md as primary reference)*

Shows ALL possible spell fields with comments. Answers the question: "What CAN a spell have?"

> **Note**: The template is now archived. Use `SPELL_JSON_EXAMPLES.md` as the primary source of truth, with `src/systems/spells/validation/spellValidator.ts` as the authoritative schema.

### 2. Working Examples
**File**: [docs/spells/SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md)

10 complete, validated spells showing concrete patterns. Answers the question: "How do I actually use those fields?"

### 3. Gemini Coordination Prompt (UPDATED)
**File**: [docs/tasks/spell-system-overhaul/PROMPT_FOR_GEMINI_V2.md](PROMPT_FOR_GEMINI_V2.md)

Complete instructions for Gemini to coordinate Jules through GitHub. Updated to reflect that PR #38 and #39 are merged.

### 4. Migration Strategy
**File**: [docs/tasks/spell-system-overhaul/TASK_STRATEGY_UPDATE.md](TASK_STRATEGY_UPDATE.md)

The plan: Complete ALL cantrips → Complete ALL Level 1 → Then Level 2, 3, etc.

## The Established Pattern

```
Jules receives task →
  Reads SPELL_TEMPLATE.json (all fields) →
  Reads SPELL_JSON_EXAMPLES.md (how to use them) →
  Finds matching example →
  Copies complete structure →
  Fills in spell-specific values →
  Verifies trigger + condition on ALL effects →
  Runs npm run validate →
  Creates PR →
Gemini reviews →
  Checks trigger + condition fields ✅
  Checks correct scaling type ✅
  Checks validation passes ✅
  Approves or requests changes →
Pattern repeats
```

## Critical Rules (From PR #38 & #39)

1. **ALL effects MUST have**:
   - `trigger`: { "type": "..." }
   - `condition`: { "type": "..." }
   - Plus effect-specific fields

2. **Scaling type matters**:
   - Cantrips (Level 0): `"character_level"`
   - Level 1+: `"slot_level"`

3. **Effect types are ALL CAPS**:
   - ✅ `"DAMAGE"`, `"HEALING"`, `"DEFENSIVE"`
   - ❌ `"damage"`, `"Damage"`, `"Buff"`

4. **Validation is mandatory**:
   - `npm run validate` must pass before PR

## Next Steps for Spell Migration

### Phase 1: Complete Remaining Cantrips (HIGH PRIORITY)

1. Check `docs/spells/STATUS_LEVEL_0.md` for remaining cantrips
2. Send PROMPT_FOR_GEMINI_V2.md to Gemini 3 Pro
3. Gemini tasks Jules with batches of 5-10 cantrips
4. Gemini reviews PRs via comments
5. Approve when validation passes
6. Repeat until STATUS_LEVEL_0.md shows 100%

### Phase 2: Complete Remaining Level 1 Spells

1. Check `docs/spells/STATUS_LEVEL_1.md` for remaining spells
2. Gemini tasks Jules with batches of 5-10 spells
3. Same review/approval process
4. Repeat until STATUS_LEVEL_1.md shows 100%

### Phase 3: Continue Through Spell Levels

Repeat the pattern for Level 2, 3, 4, etc.

## Why This Works

### The Problem We Solved
**Before**: "Follow src/types/spells.ts" → Jules didn't understand TypeScript `extends`

**After**: "Use SPELL_TEMPLATE.json + SPELL_JSON_EXAMPLES.md" → Jules pattern-matches successfully

### The Pattern We Established
- Template = "What fields exist?"
- Examples = "How do I use them?"
- Validation = "Did I do it right?"
- One level at a time = "Stay focused"

## What to Send Gemini

**Primary Prompt**: [PROMPT_FOR_GEMINI_V2.md](PROMPT_FOR_GEMINI_V2.md)

This updated prompt:
- ✅ Reflects that PR #38 and #39 are merged
- ✅ Focuses on completing remaining cantrips first
- ✅ Includes task templates for both cantrips and leveled spells
- ✅ Has quality gates and validation checklists
- ✅ Uses GitHub issue/PR comment coordination

## Communication Flow

```
You send PROMPT_FOR_GEMINI_V2.md to Gemini
                    ↓
Gemini creates GitHub issue with task
                    ↓
Jules reads issue → Migrates spells → Creates PR
                    ↓
Gemini reviews PR via comments
                    ↓
Jules fixes any issues
                    ↓
Gemini approves → You merge
                    ↓
Repeat until spell level 100% complete
                    ↓
Move to next spell level
```

### Coordination via GitHub CLI

- Post instructions: `gh pr comment <pr-number> --body "Fix instructions here..."`
- Review diff: `gh pr diff <pr-number>`
- Post feedback: `gh pr comment <pr-number> --body "Feedback here..."`

## Key Files Reference

| File | Purpose |
|------|---------|
| `SPELL_TEMPLATE.json` | Shows ALL possible fields |
| `SPELL_JSON_EXAMPLES.md` | 10 working spell examples |
| `PROMPT_FOR_GEMINI_V2.md` | Gemini's complete coordination instructions |
| `TASK_STRATEGY_UPDATE.md` | Migration strategy (one level at a time) |
| `ROOT_CAUSE_ANALYSIS_PR38.md` | Why we use examples, not TypeScript |
| `STATUS_LEVEL_0.md` | Cantrip progress tracking |
| `STATUS_LEVEL_1.md` | Level 1 spell progress tracking |

## Success Criteria

You'll know it's working when:
- PRs pass validation on first attempt
- All effects include trigger + condition fields
- Cantrips use character_level; leveled spells use slot_level
- One spell level completes before moving to next
- Contributors reference the template and examples
- Absorb Elements + Armor of Agathys use `DAMAGE` (not `UTILITY`) for stored/retaliation damage with correct triggers and scaling

## Red Flags (Block PRs)

- UTILITY used for actual damage/healing (should be DAMAGE/HEALING)
- Missing `trigger` or `condition` on any effect
- PR submitted without `npm run validate` passing
- Scaling type mismatched to spell level (slot_level vs character_level)

## What's Different Now

### Before PR #38 & #39:
- ❌ Jules given TypeScript references
- ❌ Missing trigger/condition fields
- ❌ Mixed scaling types
- ❌ No comprehensive template

### After PR #38 & #39:
- ✅ Jules has complete template
- ✅ Jules has 10 working examples
- ✅ Pattern established and proven
- ✅ Quality gates in place
- ✅ Ready to scale

## Your Action

**Send [PROMPT_FOR_GEMINI_V2.md](PROMPT_FOR_GEMINI_V2.md) to Gemini 3 Pro and let the system work!**

The pattern is established. The tools are ready. Gemini just needs to maintain the quality gates and keep Jules working through the spell levels one at a time.

---

**Bottom Line**: We fixed the root cause (TypeScript → Examples), established the pattern (PR #38 & #39), created the tools (Template + Examples), and documented the process (Gemini prompt). Now it's time to scale! 🚀
