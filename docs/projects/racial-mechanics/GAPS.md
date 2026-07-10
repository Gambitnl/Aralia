---
schema_version: 1
gap_schema: project_gap_registry
project: Racial Mechanics / Race Hierarchy
slug: racial-mechanics
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-23"
gap_count: 16
open_gap_count: 14
resolved_gap_count: 2
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/racial-mechanics/NORTH_STAR.md
tracker: docs/projects/racial-mechanics/TRACKER.md
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
# Racial Mechanics / Race Hierarchy Gap Registry

Status: active
Last updated: 2026-06-23

Iteration note: this docs-only pass opened no new project-local gaps; the only new ambiguity was workflow-level and is recorded in shared `WORKFLOW_GAPS.md`.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| RM-038 | in_progress | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Race glossary entries may use outdated 2014 trait descriptions instead of the 2024 versions. | User request | Inconsistent or outdated flavor/rules text in the glossary confuses players and diverges from the 2024 core rules alignment. | Audit all race glossary entries under `public/data/glossary/entries/races/` and update to 2024 versions. Core species updated. | Verification check against 2024 source material. |
| RM-SYNC-001 | open | support_needed_now | Codex | TRACKER.md | 2026-06-01 | Systemic sync gap between `src/data/races/*.ts` and `public/data/glossary/entries/races/*.json`. | Observed during RM-038; some races have 2024 JSON but legacy TS. | Discrepancies between what the player reads (glossary) and how the game functions (source data) leads to mechanical bugs. | Audit all races for TS/JSON alignment and establish a single source of truth or a sync protocol. | Verify alignment after RM-038. |
| RM-ORC-002 | open | support_needed_now | Codex | TRACKER.md | 2026-06-01 | Orc missing Powerful Build trait in original `src/data/races/orc.ts` (Fixed in TS, need to ensure parser handles it). | 2024 PHB vs `orc.ts` | Discrepancy between 2024 core rules and game data. | Ensure Powerful Build is correctly parsed and applied to carrying capacity. | Verify carrying capacity calculation for Orcs. |
| RM-040 | open | adjacent_follow_up | UI | Character Sheet | 2026-06-02 | Dragonborn Breath Weapon UI lacks visual distinction for area shapes (Cone vs Line) or damage types beyond plain text. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx` | Player immersion is reduced when high-impact racial features are purely text-based. | Implement icon-based or color-coded display for Breath Weapon properties. | UI visual audit. |
| RM-041 | open | adjacent_follow_up | State | Reducer | 2026-06-02 | No mechanism exists to manually end "Draconic Flight" or other duration-based racial status effects before a rest. | `src/state/reducers/characterReducer.ts` | While mostly beneficial, some scenarios (e.g., anti-flight zones) might require manually ending the effect. | Add a "Dismiss Status Effect" action to allow manual termination of temporary racial states. | Test manual toggle in UI. |
| RM-042 | open | adjacent_follow_up | Docs | Glossary | 2026-06-02 | Glossary entry descriptions for many races still contain 2014 text (e.g., mentioning 25ft speed) even when game data is modernized. | `public/data/glossary/entries/races/*.json` | Discrepancies between rules text and game mechanics cause player confusion. | Perform systemic content audit of race glossary JSONs to align with 2024 standards. | Compare glossary speed text with game data speed for all races. |
| RM-043 | open | adjacent_follow_up | Docs | Glossary | 2026-06-02 | `modernizationStatus` flag is missing from static glossary JSON files, preventing indicators from appearing in the glossary. | `public/data/glossary/entries/races/*.json` | UI indicators for rule versions are inconsistent if not supported by the underlying glossary data. | Propagate `modernizationStatus` to all relevant race glossary JSON files. | Verify indicator visibility in glossary for all modernized races. |
| RM-044 | resolved | adjacent_follow_up | Codex | Character Utils | 2026-06-02 | `calculateCharacterSpeedFromRace` contains hardcoded speed overrides (e.g., Wood Elf 35ft) that bypass the race file's `traits` array. | `src/utils/character/characterUtils.ts:1347`; board-reconciled 2026: task "W3-P1: Move hardcoded racial speed overrides into race data; unify racial-resource-id generation" — src/utils/character/characterUtils.ts only. RM-044: replaced hardcoded wood_elf speed=35 block in calculateCharacterSpeedFromRace with data-driven read of chosen elven lineage's speedIncrease benefit; standalone wood_elf/half_elf_wood already carry 'Speed: 35 feet' trait so need no override; no src/data/races edits needed (data already present). RM-045: added overloaded resolveRacialResourceId('feature'|'spell',...) helper; resolveRacialSpellLimitedUseId now delegates to it; L1041 trait-resource key now uses it. Output strings byte-identical so persisted saves/lookups unaffected; self-reviewed against existing tests (characterUtils/orcRacialTraits/regression_RM-CRASH-001) which all use the unchanged literal formats. | Hardcoded logic makes the system fragile and difficult to modernize via data-only changes. | Move specialized speed logic into the race data files (e.g., `speedOverride` field) and update the calculator. | Verify speed parser results match data overrides. |
| RM-045 | resolved | adjacent_follow_up | Codex | Character Utils | 2026-06-02 | Racial resource ID generation is inconsistent (some use `racial_feature_<id>`, others `racial_<race>_<spell>`), creating brittle lookup paths. | `src/utils/character/characterUtils.ts`; board-reconciled 2026: task "W3-P1: Move hardcoded racial speed overrides into race data; unify racial-resource-id generation" — src/utils/character/characterUtils.ts only. RM-044: replaced hardcoded wood_elf speed=35 block in calculateCharacterSpeedFromRace with data-driven read of chosen elven lineage's speedIncrease benefit; standalone wood_elf/half_elf_wood already carry 'Speed: 35 feet' trait so need no override; no src/data/races edits needed (data already present). RM-045: added overloaded resolveRacialResourceId('feature'|'spell',...) helper; resolveRacialSpellLimitedUseId now delegates to it; L1041 trait-resource key now uses it. Output strings byte-identical so persisted saves/lookups unaffected; self-reviewed against existing tests (characterUtils/orcRacialTraits/regression_RM-CRASH-001) which all use the unchanged literal formats. | Inconsistent naming conventions lead to "undefined" lookup crashes and maintainability debt. | Implement a unified `resolveRacialResourceId` helper and migrate all paths to use it. | Verify resource tracking for both traits and spells. |
| RM-GG5-001 | resolved | in_scope_now | GLOBAL_GAPS.md (GG-5) | Selecting a race and class that grant overlapping skill proficiencies does not offer alternate skill choices or perform deduplication. | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Breaks D&D 2024 PHB rules, leading to redundant proficiencies. | Implement skill proficiency deduplication and alternate choice selection. | Implemented custom selection pool expansion and background skill indicators, verified in UI and tests 2026-06-23. |
| RM-GG6-001 | open | in_scope_now | GLOBAL_GAPS.md (GG-6) | "Powerful Build" trait (Orc, Goliath) is not wired into carrying capacity or encumbrance logic. | `src/types/character.ts` (modifier exists), `src/utils/characterUtils.ts` (logic missing) | Racial traits affecting physical capability have no mechanical impact on inventory/encumbrance systems. | Update carrying capacity calculation to check for `powerfulBuild` modifier. | Inventory weight capacity tests. |
| RM-GG7-001 | resolved | in_scope_now | GLOBAL_GAPS.md (GG-7) | `CharacterOverview.tsx` only displays a single base `Speed` value, failing to show `Flying`, `Swimming`, or `Climbing` speeds. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx:243` | 2024 races (Dragonborn, Sea Elf) rely on alternate movement speeds which are currently invisible in the UI. | Update Vitals section to display all movement speeds from the character state. | Implemented alternate speed calculations in characterUtils and side-by-side display in CharacterOverview, checked 2026-06-23. |
| RM-GG9-001 | open | in_scope_now | GLOBAL_GAPS.md (GG-9) | Racial condition immunities (e.g., Yuan-ti's immunity to the Poisoned condition) are not automatically enforced when effects are applied. | `src/state/reducers/characterReducer.ts` (status effect logic) | Mechanical benefits of certain races are ignored by the automated status effect systems. | Update status effect application logic to check character immunities before applying conditions. | Test applying 'poisoned' to a Yuan-ti character. |
| RM-LR-CHOICE-003 | untriaged | in_scope_now | Codex | TRACKER.md | 2026-06-03 | The `LongRestModal` does not currently prompt for spells when a racial trait grants a choice of spell on long rest (e.g., future races or variants). | `LongRestModal.tsx` | Spell choices during rests are a common mechanic that is currently unsupported by the generic rest choice UI. | Add support for spell selection in `RacialRestChoice` and the `LongRestModal` UI. | Verify a character can choose a spell during a long rest and have it added to their prepared list. |
| RM-SAVE-001 | resolved | adjacent_follow_up | Codex | Combat Utils | 2026-06-03 | `rollSavingThrow` lacks context (e.g. damage type, effect type) needed to resolve contextual saves like "advantage on saving throws against poison". | `src/utils/character/savingThrowUtils.ts`; board-reconciled 2026: task "W3-P2: Add optional effectContext to rollSavingThrow + structured advantage modifiers (backward-compatible)" — savingThrowUtils.ts,savingThrowUtils.test.ts; added SaveEffectContext + SaveAdvantageModifier interfaces, appended optional effectContext & structuredModifiers params to rollSavingThrow (backward-compatible), precise ability+context matching, legacy 'against X' strings now narrow only when effectContext supplied; 7 new tests cover RM-SAVE-001/002; self-reviewed, existing tests unaffected (new params default undefined) | Contextual saving throws currently apply too broadly to all saving throws if we aren't careful. | Thread `effectContext` into `rollSavingThrow` for precise advantage matching. | Unit test verifying advantage applies ONLY to poison effects. |
| RM-SAVE-002 | resolved | adjacent_follow_up | Codex | Combat Utils | 2026-06-03 | Advantage modifiers are stored as loose strings (e.g. "advantage on Intelligence saving throws") leading to brittle regex matching. | `src/utils/character/savingThrowUtils.ts`; board-reconciled 2026: task "W3-P2: Add optional effectContext to rollSavingThrow + structured advantage modifiers (backward-compatible)" — savingThrowUtils.ts,savingThrowUtils.test.ts; added SaveEffectContext + SaveAdvantageModifier interfaces, appended optional effectContext & structuredModifiers params to rollSavingThrow (backward-compatible), precise ability+context matching, legacy 'against X' strings now narrow only when effectContext supplied; 7 new tests cover RM-SAVE-001/002; self-reviewed, existing tests unaffected (new params default undefined) | String matching for saving throw advantage fails if phrasing varies slightly. | Replace string array with structured modifier objects (e.g. `{ type: 'advantage', context: 'saving_throw', abilities: ['Intelligence'] }`). | Unit test with structured modifier objects. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for the current objective. |
| `support_needed_now` | Needed to continue safely even if not core mechanics. |
| `adjacent_follow_up` | Useful adjacent work that should remain tracked without blocking current slice. |
| `out_of_scope` | Real but not part of the current project objective. |
| `blocked_human_decision` | Requires user/operator policy choice. |
| `blocked_external_state` | Requires another team, system, or external dependency. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
