---
schema_version: 1
gap_schema: project_gap_registry
project: Character Creator
slug: character-creator
status: "active (G2 resolved 2026-06-08; no pending review hold â€” confirmed in the 2026-06-10 decision blitz housekeeping pass)"
status_note: "G5 flow assertion hardening resolved on 2026-06-25 with focused headed Playwright proof of final gameplay state."
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 17
open_gap_count: 5
resolved_gap_count: 12
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/character-creator/NORTH_STAR.md
tracker: docs/projects/character-creator/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Character Creator Gap Registry

Status: active (G2 resolved 2026-06-08; no pending review hold â€” confirmed in the 2026-06-10 decision blitz housekeeping pass)
Last updated: 2026-06-25

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Uncertainty |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/character-creator/TRACKER.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (registry row) | The registry explicitly leaves wizard finalization behavior as unfinished | Move to project execution tasks when implementation resumes | Project-level validation checklist + acceptance criteria |
| G3 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/CharacterCreator.README.md` / `docs/architecture/domains/character-creator.md` / `docs/tasks/feature-capabilities/character-creator.md` | discovery pass | Source docs have historical drift about pathing and flow assumptions | Prevents wrong assumptions during future rewrites or maintenance | Perform doc harmonization before relying on architecture claims in planning | Consistency pass across these docs |
| G4 | resolved | adjacent_follow_up | Codex | `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` | test audit | Lint-intent TODOs for intentionally unused aliases existed in flow test | Maintained technical debt risk if lint/quality gating is tightened later | Resolved 2026-06-25: removed unused alias imports and refreshed the Changeling flow test to select required size before confirmation | `npm exec vitest run src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` passes |
| G5 | resolved | support_needed_now | Codex | `tests/character-creator-flow.spec.ts` | coverage audit | E2E Playwright flow was screenshot-heavy and lacked robust assertions on final game state | Resolved 2026-06-25: Human Fighter flow now clears stale browser run state, selects concrete Human/Soldier/Fighter choices, clicks the exact `Begin Adventure!` final-submit button instead of sidebar `(completed)` rows, and asserts visible `game-layout`, `action-pane`, `world-pane`, plus `window.__araliaState` phase `PLAYING`, party size 1, and party name `Sir Testalot` | Prevents screenshot capture from masking a failed creator-to-game handoff | Closed after focused headed Playwright proof | `npx playwright test tests/character-creator-flow.spec.ts -g "Complete Human Fighter creation flow" --project=chromium --headed` passes; before/after proof is centralized under `.agent/scratch/proof/character-creator/flow-assertions/` |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G8 | Code modularization audit routing | Character/race creation files are large split candidates | `src/utils/character/characterUtils.ts`; `src/data/races/racialTraits.ts`; `src/components/CharacterCreator/Race/RaceDetailPane.tsx` | Splitting trait derivation or race presentation should follow defined boundaries. | Define trait derivation and race presentation proof boundaries before any split | `src/utils/character/__tests__/characterUtils.test.ts` plus character-creator navigation decision before any split |
| G7 | resolved | in_scope_now | Codex | `docs/projects/character-creator/GAPS.md` | cold-start gap discovery | Test in CreationSidebar.test.tsx used `CreationStep.FeatSelection` alias but sidebar only shows 'Racial Feat' for human race | The test referenced a step that is not visible in initial state and used an outdated alias; it now validates actual sidebar step labels | Resolved 2026-06-24: sidebar test proves `Racial Feat` is hidden before human lineage selection and navigates to `CreationStep.RacialFeatSelection` once a human race is selected | `npm exec vitest run src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx` passes |
| G8 | resolved | adjacent_follow_up | Codex | `src/components/CharacterCreator/config/sidebarSteps.ts` / `src/components/CharacterCreator/CharacterCreator.tsx` | cold-start gap discovery | `StepLockedPlaceholder` messages were hardcoded strings scattered across `CharacterCreator.tsx` renderStep switch cases | Centralized `LOCKED_STEP_MESSAGES` and `getLockedStepMessage` now own the placeholder wording with typed keys in sidebar step config | Keeps permissive sidebar navigation easier to maintain without changing visible player guidance | Resolved 2026-06-25: extracted every lock/review/no-extra-features message to sidebar config and updated `CharacterCreator.tsx` to reference typed keys/helpers | `npm exec vitest run src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx`; `npm run projects:audit`; dependency sync for `src/components/CharacterCreator/config/sidebarSteps.ts` | None |
| G14 | resolved | adjacent_follow_up | Codex | `CreationSidebar.tsx` progress counter + default-completed steps | 20-character flow audit | Progress counter jumped erratically because steps with defaults (Appearance, Age) were pre-marked complete before being visited, and conditional steps re-based the denominator (observed 1/8 -> 3/10 -> 5/11 across three confirms) | `src/components/CharacterCreator/CreationSidebar.tsx`; `src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx` | "Steps complete" stopped being a trustworthy progress signal; completing one step appeared to complete several | Resolved 2026-06-25: footer progress now counts completed visible steps only when their step is at or before the active wizard step, preserving default values without crediting future steps | `npm exec vitest run src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx` passes and proves Human at Race reports `1 / 10 steps complete` | Counter-only fix preserved the defaults-are-fine design decision |
| G15 | resolved | adjacent_follow_up | Codex | `SkillSelection.tsx` | 20-character flow audit | Class skill list badged racially-granted skills ("Racial") but not background-granted ones; Sage grants Arcana/History and those rows needed visible source feedback | High Elf Wizard (#2), Halfling Rogue (#7) runs 2026-06-11; `src/components/CharacterCreator/SkillSelection.tsx`; `src/components/CharacterCreator/SkillSelection.test.tsx` | Double-picking a background skill wasted a class skill choice with no warning (same family as G12) | Resolved 2026-06-25: auto-granted class skills remain visible as disabled/badged rows while replacement choices expand from the wider skill pool | `npm exec vitest run src/components/CharacterCreator/SkillSelection.test.tsx` passes and proves Sage + Wizard Arcana/History rows show `Background` without increasing `Selected: 0 / 2` | None |
| G16 | resolved | adjacent_follow_up | Codex | `src/components/ui/SpellSummaryCard.tsx`; `src/components/CharacterCreator/Class/SpellCard.tsx`; `src/components/CharacterCreator/FeatSpellPicker.tsx`; `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx` | 20-character flow audit + UI drift comparison | Three unrelated spell-card designs: (a) class spell selection, checkbox cards with school/component/time/range/effect facts; (b) feat picker, expandable spell rows with different icon/header treatment; (c) in-game spellbook, list rows plus separate detail pane. Same domain object, three visual languages | Shared `SpellSummaryCard` now backs the class spell card wrapper, Magic Initiate feat picker rows, and the character-sheet spellbook list; focused tests pass 33/33; rendered proof exists for Wizard class spell selection, Magic Initiate spell rows, and a browser-mounted Character Sheet spellbook list | Players re-learned how to read a spell three times; future spell-UI changes had to be made in three places | Resolved 2026-06-25: adopted the shared spell summary component in all three surfaces and captured rendered proof for each surface | `.agent/scratch/g16-class-spell-surface.png`, `.agent/scratch/g16-magic-initiate-spell-rows.png`, `.agent/scratch/g16-spellbook-list.png`; focused tests pass 33/33 | Browser proof for the spellbook list used an ignored Vite scratch page mounting the real `SpellbookTab.tsx` with Elara Vance because dev quick-start depends on unavailable local party generation in this environment |
| G17 | resolved | adjacent_follow_up | Codex | `WeaponMasterySelection.tsx` + weapons data | 20-character flow audit | "Rusty Sword" (a junk/starter item) appeared in the Weapon Mastery pool alongside real weapon types; mastery detail pane was hover-only ("Hover over an item for details") which was unusable on touch and undiscoverable | Weapon Mastery step run 2026-06-11 (Fighter #1); local proof 2026-06-25 | Junk items in a build-defining list looked unpolished; hover-only details hid the mastery rules | Resolved 2026-06-25: mastery eligibility now uses the current `category` field, excludes only the legacy `rusty_sword` duplicate from the selector while preserving item data, and exposes details through hover, focus, or tap/click | `npm exec vitest run src/components/CharacterCreator/WeaponMasterySelection.test.tsx` passes and proves Rusty Sword is absent while Longsword/Greataxe details are reachable by focus/click | None |
| G18 | resolved | adjacent_follow_up | Gemini (focus on racial traits) | `useCharacterAssembly.ts` / `sidebarSteps.ts` | cold-start gap discovery | Redundant base race validation checks remain in `useCharacterAssembly.ts` and `sidebarSteps.ts` for elf, goliath, and tiefling despite these being non-selectable base helper races | `useCharacterAssembly.ts:293-296`, `sidebarSteps.ts:52-55` | Leads to dead code and unnecessary validation maintenance for helper classes that are never selected by the user | Remove redundant base-race checks from `useCharacterAssembly.ts` and `sidebarSteps.ts` | Vitest and compiler checks pass after removal | None |
| G19 | resolved | adjacent_follow_up | Gemini (focus on racial traits) | `characterReducer.ts` / `RacialRestChoiceData` | cold-start gap discovery | TypeScript and mapping error in `characterReducer.ts` rest choices: `RacialRestChoiceData` lacks `weaponIds` and the rest reducer maps skill choices to malformed `Skill` objects lacking `id`/`ability` | `types/character.ts:473-480`, `characterReducer.ts:626-628,638,644` | Causes TypeScript compiler check failures and corrupts the character's skill list on rest choice resolution | Add `weaponIds` to `RacialRestChoiceData` and look up the full `Skill` object from `SKILLS_DATA` inside the rest reducer mapping function | `npm run typecheck` passes; long rest resolves and successfully applies skill/weapon choices on characters | None |
| G20 | resolved | adjacent_follow_up | Codex | `skillSelectionUtils.test.ts` | G18/G19 verification pass | The unit test `deriveRacialSkillGrants returns expected sources and ids` previously queried a human skill choice from a non-human `raceId` (bugbear) and expected it to be granted, which failed under proper raceId constraints | `src/components/CharacterCreator/utils/__tests__/skillSelectionUtils.test.ts:48-66` now checks bugbear Sneaky and human Skillful separately | Prevented skillSelectionUtils unit tests from passing successfully without mock bypasses | Resolved as already-current 2026-06-24: current test queries Skillful with `raceId: 'human'`, preserving the raceId constraint | `npm exec vitest run src/components/CharacterCreator/utils/__tests__/skillSelectionUtils.test.ts` passes | None |
| G21 | resolved | adjacent_follow_up | Antigravity | Character Creator Feats selection | Combat System Durations (2026-06-02) | The Character Creator allows selecting feats (e.g., "War Caster") without verifying if the character meets prerequisites like spellcasting capability or level thresholds. | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Permits illegal character builds violating D&D 2024 PHB rules, breaking mechanical integrity. | Implement prerequisite checking in the feat selection module. | Checked spellcasting prerequisite during creation feat selection in unit tests. | None |
| G22 | not_started | adjacent_follow_up | Codex | Feat selection and feat-effect contracts | `docs/BACKLOG.md` migration plus feat-plan retirement 2026-06-26 | Remaining feat-selection and feat-effect UI contracts for skill, spell, weapon/tool/instrument/expertise, and damage-type choices need project-owned execution rows instead of preserved task backlog files. | Retired `docs/tasks/feat-implementation-plan.md`, `docs/tasks/feat-ui-implementation-plan.md`, `docs/tasks/feat-system-gaps.md`, and `docs/plans/features/SLASHER_FEAT_DESIGN.md`; `docs/BACKLOG.md`; `src/types/character.ts`; `src/data/feats/featsData.ts`; `src/components/CharacterCreator/FeatSelection.test.tsx`; `src/commands/__tests__/SlasherFeat.test.ts` | Feats can expose selectable metadata without every choice family having visible, validated UI and persisted character effects. Slasher's Strength/Dexterity setup is now covered by focused UI proof, and its combat riders have command-level proof. | Recheck current feat code, then pick one remaining choice family such as damage type, skill expertise, spell choice, or weapon/tool selection for a bounded UI/effect proof. Do not reopen Slasher as a standalone design packet unless current source regresses. | Focused creator tests proving the selected feat choice is visible, required before confirmation, stored in `featChoices`, and reflected in assembled character output. Current Slasher UI proof: `npx vitest run src/components/CharacterCreator/FeatSelection.test.tsx --reporter=dot` passed 1 test. | The old feat markdown backlog files were retired after their still-valid work was folded into this row; the Slasher design note was retired after the remaining STR/DEX UI setup was proven. |
| G23 | not_started | adjacent_follow_up | Codex | Race portrait QA and regeneration | `docs/portraits/race_portrait_regen_backlog.md` retirement 2026-06-25 | Race portrait regeneration still has unresolved visual QA, uniqueness, and regen rows, but the Markdown checklist is no longer the canonical source. | `docs/portraits/race_portrait_regen_backlog.json`; `public/assets/images/races/race-image-status.json`; `scripts/audits/slice-of-life-settings.json` reports 97 rows marked for regen, 166 visual-pending rows, and 61 rows missing observed activity in its current summary. | Character creation relies on race portraits as a first-screen identity signal; stale duplicate checklists make it unclear which image defects are still pending. | Use the JSON backlog seed and slice-of-life QA ledger as the execution source; regenerate or mark rows through the portrait tooling and update the QA ledger rather than editing a Markdown checklist. | Run the portrait QA/regeneration flow, then prove current `slice-of-life-settings.json` summary has fewer pending/regeneration rows and spot-check changed images in the character creator or race preview surface. | Some generated status entries are stale/discarded; trust the current QA ledger over the deleted human-readable checklist. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for this slice to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of retaining them here.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
