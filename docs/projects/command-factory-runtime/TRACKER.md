# TRACKER: Command Factory Runtime

Status: active  
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh project docs to capture command-factory role, file map, integrations, and gap list | Worker C | 2026-05-31 | `src/commands/factory`, `src/hooks/useAbilitySystem.ts`, `src/commands/index.ts` | Keep project docs source-anchored and watch for drift | Review this runtime on next factory edit |
| T2 | active | Monitor drift after source edits and keep gaps updated | Worker C | 2026-05-31 | `docs/projects/command-factory-runtime/NORTH_STAR.md` | Verify references still match runtime call-chain and test coverage | `rg -n "createCommands(" src` and relevant factory tests |

## Gap Log

- Durable gaps for this runtime are tracked in `docs/projects/command-factory-runtime/GAPS.md`.
- No implementation blockers were discovered in the docs-only pass.
