# Command Factory Runtime Living Tracker

Status: active  
Last updated: 2026-06-08

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
| T2 | active | Monitor drift after source edits and keep gaps updated | Worker C | 2026-06-08 | `docs/projects/command-factory-runtime/NORTH_STAR.md`, `src/commands/factory/AbilityCommandFactory.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts` | Confirm the shared validator now covers ability-side attacker filters, then update `GAPS.md` if drift or a blocker appears | `Select-String -Path src\\commands\\factory\\*.ts,src\\hooks\\useAbilitySystem.ts -Pattern 'SpellCommandFactory\\.matchesFilter|TargetValidationUtils\\.matchesFilter'` and relevant factory tests |

## Gap Log

- Durable gaps for this runtime are tracked in `docs/projects/command-factory-runtime/GAPS.md`.
- No implementation blockers were discovered in the docs-only pass.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
