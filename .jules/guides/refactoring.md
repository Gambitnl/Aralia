# Refactoring Guide

How to safely refactor code in Aralia.

---

## Self-Check Prompts

Ask yourself before refactoring:

> "Do tests exist for this code? If not, should I write them first?"
> "Is this refactor necessary, or am I gold-plating?"
> "Will this change ripple into many files? Should I scope it smaller?"
> "Am I refactoring AND adding features? Those should be separate PRs."

Refactoring should improve code without changing behavior. Creative deviations are fine, but be intentional.

---

## Traffic Light System

### Green Light - Just Do It

Small, safe changes that improve clarity:

- **Dead code removal** (< 20 lines)
- **Rename for clarity** (variable, function, file)
- **Extract helper function** (within same file)
- **Fix code style inconsistency**
- **Remove unused imports**
- **Simplify boolean expressions**

```typescript
// Before
const x = condition ? true : false;

// After (green light - obvious improvement)
const x = condition;
```

### Yellow Light - Ask First or Document in PR

Medium changes that need visibility:

- **Moving files** between directories
- **Changing function signatures** used in 3+ places
- **Extracting new module** from existing code
- **Changing state shape** in a localized way
- **Updates > 50 lines**

Create PR with clear explanation of *why*.

### Red Light - Needs Discussion

Large changes that affect architecture:

- **New dependencies**
- **State management pattern changes**
- **Directory structure reorganization**
- **Breaking changes to shared utilities**
- **Removing or merging modules**

Open an issue or RFC first. Get buy-in before coding.

---

## The Refactoring Process

### 1. Ensure Tests Exist

```bash
# Check coverage for the file
pnpm test --coverage src/utils/spellHelpers.ts
```

If no tests:
- Write tests first (captures current behavior)
- Then refactor
- Tests should pass before AND after

### 2. Make the Change

- One type of change at a time
- Commit frequently
- Keep changes reversible

### 3. Verify

```bash
pnpm build   # No type errors
pnpm test    # No regressions
pnpm lint    # Style passes
```

### 4. Review the Diff

Before PR:
- Is this change focused?
- Did I accidentally include unrelated changes?
- Would I understand this diff in 6 months?

---

## Common Refactors

### Extract Function

```typescript
// Before: inline logic
function processSpell(spell: Spell) {
  const damage = spell.level * 2 + 10;
  const scaled = Math.floor(damage * 1.5);
  // ... more code
}

// After: extracted helper
function calculateBaseDamage(level: number): number {
  const damage = level * 2 + 10;
  return Math.floor(damage * 1.5);
}

function processSpell(spell: Spell) {
  const damage = calculateBaseDamage(spell.level);
  // ... more code
}
```

### Rename for Clarity

```typescript
// Before: unclear
const d = calculateD(c, s);

// After: clear
const damage = calculateDamage(caster, spell);
```

### Simplify Conditionals

```typescript
// Before: nested ifs
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      doThing();
    }
  }
}

// After: guard clauses
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
doThing();
```

### Replace Magic Numbers

```typescript
// Before
if (level >= 5) {
  diceCount = 2;
}

// After
const CANTRIP_SCALING_LEVEL = 5;
const SCALED_DICE_COUNT = 2;

if (level >= CANTRIP_SCALING_LEVEL) {
  diceCount = SCALED_DICE_COUNT;
}
```

---

## Anti-Patterns

### Refactor + Feature

```typescript
// BAD: One PR that does both
// - Renamed all variables
// - Also added new validation logic
// - Also fixed a bug

// GOOD: Separate PRs
// PR 1: Rename variables for clarity
// PR 2: Add validation logic
// PR 3: Fix bug
```

### Big Bang Refactor

```typescript
// BAD: Rewrite entire module at once
// - High risk of breaking things
// - Hard to review
// - Hard to revert

// GOOD: Incremental refactoring
// Step 1: Extract helpers (small PR)
// Step 2: Rename for clarity (small PR)
// Step 3: Reorganize structure (small PR)
```

### Refactoring Without Tests

```typescript
// BAD: "I'll just clean this up real quick"
// *breaks something nobody notices for weeks*

// GOOD: Tests prove behavior preserved
```

---

## When NOT to Refactor

- **Deadline pressure** - ship first, refactor later
- **Code you don't own** - unless you're fixing a bug
- **"Just because"** - refactoring needs a reason
- **Unfamiliar code** - understand first, refactor later
- **Working code** - don't fix what isn't broken (unless it's blocking you)

---

## PR Scope

Keep refactoring PRs focused:

```
GOOD PR: "Rename spell helpers for clarity"
- Renames 5 functions
- Updates all call sites
- No behavior change

BAD PR: "Refactor spell system"
- Renames functions
- Changes state shape
- Adds new features
- Fixes 3 bugs
- 500 lines changed
```

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
