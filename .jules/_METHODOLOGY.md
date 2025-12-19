# Aralia Development Methodology

Process guidelines for all personas. Start here, dive into guides as needed.

---

## Core Philosophy: Thoroughness Over Brevity

**DO NOT take shortcuts.** Every feature should be:
- **Complete** - Not a stub, mock, or partial implementation
- **Documented** - JSDoc for functions, inline comments explaining "why"
- **Tested** - If it's important enough to write, it's important enough to test
- **Robust** - Handle edge cases, not just the happy path
- **Production-Ready** - Could ship to users as-is

> *"Go the extra mile. A half-finished feature is worse than no feature."*

### The Extra Mile Mandate

**You are not here to do the minimum. You are here to do it RIGHT.**

When implementing anything:
1. **Don't stub.** If you write a function signature, implement it fully.
2. **Don't mock when you can build.** Mocks in tests are fine. Mocking production functionality is not.
3. **Don't leave TODOs in your own work.** If you know something needs to be done, do it now.
4. **Don't underestimate scope.** If a feature needs 500 lines, write 500 lines. Don't cram it into 50.
5. **Don't optimize for "small PRs".** Optimize for *complete* PRs.

**Anti-patterns to avoid:**
```typescript
// ❌ BAD: Stubbing with TODO
function calculateDamage(attack: Attack): number {
  // TODO: Implement damage calculation
  return 0;
}

// ❌ BAD: Placeholder return values
function getSpellSlots(level: number): number[] {
  return []; // Will implement later
}

// ❌ BAD: Fake data instead of real implementation
const factions = ['placeholder']; // Replace with real data

// ✅ GOOD: Full implementation, even if lengthy
function calculateDamage(attack: Attack): number {
  const baseDamage = rollDice(attack.damageDice);
  const modifier = getAbilityModifier(attack.ability, attack.attacker);
  const resistanceMultiplier = getResistanceMultiplier(attack.damageType, attack.target);
  const vulnerabilityMultiplier = getVulnerabilityMultiplier(attack.damageType, attack.target);

  let total = (baseDamage + modifier) * resistanceMultiplier * vulnerabilityMultiplier;

  // Critical hits double dice damage (PHB p.196)
  if (attack.isCritical) {
    total += rollDice(attack.damageDice);
  }

  return Math.max(0, Math.floor(total));
}
```

**The litmus test:** If another developer opened your PR, would they see working code or placeholders?

### Understanding "ONE Feature"

Many persona missions say "implement ONE feature" or "fix ONE issue." This is about **scope control, not minimizing effort**.

**What "ONE" means:**
- Focus on a coherent unit of work (not multiple unrelated changes)
- See that unit through to completion
- Don't context-switch mid-implementation

**What "ONE" does NOT mean:**
- Keep it small
- Cut corners to fit in fewer lines
- Leave out edge cases
- Stub parts you don't feel like writing

A "ONE feature" that properly implements faction reputation with all edge cases, tests, documentation, and integration points might be 800 lines across 12 files. That's correct. A "ONE feature" that's 30 lines of placeholder code is wrong.

---

## Code Documentation Requirements

**All new code must include:**

1. **JSDoc for functions/classes:**
```typescript
/**
 * Calculates damage after applying resistances and vulnerabilities.
 * @param baseDamage - Raw damage before modifications
 * @param damageType - The type of damage (fire, cold, etc.)
 * @param target - The character receiving damage
 * @returns Final damage value, minimum 0
 */
function calculateDamage(baseDamage: number, damageType: DamageType, target: Character): number
```

2. **Inline comments explaining "why":**
```typescript
// We sort by level first to match PHB spell list ordering
// (players expect cantrips at top, 9th-level at bottom)
const sortedSpells = spells.sort((a, b) => a.level - b.level);
```

3. **Complex logic explanations:**
```typescript
// Advantage/disadvantage cancel out regardless of how many of each
// PHB p.173: "If circumstances cause a roll to have both, you have neither"
const hasAdvantage = advantages > 0 && disadvantages === 0;
```

