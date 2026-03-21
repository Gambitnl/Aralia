# Guide: Verifying Changes In Aralia

**Last Updated**: 2026-03-11  
**Purpose**: Define how agents and collaborators should verify changes in the current Aralia repository, using the real repo workflow rather than the older XML handoff model.

## Core Rule

Do not claim a change is complete just because the source code looks right.

Verification means matching the kind of check to the kind of change:
- code behavior should be checked with tests, targeted execution, or direct runtime inspection
- docs should be checked against the actual repo state and affected links
- visual changes should be verified from rendered output, not from source inspection alone

## Verification Levels

### 1. Structural verification

Use when you changed organization, docs, naming, or references.

Examples:
- file exists at the new path
- links point to real files
- registry entries match the docs tree
- imports resolve after a refactor

This is necessary, but it is not enough for behavioral or visual claims.

### 2. Behavioral verification

Use when code behavior or data flow changed.

Examples:
- run the relevant unit tests
- run type checks when the change affects types or interfaces
- run lint when the change may have introduced syntax or rule violations
- perform a targeted runtime check if the issue is not well-covered by tests

If only some of these were run, say exactly which ones.

### 3. Visual verification

Use when the task changes layout, styling, visibility, interaction affordances, or other UI/UX behavior.

Per repo policy:
- rendered output is the source of truth
- do not claim a visual fix from DOM or source inspection alone
- use a screenshot, Playwright inspection, or direct rendered verification before calling the visual issue fixed

If you only confirmed structure and did not inspect the rendered result, say that explicitly.

## Documentation Verification

When changing docs:

1. verify factual claims against the repo
2. verify moved or rewritten links
3. verify the file's role still matches its location
4. update any ledgers or registries that depend on that file

For the current documentation overhaul:
- a file is only `processed` when claim extraction, repo verification, disposition, and follow-through are all complete

## Repo-Specific Checks

Depending on the change, verification may involve:
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- narrower targeted checks instead of full-suite runs when scope is local

If you changed exported signatures, `utils`, `hooks`, or `state` files, also follow the dependency-sync rule in [AGENTS.md](../AGENTS.md).

## What To Report Back

A good verification note says:
- what was checked
- what command or inspection method was used
- what passed
- what was not checked
- any residual risk

Good example:
- "Verified the docs rewrite against the current `docs/tasks/` tree and updated the registry links. No code tests were run because no runtime behavior changed."

Bad example:
- "Verified."

## Failure And Partial Verification

If full verification is blocked:
- say what blocked it
- say what you checked instead
- say what remains uncertain

Do not collapse partial verification into a stronger claim.

Examples:
- "Typecheck passed, but I did not run the UI flow."
- "Links were checked structurally, but I did not validate the rendered screen."
- "The file paths were updated, but the broader subtree still needs manual reconciliation."

## Related Docs

- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for everyday dev workflow orientation
- [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md) for doc-system rules
- [AGENTS.md](../AGENTS.md) for the repo's verification and reporting expectations
