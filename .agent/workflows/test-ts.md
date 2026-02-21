---
description: Run TypeScript tests (Vitest, TSD, TSC) and handle errors systematically.
chain: tidy-up
chain_order: 1
---

# /test-ts Workflow

Execute this workflow to run tests and resolve TypeScript errors while following the
**Preservationist Rules** defined in `.agent/skills/code_commentary/SKILL.md`.

## Steps

1. **Environmental Verification**
   - Check if the project is in a consistent state:
     - Run `npx tsc --noEmit` locally to catch immediate regressions.
     - Check `vitest.config.ts` for any ignored clusters.

2. **Categorized Testing**
   - **Unit Tests**: Run `npm run test` or `npx vitest run [path]` for specific files.
   - **Type Tests**: Run `npm run test:types` (uses `tsd`) for type-level assertions.
   - **Full Check**: Run `npx tsc --noEmit --pretty false > tsc_output.log` for a comprehensive error list.

3. **Analysis Phase**
   - Categorize errors into:
     - **Leaf-Node Mismatches**: Basic property type differences (e.g., `string` vs `literal`).
     - **Missing Properties**: Required fields omitted in mocks.
     - **Structural Mismatches**: Deeply nested objects failing to match interfaces.

4. **Resolution**
   - Follow the **Preservationist Rules** and **Debt Flagging** standards from the Code Commentary skill.
   - Fix only the reported error; do not refactor surrounding code.
   - Flag risky fixes with `// DEBT:` or `// TODO(next-agent):` as defined in the skill.

5. **Final Hygiene**
   - Clear temporary logs (`tsc_output.log`).
   - Run `/session-ritual` to sync terminal learnings.