---

## Architecture Awareness (Mandatory)

**All personas MUST consult the architecture documentation before making changes.**

### Before Starting Work

1. **Read `docs/ARCHITECTURE.md`** to understand domain boundaries
2. **Check the relevant domain doc** in `docs/architecture/domains/` for file ownership
3. **Review `docs/architecture/_generated/deps.json`** if you need to understand dependencies

### When Creating New Files

New files are a coordination risk. Before creating:
1. **Search architecture docs** for existing files with similar purpose
2. **Check if functionality already exists** elsewhere in the codebase

### Mandatory: Verify Files Are in Architecture (Before PR)

**After completing your work, you MUST verify that every file you modified or created is listed in the architecture documentation.**

For each file you touched:
1. Check if it appears in a domain doc under `docs/architecture/domains/`
2. If NOT found, add it to your worklog as "UNTRACKED"

#### Worklog Format for Untracked Files

```markdown
### UNTRACKED FILES
- `src/path/to/file.ts` - [brief purpose]
- `src/path/to/another.ts` - [brief purpose]
```

The Core persona (run by maintainer) will consolidate these into the architecture documentation between runs.

### When Modifying Shared Files

Some files are modified frequently and have high conflict risk:
- `src/types/index.ts`
- `src/App.tsx`
- `src/state/appState.ts`
- `src/types/combat.ts`

For these files:
1. Make minimal, focused changes
2. Document the change clearly in your PR

---

## Chronicle Directive (Worklogs)

**All personas MUST log critical learnings to their worklog.**

### Worklog Location & Naming
```
.jules/worklogs/worklog_<persona>.md
```
Example: `.jules/worklogs/worklog_analyst.md`

### ⚠️ CRITICAL: APPEND-ONLY WORKLOGS

**NEVER delete or overwrite your worklog file. ONLY append to it.**

```bash
# ❌ FORBIDDEN: Overwriting the file
echo "new content" > worklog_persona.md

# ✅ CORRECT: Appending to the file
echo "new content" >> worklog_persona.md
```

If your worklog doesn't exist, create it. If it exists, append new entries at the end.

### Date Discovery (Best Effort)

**Reference Date:** As of this methodology update, the actual date is **December 2025** (Amsterdam timezone).

If you believe you know the date, you're likely using your training cutoff. Try these commands to discover the real date:

```bash
# Try these to get the current date/time
date
Get-Date
timedatectl
cat /etc/timezone && date
```

**If date discovery works:** Use that date in your entries.

**If date discovery fails:** That's okay! Instead:
1. Omit the date from your entry, OR
2. Use "BATCH-UNKNOWN" as a placeholder

**Log your date discovery attempt:**

```markdown
### DATE DISCOVERY ATTEMPT
**Method tried:** [command you ran]
**Result:** [what happened - worked, permission denied, command not found, etc.]
```

This helps the Core persona (maintainer) understand what's possible in your environment and collectively troubleshoot date discovery for future batches.

### Entry Format
```markdown
### [Title]
**Learning:** [The critical insight]
**Action:** [How to apply this next time]
```

### What to Log
- ✅ Critical insights that apply to future work
- ✅ Patterns discovered that should be reused
- ✅ Edge cases that surprised you
- ❌ Routine work ("Fixed bug", "Added type")
- ❌ Task completion logs

---

## Verification Checklist

Before any PR:
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] No `console.log` left behind
- [ ] **New code has JSDoc and inline comments**
- [ ] **Implementation is complete, not stubbed**
- [ ] **Verified all modified files are in architecture docs** (log UNTRACKED if not)
- [ ] **Consulted architecture docs** for relevant domain

## Guides

### Code Workflow

| Topic | Guide | Summary |
|-------|-------|---------|
| Testing | [testing.md](guides/testing.md) | When to test, test structure, running tests |
| PR Workflow | [pr-workflow.md](guides/pr-workflow.md) | PR size, titles, descriptions, review process |
| Feature Discovery | [feature-discovery.md](guides/feature-discovery.md) | Finding work, claiming tasks, grep commands |

