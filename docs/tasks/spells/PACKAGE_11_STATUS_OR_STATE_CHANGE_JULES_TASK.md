# Package 11 Jules Task: Status And State Changes

Status: historical Package 11 packet; PR #1072 merged on 2026-05-25.

This packet promotes tracker gap `G105` into a bounded implementation task. It
exists because Package 10 closed the representative target-filter/eligibility
slice, and the execution plan lists `status_or_state_change` as the next
mechanics bucket after `choice_or_mode`, `attack_or_save_modifier`, and
`target_filter_or_eligibility`.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, decision reporting, and tracker updates.
Jules should own the implementation-heavy spell data, smallest reusable runtime
bridge, and focused tests for the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package11-status-state-change`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package11-status-state-change-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package11-status-state-change`

## Goal

Make a representative cantrip/level 1-3 subset of status and state-change spell
rules mechanically visible and testable instead of leaving those rules in prose
only.

This package should focus on the `status_or_state_change` bucket for the
early-game spell band. It does not need to close every open row in that bucket
in one PR if the reusable model gets too broad. Prefer a small, honest runtime
bridge plus representative proof over a wide but shallow data sweep.

Representative families to cover:

- Direct status application: a spell applies a condition such as Poisoned,
  Blinded, Prone, Restrained, Incapacitated, or Unconscious.
- Option-specific status payload: a selected command or mode applies a status,
  such as Command's Grovel option applying Prone.
- Condition removal or staged status progression: a spell ends a condition, or
  a later failed save changes one status into another.

Candidate early-game rows from the current bucket evidence:

- Level 1: `command::manual_grovel_prone_state`,
  `ray-of-sickness::manual_poisoned_until_next_turn`,
  `sleep::status_or_state_change`,
  `snare::status_or_state_change`,
  `tashas-hideous-laughter::status_or_state_change`,
  `unseen-servant::status_or_state_change`.
- Level 2: `blindness-deafness::status_or_state_change`,
  `crown-of-madness::status_or_state_change`,
  `lesser-restoration::status_or_state_change`,
  `protection-from-poison::manual_end_poisoned_condition`,
  `pyrotechnics::status_or_state_change`,
  `web::status_or_state_change`.
- Level 3: select only if it remains small and mechanical after inspection;
  avoid broad summon/control or entity-creation rows unless they are needed to
  prove the status model.

Jules should pick a bounded representative subset from those rows, implement
the shared model needed to prove it, and record any residual rows left for
later.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/status_or_state_change.md`
- relevant spell JSON files under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/types/spellStatusMetadata.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/utils/character/spellAbilityFactory.ts`
- nearest existing status-condition, ability, combat, and spell-validation tests

Current evidence to preserve:

- `StatusConditionEffect.statusCondition`, `StatusCondition.repeatSave`,
  `StatusCondition.breakTriggers`, and `BaseEffect.conditionRemoval` already
  exist. Prefer using these before adding a new shape.
- `Command` already has `controlOptions`, but Grovel currently carries Prone
  only as prose in the option details.
- `Sleep` already has a two-effect Incapacitated-to-Unconscious model with
  repeat-save and break-trigger hints. Do not flatten that staged behavior.
- `Lesser Restoration` and `Protection from Poison` are useful condition-removal
  candidates because the existing type model already has `conditionRemoval`.
- Several bucket rows overlap with summon/control, terrain, vision/light, or
  conditional-ending behavior. Keep Package 11 focused on status/state payloads
  and leave the broader behavior as residual work when needed.

## Allowed Write Scope

Jules may edit:

- status/state-change spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/` for the
  selected representative rows only
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/status_or_state_change.md`
  only to mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` or `src/types/spellStatusMetadata.ts` only for the
  smallest typed extension needed to represent reusable status/state facts
- spell factory, ability factory, status-condition command, or combat helpers
  only where they are the narrow runtime bridge for the selected rows
- focused tests under the nearest existing `__tests__` directories
- package-specific completion notes in this file or the living tracker

Jules should not edit:

- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, dashboard caches, generated manifests, draft IDs,
  click receipts, or local orchestration logs
- GitHub workflow files
- levels 4-9 spell data
- premade roster semantics
- character creator or spellbook UI
- broad AI arbitration policy
- broad summon/control, terrain, light/vision, or conditional-ending systems
  unless a tiny status/state field is unavoidable for this package
- combat HUD/rider-icon UI; record that as a later visual-follow-up if noticed
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `status_or_state_change` bucket rows and selected
   spell JSON files before editing.
2. Choose a bounded representative subset from the level 1-3 candidate rows.
   Include at least one direct status application and one option-specific status
   payload. Include one condition-removal or staged-status row if current code
   evidence shows it can be represented without broadening the package.
3. Reuse existing status fields where possible before adding new types.
4. Make the runtime bridge consume or expose that data enough for focused tests
   and future combat/spellbook surfaces to use it honestly.
5. Update the selected spell JSON files with explicit status/state data.
6. Add focused tests proving that the selected rows carry the intended
   status/state facts through the data/runtime path.
7. Do not mark unimplemented rows closed. If the package only proves a subset,
   document the remaining rows in the completion note and tracker.
8. Run validation and focused tests.
9. Update this packet or the living tracker with the implementation result,
   tests run, behavior proven, and residual limitations.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
```

Add the focused tests created or changed by this package. Use the actual nearest
test paths present in the implementation branch.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file.

## Acceptance Criteria

- At least one direct status application and one option-specific status payload
  from levels 1-3 are represented by explicit data or a runtime bridge instead
  of prose only.
- A condition-removal or staged-status row is represented if it can be done with
  the existing model or a tiny extension.
- Existing useful `statusCondition`, `repeatSave`, `breakTriggers`,
  `conditionRemoval`, and control-option data is preserved.
- Focused tests prove the selected rows expose the new status/state data through
  the intended runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The bucket tracker or completion note honestly distinguishes closed rows from
  residual rows.
- No Symphony runtime/source/local-state artifacts are committed.

## Decision Report

Decision point: choose the next package after Package 10 merged.

Decision made by Codex foreman: promote `status_or_state_change` into Package
11 and delegate it to Jules first.

Why: the execution plan already sequences status/state changes after the
completed choice/mode, attack/save modifier, and target-filter/eligibility
mechanics slices. The bucket has enough level 1-3 findings to matter for
early-game combat and spell testing, but it is still narrow enough for a
representative Jules implementation slice.

Artifact boundary:

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_11_STATUS_OR_STATE_CHANGE_JULES_TASK.md","sha256WithoutMarker":"868db59fbe394e3e95089b062bdc1fa0f1f0bbb109b56a6ad21366084e972c17","markedAtUtc":"2026-06-25T22:29:38.372Z"} -->
