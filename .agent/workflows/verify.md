---
description: Verify code quality before finishing work. Run lint, type-check, build, tests, and check for red flags.
---

# Verify Workflow

Run this before finishing any implementation work to catch issues early.

---

## Step 1: Automated Checks

Run these commands and report the results:

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type checking
npm run build         # Production build
npm run test -- --run # Vitest (single run, no watch)
```

If any command fails, fix the issues before proceeding. Do NOT:
- Suppress errors with `@ts-ignore` or `@ts-expect-error` unless the fix genuinely threatens runtime stability
- Mutate tests to make them pass — fix the code instead
- Skip a failing check and move on

---

## Step 2: Red Flag Scan

Search the files you modified for these patterns:

| Pattern | What it means |
|---------|---------------|
| `throw new Error('not implemented')` | Stub — must be implemented or removed |
| `// TODO` or `// FIXME` (new ones) | Acceptable if documented, but don't leave without noting |
| `: any` (new occurrences) | Weak typing — use a specific type |
| `console.log` (not in logger.ts) | Use `src/utils/logger.ts` instead |
| `as any` | Type assertion hiding a real issue |
| Mock/fake data in non-test files | Should use real data sources |

Report any new instances found. If you introduced them during this session, fix them.

---

## Step 3: Preservationist Check

When fixing errors, follow the **Preservationist Mentality**:

- **Minimalism**: Fix only the reported error — do not refactor surrounding code
- **Stability**: If a formal fix threatens runtime stability in legacy code, use `@ts-expect-error` with a comment explaining why
- **Structural Integrity**: Never flatten or alter object shapes just to satisfy the compiler — restore the interface to match the data if appropriate

---

## Step 4: Report

Summarize:
- How many lint errors/warnings (before vs after if applicable)
- How many type errors (before vs after)
- Build status (pass/fail)
- Test results (pass count, fail count, skip count)
- Any red flags found and what was done about them
