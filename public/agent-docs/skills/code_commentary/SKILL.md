---
name: Code Commentary
description: >
  Universal commenting standard for all agents working on the Aralia codebase. Every code
  file that an agent creates or edits must contain plain-English comments that explain what
  each section does, why it was built that way, and what problems were left behind. The
  owner of this project does not read code — comments are the primary way they understand
  what agents have done. Use this skill during ANY code-writing task.
---

# Code Commentary

## Why This Exists

The owner of this codebase does not read or write code. They rely entirely on comments
to understand what a file does, why it was built the way it was, and what state it was
left in. Comments are not a nicety — they are the primary interface between the agents
who write the code and the human who owns it.

A second audience is future agents. When a new agent opens a file months later, the
comments should give it full context without needing to trace imports or read other files.

## When This Applies

**Every file an agent creates or edits.** There are no exceptions. If you touched it,
you comment it — including code you didn't write but that surrounds your changes.

If the file already has good comments, leave them alone. If it has none, add them while
you're there.

---

## The Three Layers

### 1. File Header

Every file gets a plain-English paragraph at the top (below imports) that answers:

- What does this file do? (One sentence, no jargon.)
- Why does it exist? What problem does it solve or what part of the game does it power?
- How does it connect to the rest of the system? What calls it, and what does it call?

Write it like you're explaining the file to someone who has never seen code before.

```ts
/**
 * This file calculates how much each business in the game is worth.
 *
 * Every in-game day, the world simulation asks this file to update the value of every
 * player-owned and NPC-owned business. It looks at how much money the business made
 * recently, how good the location is, and whether someone is actively managing it.
 * The result is a gold value that gets used when a player tries to buy or sell a business.
 *
 * Called by: worldReducer.ts (Step 5b — daily business simulation)
 * Depends on: the region registry for location quality, BusinessManagement for manager scores
 */
```

### 2. Section Separators

Break the file into named regions using visual dividers. Each separator gets a
plain-English explanation of what that section handles.

```ts
// ============================================================================
// Revenue Calculation
// ============================================================================
// This section figures out how much money a business earned recently.
// It only looks at the last 30 game-days because older income doesn't reflect
// current trends. The number it produces gets fed into the valuation formula
// in the next section below.
// ============================================================================
```

Use these for every logical group in the file — imports, constants, types, each
major function cluster, exports, etc. The reader should be able to scroll through
the file and understand its structure just by reading the separators.

### 3. Block-Level Comments

Place a comment above **every meaningful block of code**: functions, conditionals,
loops, assignments that aren't self-evident, return statements with logic behind them.

Write these in plain English. Explain what the block does in terms of the game, not
in terms of the programming language. Pretend the reader doesn't know what a "map",
"reduce", or "ternary" is.

```ts
// Look at the last 30 days of income and average it out.
// This smooths over good days and bad days to get a stable number.
const recentDays = business.revenueHistory.slice(-30);
const avgDaily = recentDays.reduce((sum, day) => sum + day.net, 0) / recentDays.length;

// Project that daily average across a full game-year (360 days)
// to get an annual earnings estimate — this is what buyers care about.
const projectedAnnual = avgDaily * 360;

// Management quality ranges from 0 (abandoned) to 100 (perfect).
// We scale it to a 0.1–1.0 multiplier. Even an abandoned business keeps
// 10% of its value because the physical building still has worth.
const mgmtFactor = Math.max(0.1, mgmtQuality / 100);
```

**Never** write comments that just restate the code in programming terms.

- Bad: `// Multiply avgDaily by 360`
- Good: `// Project that daily average across a full game-year (360 days)`

- Bad: `// Check if length is zero`
- Good: `// If the business hasn't earned any money yet, it has no market value`

---

## Debt and Shortcut Flagging

When you take a shortcut, use a workaround, or leave something imperfect, **say so
loudly** directly above the problem. Don't quietly move on hoping nobody notices.

