# Character Creator Living Tracker

Status: active (G2 resolved 2026-06-08; no pending review hold â€” confirmed in the 2026-06-10 decision blitz housekeeping pass)
Last updated: 2026-06-12

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
| T5 | not_started | Track and prioritize wizard/validation edge-case follow-up in project workflow | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Promote into local gap planning and close on implementation handoff | Confirm with registry evidence and product owner |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/character-creator/GAPS.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (Feature/UI Projects row) | Keeps known unresolved edge behavior visible across handoffs | Move to execution task when feature scope is resumed | Concrete validation checklist before release |
| G3 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/CharacterCreator.test.tsx` debt | docs enrichment | test file contains TODO lint-intent markers for unused imports | Signals technical debt and potential lint churn for future maintainers | Address in local code task, not this docs-only pass | CI lint check result or test clean-up PR |
| G18 | not_started | adjacent_follow_up | Gemini | `useCharacterAssembly.ts` / `sidebarSteps.ts` | cold-start gap discovery | Redundant base race validation checks remain in `useCharacterAssembly.ts` and `sidebarSteps.ts` for elf, goliath, and tiefling despite these being non-selectable base helper races | `useCharacterAssembly.ts:293-296`, `sidebarSteps.ts:52-55` | Leads to dead code and unnecessary validation maintenance for helper classes that are never selected by the user | Remove redundant base-race checks from `useCharacterAssembly.ts` and `sidebarSteps.ts` | Vitest and compiler checks pass after removal |
| G19 | not_started | adjacent_follow_up | Gemini | `characterReducer.ts` / `RacialRestChoiceData` | cold-start gap discovery | TypeScript and mapping error in `characterReducer.ts` rest choices: `RacialRestChoiceData` lacks `weaponIds` and the rest reducer maps skill choices to malformed `Skill` objects lacking `id`/`ability` | `types/character.ts:473-480`, `characterReducer.ts:626-628,638,644` | Causes TypeScript compiler check failures and corrupts the character's skill list on rest choice resolution | Add `weaponIds` to `RacialRestChoiceData` and look up the full `Skill` object from `SKILLS_DATA` inside the rest reducer mapping function | `npm run typecheck` passes; long rest resolves and successfully applies skill/weapon choices on characters |

## Update Rules

- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/character-creator/GAPS.md`.
- For cross-project or out-of-project artifacts, prefer routing to `docs/projects/GLOBAL_GAPS.md`.
