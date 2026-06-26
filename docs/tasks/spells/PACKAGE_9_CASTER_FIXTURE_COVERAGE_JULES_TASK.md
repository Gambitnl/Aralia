# Package 9 Jules Task: Higher-Level Caster Fixture Coverage

Status: historical Package 9 replacement packet; PR #1043 merged on 2026-05-25.

This packet promotes tracker gap `G3` into the next non-overlapping Spell Phase
1 candidate. Package 8 has now merged, so fixture coverage for level 2 and
level 3 spell testing is the next sequential package. Keep this package
separate from the already-merged Package 8 Bless/Bane runtime files.

## Worker

Default worker: Jules, through a replacement visible Symphony/Jules handoff
path from current `origin/master`.

Codex role: foreman. Codex owns sequencing, dashboard handoff, PR review,
verification, decision reporting, and tracker updates. Jules should own the
implementation-heavy fixture audit, manifest shape, fixture data, and focused
tests once this package is dispatched.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package9-caster-fixture-coverage`

Optional Codex review/repair branch:

- `codex/spells-package9-caster-fixture-coverage-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package9-caster-fixture-coverage`

## Goal

Make the combat simulator able to test level 2 and level 3 spell behavior from
legal caster fixtures without corrupting the default level 1 premade party.

Current evidence:

- `public/premade-characters/manifest.json` lists 13 normal premades, one per
  class, and every listed character is level 1.
- The level 1 caster premades have level 1 spell slots only; their level 2 and
  level 3 slot maxima are `0`.
- `EARLY_GAME_SPELL_EXECUTION_PLAN.md` requires the default party to stay a
  legal level 1 class spread and recommends additional level 3 and level 5
  caster variants for spell testing.
- Tracker gap `G3` records that higher-level caster fixtures for level 2 and
  level 3 spell testing still need a roster design decision.

The package should add a conservative fixture path for higher-level spell
testing while preserving the normal starting roster.

## Replacement Context

The first Package 9 Jules path is stale and must not be used as the new base:

- stale Jules session: `236577711126494484`
- stale PR: #1030
- last stale PR head: `dc8b412fb72d8dcdcd4caf92250c03b7ab4ca3d8`
- decision packet: `PACKAGE_9_STALE_PR_REPLACEMENT_DECISION.md`

The replacement attempt should start from current `origin/master`, not from the
stale PR branch. Carry forward only the useful lessons:

- keep tracker rows aligned with the current master tracker and never mark the
  package complete before foreman review and merge;
- prove manifest discoverability against the real
  `public/premade-characters/manifest.json`, not only a mocked two-character
  manifest;
- prove combat reachability through `createPlayerCombatCharacter` or the
  current combat conversion layer for representative level 2 and level 3 spells;
- do not include UI files, Symphony runtime/source files, GitHub workflow edits,
  generated reports, or temporary conflict helper scripts in the final PR.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`
- `public/premade-characters/manifest.json`
- `public/premade-characters/*.json`
- `src/services/premadeCharacterService.ts`
- the party editor, premade picker, combat simulator, and nearest premade
  fixture tests

## Allowed Write Scope

Jules may edit:

- `public/premade-characters/manifest.json`
- new or updated fixture files under `public/premade-characters/`
- `src/services/premadeCharacterService.ts` only for manifest metadata or loader
  support needed to distinguish normal premades from dev/test fixtures
- focused tests or audit scripts that prove fixture legality and loader behavior
- this packet or the living tracker with concise completion notes

Jules should not edit:

- `src/components/Party/PartyEditorModal.tsx` or other UI files unless Jules
  pauses first and explains why manifest/fixture/service/test changes cannot
  satisfy the package
- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, generated manifests, draft IDs, click receipts, or
  other orchestration state
- GitHub workflow files
- temporary conflict helper scripts such as `resolve.js` or `resolve.cjs`
- Package 8 Bless/Bane files or roll-runtime files; PR #1020 has already
  landed and should remain closed unless fixture work reveals a separate,
  tracker-worthy follow-up
- levels 4-9 spell data
- broad character creator or spellbook UI unrelated to fixture loading
- broad AI arbitration policy
- generated gate reports when the only change is timestamp churn

## Required Work

1. Reconfirm the current premade manifest and caster fixture state from the
   files above.
2. Preserve the default level 1 party semantics: the existing 13 class premades
   should remain normal starting-party choices.
3. Choose the smallest durable fixture exposure model:
   - manifest metadata that marks fixtures as normal, dev/test, or
     simulator-only;
   - a dedicated dev combat roster; or
   - a simulator-only fixture loader.
4. Add enough legal caster fixtures to test level 2 and level 3 spell behavior
   without giving any caster every spell.
5. Make fixture spellbooks honest:
   - cantrips should be class-appropriate;
   - known/prepared spell counts should fit the current app rule model;
   - spell slots should match the fixture level;
   - prepared spells should be a bounded subset of available spells.
6. Keep equipment, AC, hit points, spellcasting ability, and combat conversion
   functional for the added fixtures.
7. Add focused verification that:
   - normal level 1 premades still load;
   - dev/test fixtures are discoverable through the chosen fixture path;
   - at least one level 2 spell and one level 3 spell can be reached from a
     legal fixture in the combat simulator or combat conversion layer;
   - no caster fixture is loaded with the whole class spell list as prepared.
8. Record residual limitations in the tracker instead of widening into every
   remaining spell mechanic.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
```

Add the focused tests created or changed by this package. Candidate areas:

```powershell
npx vitest run src/utils/combat/__tests__/combatUtils_premade.test.ts --reporter=verbose
npx vitest run src/services/__tests__/premadeCharacterService.test.ts --reporter=verbose
```

Use the actual nearest test paths present in the implementation branch. If
exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file.

## Acceptance Criteria

- The normal default party remains a level 1 one-per-class roster.
- Higher-level caster fixtures exist for level 2 and level 3 spell testing.
- Those fixtures are clearly marked as dev/test or simulator-only rather than
  silently becoming normal starting-party members.
- Caster spellbooks remain bounded and legal enough for the app's current rule
  model; no caster receives every spell as prepared.
- The combat simulator or combat conversion layer can load representative
  fixtures with level 2 and level 3 spell slots.
- Focused tests or audits prove the loader/fixture behavior.
- No Package 8 Bless/Bane runtime files or Symphony runtime/source artifacts are
  committed as part of this package.
- No stale PR #1030 branch state, stale tracker rows, or temporary conflict
  helper scripts are carried into the replacement PR.

## Decision Report

Decision point: choose the next non-overlapping package after Package 8 merged,
then choose the replacement path after stale PR #1030 failed to publish a
reviewable repair.

Decision made by Codex foreman: promote `G3` from queued fixture work into
active Package 9 and launch it through the visible Symphony/Jules path. After
PR #1030 became stale/unaccepted, keep Package 9 active and use a replacement
Jules dispatch from current `origin/master` before considering a local port.

Why: all current premades are level 1, so level 2 and level 3 spell testing
still lacks legal caster fixtures. This package is product-relevant, does not
overlap the now-merged Package 8 Bless/Bane write scope, and can be delegated to
Jules because the sequential boundary is clear.

Artifact boundary:

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_9_CASTER_FIXTURE_COVERAGE_JULES_TASK.md","sha256WithoutMarker":"2ea306c9bb41665a15b3c5be06fdf3115f2417cecb31f3978e3b77be4a382636","markedAtUtc":"2026-06-25T22:29:38.368Z"} -->