Use these prefixes so they're easy to search for:

### `// DEBT:`
For known shortcuts or imperfect code that works but should be improved later.

```ts
// DEBT: Using 'any' here because the API response shape changes depending on
// which endpoint was called. A proper union type should be created once the
// API is stable, mapping each endpoint to its specific response shape.
const data: any = await fetchEndpoint(url);
```

### `// HACK:`
For ugly workarounds that solve an immediate problem but aren't the right fix.

```ts
// HACK: The date picker component fires onChange twice on first render.
// This flag skips the first call. The real fix is to patch the component
// library or switch to a different one.
if (isFirstRender.current) { isFirstRender.current = false; return; }
```

### `// TODO(next-agent):`
For work that's explicitly deferred to a future session. Be specific about what
needs doing and why you couldn't do it now.

```ts
// TODO(next-agent): This function assumes all businesses have a revenueHistory
// array, but newly created businesses might not. Add a guard clause that returns
// 0 for businesses less than 1 day old. Skipped now because the business creation
// flow is being rewritten in a separate branch.
```

### Rules for debt flags:

- Place them **directly above** the line or block they describe. Never on the same line.
- Explain **what** the shortcut is, **why** you took it, and **what the proper fix** would be.
- Be honest. If you used `as any` because you didn't know the right type, say that.
  Don't dress it up as a deliberate choice.

---

## Preservationist Rules

These rules apply to all code-editing work. They are the canonical version — other
skills and workflows reference this section rather than repeating it.

### Minimal Impact
Fix only the problem you were asked to fix. Don't refactor surrounding code, rename
variables for style, or "improve" things that aren't broken. Every change is a risk.

### No Deletion
Never remove features, exports, or working code just to make the compiler happy or
the linter quiet. Add types, add guards, add narrowing — but don't delete.

### Structural Integrity
Don't reshape objects, flatten nested data, or change API signatures to satisfy
type errors. If the data has a certain shape, the types should match the data — not
the other way around.

### Don't Mutate Tests to Pass
If a test fails, the code is probably wrong — not the test. Fix the code. If you
genuinely believe the test is outdated, explain why in a comment above the change.

---

## Red Flags Checklist

Before finishing any task, scan every file you touched for these patterns. If you
introduced any of them during this session, fix them or flag them with a DEBT comment
explaining why they're there.

| Pattern | Why it's a problem |
|---------|-------------------|
| `: any` | Hides real type information — use a specific type |
| `as any` | Forces the compiler to look away — document why |
| `throw new Error('not implemented')` | Stub that will crash at runtime — implement or remove |
| `console.log` (outside logger.ts) | Use the project's logger utility instead |
| `@ts-ignore` / `@ts-expect-error` | Silences the compiler — only acceptable with a comment explaining why |
| Mock/fake data in non-test files | Should use real data sources |
| Hardcoded values | Should come from config or data files |

---

## Mode Override: Pickle Rick

When running in Pickle Rick mode (`/pickle-rick`), the following overrides apply:

- **TODOs are not acceptable.** Pickle Rick finishes what it starts. If you can't
  finish something, stop and ask the user instead of leaving a TODO.
- **Elegance over preservation.** Verbose or clunky code should be made clean, even
  if that means rewriting it. The preservationist "don't touch what isn't broken" rule
  is relaxed — Rick fixes what he sees.
- **All other commentary rules still apply.** Plain English, block-level comments,
  section separators, debt flagging — all still required.

---

## Self-Review Checklist

Before you finish your task, verify:

- [ ] Every file has a plain-English header explaining what it does and why
- [ ] Logical sections are separated with visual dividers and descriptions
- [ ] Every block of code has a comment above it in plain English
- [ ] All shortcuts and workarounds are flagged with DEBT, HACK, or TODO
- [ ] Comments explain things in game terms, not programming jargon
- [ ] No stale comments left behind from previous code that was changed
- [ ] The red flags checklist was reviewed
