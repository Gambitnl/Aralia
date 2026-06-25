# Character Creator Living Tracker

Status: active (G2 resolved 2026-06-08; no pending review hold â€” confirmed in the 2026-06-10 decision blitz housekeeping pass)
Last updated: 2026-06-25

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
| G4 | done | adjacent_follow_up | Codex | `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` | test audit | Flow test contained stale lint-intent unused alias imports and had drifted from the current Changeling size requirement | Kept the flow smoke test noisy and brittle | Closed 2026-06-25; removed unused aliases and selected Changeling size before confirmation | `npm exec vitest run src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` passes |
| G7 | done | in_scope_now | Codex | `CreationSidebar.test.tsx` | cold-start gap discovery | Sidebar test used the stale `FeatSelection` alias and expected a feat step before human lineage selection | The test no longer described the visible sidebar contract | Closed 2026-06-24; test now proves `Racial Feat` is hidden initially and navigates to `CreationStep.RacialFeatSelection` for human lineage | `npm exec vitest run src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx` passes |
| G14 | done | adjacent_follow_up | Codex | `CreationSidebar.tsx` progress counter | 20-character flow audit | Progress counter credited default-complete future steps such as Age and Appearance before the user reached them | Completing one visible choice looked like several steps completed | Closed 2026-06-25; footer progress counts completed visible steps only when their step is at or before the active wizard step | `npm exec vitest run src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx` passes |
| G15 | done | adjacent_follow_up | Codex | `SkillSelection.tsx` background skill badges | 20-character flow audit | Background-granted class skills needed visible source feedback and protection from consuming class picks | Double-picking background skills wasted class skill choices | Closed 2026-06-25; auto-granted class skills remain visible as disabled/badged rows while replacement choices expand from the wider skill pool | `npm exec vitest run src/components/CharacterCreator/SkillSelection.test.tsx` passes |
| G17 | done | adjacent_follow_up | Codex | `WeaponMasterySelection.tsx` mastery eligibility/details | 20-character flow audit | Rusty Sword appeared in the mastery list and details were hover-only | Legacy duplicate gear looked like a build-defining weapon type; touch users could not inspect mastery rules | Closed 2026-06-25; mastery eligibility uses current weapon categories, excludes only legacy `rusty_sword`, and previews details on hover, focus, or click/tap | `npm exec vitest run src/components/CharacterCreator/WeaponMasterySelection.test.tsx` passes |
| G18 | done | adjacent_follow_up | Gemini | `useCharacterAssembly.ts` / `sidebarSteps.ts` | cold-start gap discovery | Redundant base race validation checks remain in `useCharacterAssembly.ts` and `sidebarSteps.ts` for elf, goliath, and tiefling despite these being non-selectable base helper races | `useCharacterAssembly.ts:293-296`, `sidebarSteps.ts:52-55` | Leads to dead code and unnecessary validation maintenance for helper classes that are never selected by the user | Removed redundant base-race checks from `useCharacterAssembly.ts` and `sidebarSteps.ts` | Vitest and compiler checks pass after removal |
| G19 | done | adjacent_follow_up | Gemini | `characterReducer.ts` / `RacialRestChoiceData` | cold-start gap discovery | TypeScript and mapping error in `characterReducer.ts` rest choices: `RacialRestChoiceData` lacks `weaponIds` and the rest reducer maps skill choices to malformed `Skill` objects lacking `id`/`ability` | `types/character.ts:473-480`, `characterReducer.ts:626-628,638,644` | Causes TypeScript compiler check failures and corrupts the character's skill list on rest choice resolution | Added `weaponIds` to `RacialRestChoiceData` and look up the full `Skill` object from `SKILLS_DATA` inside the rest reducer mapping function | `npm run typecheck` passes; long rest resolves and successfully applies skill/weapon choices on characters |
| G20 | done | adjacent_follow_up | Codex | `skillSelectionUtils.test.ts` | G18/G19 verification pass | Current test now checks bugbear Sneaky and human Skillful under matching race ids | The stale gap no longer reproduces in this checkout | Closed 2026-06-24 from current-state proof; no code change needed | `npm exec vitest run src/components/CharacterCreator/utils/__tests__/skillSelectionUtils.test.ts` passes |

## Update Rules

- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/character-creator/GAPS.md`.
- For cross-project or out-of-project artifacts, prefer routing to `docs/projects/GLOBAL_GAPS.md`.
