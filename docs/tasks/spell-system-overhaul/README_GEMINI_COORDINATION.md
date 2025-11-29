# Gemini-Jules Coordination Guide

## Quick Start

Send the contents of **PROMPT_FOR_GEMINI.md** to Gemini 3 Pro to begin coordinating Jules on spell migration fixes.

## How It Works

### Communication Flow

```
User → Gemini 3 Pro → GitHub PR Comments → Jules
                                            ↓
                                    Jules reads PR comments
                                            ↓
                                    Jules makes fixes
                                            ↓
                                    Jules pushes commits
                                            ↓
                                    Jules replies to comments
                                            ↓
Gemini monitors PR ← GitHub PR ← Jules
```

### Coordination Method

**Gemini coordinates Jules through GitHub PR comments using `gh` CLI:**

```bash
# Gemini posts instructions
gh pr comment 38 --body "Fix instructions here..."

# Jules reads PR comments and responds
# Jules commits fixes to PR

# Gemini reviews
gh pr diff 38
gh pr comment 38 --body "Feedback here..."
```

## Key Documents

### For Gemini to Read
1. **PROMPT_FOR_GEMINI.md** - Complete coordination instructions
2. **docs/spells/SPELL_JSON_EXAMPLES.md** - Source of truth for spell structure
3. **docs/spells/ROOT_CAUSE_ANALYSIS_PR38.md** - Why the issue happened

### For Jules to Read (via Gemini's PR comments)
1. **docs/spells/SPELL_JSON_EXAMPLES.md** - Complete spell examples
2. PR comments from Gemini with specific fix instructions

## Current State

### PR #38 - Level 1 Spells
**Status**: Partially fixed
- `absorb-elements.json` has trigger/condition fields ✅
- BUT uses UTILITY effect instead of DAMAGE for bonus damage ❌
- Other 4 spells need trigger/condition fields added

### PR #39 - Cantrips
**Status**: Needs fixing
- All cantrips likely missing trigger/condition fields

## Gemini's Mission

1. **Phase 1**: Fix PR #38
   - Post root cause analysis to PR
   - Post detailed fix instructions
   - Monitor Jules's fixes
   - Review and provide feedback
   - Verify validation passes

2. **Phase 2**: Fix PR #39
   - Post fix instructions once PR #38 is done
   - Monitor and review
   - Verify validation passes

3. **Phase 3**: Establish Pattern
   - Post summary establishing future workflow
   - Set up quality gate for future PRs

## Success Metrics

- ✅ All effects in PR #38 have trigger + condition fields
- ✅ Absorb Elements uses DAMAGE effect (not UTILITY) for bonus damage
- ✅ All effects in PR #39 have trigger + condition fields
- ✅ `npm run validate` passes for both PRs
- ✅ Jules understands to use SPELL_JSON_EXAMPLES.md going forward

## Red Flags for Gemini to Watch

If Jules:
- Uses UTILITY effect for actual damage/healing → Must use DAMAGE/HEALING
- Skips trigger/condition fields → Point to examples
- References TypeScript instead of examples → Redirect to examples
- Creates PR without validation → Require validation first

## The Core Fix

**Problem**: Jules was given TypeScript type definitions
**Solution**: Provide concrete JSON examples instead

**Key Insight**: AI agents excel at pattern matching, struggle with TypeScript inheritance.

## Emergency Contact

If Gemini gets stuck or Jules doesn't respond:
- Check PR comments are actually posting
- Verify Jules has PR notification access
- Escalate to user if needed

---

**Remember**: Gemini coordinates via PR comments. All instructions to Jules go through GitHub PRs.
