---
description: Run TypeScript tests (Vitest, TSD, TSC) and handle errors systematically.
---

# /test-ts Workflow

Execute this workflow to run tests and resolve TypeScript errors while adhering to the **Preservationist Mentality**.

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
     - **Missing Propeties**: Required fields omitted in mocks.
     - **Structural Mismatches**: Deeply nested objects failing to match interfaces.

4. **Resolution (Preservationist Mentality)**
   - **Minimalism**: Fix only the reported error; do not refactor surrounding code.
   - **Stability**: Prioritize `@ts-expect-error` or `as any` if a formal fix threatens runtime stability (especially in legacy/procedural modules).
   - **Structural Integrity**: Never flatten or alter object shapes to satisfy the compiler; restore the interface to match the data if appropriate.
   - **Workflow Ritual**: Annotate risky fixes with `// TODO(next-agent): Preserve behavior; refine type...`.

5. **Final Hygiene**
   - Clear temporary logs (`tsc_output.log`).
   - Run `/session-ritual` to sync terminal learnings.
