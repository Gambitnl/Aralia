---
description: Run TypeScript tests (Vitest, TSD, TSC) and handle errors systematically.
---

# /test-ts Workflow

Execute this workflow to run tests and resolve TypeScript errors while adhering to the **Preservationist Mentality**.

Select the mode needed for the requested change. These steps are guidance, not a
requirement to run every check. Preserve the approval boundaries in root `AGENTS.md`.

## Steps

1. **Environmental Verification**
   - Inspect the affected test configuration when test selection or exclusions are unclear.
   - A focused unit test does not require a full typecheck first. Run type checks when
     the change affects type contracts or the task explicitly calls for them.

2. **Categorized Testing**
   - **Unit Tests**: Run `npx vitest run [path]` for affected files. Use watch mode only
     when the task needs an ongoing interactive test session.
   - **Type Tests**: Run `npm run test:types` (uses `tsd`) for type-level assertions.
   - **Scoped Typecheck**: Run `npm run typecheck:files -- <path> [<path>...]` for the
     files you touched. This is the default typecheck for task work.
   - **Full Check**: When a comprehensive typecheck is required, run
     `npx tsc --noEmit --pretty false`. If saving output, use an ignored path under
     `.agent/scratch/` after confirming it with `git check-ignore`.

### Vitest under multi-agent load

`vitest.config.ts` splits discovery into two projects. Both share every setting except
the timeout, and the union of the two is the same file list a single project found.

| Project | Files | `testTimeout` |
| --- | --- | --- |
| `app` | everything else | 5 s (Vitest default) |
| `generation` | `src/systems/worldforge/bridge/__tests__`, `src/systems/worldforge/local/__tests__`, `src/components/BattleMap/__tests__` | 60 s |

The runner prints the lane next to each file (`|generation| src/...`), so you can tell
at a glance which timeout a failure was measured against. Add a suite to
`SLOW_SUITE_GLOBS` only after confirming on a quiet run that its tests exceed roughly
4 s; do not raise the global default, because that is what lets a genuinely hung unit
test fail fast.

When several agents share this checkout, the machine - not the code - is the variable.
Run scoped tests as:

```
npx vitest run <files> --pool=threads --testTimeout=60000
```

`--pool=threads` avoids the process-fork transform cost that pushed per-file transform
time to 143-500 s in earlier sweeps, and the explicit `--testTimeout` covers files
outside the `generation` lane that only get slow while the box is loaded.

**Retry once on a worker start timeout.** `Error: Timeout waiting for worker to
respond` and a collection error in a file that has no relation to your change are load
artifacts, not regressions. Re-run the same command once. If it reproduces, it is real
and belongs in your report; if it passes, say so rather than filing a phantom red.

3. **Analysis Phase**
   - Categorize errors into:
     - **Leaf-Node Mismatches**: Basic property type differences (e.g., `string` vs `literal`).
     - **Missing Propeties**: Required fields omitted in mocks.
     - **Structural Mismatches**: Deeply nested objects failing to match interfaces.

4. **Resolution (Preservationist Mentality)**
   - **Minimalism**: Fix only the reported error; do not refactor surrounding code.
   - **Stability**: Prioritize `@ts-expect-error` or `as any` if a formal fix threatens runtime stability (especially in legacy/procedural modules).
   - **Structural Integrity**: Never flatten or alter object shapes to satisfy the compiler; restore the interface to match the data if appropriate.
   - **Refactor Escalation via Tags**: If the formal fix requires broader refactor, do not silently expand scope.
     - Use `// TODO(next-agent):` to queue explicit refactor work.
     - Use `// REVIEW_INTENT:` when unsure if existing logic is intentional.
     - Use `// DEBT:` for temporary low-risk stabilization workarounds.

5. **Final Hygiene**
   - Report which checks passed and any failures, distinguishing existing debt from
     regressions caused by the change. Rerun affected checks after repairs.
   - After the relevant checks pass, stop unless an unresolved risk warrants more proof.
     Use session maintenance only when the root `AGENTS.md` criteria apply.
