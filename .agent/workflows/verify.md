---
description: Verify code quality before finishing work. Run lint, type-check, build, tests, and check for red flags.
chain: tidy-up
chain_via: session-ritual
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

If any command fails, fix the issues before proceeding. Follow the
**Preservationist Rules** from `.agent/skills/code_commentary/SKILL.md` when fixing.

---

## Step 2: Red Flag Scan

Search the files you modified for the patterns listed in the **Red Flags Checklist**
in `.agent/skills/code_commentary/SKILL.md`.

Report any new instances found. If you introduced them during this session, fix them
or flag them with a `// DEBT:` comment explaining why they're there.

---

## Step 3: Code Commentary Check

Verify that all files you modified follow the **Code Commentary** rules from the skill:

- Every file has a plain-English header
- Logical sections have visual separators
- Every block of code has a comment above it
- All shortcuts are flagged with DEBT, HACK, or TODO

---

## Step 4: Report

Summarize:
- How many lint errors/warnings (before vs after if applicable)
- How many type errors (before vs after)
- Build status (pass/fail)
- Test results (pass count, fail count, skip count)
- Any red flags found and what was done about them