### Code Maintenance

| Topic | Guide | Summary |
|-------|-------|---------|
| TODOs | [todos.md](guides/todos.md) | TODO format, persona routing, lifecycle |
| Comments | [comments.md](guides/comments.md) | When to comment, JSDoc, inline comments |
| Refactoring | [refactoring.md](guides/refactoring.md) | Green/yellow/red light, steps, PR scope |
| Deprecation | [deprecation.md](guides/deprecation.md) | Marking deprecated, migration, removal |

---

## Quick TODO Reference

```typescript
// TODO [2025-12-16]: Brief description
// TODO(Persona) [2025-12-16]: Routes to specific persona
// FIXME [2025-12-16]: Something broken
// HACK [2025-12-16]: Temporary workaround
```

See [todos.md](guides/todos.md) for full protocol.

---

## Cross-Cutting: TODO Date Tagging

**All personas must tag undated TODOs when encountered.**

When you encounter a TODO/FIXME/HACK/XXX without a date:

1. **Check today's date first** - Don't assume, verify the current date
2. **Add `[discovered YYYY-MM-DD]`** to mark when you found it
3. **Do not claim you created it** - Use "discovered" not the creation format

```typescript
// Before: // TODO: Fix validation
// After:  // TODO [discovered 2025-12-16]: Fix validation

// Before: // FIXME: Race condition here
// After:  // FIXME [discovered 2025-12-16]: Race condition here
```

This is a **passive duty** - do it whenever you're already editing a file and notice an undated marker. Don't create PRs just for date tagging.

---

## Cross-Cutting: Visitation Tracking (Upkeep Personas Only)

**Applies to:** Scribe, Hunter, Gardener, Sentinel (audit/upkeep personas)

**Does NOT apply to:** Oracle, Vanguard, Bolt, Steward, Vector, etc. (code modification personas)

Upkeep personas should leave a visitation marker at the end of files they've audited:

```typescript
// @visited Scribe 2025-12-16
```

### Purpose
- Lets the persona skip already-visited files on subsequent runs
- Focus effort on unvisited areas of the codebase
- Prevents redundant audits of the same files

### Rules
1. **Check today's date first** - verify before adding marker
2. **Add marker at file end** - after all code, before any existing markers
3. **One line per persona** - each persona tracks separately
4. **Update on revisit** - if you do revisit, update your date

```typescript
// End of file
// @visited Scribe 2025-12-16
// @visited Hunter 2025-12-14
// @visited Gardener 2025-12-10
```

### Finding Unvisited Files

```bash
# Files Scribe hasn't visited
find src -name "*.ts" -o -name "*.tsx" | xargs grep -L "@visited Scribe"

# Files not visited by any upkeep persona
find src -name "*.ts" -o -name "*.tsx" | xargs grep -L "@visited"
```

### When to Revisit
- File was significantly modified since last visit (check git blame)
- 3+ months since last visit
- Specifically requested

---

## Quick PR Title Format

```
[emoji] Persona: Brief description

Examples:
🔮 Oracle: Add return types to spell utilities
🎯 Hunter: Resolve TODO in damage calculation
```

See [pr-workflow.md](guides/pr-workflow.md) for full guidelines.

---

## Cross-Cutting: D&D World Awareness

**Every feature must wire up to D&D mechanics and respect the living world simulation.**

Before implementing, ask:
- Does this respect information propagation? (See [dnd-domain.md](guides/dnd-domain.md#world-simulation--information-propagation))
- Would this make sense in a D&D world where magic exists but isn't universal?
- Are there mechanical hooks (skills, spells, abilities) that should interact with this?

> *"The world is simulated, not scripted. Events happen independently. Information travels realistically. Magic is powerful but not omnipresent."*

---

*See [_CODEBASE.md](_CODEBASE.md) for technical standards.*
*See [_ROSTER.md](_ROSTER.md) for persona domains.*
