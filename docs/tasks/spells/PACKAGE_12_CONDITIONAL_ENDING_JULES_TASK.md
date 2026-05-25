# Package 12 Jules Task: Conditional Endings

Status: draft package packet for the next Jules-preferred mechanics slice.

This packet promotes tracker gap `G115` into a bounded implementation task. It
exists because Package 11 closed the representative `status_or_state_change`
slice, and the execution plan lists `conditional_ending` as the next mechanics
bucket after `choice_or_mode`, `attack_or_save_modifier`,
`target_filter_or_eligibility`, and `status_or_state_change`.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, decision reporting, and tracker updates.
Jules should own the implementation-heavy spell data, smallest reusable runtime
bridge, and focused tests for the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package12-conditional-ending`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package12-conditional-ending-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package12-conditional-ending`

## Goal

Make a representative cantrip/level 1-3 subset of conditional-ending spell
rules mechanically visible and testable instead of leaving those rules in prose
only.

This package should focus on early spell effects that end, transfer, suppress,
or expire before their normal duration because a concrete condition occurs. It
does not need to close every open `conditional_ending` row in one PR. Prefer a
small, honest runtime bridge plus representative proof over a wide but shallow
data sweep.

Representative families to cover:

- Transfer-on-defeat: a mark or curse can move to a new target after the current
  target drops to 0 Hit Points.
- Temporary suppression: an instantaneous spell creates a timed suppression or
  temporary ending for another effect.
- Escape or attention break: a target can end a mental/probing effect through a
  later save, check, action, range break, or total-cover condition.
- Delivery/route failure: a messenger, summoned helper, or created agent loses
  the task if a duration or destination rule fails.

Candidate early-game rows from the current bucket evidence:

- Level 1: `hex::conditional_ending`,
  `hunters-mark::conditional_ending`.
- Level 2: `animal-messenger::conditional_ending`,
  `detect-thoughts::conditional_ending`,
  `knock::conditional_ending`.
- Level 3: choose a small representative only if inspection shows it stays
  within conditional-ending behavior and does not broaden into terrain,
  summon/control, vision/light, social AI arbitration, or trap-authoring scope.

Jules should pick a bounded representative subset from those rows, implement
the shared model needed to prove it, and record any residual rows left for
later.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/conditional_ending.md`
- relevant spell JSON files under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest existing ability/combat/spell-validation tests

Current evidence to preserve:

- Runtime JSON already has `effects[].conditionalEndings` in many spells. Reuse
  that field if it can represent the selected rows honestly.
- Several earlier packages intentionally avoided conditional-ending work when it
  overlapped with status, terrain, light/vision, or summon/control systems. Keep
  those broader rows as residual work unless the selected representative row can
  be proven with a small extension.
- Package 11 added status/condition-removal proof. Do not rework that slice
  unless a conditional-ending test needs to read the existing status data.

## Allowed Write Scope

Jules may edit:

- selected conditional-ending spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/conditional_ending.md` only to
  mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` only for the smallest typed extension needed to
  represent reusable conditional-ending facts
- spell factory, ability factory, effect command, or combat helpers only where
  they are the narrow runtime bridge for the selected rows
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
- broad summon/control, terrain, light/vision, social manipulation, trap/glyph,
  or object-state systems unless a tiny conditional-ending field is unavoidable
  for the selected row
- combat HUD/rider-icon UI; record that as a later visual-follow-up if noticed
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `conditional_ending` bucket rows and selected spell
   JSON files before editing.
2. Choose a bounded representative subset from the level 1-3 candidate rows.
   Include at least one transfer-on-defeat or temporary-suppression row. Include
   one escape/attention-break row only if it can be represented without broad AI
   or social-arbitration work.
3. Reuse existing `conditionalEndings` data where possible before adding new
   types.
4. Make the runtime bridge consume or expose that data enough for focused tests
   and future combat/spellbook surfaces to use it honestly.
5. Update the selected spell JSON files with explicit conditional-ending data.
6. Add focused tests proving that the selected rows carry the intended
   conditional-ending facts through the data/runtime path.
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

- At least one level 1-3 conditional-ending row is represented by explicit data
  or a runtime bridge instead of prose only.
- Existing `conditionalEndings` data is preserved and reused where it fits.
- Focused tests prove the selected rows expose the new conditional-ending data
  through the intended runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The bucket tracker or completion note honestly distinguishes closed rows from
  residual rows.
- No Symphony runtime/source/local-state artifacts are committed.

## Decision Report

Decision point: choose the next package after Package 11 merged.

Decision made by Codex foreman: promote `conditional_ending` into Package 12
and delegate it to Jules first.

Why: the execution plan sequences conditional endings after the completed
representative choice/mode, attack/save modifier, target-filter/eligibility,
and status/state-change mechanics slices. The current bucket report lists 54
open findings, including early-game level 1-3 rows that can be represented as a
bounded data/runtime proof without entering levels 4-9 or broad UI work.

Artifact boundary:

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.
